-- Add gender column to profiles
alter table profiles add column gender text;

-- Create avatars bucket if not exists
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- RLS Policies for Storage
-- Note: 'storage.objects' requires RLS enabled in Supabase by default? Yes.

-- 1. Public Read
create policy "Avatars are publicly accessible"
on storage.objects for select
using ( bucket_id = 'avatars' );

-- 2. Authenticated Upload (Folder structure: {userId}/{filename})
create policy "Users can upload their own avatar"
on storage.objects for insert
with check (
  bucket_id = 'avatars' 
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Authenticated Update
create policy "Users can update their own avatar"
on storage.objects for update
using (
  bucket_id = 'avatars' 
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Authenticated Delete
create policy "Users can delete their own avatar"
on storage.objects for delete
using (
  bucket_id = 'avatars' 
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);
