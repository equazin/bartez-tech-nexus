-- ── 080_payments_system.sql ──────────────────────────────────────────────────────
-- Payments system for client-uploaded proofs
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Create the payments table
CREATE TABLE IF NOT EXISTS payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  order_id        BIGINT REFERENCES orders(id),
  invoice_id      UUID REFERENCES invoices(id),
  amount          NUMERIC(14,2) NOT NULL,
  currency        TEXT NOT NULL CHECK (currency IN ('ARS', 'USD')),
  payment_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method  TEXT NOT NULL CHECK (payment_method IN ('transferencia', 'deposito', 'efectivo', 'otro')),
  reference       TEXT,
  file_url        TEXT,
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'validado', 'rechazado')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Indexes for efficient lookup
CREATE INDEX IF NOT EXISTS idx_payments_client ON payments(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_order  ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_status  ON payments(status);

-- 3. Enable RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Clients: can view their own payments
DROP POLICY IF EXISTS "payments_client_select" ON payments;
CREATE POLICY "payments_client_select" ON payments FOR SELECT TO authenticated
  USING (client_id = auth.uid());

-- Clients: can insert their own payments
DROP POLICY IF EXISTS "payments_client_insert" ON payments;
CREATE POLICY "payments_client_insert" ON payments FOR INSERT TO authenticated
  WITH CHECK (client_id = auth.uid());

-- Admins/Vendedores: full access
DROP POLICY IF EXISTS "payments_admin_all" ON payments;
CREATE POLICY "payments_admin_all" ON payments FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid()
        AND role IN ('admin', 'vendedor')
    )
  );

-- 5. Storage Bucket: payment-proofs
INSERT INTO storage.buckets (id, name, public) 
VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO NOTHING;

-- 6. Storage Policies
-- Clients: can upload to their own subfolder
DROP POLICY IF EXISTS "payment_proofs_client_upload" ON storage.objects;
CREATE POLICY "payment_proofs_client_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payment-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Clients: can read their own subfolder
DROP POLICY IF EXISTS "payment_proofs_client_select" ON storage.objects;
CREATE POLICY "payment_proofs_client_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'payment-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Admins: can read all
DROP POLICY IF EXISTS "payment_proofs_admin_select" ON storage.objects;
CREATE POLICY "payment_proofs_admin_select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-proofs' AND
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid()
        AND role IN ('admin', 'vendedor')
    )
  );

COMMENT ON TABLE payments IS 'Client-uploaded payment proofs pending validation by the sales team.';
