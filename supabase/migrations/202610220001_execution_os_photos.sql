-- Execução vinculável à OS, sem reclassificar retroativamente registros existentes.
ALTER TABLE public.field_execution_entries
 ADD COLUMN IF NOT EXISTS work_order_id uuid REFERENCES public.work_orders(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_field_exec_work_order ON public.field_execution_entries(work_order_id);
-- Fotos associadas ao registro e ao usuário que enviou, sem inventar GPS/EXIF.
CREATE TABLE IF NOT EXISTS public.field_execution_photos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 execution_entry_id uuid NOT NULL REFERENCES public.field_execution_entries(id) ON DELETE CASCADE,
 storage_path text NOT NULL UNIQUE,
 original_name text NOT NULL,
 content_type text NOT NULL CHECK (content_type IN ('image/jpeg','image/png','image/webp')),
 file_size_bytes integer NOT NULL CHECK (file_size_bytes BETWEEN 1 AND 8388608),
 uploaded_by uuid DEFAULT auth.uid(),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_execution_photos_entry ON public.field_execution_photos(execution_entry_id,created_at);
ALTER TABLE public.field_execution_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS execution_photo_read ON public.field_execution_photos;
CREATE POLICY execution_photo_read ON public.field_execution_photos
 FOR SELECT TO authenticated USING(siga_private.can_read_sensitive());
DROP POLICY IF EXISTS execution_photo_insert ON public.field_execution_photos;
CREATE POLICY execution_photo_insert ON public.field_execution_photos
 FOR INSERT TO authenticated WITH CHECK(siga_private.can_write());
GRANT SELECT,INSERT ON public.field_execution_photos TO authenticated;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('siga-execution-photos','siga-execution-photos',false,8388608,
 ARRAY['image/jpeg','image/png','image/webp'])
 ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS execution_photo_object_read ON storage.objects;
CREATE POLICY execution_photo_object_read ON storage.objects
 FOR SELECT TO authenticated USING(bucket_id='siga-execution-photos' AND siga_private.can_read_sensitive());
DROP POLICY IF EXISTS execution_photo_object_insert ON storage.objects;
CREATE POLICY execution_photo_object_insert ON storage.objects
 FOR INSERT TO authenticated WITH CHECK(bucket_id='siga-execution-photos' AND siga_private.can_write());
DROP POLICY IF EXISTS execution_photo_object_delete ON storage.objects;
CREATE POLICY execution_photo_object_delete ON storage.objects
 FOR DELETE TO authenticated USING(bucket_id='siga-execution-photos' AND siga_private.can_write());