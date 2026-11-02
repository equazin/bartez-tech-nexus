-- ── 060_multi_warehouse.sql ──────────────────────────────────────────────
-- Multi-warehouse support for Argentina sites
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Warehouses table
CREATE TABLE IF NOT EXISTS warehouses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  location    TEXT, -- 'CABA', 'Norte', 'Sur', etc.
  address     TEXT,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Seed basic warehouses
INSERT INTO warehouses (name, location, address)
VALUES 
  ('Central CABA', 'CABA', 'Av. Corrientes 1234, CABA'),
  ('Interior Norte', 'Santa Fe', 'Bv. Oroño 456, Rosario, SF'),
  ('Logística Sur', 'Neuquén', 'Ruta 22 Km 1200, Nqn')
ON CONFLICT DO NOTHING;

-- 2. Product-Warehouse stock
CREATE TABLE IF NOT EXISTS product_stocks (
  product_id      INTEGER REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id    UUID REFERENCES warehouses(id) ON DELETE CASCADE,
  stock           INTEGER DEFAULT 0,
  stock_reserved  INTEGER DEFAULT 0,
  updated_at      TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (product_id, warehouse_id)
);

-- Trigger to update overall product stock 
-- (This maintains compatibility with existing code that reads products.stock)
CREATE OR REPLACE FUNCTION update_global_product_stock()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE products
  SET 
    stock = (SELECT COALESCE(SUM(stock), 0) FROM product_stocks WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)),
    stock_reserved = (SELECT COALESCE(SUM(stock_reserved), 0) FROM product_stocks WHERE product_id = COALESCE(NEW.product_id, OLD.product_id))
  WHERE id = COALESCE(NEW.product_id, OLD.product_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_global_stock_trg ON product_stocks;
CREATE TRIGGER update_global_stock_trg
AFTER INSERT OR UPDATE OR DELETE ON product_stocks
FOR EACH ROW EXECUTE FUNCTION update_global_product_stock();

-- 3. Update create_order RPC to support warehouse-specific subtraction
-- If no warehouse is specified, it uses priority (CABA -> Interior -> Sur)
CREATE OR REPLACE FUNCTION reserve_stock_create_order_v4(
  p_client_id  UUID,
  p_products   JSONB,
  p_total      NUMERIC,
  p_notes      TEXT      DEFAULT NULL,
  p_payment    TEXT      DEFAULT 'transferencia',
  p_surcharge  NUMERIC   DEFAULT 0,
  p_ship_type  TEXT      DEFAULT NULL,
  p_ship_addr  TEXT      DEFAULT NULL,
  p_ship_cost  NUMERIC   DEFAULT 0,
  p_warehouse_id UUID    DEFAULT NULL -- Optional specific warehouse
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_profile        RECORD;
  v_item           JSONB;
  v_product_id     INTEGER;
  v_quantity       INTEGER;
  v_order_id       BIGINT; -- Matches orders.id type
  v_order_number   TEXT;
  v_target_wh      UUID;
BEGIN
  -- ── Client checks ────────────────────────────────────────────────────────
  SELECT credit_limit, credit_used, estado INTO v_profile FROM profiles WHERE id = p_client_id;
  IF v_profile.estado = 'bloqueado' THEN RAISE EXCEPTION 'Cuenta bloqueada.'; END IF;
  
  -- Use myInvoices or invoices depending on DB
  IF EXISTS (SELECT 1 FROM invoices WHERE client_id = p_client_id AND status NOT IN ('paid', 'cancelled') AND due_date < now()) THEN
    RAISE EXCEPTION 'Facturas vencidas.';
  END IF;

  -- ── Stock reservation ──────────────────────────────────────────────────────
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_products) LOOP
    v_product_id := (v_item->>'product_id')::INTEGER;
    v_quantity   := (v_item->>'quantity')::INTEGER;

    -- Pick warehouse
    IF p_warehouse_id IS NOT NULL THEN
      v_target_wh := p_warehouse_id;
    ELSE
      -- Pick the one with most stock
      SELECT warehouse_id INTO v_target_wh FROM product_stocks 
      WHERE product_id = v_product_id AND (stock - stock_reserved) >= v_quantity
      ORDER BY (stock - stock_reserved) DESC LIMIT 1;
    END IF;

    IF v_target_wh IS NULL THEN
      RAISE EXCEPTION 'Sin stock disponible en ninguna sucursal para ID %', v_product_id;
    END IF;

    UPDATE product_stocks
    SET stock_reserved = stock_reserved + v_quantity
    WHERE product_id = v_product_id AND warehouse_id = v_target_wh;
  END LOOP;

  -- ── Create Order ───────────────────────────────────────────────────────────
  -- sequence might be order_number_seq or invoice_number_seq
  SELECT 'ORD-' || LPAD(nextval('order_number_seq')::TEXT, 6, '0') INTO v_order_number;

  INSERT INTO orders (
    client_id, products, total, status, order_number, notes, payment_method,
    shipping_type, shipping_address, shipping_cost, created_at, updated_at
  )
  VALUES (
    p_client_id, p_products, p_total, 'pending', v_order_number, p_notes, p_payment,
    p_ship_type, p_ship_addr, p_ship_cost, now(), now()
  )
  RETURNING id INTO v_order_id;

  RETURN jsonb_build_object('id', v_order_id, 'order_number', v_order_number);
END;
$$;
