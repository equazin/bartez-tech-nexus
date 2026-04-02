-- ── 063_preorder_pickup_points.sql ──────────────────────────────────────
-- Supporting pre-orders (containers arriving) and pick-up points
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Pre-order support on products
ALTER TABLE products ADD COLUMN IF NOT EXISTS allow_preorder BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS expected_arrival DATE; -- container arrival date
ALTER TABLE products ADD COLUMN IF NOT EXISTS preorder_notes TEXT;

-- 2. Pick-up Points (linked to Warehouses or external sites)
-- We already have warehouses, let's add metadata for pick-up
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS opening_hours TEXT;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS allows_pickup BOOLEAN DEFAULT true;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS google_maps_url TEXT;

-- 3. Pre-order logic extension (allowing reservation on negative stock for preorders)
-- Update the reserve_stock function to allow pre-orders if product.allow_preorder = true
CREATE OR REPLACE FUNCTION reserve_stock_create_order_v5(
  p_client_id  UUID,
  p_products   JSONB,
  p_total      NUMERIC,
  p_notes      TEXT      DEFAULT NULL,
  p_payment    TEXT      DEFAULT 'transferencia',
  p_surcharge  NUMERIC   DEFAULT 0,
  p_ship_type  TEXT      DEFAULT NULL,
  p_ship_addr  TEXT      DEFAULT NULL,
  p_ship_cost  NUMERIC   DEFAULT 0,
  p_warehouse_id UUID    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_profile        RECORD;
  v_item           JSONB;
  v_product_id     INTEGER;
  v_quantity       INTEGER;
  v_order_id       BIGINT;
  v_order_number   TEXT;
  v_target_wh      UUID;
  v_allow_pre      BOOLEAN;
BEGIN
  -- ── Client checks ────────────────────────────────────────────────────────
  SELECT credit_limit, credit_used, estado INTO v_profile FROM profiles WHERE id = p_client_id;
  IF v_profile.estado = 'bloqueado' THEN RAISE EXCEPTION 'Cuenta bloqueada.'; END IF;
  
  -- ── Stock reservation ──────────────────────────────────────────────────────
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_products) LOOP
    v_product_id := (v_item->>'product_id')::INTEGER;
    v_quantity   := (v_item->>'quantity')::INTEGER;
    
    SELECT allow_preorder INTO v_allow_pre FROM products WHERE id = v_product_id;

    -- Pick warehouse
    SELECT warehouse_id INTO v_target_wh FROM product_stocks 
    WHERE product_id = v_product_id AND (stock - stock_reserved) >= v_quantity
    ORDER BY (stock - stock_reserved) DESC LIMIT 1;

    -- If no stock in warehouses but allowed preorder, pick primary warehouse (CABA)
    IF v_target_wh IS NULL AND v_allow_pre = true THEN
       SELECT id INTO v_target_wh FROM warehouses WHERE location = 'CABA' LIMIT 1;
    END IF;

    IF v_target_wh IS NULL AND v_allow_pre = false THEN
      RAISE EXCEPTION 'Sin stock disponible para ID %', v_product_id;
    END IF;

    -- Update or Insert stock reservation
    INSERT INTO product_stocks (product_id, warehouse_id, stock_reserved)
    VALUES (v_product_id, v_target_wh, v_quantity)
    ON CONFLICT (product_id, warehouse_id) 
    DO UPDATE SET stock_reserved = product_stocks.stock_reserved + v_quantity;
  END LOOP;

  -- ── Create Order ───────────────────────────────────────────────────────────
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
