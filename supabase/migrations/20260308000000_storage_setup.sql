-- Create storage bucket for communication uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'comm-uploads',
  'comm-uploads',
  false,
  52428800, -- 50MB
  ARRAY['image/*', 'video/*', 'application/pdf', 'text/*', 'application/zip', 'application/json']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policy: Users can upload to their workspace folders
CREATE POLICY "Users can upload to workspace folders"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'comm-uploads' AND
  auth.uid() IS NOT NULL AND
  (storage.foldername(name))[1] IN (
    SELECT workspace_id::text
    FROM workspace_members
    WHERE user_id = auth.uid()
  )
);

-- RLS policy: Users can read from their workspace folders
CREATE POLICY "Users can read workspace uploads"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'comm-uploads' AND
  auth.uid() IS NOT NULL AND
  (storage.foldername(name))[1] IN (
    SELECT workspace_id::text
    FROM workspace_members
    WHERE user_id = auth.uid()
  )
);

-- RLS policy: Users can delete their own uploads
CREATE POLICY "Users can delete own uploads"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'comm-uploads' AND
  auth.uid() IS NOT NULL
);
