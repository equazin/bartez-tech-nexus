-- Teqo · Subida de fotos de productos y bundles desde el panel (necesita profiles, por eso va al final).
DROP POLICY IF EXISTS "products_bucket_panel" ON storage.objects;
CREATE POLICY "products_bucket_panel" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id IN ('products', 'bundles') AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND lower(p.role) IN ('admin', 'vendedor', 'sales')))
  WITH CHECK (bucket_id IN ('products', 'bundles') AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND lower(p.role) IN ('admin', 'vendedor', 'sales')));
