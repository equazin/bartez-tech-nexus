-- ── 049_rma_returns.sql ───────────────────────────────────────────────────────
-- Sistema básico de RMA (Return Merchandise Authorization).
-- Permite a clientes solicitar devoluciones/cambios sobre pedidos entregados.
-- Fully idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Tabla principal de RMAs
CREATE TABLE IF NOT EXISTS rma_requests (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  rma_number      TEXT UNIQUE,           -- e.g. "RMA-0001"
  client_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  order_id        UUID NOT NULL REFERENCES orders(id)  ON DELETE CASCADE,
  -- Status workflow: draft → submitted → reviewing → approved → rejected → resolved
  status          TEXT NOT NULL DEFAULT 'submitted'
                  CHECK (status IN ('draft', 'submitted', 'reviewing', 'approved', 'rejected', 'resolved')),
  reason          TEXT NOT NULL
                  CHECK (reason IN ('defective', 'wrong_item', 'damaged_in_transit', 'not_as_described', 'other')),
  description     TEXT,
  -- Items involved (subset of order items)
  items           JSONB NOT NULL DEFAULT '[]'::JSONB,
  -- e.g. [{ product_id, name, sku, quantity, unit_price }]
  -- Resolution
  resolution_type TEXT CHECK (resolution_type IN ('refund', 'exchange', 'credit_note', 'repair')),
  resolution_notes TEXT,
  -- Tracking
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  resolved_at     TIMESTAMPTZ,
  admin_id        UUID REFERENCES auth.users(id)  -- who processed it
);

COMMENT ON TABLE rma_requests IS
  'Return Merchandise Authorization requests from B2B clients.';

-- 2. Auto-number trigger
CREATE SEQUENCE IF NOT EXISTS rma_number_seq START 1;

CREATE OR REPLACE FUNCTION set_rma_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.rma_number IS NULL THEN
    NEW.rma_number := 'RMA-' || LPAD(nextval('rma_number_seq')::TEXT, 4, '0');
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_rma_number ON rma_requests;
CREATE TRIGGER trg_set_rma_number
  BEFORE INSERT OR UPDATE ON rma_requests
  FOR EACH ROW EXECUTE FUNCTION set_rma_number();

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_rma_client_id  ON rma_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_rma_order_id   ON rma_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_rma_status     ON rma_requests(status);

-- 4. RLS
ALTER TABLE rma_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_rma_select" ON rma_requests;
DROP POLICY IF EXISTS "client_rma_insert" ON rma_requests;
DROP POLICY IF EXISTS "admin_rma_all"     ON rma_requests;

-- Client: can read and create their own RMAs
CREATE POLICY "client_rma_select"
  ON rma_requests FOR SELECT TO authenticated
  USING (client_id = auth.uid());

CREATE POLICY "client_rma_insert"
  ON rma_requests FOR INSERT TO authenticated
  WITH CHECK (client_id = auth.uid());

-- Admin: full access
CREATE POLICY "admin_rma_all"
  ON rma_requests FOR ALL TO authenticated
  USING (get_my_role() = 'admin');
