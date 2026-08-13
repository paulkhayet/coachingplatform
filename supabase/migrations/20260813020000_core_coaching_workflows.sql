-- Core client/session/assignment workflows.
-- Guardian automation applies only to assignment logistics; responses remain separately permissioned.

alter table public.client_relationships
  add column if not exists automatic_assignment_updates boolean not null default false;

alter table public.assignments
  add column if not exists response_type text not null default 'checkbox'
    check (response_type in ('checkbox', 'text')),
  add column if not exists guardian_share_setting text not null default 'client_default'
    check (guardian_share_setting in ('client_default', 'share', 'private')),
  add column if not exists reviewed_at timestamptz;

create table if not exists public.assignment_responses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assignment_id uuid not null unique references public.assignments(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  submitted_by uuid references public.profiles(id) on delete set null,
  response_text text not null default '',
  completed boolean not null default false,
  visibility public.visibility_level not null default 'coach_client',
  submitted_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists assignment_responses_client_idx
  on public.assignment_responses (client_id, updated_at desc);

alter table public.assignment_responses enable row level security;

create policy "members manage assignment responses"
  on public.assignment_responses for all
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "clients manage their assignment responses"
  on public.assignment_responses for all
  using (public.is_client_self(client_id))
  with check (public.is_client_self(client_id));

create policy "guardians read explicitly shared assignment responses"
  on public.assignment_responses for select
  using (
    public.is_client_guardian(client_id)
    and visibility in ('coach_parent', 'coach_client_parent')
  );

create or replace function public.guardian_can_read_assignment_logistics(
  target_client uuid,
  share_setting text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.client_relationships relationship
    where relationship.client_id = target_client
      and relationship.profile_id = auth.uid()
      and relationship.role = 'guardian'
      and relationship.portal_enabled = true
      and coalesce((relationship.permissions ->> 'progress_updates')::boolean, false)
      and (
        share_setting = 'share'
        or (
          share_setting = 'client_default'
          and relationship.automatic_assignment_updates = true
        )
      )
  );
$$;

create policy "guardians read shared assignment logistics"
  on public.assignments for select
  using (
    public.guardian_can_read_assignment_logistics(client_id, guardian_share_setting)
  );

comment on column public.client_relationships.automatic_assignment_updates is
  'Automatically shares assignment title, due date, requirement, and completion status only. Never shares response content.';
comment on column public.assignments.guardian_share_setting is
  'client_default follows each guardian relationship setting; share forces logistics sharing; private disables guardian sharing.';
comment on table public.assignment_responses is
  'Stores client checkbox/text responses separately so guardian logistics access cannot expose response content.';
