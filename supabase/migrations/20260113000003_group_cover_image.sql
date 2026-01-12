-- Add cover image support for groups

-- Add cover_image_url column to groups table
ALTER TABLE groups ADD COLUMN IF NOT EXISTS cover_image_url text;

-- Create storage bucket for group covers if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('group-covers', 'group-covers', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for group covers
CREATE POLICY "Group covers are publicly viewable"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'group-covers');

CREATE POLICY "Authenticated users can upload group covers"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'group-covers');

CREATE POLICY "Users can update their group covers"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'group-covers');

CREATE POLICY "Users can delete their group covers"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'group-covers');
