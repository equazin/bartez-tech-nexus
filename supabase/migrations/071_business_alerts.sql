-- Migration 071: Business alerts table
-- Idempotent

CREATE TABLE IF NOT EXISTS business_alerts (
  id         BIGSERIAL PRIMARY KEY,
  client_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('invoice', 'rma', 'promotion', 'info', 'warning')),
  title      TEXT NOT NULL,
  subtitle   TEXT,
  active     BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_alerts_client_active ON business_alerts(client_id, active);

-- RLS
ALTER TABLE business_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "business_alerts_select_client" ON business_alerts;
CREATE POLICY "business_alerts_select_client" ON business_alerts
  FOR SELECT USING (
    client_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'vendedor')
    )
  );

DROP POLICY IF EXISTS "business_alerts_all_admin" ON business_alerts;
CREATE POLICY "business_alerts_all_admin" ON business_alerts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'vendedor')
    )
  );
