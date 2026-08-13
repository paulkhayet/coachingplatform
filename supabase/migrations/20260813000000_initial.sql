-- Soli MVP schema. Organization-first so solo coaches can add teammates later.
create extension if not exists pgcrypto;

create type public.organization_role as enum ('owner', 'admin', 'coach');
create type public.client_kind as enum ('adult', 'minor');
create type public.relationship_role as enum ('client', 'guardian', 'third_party');
create type public.visibility_level as enum ('coach_only', 'coach_client', 'coach_parent', 'coach_client_parent');
create type public.assignment_status as enum ('not_started', 'in_progress', 'submitted', 'completed');
create type public.payment_status as enum ('draft', 'open', 'paid', 'past_due', 'void');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  timezone text not null default 'America/Los_Angeles',
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.organization_role not null default 'coach',
  created_at timestamptz not null default now(),
  primary key (organization_id, profile_id)
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assigned_coach_id uuid not null references public.profiles(id),
  client_profile_id uuid references public.profiles(id),
  kind public.client_kind not null default 'adult',
  full_name text not null,
  preferred_name text,
  pronouns text,
  birth_date date,
  email text,
  phone text,
  timezone text not null default 'America/Los_Angeles',
  status text not null default 'active' check (status in ('lead', 'active', 'paused', 'archived')),
  headline text,
  intake jsonb not null default '{}'::jsonb,
  important_dates jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clients_org_idx on public.clients (organization_id, status);
create index clients_coach_idx on public.clients (assigned_coach_id, status);

-- Logistics permissions never imply access to private coaching notes.
create table public.client_relationships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  full_name text not null,
  email text,
  role public.relationship_role not null,
  relation_label text,
  permissions jsonb not null default '{"scheduling":false,"billing":false,"agreements":false,"progress_updates":false}'::jsonb,
  portal_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

create index client_relationships_client_idx on public.client_relationships (client_id);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  title text not null,
  description text,
  progress smallint not null default 0 check (progress between 0 and 100),
  visibility public.visibility_level not null default 'coach_client',
  status text not null default 'active' check (status in ('active', 'achieved', 'paused')),
  created_at timestamptz not null default now()
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  coach_id uuid not null references public.profiles(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'attended', 'late_cancel', 'no_show', 'cancelled')),
  meeting_provider text check (meeting_provider in ('google_meet', 'zoom', 'other')),
  meeting_url text,
  external_calendar_event_id text,
  recurring_series_id uuid,
  next_session_at timestamptz,
  created_at timestamptz not null default now()
);

create index sessions_client_time_idx on public.sessions (client_id, starts_at desc);
create index sessions_coach_time_idx on public.sessions (coach_id, starts_at);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete set null,
  author_id uuid not null references public.profiles(id),
  body text not null default '',
  visibility public.visibility_level not null default 'coach_only',
  note_type text not null default 'coach_note' check (note_type in ('coach_note', 'shared_note', 'progress_update', 'meeting_summary')),
  ai_generated boolean not null default false,
  transcript_storage_path text,
  client_consent_recorded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not ai_generated or note_type = 'meeting_summary')
);

create index notes_client_time_idx on public.notes (client_id, created_at desc);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  assigned_by uuid not null references public.profiles(id),
  title text not null,
  instructions text,
  assignment_type text not null default 'task',
  is_required boolean not null default false,
  due_at timestamptz,
  status public.assignment_status not null default 'not_started',
  response jsonb,
  submitted_at timestamptz,
  completed_at timestamptz,
  visibility public.visibility_level not null default 'coach_client',
  created_at timestamptz not null default now()
);

create index assignments_client_status_idx on public.assignments (client_id, status);

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  title text not null,
  description text,
  resource_type text not null,
  storage_path text,
  external_url text,
  mime_type text,
  byte_size bigint,
  created_at timestamptz not null default now(),
  check (storage_path is not null or external_url is not null)
);

