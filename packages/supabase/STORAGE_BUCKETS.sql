-- Storage buckets for ByeMidias
-- Execute in Supabase Dashboard SQL Editor

-- Create buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('media', 'media', true, 524288000, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/avi', 'application/pdf']),
  ('templates', 'templates', false, 52428800, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/json']),
  ('branding', 'branding', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp']);

-- Storage policies
-- Allow authenticated users to read all media
CREATE POLICY "Authenticated users can read media"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'media');

-- Allow authenticated users to upload media  
CREATE POLICY "Authenticated users can upload media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'media');

-- Allow authenticated users to delete their own media
CREATE POLICY "Authenticated users can delete media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'media');

-- Templates: private, org-only access
CREATE POLICY "Authenticated users can read templates"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'templates');

CREATE POLICY "Authenticated users can upload templates"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'templates');

-- Branding: public read, authenticated write
CREATE POLICY "Anyone can read branding"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'branding');

CREATE POLICY "Authenticated users can upload branding"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'branding');

CREATE POLICY "Authenticated users can delete branding"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'branding');
