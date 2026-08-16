-- Public avatar bucket for profile photos. Unlike the resource/agreement
-- buckets, avatars are not sensitive client data, so the bucket is public
-- and objects serve directly from the public URL without a signed-URL round
-- trip. Object paths must begin with the uploader's own user id:
-- {user_id}/avatar
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('soli-avatars', 'soli-avatars', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "public read avatars" on storage.objects
for select using (bucket_id = 'soli-avatars');

create policy "users upload own avatar" on storage.objects
for insert with check (
  bucket_id = 'soli-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users update own avatar" on storage.objects
for update using (
  bucket_id = 'soli-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
) with check (
  bucket_id = 'soli-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users delete own avatar" on storage.objects
for delete using (
  bucket_id = 'soli-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
