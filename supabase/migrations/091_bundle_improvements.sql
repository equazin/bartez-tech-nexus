-- ── 091_bundle_improvements.sql ──────────────────────────────────────────────
-- 1. Soft-delete on product_bundles (deleted_at)
-- 2. bundle_id / bundle_name nullable columns on order_items
-- 3. Update reserve_stock_and_create_order to write bundle fields
-- 4. Trigger: prevent deletion of the last option on a required slot
-- Idempotent: safe to run multiple times.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Soft-delete column ─────────────────────────────────────────────────────
ALTER TABLE product_bundles
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Index so active-bundle queries stay fast
CREATE INDEX IF NOT EXISTS idx_product_bundles_deleted_at
  ON product_bundles (deleted_at)
  WHERE deleted_at IS NULL;

-- Update RLS / existing policies: active portal query already filters active=true;
-- admin fetch (fetchAllBundles) will now also filter deleted_at IS NULL.

-- ── 2. Bundle tracking columns on order_items ─────────────────────────────────
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS bundle_id   UUID DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bundle_name TEXT DEFAULT NULL;

COMMENT ON COLUMN order_items.bundle_id   IS 'UUID of the bundle this line item belongs to (nullable)';
COMMENT ON COLUMN order_items.bundle_name IS 'Snapshot of bundle title at order time (nullable)';

-- ── 3. Update reserve_stock_and_create_order to persist bundle metadata ────────
-- Drop all overloaded versions first (same pattern as migration 072)
DROP FUNCTION IF EXISTS reserve_stock_and_create_order(uuid, jsonb, numeric, text, text, numeric, text, text, text, numeric, text, uuid, numeric);
DROP FUNCTION IF EXISTS reserve_stock_and_create_order(uuid, jsonb, numeric, text, text, numeric, text, text, text, numeric, text, text, uuid, numeric);
DROP FUNCTION IF EXISTS reserve_stock_and_create_order(uuid, jsonb, numeric, text, text, numeric, text, text, text, numeric, text);
DROP FUNCTION IF EXISTS reserve_stock_and_create_order(uuid, jsonb, numeric, text, text, numeric, text, text, text, numeric);
DROP FUNCTION IF EXISTS reserve_stock_and_create_order(uuid, jsonb, numeric, text);
DROP FUNCTION IF EXISTS reserve_stock_and_create_order(uuid, jsonb, numeric);

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

  -- ── Dual-write normalized order_items (with bundle metadata) ─────────────
  INSERT INTO order_items (
    order_id, product_id, name, sku,
    quantity, cost_price, unit_price, total_price,
    margin, iva_rate,
    bundle_id, bundle_name,
    created_at
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
    NULLIF(item->>'bundle_id',   '')::uuid,
    NULLIF(item->>'bundle_name', ''),
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
  'JSONB products column and the normalized order_items table. '
  'Persists bundle_id and bundle_name from line-item JSONB (migration 091).';

-- ── 4. Trigger: protect required slot from losing its last option ─────────────
CREATE OR REPLACE FUNCTION check_required_slot_has_option()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_required   boolean;
  v_slot_label text;
  v_count      integer;
BEGIN
  -- Get the slot's required flag
  SELECT required, label
    INTO v_required, v_slot_label
    FROM bundle_slots
   WHERE id = OLD.slot_id;

  IF NOT FOUND OR NOT v_required THEN
    RETURN OLD; -- optional slots can be emptied freely
  END IF;

  -- Count remaining options after this delete
  SELECT COUNT(*)
    INTO v_count
    FROM bundle_slot_options
   WHERE slot_id = OLD.slot_id
     AND id <> OLD.id;

  IF v_count = 0 THEN
    RAISE EXCEPTION
      'No se puede eliminar la única opción del slot requerido "%". Agregue otra opción primero.',
      v_slot_label;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_required_slot_protect ON bundle_slot_options;

CREATE TRIGGER trg_required_slot_protect
  BEFORE DELETE ON bundle_slot_options
  FOR EACH ROW
  EXECUTE FUNCTION check_required_slot_has_option();

COMMENT ON TRIGGER trg_required_slot_protect ON bundle_slot_options IS
  'Prevents deleting the last option from a required slot (migration 091).';
