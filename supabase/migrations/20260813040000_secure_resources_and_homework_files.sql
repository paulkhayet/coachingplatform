-- Secure resource library and homework file submissions.

-- Every upload in the resource library is capped at 10 MB. The bucket remains
-- private; access is granted only through storage RLS and short-lived URLs.
update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array[
      'application/pdf',
      'image/png',
      'image/jpeg',
      'video/mp4',
      'audio/mpeg',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
where id = 'soli-resources';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'soli-homework',
  'soli-homework',
  false,
  10485760,
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.assignments
  drop constraint if exists assignments_response_type_check;

alter table public.assignments
  add constraint assignments_response_type_check
  check (response_type in ('checkbox', 'text', 'file'));

alter table public.assignments
  add column if not exists resource_id uuid references public.resources(id) on delete set null;

create table if not exists public.assignment_files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id),
  storage_path text not null unique,
  original_filename text not null,
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0 and byte_size <= 10485760),
  created_at timestamptz not null default now()
);

create index if not exists assignment_files_assignment_idx
  on public.assignment_files (assignment_id, created_at desc);

alter table public.assignment_files enable row level security;

create policy "members manage assignment files"
  on public.assignment_files for all
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "clients read their assignment files"
  on public.assignment_files for select
  using (
    public.is_client_self(client_id)
    and uploaded_by = auth.uid()
    and exists (
      select 1 from public.assignments assignment
      where assignment.id = assignment_id
        and assignment.client_id = client_id
        and assignment.visibility in ('coach_client', 'coach_client_parent')
    )
  );

create policy "clients add their assignment files"
  on public.assignment_files for insert
  with check (
    public.is_client_self(client_id)
    and uploaded_by = auth.uid()
    and exists (
      select 1 from public.assignments assignment
      where assignment.id = assignment_id
        and assignment.organization_id = organization_id
        and assignment.client_id = client_id
        and assignment.response_type = 'file'
        and assignment.visibility in ('coach_client', 'coach_client_parent')
    )
  );

-- Clients can open only library objects that the coach explicitly assigned.
create policy "clients read assigned resource files"
  on storage.objects for select
  using (
    bucket_id = 'soli-resources'
    and exists (
      select 1
      from public.resources resource
      join public.resource_assignments assignment
        on assignment.resource_id = resource.id
      where resource.storage_path = storage.objects.name
        and public.is_client_self(assignment.client_id)
        and assignment.visibility in ('coach_client', 'coach_client_parent')
    )
  );

-- Homework object paths are:
-- {organization_id}/{client_id}/{assignment_id}/{opaque_uuid}
create policy "members manage homework files"
  on storage.objects for all
  using (
    bucket_id = 'soli-homework'
    and public.is_org_member((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'soli-homework'
    and public.is_org_member((storage.foldername(name))[1]::uuid)
  );

create policy "clients upload homework files"
  on storage.objects for insert
  with check (
    bucket_id = 'soli-homework'
    and public.is_client_self((storage.foldername(name))[2]::uuid)
    and exists (
      select 1 from public.assignments assignment
      where assignment.id = (storage.foldername(name))[3]::uuid
        and assignment.organization_id = (storage.foldername(name))[1]::uuid
        and assignment.client_id = (storage.foldername(name))[2]::uuid
        and assignment.response_type = 'file'
        and assignment.visibility in ('coach_client', 'coach_client_parent')
    )
  );

create policy "clients read their homework files"
  on storage.objects for select
  using (
    bucket_id = 'soli-homework'
    and public.is_client_self((storage.foldername(name))[2]::uuid)
    and exists (
      select 1 from public.assignment_files file
      where file.storage_path = storage.objects.name
        and file.uploaded_by = auth.uid()
    )
  );

create or replace function public.audit_assignment_file_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.portal_audit_events (
    organization_id, client_id, actor_profile_id, event_type, subject_type,
    subject_id, metadata
  ) values (
    new.organization_id, new.client_id, auth.uid(), 'assignment_file_uploaded',
    'assignment_file', new.id,
    jsonb_build_object('mime_type', new.mime_type, 'byte_size', new.byte_size)
  );
  return new;
end;
$$;

create trigger assignment_file_created_audit
after insert on public.assignment_files
for each row execute function public.audit_assignment_file_created();

comment on table public.assignment_files is
  'Private client homework uploads. Guardian access is intentionally excluded.';
comment on column public.assignments.resource_id is
  'Optional library resource attached to an assignment.';
