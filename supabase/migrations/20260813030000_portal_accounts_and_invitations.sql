-- Authenticated client and guardian portals with explicit invitations.
-- Portal identities are linked only after the signed-in email claims a matching,
-- unexpired invitation. Logistics policies do not broaden private note access.

create table public.portal_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  relationship_id uuid references public.client_relationships(id) on delete cascade,
  email text not null,
  full_name text not null,
  role text not null check (role in ('client', 'guardian', 'third_party')),
  token uuid not null default gen_random_uuid() unique,
  created_by uuid not null references public.profiles(id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_by uuid references public.profiles(id),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check ((role = 'client' and relationship_id is null) or (role <> 'client' and relationship_id is not null))
);

create index portal_invitations_client_idx
  on public.portal_invitations (client_id, created_at desc);

create table public.scheduling_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete set null,
  requested_by uuid not null references public.profiles(id),
  request_type text not null check (request_type in ('reschedule', 'cancel', 'new_session')),
  requested_starts_at timestamptz,
  message text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'withdrawn')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index scheduling_requests_client_idx
  on public.scheduling_requests (client_id, created_at desc);

create table public.portal_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  subject_type text not null,
  subject_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index portal_audit_events_client_idx
  on public.portal_audit_events (client_id, created_at desc);

alter table public.portal_invitations enable row level security;
alter table public.scheduling_requests enable row level security;
alter table public.portal_audit_events enable row level security;

create policy "members manage portal invitations"
  on public.portal_invitations for all
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "members manage scheduling requests"
  on public.scheduling_requests for all
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "portal users create scheduling requests"
  on public.scheduling_requests for insert
  with check (
    requested_by = auth.uid()
    and (
      public.is_client_self(client_id)
      or exists (
        select 1 from public.client_relationships relationship
        where relationship.client_id = scheduling_requests.client_id
          and relationship.profile_id = auth.uid()
          and relationship.role = 'guardian'
          and relationship.portal_enabled = true
          and coalesce((relationship.permissions ->> 'scheduling')::boolean, false)
      )
    )
  );

create policy "portal users read own scheduling requests"
  on public.scheduling_requests for select
  using (requested_by = auth.uid());

create policy "members read portal audit"
  on public.portal_audit_events for select
  using (public.is_org_member(organization_id));

create policy "members create portal audit"
  on public.portal_audit_events for insert
  with check (public.is_org_member(organization_id));

-- Portal account discovery.
create policy "clients read own client record"
  on public.clients for select
  using (client_profile_id = auth.uid());

create policy "related users read own relationship"
  on public.client_relationships for select
  using (profile_id = auth.uid() and portal_enabled = true);

