-- Practice-level OAuth connections for calendars and meeting providers.
-- Connection metadata is readable by the coach; encrypted credentials live in
-- a separate table with no client-facing policies.

create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('google', 'zoom')),
  status text not null default 'connected' check (status in ('connected', 'needs_attention', 'disconnected')),
  account_email text,
  external_account_id text,
  scopes text[] not null default '{}',
  sync_enabled boolean not null default true,
  auto_add_meeting boolean not null default true,
  default_for_scheduling boolean not null default false,
  token_expires_at timestamptz,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, profile_id, provider)
);

create table if not exists public.integration_credentials (
  connection_id uuid primary key references public.integration_connections(id) on delete cascade,
  access_token_encrypted text not null,
  refresh_token_encrypted text,
  updated_at timestamptz not null default now()
);

alter table public.integration_connections enable row level security;
alter table public.integration_credentials enable row level security;

create policy "members read integration connections"
  on public.integration_connections for select
  using (public.is_org_member(organization_id));

create or replace function public.save_integration_oauth_connection(
  target_organization uuid,
  target_provider text,
  target_account_email text,
  target_external_account_id text,
  target_scopes text[],
  encrypted_access_token text,
  encrypted_refresh_token text,
  target_token_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  connection_id uuid;
begin
  if target_provider not in ('google', 'zoom') then
    raise exception 'Unsupported integration provider.';
  end if;
  if not public.is_org_member(target_organization) then
    raise exception 'You do not have access to this practice.';
  end if;

  insert into public.integration_connections (
    organization_id, profile_id, provider, status, account_email,
    external_account_id, scopes, token_expires_at, updated_at
  ) values (
    target_organization, auth.uid(), target_provider, 'connected',
    nullif(target_account_email, ''), nullif(target_external_account_id, ''),
    coalesce(target_scopes, '{}'), target_token_expires_at, now()
  )
  on conflict (organization_id, profile_id, provider) do update
    set status = 'connected',
      account_email = excluded.account_email,
      external_account_id = excluded.external_account_id,
      scopes = excluded.scopes,
      token_expires_at = excluded.token_expires_at,
      updated_at = now()
  returning id into connection_id;

  insert into public.integration_credentials (
    connection_id, access_token_encrypted, refresh_token_encrypted, updated_at
  ) values (
    connection_id, encrypted_access_token, nullif(encrypted_refresh_token, ''), now()
  )
  on conflict (connection_id) do update
    set access_token_encrypted = excluded.access_token_encrypted,
      refresh_token_encrypted = coalesce(
        excluded.refresh_token_encrypted,
        public.integration_credentials.refresh_token_encrypted
      ),
      updated_at = now();

  return connection_id;
end;
$$;

create or replace function public.update_integration_preferences(
  target_connection uuid,
  target_sync_enabled boolean,
  target_auto_add_meeting boolean,
  target_default_for_scheduling boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.integration_connections%rowtype;
begin
  select * into target
  from public.integration_connections
  where id = target_connection;

  if target.id is null or target.profile_id <> auth.uid()
    or not public.is_org_member(target.organization_id) then
    raise exception 'This integration is not available to your account.';
  end if;

  if target_default_for_scheduling then
    update public.integration_connections
    set default_for_scheduling = false, updated_at = now()
    where organization_id = target.organization_id
      and profile_id = auth.uid()
      and provider <> target.provider;
  end if;

  update public.integration_connections
  set sync_enabled = target_sync_enabled,
    auto_add_meeting = target_auto_add_meeting,
    default_for_scheduling = target_default_for_scheduling,
    updated_at = now()
  where id = target.id;
end;
$$;

create or replace function public.disconnect_integration(target_connection uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.integration_connections%rowtype;
begin
  select * into target
  from public.integration_connections
  where id = target_connection;

  if target.id is null or target.profile_id <> auth.uid()
    or not public.is_org_member(target.organization_id) then
    raise exception 'This integration is not available to your account.';
  end if;

  delete from public.integration_credentials where connection_id = target.id;
  update public.integration_connections
  set status = 'disconnected',
    account_email = null,
    external_account_id = null,
    scopes = '{}',
    token_expires_at = null,
    sync_enabled = false,
    auto_add_meeting = false,
    default_for_scheduling = false,
    updated_at = now()
  where id = target.id;
end;
$$;

grant execute on function public.save_integration_oauth_connection(
  uuid, text, text, text, text[], text, text, timestamptz
) to authenticated;
grant execute on function public.update_integration_preferences(
  uuid, boolean, boolean, boolean
) to authenticated;
grant execute on function public.disconnect_integration(uuid) to authenticated;

comment on table public.integration_credentials is
  'Encrypted OAuth credentials. No direct authenticated-user policy is provided.';
comment on table public.integration_connections is
  'Non-secret connection status and coach-controlled scheduling preferences.';
