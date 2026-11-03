-- ── 015_purchase_orders.sql ──────────────────────────────────────────────────
-- Purchase Orders (Órdenes de Compra) to suppliers
-- Tracks incoming stock before it hits product_suppliers
-- When received → auto-increases stock + logs movement

CREATE SEQUENCE IF NOT EXISTS po_number_seq START 1;

CREATE TABLE IF NOT EXISTS purchase_orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number     TEXT UNIQUE NOT NULL
                  DEFAULT ('OC-' || LPAD(nextval('po_number_seq')::TEXT, 5, '0')),
  supplier_id   UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  status        TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','sent','partial','received','cancelled')),
  -- items: [{ product_id, product_name, sku, qty_ordered, unit_cost }]
  items         JSONB NOT NULL DEFAULT '[]',
  subtotal      NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes         TEXT,
  expected_date DATE,
  received_at   TIMESTAMPTZ,
  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_po_supplier  ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_status    ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_created   ON purchase_orders(created_at DESC);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "po_admin_all"
  ON purchase_orders FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','vendedor'))
  );

CREATE TRIGGER purchase_orders_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ── Receive PO: update product_suppliers stock + log movement ─────────────────
CREATE OR REPLACE FUNCTION receive_purchase_order(p_po_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_po   RECORD;
  v_item JSONB;
  v_pid  INTEGER;
  v_qty  INTEGER;
BEGIN
  SELECT * INTO v_po FROM purchase_orders WHERE id = p_po_id;

  IF v_po IS NULL THEN
    RAISE EXCEPTION 'Orden de compra % no encontrada', p_po_id;
  END IF;
  IF v_po.status IN ('received', 'cancelled') THEN
    RAISE EXCEPTION 'La OC ya fue recibida o está cancelada';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_po.items)
  LOOP
    v_pid := (v_item->>'product_id')::INTEGER;
    v_qty := (v_item->>'qty_ordered')::INTEGER;

    -- Upsert product_suppliers row for this supplier
    INSERT INTO product_suppliers (product_id, supplier_id, cost_price, stock_available, price_multiplier)
    VALUES (
      v_pid,
      v_po.supplier_id,
      COALESCE((v_item->>'unit_cost')::NUMERIC, 0),
      v_qty,
      1.0
    )
    ON CONFLICT (product_id, supplier_id) DO UPDATE
      SET stock_available = product_suppliers.stock_available + v_qty,
          cost_price      = CASE
            WHEN (v_item->>'unit_cost') IS NOT NULL
            THEN (v_item->>'unit_cost')::NUMERIC
            ELSE product_suppliers.cost_price
          END,
          updated_at      = now();

    -- Log stock movement
    INSERT INTO stock_movements (
      product_id, supplier_id, movement_type,
      quantity_delta, reference_id, reference_type,
      notes, created_by
    ) VALUES (
      v_pid,
      v_po.supplier_id,
      'sync',
      v_qty,
      p_po_id::TEXT,
      'purchase_order',
      'OC ' || v_po.po_number || ' recibida',
      auth.uid()
    );
  END LOOP;

  UPDATE purchase_orders
  SET status      = 'received',
      received_at = now(),
      updated_at  = now()
  WHERE id = p_po_id;
END;
$$;
