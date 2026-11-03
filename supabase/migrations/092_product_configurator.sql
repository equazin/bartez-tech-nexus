-- 087_product_configurator.sql
-- Plantillas de armado / configuracion de equipos.

CREATE TABLE IF NOT EXISTS product_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  base_product_id INTEGER REFERENCES products(id),
  components JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_template BOOLEAN NOT NULL DEFAULT false,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_configurations_profile_created
  ON product_configurations (profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_configurations_templates
  ON product_configurations (is_template, created_at DESC);

ALTER TABLE product_configurations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_configurations_client_select ON product_configurations;
CREATE POLICY product_configurations_client_select
ON product_configurations
FOR SELECT
USING (
  is_template = true
  OR profile_id = auth.uid()
);

DROP POLICY IF EXISTS product_configurations_client_insert ON product_configurations;
CREATE POLICY product_configurations_client_insert
ON product_configurations
FOR INSERT
WITH CHECK (
  profile_id = auth.uid()
  AND is_template = false
);

DROP POLICY IF EXISTS product_configurations_client_update ON product_configurations;
CREATE POLICY product_configurations_client_update
ON product_configurations
FOR UPDATE
USING (profile_id = auth.uid())
WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS product_configurations_client_delete ON product_configurations;
CREATE POLICY product_configurations_client_delete
ON product_configurations
FOR DELETE
USING (profile_id = auth.uid());

DROP POLICY IF EXISTS product_configurations_staff_all ON product_configurations;
CREATE POLICY product_configurations_staff_all
ON product_configurations
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'vendedor', 'sales')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'vendedor', 'sales')
  )
);
