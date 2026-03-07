-- comm-uploads: Supabase Storage bucket for chat file attachments.
-- Public bucket (permanent stable URLs via getPublicUrl) – auth is enforced
-- at upload time via RLS so only authenticated workspace members can write.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comm-uploads',
  'comm-uploads',
  true,
  52428800, -- 50 MiB
  array[
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
    'image/webp', 'image/svg+xml',
    'application/pdf',
    'text/plain', 'text/markdown',
    'application/zip', 'application/x-zip-compressed',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Only authenticated users can upload
drop policy if exists comm_uploads_insert on storage.objects;
create policy comm_uploads_insert
  on storage.objects
  for insert
  with check (
    bucket_id = 'comm-uploads'
    and auth.uid() is not null
  );

-- Public read (bucket is public; explicit policy documents intent)
drop policy if exists comm_uploads_select on storage.objects;
create policy comm_uploads_select
  on storage.objects
  for select
  using (bucket_id = 'comm-uploads');

-- Uploaders can delete their own files
drop policy if exists comm_uploads_delete on storage.objects;
create policy comm_uploads_delete
  on storage.objects
  for delete
  using (
    bucket_id = 'comm-uploads'
    and owner = auth.uid()
  );
