-- ── 072_order_items_dual_write.sql ───────────────────────────────────────────
-- Extends reserve_stock_and_create_order to dual-write into the normalized
-- order_items table (alongside the legacy JSONB products column).
--
-- The checkout API sends p_products as JSONB with enriched line-item data:
--   [{ product_id, quantity, name, sku, unit_price, total_price, cost_price, margin, iva_rate }, ...]
--
-- Strategy: ADDITIVE — JSONB column is NOT removed (backward compat).
-- Idempotent: safe to run multiple times.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION reserve_stock_and_create_order(
  p_client_id              uuid,
  p_products               jsonb,
  p_total                  numeric,
  p_status                 text    DEFAULT 'pending',
  p_payment_method         text    DEFAULT NULL,
  p_payment_surcharge_pct  numeric DEFAULT NULL,
  p_shipping_type          text    DEFAULT NULL,
  p_shipping_address       text    DEFAULT NULL,
  p_shipping_transport     text    DEFAULT NULL,
  p_shipping_cost          numeric DEFAULT NULL,
  p_notes                  text    DEFAULT NULL,
  p_coupon_id              uuid    DEFAULT NULL,
  p_discount_amount        numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_number  text;
  v_order_id      bigint;
  v_item          jsonb;
  v_product_id    integer;
  v_quantity      integer;
  v_stock         integer;
  v_reserved      integer;
  v_available     integer;
  v_product_name  text;
BEGIN
  -- Generate server-side order number
  v_order_number := 'ORD-' || LPAD(nextval('order_number_seq')::text, 4, '0');

  -- Validate and reserve stock atomically
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_products)
  LOOP
    v_product_id := (v_item->>'product_id')::integer;
    v_quantity   := (v_item->>'quantity')::integer;

    SELECT stock, COALESCE(stock_reserved, 0), name
      INTO v_stock, v_reserved, v_product_name
      FROM products
     WHERE id = v_product_id
       FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Producto no encontrado: ID %', v_product_id;
    END IF;

    v_available := v_stock - v_reserved;

    IF v_quantity > v_available THEN
      RAISE EXCEPTION 'Stock insuficiente para "%": disponible %, solicitado %',
        v_product_name, v_available, v_quantity;
    END IF;

    UPDATE products
       SET stock_reserved = v_reserved + v_quantity
     WHERE id = v_product_id;
  END LOOP;

  -- Create the order (JSONB column kept for backward compat)
  INSERT INTO orders (
    client_id, products, total, status, order_number,
    payment_method, payment_surcharge_pct,
    shipping_type, shipping_address, shipping_transport, shipping_cost,
    notes, coupon_id, discount_amount, created_at
  ) VALUES (
    p_client_id, p_products, p_total, p_status, v_order_number,
    p_payment_method, p_payment_surcharge_pct,
    p_shipping_type, p_shipping_address, p_shipping_transport, p_shipping_cost,
    p_notes, p_coupon_id, p_discount_amount, now()
  )
  RETURNING id INTO v_order_id;

  -- ── NEW: dual-write normalized order_items ────────────────────────────────
  INSERT INTO order_items (
    order_id, product_id, name, sku,
    quantity, cost_price, unit_price, total_price,
    margin, iva_rate, created_at
  )
  SELECT
    v_order_id,
    (item->>'product_id')::integer,
    COALESCE(item->>'name', 'Producto'),
    item->>'sku',
    GREATEST(1, (item->>'quantity')::integer),
    (item->>'cost_price')::numeric,
    COALESCE((item->>'unit_price')::numeric,  0),
    COALESCE((item->>'total_price')::numeric, 0),
    (item->>'margin')::numeric,
    COALESCE((item->>'iva_rate')::numeric, 21),
    now()
  FROM jsonb_array_elements(p_products) AS item
  WHERE (item->>'product_id') IS NOT NULL
    AND (item->>'product_id')::integer > 0;
  -- ─────────────────────────────────────────────────────────────────────────

  -- Coupon: increment usage counter and log
  IF p_coupon_id IS NOT NULL THEN
    UPDATE coupons
       SET used_count = used_count + 1
     WHERE id = p_coupon_id;

    INSERT INTO coupon_usage (
      coupon_id, order_id, client_id, discount_amount, used_at
    ) VALUES (
      p_coupon_id, v_order_id, p_client_id, p_discount_amount, now()
    );
  END IF;

  RETURN jsonb_build_object(
    'id',           v_order_id,
    'order_number', v_order_number,
    'status',       p_status
  );
END;
$$;

COMMENT ON FUNCTION reserve_stock_and_create_order IS
  'Atomically reserves stock and creates an order. Dual-writes to both the legacy '
  'JSONB products column and the normalized order_items table (migration 072).';