create table public.resource_assignments (
  resource_id uuid not null references public.resources(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  assigned_by uuid not null references public.profiles(id),
  visibility public.visibility_level not null default 'coach_client',
  assigned_at timestamptz not null default now(),
  primary key (resource_id, client_id)
);

create table public.agreements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  title text not null,
  version text not null,
  storage_path text not null,
  status text not null default 'pending' check (status in ('pending', 'partially_signed', 'signed', 'void')),
  created_at timestamptz not null default now()
);

create table public.agreement_signatures (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.agreements(id) on delete cascade,
  signer_profile_id uuid references public.profiles(id),
  signer_name text not null,
  signer_email text not null,
  signer_role text not null,
  signed_at timestamptz not null,
  ip_address inet,
  user_agent text,
  signature_evidence_path text not null,
  created_at timestamptz not null default now()
);

create table public.packages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  session_count integer,
  price_cents integer not null check (price_cents >= 0),
  stripe_product_id text,
  stripe_price_id text,
  is_subscription boolean not null default false,
  active boolean not null default true
);

create table public.client_packages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  package_id uuid not null references public.packages(id),
  sessions_used integer not null default 0,
  stripe_customer_id text,
  stripe_subscription_id text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  stripe_invoice_id text unique,
  amount_due_cents integer not null,
  status public.payment_status not null default 'draft',
  due_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  name text not null,
  template_type text not null,
  definition jsonb not null default '{"steps":[]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Security-definer helpers avoid recursive membership policies.
create or replace function public.is_org_member(target_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organization_members where organization_id = target_org and profile_id = auth.uid());
$$;

create or replace function public.is_client_self(target_client uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.clients where id = target_client and client_profile_id = auth.uid());
$$;

create or replace function public.is_client_guardian(target_client uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.client_relationships
    where client_id = target_client and profile_id = auth.uid()
      and role = 'guardian' and portal_enabled = true
  );
$$;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.clients enable row level security;
alter table public.client_relationships enable row level security;
alter table public.goals enable row level security;
alter table public.sessions enable row level security;
alter table public.notes enable row level security;
alter table public.assignments enable row level security;
alter table public.resources enable row level security;
alter table public.resource_assignments enable row level security;
alter table public.agreements enable row level security;
alter table public.agreement_signatures enable row level security;
alter table public.packages enable row level security;
alter table public.client_packages enable row level security;
alter table public.invoices enable row level security;
alter table public.templates enable row level security;

create policy "members manage clients" on public.clients for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "members manage relationships" on public.client_relationships for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "members manage goals" on public.goals for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "members manage sessions" on public.sessions for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "members manage notes" on public.notes for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "members manage assignments" on public.assignments for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "members manage resources" on public.resources for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "members manage resource assignments" on public.resource_assignments for all using (exists (select 1 from public.clients c where c.id = client_id and public.is_org_member(c.organization_id)));
create policy "members manage agreements" on public.agreements for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "members manage packages" on public.packages for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "members manage client packages" on public.client_packages for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "members manage invoices" on public.invoices for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "members manage templates" on public.templates for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

-- Portal reads are deliberately narrow. Coach-only notes never pass these predicates.
create policy "clients read shared goals" on public.goals for select using (
  public.is_client_self(client_id) and visibility in ('coach_client', 'coach_client_parent')
);
create policy "clients read shared notes" on public.notes for select using (
  public.is_client_self(client_id) and visibility in ('coach_client', 'coach_client_parent')
);
create policy "guardians read explicitly shared notes" on public.notes for select using (
  public.is_client_guardian(client_id) and visibility in ('coach_parent', 'coach_client_parent')
);
create policy "clients read assignments" on public.assignments for select using (
  public.is_client_self(client_id) and visibility in ('coach_client', 'coach_client_parent')
);

-- Private files belong in a non-public Storage bucket. Add storage.objects policies
-- that resolve ownership and visibility through resource_assignments and agreements.
