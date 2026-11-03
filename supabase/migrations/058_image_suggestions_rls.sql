-- ── 056_image_suggestions_rls.sql ──────────────────────────────────────────
-- RLS for image_suggestions and image_processing_log.
-- Admins and vendedores can read/write; service role bypasses RLS entirely.
-- ---------------------------------------------------------------------------

ALTER TABLE image_suggestions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE image_processing_log  ENABLE ROW LEVEL SECURITY;

-- image_suggestions
DROP POLICY IF EXISTS "image_suggestions_admin_all" ON image_suggestions;
CREATE POLICY "image_suggestions_admin_all"
  ON image_suggestions FOR ALL TO authenticated
  USING (get_my_role() IN ('admin', 'vendedor'))
  WITH CHECK (get_my_role() IN ('admin', 'vendedor'));

-- image_processing_log
DROP POLICY IF EXISTS "image_log_admin_all" ON image_processing_log;
CREATE POLICY "image_log_admin_all"
  ON image_processing_log FOR ALL TO authenticated
  USING (get_my_role() IN ('admin', 'vendedor'))
  WITH CHECK (get_my_role() IN ('admin', 'vendedor'));
