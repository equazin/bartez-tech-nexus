-- Migration 076: B2B registration requests
-- Stores onboarding solicitudes from /registrarse before admin approval

CREATE TABLE IF NOT EXISTS b2b_registration_requests (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cuit            TEXT        NOT NULL,
  company_name    TEXT        NOT NULL,
  contact_name    TEXT        NOT NULL,
  email           TEXT        NOT NULL,
  entity_type     TEXT        NOT NULL CHECK (entity_type IN ('empresa', 'persona_fisica')),
  tax_status      TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  assigned_to     TEXT,       -- email del ejecutivo asignado
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for admin listing
CREATE INDEX IF NOT EXISTS b2b_reg_requests_status_idx ON b2b_registration_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS b2b_reg_requests_cuit_idx   ON b2b_registration_requests (cuit);

-- RLS: only service role can read/write (admin queries via service key)
ALTER TABLE b2b_registration_requests ENABLE ROW LEVEL SECURITY;

-- Public can insert (the registration form)
CREATE POLICY "public_can_insert_registration"
  ON b2b_registration_requests FOR INSERT
  WITH CHECK (true);

-- Only service role can select/update (admin panel)
CREATE POLICY "service_role_full_access"
  ON b2b_registration_requests FOR ALL
  USING (auth.role() = 'service_role');

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_b2b_registration_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER b2b_registration_updated_at
  BEFORE UPDATE ON b2b_registration_requests
  FOR EACH ROW EXECUTE FUNCTION update_b2b_registration_updated_at();
