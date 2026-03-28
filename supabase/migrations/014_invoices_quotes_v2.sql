-- ── 014_invoices_quotes_v2.sql ───────────────────────────────────────────────
-- 1. Invoices table (first-class, linked to orders)
-- 2. Quote expiration + status workflow upgrade
-- 3. Normalized order_items view (avoids JSONB for reporting)

-- ── 1. INVOICES ───────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

CREATE TABLE IF NOT EXISTS invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number  TEXT UNIQUE NOT NULL
                    DEFAULT ('FAC-' || LPAD(nextval('invoice_number_seq')::TEXT, 6, '0')),
  order_id        BIGINT REFERENCES orders(id) ON DELETE SET NULL,
  client_id       UUID NOT NULL,                     -- denormalized for query speed
  client_snapshot JSONB,                              -- snapshot of client data at invoice time
  items           JSONB NOT NULL,                     -- line items at invoice time
  subtotal        NUMERIC(12,2) NOT NULL DEFAULT 0,
  iva_total       NUMERIC(12,2) NOT NULL DEFAULT 0,
  total           NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'ARS' CHECK (currency IN ('ARS','USD')),
  exchange_rate   NUMERIC(10,4),                      -- USD→ARS rate at invoice time
  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','sent','paid','overdue','cancelled')),
  due_date        DATE,
  paid_at         TIMESTAMPTZ,
  notes           TEXT,
  pdf_url         TEXT,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_client_id  ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_inv_order_id   ON invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_inv_status     ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_inv_due_date   ON invoices(due_date);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inv_select_own"
  ON invoices FOR SELECT TO authenticated
  USING (
    client_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','vendedor'))
  );

CREATE POLICY "inv_admin_write"
  ON invoices FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','vendedor'))
  );

CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Helper: create invoice from order
CREATE OR REPLACE FUNCTION create_invoice_from_order(
  p_order_id    BIGINT,
  p_due_days    INTEGER DEFAULT 30,
  p_currency    TEXT    DEFAULT 'ARS',
  p_exch_rate   NUMERIC DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_order       RECORD;
  v_client      RECORD;
  v_invoice_id  UUID;
BEGIN
  SELECT * INTO v_order  FROM orders   WHERE id = p_order_id;
  SELECT * INTO v_client FROM profiles WHERE id = v_order.client_id::UUID;

  INSERT INTO invoices (
    order_id, client_id, client_snapshot,
    items, subtotal, total,
    currency, exchange_rate,
    status, due_date, created_by
  ) VALUES (
    p_order_id,
    v_order.client_id::UUID,
    jsonb_build_object(
      'company_name',  v_client.company_name,
      'contact_name',  v_client.contact_name,
      'client_type',   v_client.client_type
    ),
    v_order.products,
    v_order.total * 0.826,    -- subtract IVA 21% to get net
    v_order.total,
    p_currency,
    p_exch_rate,
    'draft',
    CURRENT_DATE + p_due_days,
    auth.uid()
  )
  RETURNING id INTO v_invoice_id;

  RETURN v_invoice_id;
END;
$$;

-- ── 2. QUOTES V2 — EXPIRATION + WORKFLOW ─────────────────────────────────────
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS status        TEXT DEFAULT 'draft'
    CHECK (status IN ('draft','sent','approved','rejected','converted','expired')),
  ADD COLUMN IF NOT EXISTS expires_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS converted_to_order_id BIGINT REFERENCES orders(id),
  ADD COLUMN IF NOT EXISTS valid_days    INTEGER DEFAULT 15,
  ADD COLUMN IF NOT EXISTS notes         TEXT;

-- Set expires_at for existing quotes that don't have it
UPDATE quotes
SET expires_at = created_at + INTERVAL '15 days'
WHERE expires_at IS NULL;

-- Auto-expire quotes past their date
CREATE OR REPLACE FUNCTION expire_overdue_quotes()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE quotes
  SET status = 'expired'
  WHERE status IN ('draft','sent')
    AND expires_at < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Convert quote to order (preserving quote context)
CREATE OR REPLACE FUNCTION convert_quote_to_order(
  p_quote_id   UUID,
  p_client_id  UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_quote    RECORD;
  v_result   JSONB;
BEGIN
  SELECT * INTO v_quote FROM quotes WHERE id = p_quote_id;

  IF v_quote IS NULL THEN
    RAISE EXCEPTION 'Cotización % no encontrada', p_quote_id;
  END IF;
  IF v_quote.status NOT IN ('sent','approved') THEN
    RAISE EXCEPTION 'Solo se pueden convertir cotizaciones enviadas o aprobadas';
  END IF;
  IF v_quote.expires_at IS NOT NULL AND v_quote.expires_at < now() THEN
    RAISE EXCEPTION 'La cotización ha vencido';
  END IF;

  -- Create order using the new v2 RPC
  v_result := reserve_stock_create_order_v2(
    p_client_id,
    v_quote.items,
    v_quote.total,
    'Convertido desde cotización ' || p_quote_id::TEXT
  );

  -- Mark quote as converted
  UPDATE quotes
  SET status                   = 'converted',
      converted_to_order_id    = (v_result->>'id')::UUID
  WHERE id = p_quote_id;

  RETURN v_result;
END;
$$;

-- ── 3. ORDER_ITEMS VIEW (normalized for reporting) ───────────────────────────
--    Expands the JSONB products array into rows for SQL analytics
CREATE OR REPLACE VIEW order_items_view AS
SELECT
  o.id                              AS order_id,
  o.order_number,
  o.client_id,
  o.status                          AS order_status,
  o.created_at                      AS order_date,
  (item->>'product_id')::INTEGER    AS product_id,
  item->>'name'                     AS product_name,
  item->>'sku'                      AS sku,
  (item->>'quantity')::INTEGER      AS quantity,
  (item->>'unit_price')::NUMERIC    AS unit_price,
  (item->>'cost')::NUMERIC          AS cost_price,
  (item->>'margin')::NUMERIC        AS margin_pct,
  (item->>'quantity')::INTEGER
    * (item->>'unit_price')::NUMERIC AS line_total
FROM orders o,
LATERAL jsonb_array_elements(o.products) AS item
WHERE o.status NOT IN ('rejected');

-- ── 4. REPORTING HELPERS ─────────────────────────────────────────────────────

-- Revenue by client (last 90 days)
CREATE OR REPLACE VIEW revenue_by_client AS
SELECT
  o.client_id::UUID          AS client_id,
  p.company_name,
  p.client_type,
  COUNT(DISTINCT o.id)       AS order_count,
  SUM(o.total)               AS total_revenue,
  AVG(o.total)               AS avg_order_value,
  MAX(o.created_at)          AS last_order_date
FROM orders o
JOIN profiles p ON p.id = o.client_id::UUID
WHERE
  o.status NOT IN ('rejected')
  AND o.created_at >= now() - INTERVAL '90 days'
GROUP BY o.client_id, p.company_name, p.client_type;

-- Top products by revenue
CREATE OR REPLACE VIEW top_products_revenue AS
SELECT
  (item->>'product_id')::INTEGER  AS product_id,
  item->>'name'                   AS product_name,
  SUM((item->>'quantity')::INTEGER) AS units_sold,
  SUM((item->>'quantity')::INTEGER * (item->>'unit_price')::NUMERIC) AS revenue,
  SUM((item->>'quantity')::INTEGER
      * ((item->>'unit_price')::NUMERIC - COALESCE((item->>'cost')::NUMERIC, 0))) AS gross_margin
FROM orders o,
LATERAL jsonb_array_elements(o.products) AS item
WHERE o.status NOT IN ('rejected')
GROUP BY 1, 2
ORDER BY revenue DESC;
