-- Complete the authenticated data path for the MVP.

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger clients_set_updated_at before update on public.clients
for each row execute function public.set_updated_at();
create trigger notes_set_updated_at before update on public.notes
for each row execute function public.set_updated_at();
create trigger templates_set_updated_at before update on public.templates
for each row execute function public.set_updated_at();

-- A normal coach signup receives a profile and a solo organization. Portal users
-- are created with account_type=client/guardian/third_party and are connected later.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
  display_name text;
begin
  display_name := coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1), 'New coach');

  insert into public.profiles (id, full_name, email)
  values (new.id, display_name, coalesce(new.email, ''))
  on conflict (id) do update set full_name = excluded.full_name, email = excluded.email;

  if coalesce(new.raw_user_meta_data->>'account_type', 'coach') = 'coach' then
    insert into public.organizations (name, slug)
    values (display_name || ' Coaching', 'practice-' || substr(replace(new.id::text, '-', ''), 1, 12))
    returning id into new_org_id;

    insert into public.organization_members (organization_id, profile_id, role)
    values (new_org_id, new.id, 'owner');
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create policy "users read own profile" on public.profiles
for select using (id = auth.uid());
create policy "users update own profile" on public.profiles
for update using (id = auth.uid()) with check (id = auth.uid());

create policy "members read organizations" on public.organizations
for select using (public.is_org_member(id));
create policy "members update organizations" on public.organizations
for update using (public.is_org_member(id)) with check (public.is_org_member(id));

create policy "members read memberships" on public.organization_members
for select using (profile_id = auth.uid() or public.is_org_member(organization_id));

-- Private file buckets. Object paths must begin with the organization UUID:
-- {organization_id}/{client_id}/{random_uuid}-{safe_filename}
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('soli-resources', 'soli-resources', false, 52428800, array['application/pdf', 'image/png', 'image/jpeg', 'video/mp4', 'audio/mpeg', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('soli-agreements', 'soli-agreements', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

create policy "members read organization files" on storage.objects
for select using (
  bucket_id in ('soli-resources', 'soli-agreements')
  and public.is_org_member((storage.foldername(name))[1]::uuid)
);

create policy "members upload organization files" on storage.objects
for insert with check (
  bucket_id in ('soli-resources', 'soli-agreements')
  and public.is_org_member((storage.foldername(name))[1]::uuid)
);

create policy "members update organization files" on storage.objects
for update using (
  bucket_id in ('soli-resources', 'soli-agreements')
  and public.is_org_member((storage.foldername(name))[1]::uuid)
) with check (
  bucket_id in ('soli-resources', 'soli-agreements')
  and public.is_org_member((storage.foldername(name))[1]::uuid)
);

create policy "members delete organization files" on storage.objects
for delete using (
  bucket_id in ('soli-resources', 'soli-agreements')
  and public.is_org_member((storage.foldername(name))[1]::uuid)
);
