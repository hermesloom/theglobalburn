INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pet-photos',
  'pet-photos',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload pet photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pet-photos');

CREATE POLICY "Authenticated users can update pet photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'pet-photos');

CREATE POLICY "Anyone can view pet photos"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'pet-photos');