-- Guardians and care-team members discover only a deliberately narrow client
-- projection. A row-level clients policy would expose sensitive intake columns.
create or replace function public.get_portal_client()
returns table (
  id uuid,
  organization_id uuid,
  assigned_coach_id uuid,
  client_profile_id uuid,
  kind public.client_kind,
  full_name text,
  preferred_name text,
  pronouns text,
  birth_date date,
  email text,
  phone text,
  timezone text,
  status text,
  headline text,
  intake jsonb,
  important_dates jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select client.id, client.organization_id, client.assigned_coach_id,
    null::uuid, client.kind, client.full_name,
    client.preferred_name, client.pronouns, null::date, null::text, null::text,
    client.timezone, client.status, client.headline, '{}'::jsonb, '[]'::jsonb,
    client.created_at, client.updated_at
  from public.clients client
  where exists (
    select 1
    from public.client_relationships relationship
    where relationship.client_id = client.id
      and relationship.profile_id = auth.uid()
      and relationship.portal_enabled = true
      and relationship.role in ('guardian', 'third_party')
  )
  limit 1;
$$;

grant execute on function public.get_portal_client() to authenticated;

-- Session access is logistics-only and remains separate from notes.
create policy "clients read own sessions"
  on public.sessions for select
  using (public.is_client_self(client_id));

create policy "guardians read permitted session logistics"
  on public.sessions for select
  using (
    exists (
      select 1 from public.client_relationships relationship
      where relationship.client_id = sessions.client_id
        and relationship.profile_id = auth.uid()
        and relationship.role = 'guardian'
        and relationship.portal_enabled = true
        and coalesce((relationship.permissions ->> 'scheduling')::boolean, false)
    )
  );

create policy "guardians read selected goals"
  on public.goals for select
  using (
    visibility in ('coach_parent', 'coach_client_parent')
    and exists (
      select 1 from public.client_relationships relationship
      where relationship.client_id = goals.client_id
        and relationship.profile_id = auth.uid()
        and relationship.role = 'guardian'
        and relationship.portal_enabled = true
        and coalesce((relationship.permissions ->> 'progress_updates')::boolean, false)
    )
  );

create policy "clients read assigned resource links"
  on public.resource_assignments for select
  using (
    public.is_client_self(client_id)
    and visibility in ('coach_client', 'coach_client_parent')
  );

create policy "clients read assigned resources"
  on public.resources for select
  using (
    exists (
      select 1 from public.resource_assignments assignment
      where assignment.resource_id = resources.id
        and public.is_client_self(assignment.client_id)
        and assignment.visibility in ('coach_client', 'coach_client_parent')
    )
  );

create or replace function public.get_portal_invitation(invite_token uuid)
returns table (
  invitation_id uuid,
  email text,
  full_name text,
  role text,
  client_name text,
  expires_at timestamptz,
  accepted_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select invitation.id, invitation.email, invitation.full_name, invitation.role,
    client.full_name, invitation.expires_at, invitation.accepted_at
  from public.portal_invitations invitation
  join public.clients client on client.id = invitation.client_id
  where invitation.token = invite_token
    and invitation.revoked_at is null;
$$;

create or replace function public.claim_portal_invitation(invite_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation public.portal_invitations%rowtype;
  signed_in_email text;
begin
  if auth.uid() is null then
    raise exception 'Sign in before accepting this invitation.';
  end if;

  select lower(email) into signed_in_email from auth.users where id = auth.uid();
  select * into invitation
  from public.portal_invitations
  where token = invite_token
  for update;

  if invitation.id is null or invitation.revoked_at is not null then
    raise exception 'This invitation is no longer available.';
  end if;
  if invitation.accepted_at is not null and invitation.accepted_by <> auth.uid() then
    raise exception 'This invitation has already been accepted.';
  end if;
  if invitation.expires_at < now() then
    raise exception 'This invitation has expired.';
  end if;
  if lower(invitation.email) <> signed_in_email then
    raise exception 'Sign in with the email address this invitation was sent to.';
  end if;

  if invitation.role = 'client' then
    update public.clients
      set client_profile_id = auth.uid()
      where id = invitation.client_id
        and (client_profile_id is null or client_profile_id = auth.uid());
    if not found then
      raise exception 'This client portal is already linked to another account.';
    end if;
  else
    update public.client_relationships
      set profile_id = auth.uid(), portal_enabled = true
      where id = invitation.relationship_id
        and (profile_id is null or profile_id = auth.uid());
    if not found then
      raise exception 'This portal relationship is already linked to another account.';
    end if;
  end if;

  update public.portal_invitations
    set accepted_by = auth.uid(), accepted_at = coalesce(accepted_at, now())
    where id = invitation.id;

  insert into public.portal_audit_events (
    organization_id, client_id, actor_profile_id, event_type, subject_type, subject_id,
    metadata
  ) values (
    invitation.organization_id, invitation.client_id, auth.uid(), 'portal_invitation_accepted',
    'portal_invitation', invitation.id, jsonb_build_object('role', invitation.role)
  );

  return invitation.client_id;
end;
$$;

grant execute on function public.get_portal_invitation(uuid) to anon, authenticated;
grant execute on function public.claim_portal_invitation(uuid) to authenticated;

create or replace function public.submit_portal_assignment(
  target_assignment uuid,
  response_value text,
  is_completed boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.assignments%rowtype;
  response_id uuid;
begin
  select * into target
  from public.assignments
  where id = target_assignment
  for update;

  if target.id is null or not public.is_client_self(target.client_id) then
    raise exception 'This assignment is not available to your account.';
  end if;
  if target.visibility not in ('coach_client', 'coach_client_parent') then
    raise exception 'This assignment is not shared with the client.';
  end if;

  insert into public.assignment_responses (
    organization_id, assignment_id, client_id, submitted_by, response_text,
    completed, visibility, submitted_at, updated_at
  ) values (
    target.organization_id, target.id, target.client_id, auth.uid(), coalesce(response_value, ''),
    is_completed, 'coach_client', now(), now()
  )
  on conflict (assignment_id) do update
    set submitted_by = auth.uid(), response_text = excluded.response_text,
      completed = excluded.completed, visibility = 'coach_client',
      submitted_at = now(), updated_at = now()
  returning id into response_id;

  update public.assignments
  set status = case when is_completed then 'completed'::public.assignment_status else 'submitted'::public.assignment_status end,
    submitted_at = now(), completed_at = case when is_completed then now() else null end
  where id = target.id;

  return response_id;
end;
$$;

grant execute on function public.submit_portal_assignment(uuid, text, boolean) to authenticated;

create or replace function public.audit_portal_invitation_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.portal_audit_events (
    organization_id, client_id, actor_profile_id, event_type, subject_type, subject_id,
    metadata
  ) values (
    new.organization_id, new.client_id, new.created_by, 'portal_invitation_created',
    'portal_invitation', new.id, jsonb_build_object('role', new.role, 'email', new.email)
  );
  return new;
end;
$$;

create trigger portal_invitation_created_audit
after insert on public.portal_invitations
for each row execute function public.audit_portal_invitation_created();

create or replace function public.audit_scheduling_request_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.portal_audit_events (
    organization_id, client_id, actor_profile_id, event_type, subject_type, subject_id,
    metadata
  ) values (
    new.organization_id, new.client_id, new.requested_by, 'scheduling_request_created',
    'scheduling_request', new.id, jsonb_build_object('request_type', new.request_type)
  );
  return new;
end;
$$;

create trigger scheduling_request_created_audit
after insert on public.scheduling_requests
for each row execute function public.audit_scheduling_request_created();

create or replace function public.audit_assignment_response_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.portal_audit_events (
    organization_id, client_id, actor_profile_id, event_type, subject_type, subject_id,
    metadata
  ) values (
    new.organization_id, new.client_id, auth.uid(), 'assignment_response_updated',
    'assignment_response', new.id, jsonb_build_object('completed', new.completed)
  );
  return new;
end;
$$;

create trigger assignment_response_changed_audit
after insert or update on public.assignment_responses
for each row execute function public.audit_assignment_response_changed();

comment on table public.portal_invitations is
  'Expiring, email-bound links that connect an authenticated profile to one client or relationship.';
comment on table public.portal_audit_events is
  'Records portal invitations, acceptance, scheduling requests, and client submissions without storing private note content.';
