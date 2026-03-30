-- 022_supplier_sync_state.sql
-- Estado global de sincronizacion por proveedor para corridas incrementales.

CREATE TABLE IF NOT EXISTS supplier_sync_state (
  supplier_name         TEXT PRIMARY KEY,
  last_success_sync_at  TIMESTAMPTZ,
  last_full_sync_at     TIMESTAMPTZ,
  last_delta_sync_at    TIMESTAMPTZ,
  last_sync_meta        JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT supplier_sync_state_name_check CHECK (char_length(trim(supplier_name)) > 0)
);

ALTER TABLE supplier_sync_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "supplier_sync_state_read" ON supplier_sync_state;
CREATE POLICY "supplier_sync_state_read"
  ON supplier_sync_state
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'vendedor')
    )
  );

DROP POLICY IF EXISTS "supplier_sync_state_write" ON supplier_sync_state;
CREATE POLICY "supplier_sync_state_write"
  ON supplier_sync_state
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'vendedor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'vendedor')
    )
  );

DROP TRIGGER IF EXISTS supplier_sync_state_updated_at ON supplier_sync_state;
CREATE TRIGGER supplier_sync_state_updated_at
  BEFORE UPDATE ON supplier_sync_state
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
