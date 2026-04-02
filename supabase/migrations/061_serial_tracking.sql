-- ── 061_serial_tracking.sql ──────────────────────────────────────────────
-- Tracking Serial Numbers per sale for warranty/RMA
-- ─────────────────────────────────────────────────────────────────────────────

-- 0. Health Check for RMA (in case 049 failed due to type mismatch)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rma_requests') THEN
    CREATE TABLE rma_requests (
      id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      rma_number      TEXT UNIQUE,
      client_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      order_id        BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      status          TEXT NOT NULL DEFAULT 'submitted',
      reason          TEXT NOT NULL,
      description     TEXT,
      items           JSONB NOT NULL DEFAULT '[]'::JSONB,
      created_at      TIMESTAMPTZ DEFAULT now(),
      updated_at      TIMESTAMPTZ DEFAULT now()
    );
  END IF;
END $$;

-- 1. Serial Numbers Table
CREATE TABLE IF NOT EXISTS product_serials (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   INTEGER REFERENCES products(id) ON DELETE CASCADE,
  serial_number TEXT UNIQUE NOT NULL,
  
  -- Tracking sale
  -- orders.id is BIGINT based on schema 014/061 fix
  order_id     BIGINT REFERENCES orders(id) ON DELETE SET NULL,
  
  -- invoices.id is UUID
  invoice_id   UUID REFERENCES invoices(id) ON DELETE SET NULL,
  
  client_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Status
  status        TEXT DEFAULT 'available' CHECK (status IN ('available', 'sold', 'rma', 'scrap')),
  sold_at      TIMESTAMPTZ,
  warranty_until TIMESTAMPTZ,
  
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Index for quick lookup in RMA
CREATE INDEX IF NOT EXISTS idx_serials_lookup ON product_serials (serial_number);

-- 2. Function to mark serial as sold
CREATE OR REPLACE FUNCTION mark_serial_sold(
  p_serial TEXT,
  p_order_id BIGINT,
  p_invoice_id UUID,
  p_client_id UUID,
  p_warranty_months INTEGER DEFAULT 12
)
RETURNS VOID AS $$
BEGIN
  UPDATE product_serials
  SET 
    status = 'sold',
    order_id = p_order_id,
    invoice_id = p_invoice_id,
    client_id = p_client_id,
    sold_at = now(),
    warranty_until = now() + (p_warranty_months || ' months')::INTERVAL
  WHERE serial_number = p_serial;
END;
$$ LANGUAGE plpgsql;

-- 3. RMA Logic Extension
ALTER TABLE rma_requests ADD COLUMN IF NOT EXISTS serial_number TEXT;
ALTER TABLE rma_requests ADD COLUMN IF NOT EXISTS serial_validated BOOLEAN DEFAULT false;
