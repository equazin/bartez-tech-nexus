-- ── 013_stock_audit_credit.sql ──────────────────────────────────────────────
-- 1. Stock movements audit trail
-- 2. Unreserve stock RPC (fixes orphaned stock bug)
-- 3. Credit enforcement in order creation
-- 4. Order status change trigger (auto-unreserve on cancel/reject)

-- ── 1. STOCK MOVEMENTS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_movements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id     INTEGER     NOT NULL REFERENCES products(id),
  supplier_id    UUID        REFERENCES suppliers(id),
  movement_type  TEXT        NOT NULL CHECK (movement_type IN (
                   'sync',          -- proveedor actualizó stock
                   'reserve',       -- orden creada (stock reservado)
                   'unreserve',     -- orden cancelada (stock liberado)
                   'fulfill',       -- orden despachada (stock real consumido)
                   'adjust',        -- ajuste manual admin
                   'return'         -- devolución
                 )),
  quantity_delta INTEGER     NOT NULL,   -- positive = increase, negative = decrease
  stock_before   INTEGER,
  stock_after    INTEGER,
  reference_id   TEXT,                   -- order_id, sync_batch_id, etc.
  reference_type TEXT,                   -- 'order' | 'sync' | 'manual'
  notes          TEXT,
  created_by     UUID        REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sm_product_id   ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_sm_created_at   ON stock_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sm_reference_id ON stock_movements(reference_id);

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sm_admin_all"
  ON stock_movements FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','vendedor'))
  );

-- ── 2. UNRESERVE STOCK RPC ───────────────────────────────────────────────────
--    Called when: order is cancelled, rejected, or expired
--    Decrements stock_reserved on products table AND product_suppliers
CREATE OR REPLACE FUNCTION unreserve_stock_for_order(p_order_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_item           JSONB;
  v_product_id     INTEGER;
  v_quantity       INTEGER;
  v_supplier_id    TEXT;
  v_stock_before   INTEGER;
  v_stock_after    INTEGER;
  v_items_released INTEGER := 0;
BEGIN
  -- Validate order exists
  IF NOT EXISTS (SELECT 1 FROM orders WHERE id = p_order_id::UUID) THEN
    RAISE EXCEPTION 'Orden % no encontrada', p_order_id;
  END IF;

  -- Release stock for each item in the order
  FOR v_item IN
    SELECT jsonb_array_elements(products) FROM orders WHERE id = p_order_id::UUID
  LOOP
    v_product_id  := (v_item->>'product_id')::INTEGER;
    v_quantity    := (v_item->>'quantity')::INTEGER;
    v_supplier_id := v_item->>'supplier_id';   -- optional, may be NULL

    -- Read current stock_reserved (for audit)
    SELECT stock_reserved INTO v_stock_before
    FROM products WHERE id = v_product_id;

    -- Decrement products.stock_reserved (never below 0)
    UPDATE products
    SET stock_reserved = GREATEST(0, stock_reserved - v_quantity)
    WHERE id = v_product_id
    RETURNING stock_reserved INTO v_stock_after;

    -- Also decrement product_suppliers if supplier tracked
    IF v_supplier_id IS NOT NULL THEN
      UPDATE product_suppliers
      SET stock_reserved = GREATEST(0, stock_reserved - v_quantity)
      WHERE product_id = v_product_id
        AND supplier_id = v_supplier_id::UUID;
    END IF;

    -- Audit trail
    INSERT INTO stock_movements (
      product_id, supplier_id, movement_type,
      quantity_delta, stock_before, stock_after,
      reference_id, reference_type
    ) VALUES (
      v_product_id,
      CASE WHEN v_supplier_id IS NOT NULL THEN v_supplier_id::UUID ELSE NULL END,
      'unreserve',
      v_quantity,
      v_stock_before,
      v_stock_after,
      p_order_id,
      'order'
    );

    v_items_released := v_items_released + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success',         true,
    'order_id',        p_order_id,
    'items_released',  v_items_released
  );
END;
$$;

-- ── 3. FULFILL STOCK RPC ─────────────────────────────────────────────────────
--    Called when order is DISPATCHED — converts reserved → consumed
--    (Decrements both stock AND stock_reserved)
CREATE OR REPLACE FUNCTION fulfill_stock_for_order(p_order_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_item        JSONB;
  v_product_id  INTEGER;
  v_quantity    INTEGER;
  v_supplier_id TEXT;
  v_stock_before INTEGER;
  v_stock_after  INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM orders WHERE id = p_order_id::UUID) THEN
    RAISE EXCEPTION 'Orden % no encontrada', p_order_id;
  END IF;

  FOR v_item IN
    SELECT jsonb_array_elements(products) FROM orders WHERE id = p_order_id::UUID
  LOOP
    v_product_id  := (v_item->>'product_id')::INTEGER;
    v_quantity    := (v_item->>'quantity')::INTEGER;
    v_supplier_id := v_item->>'supplier_id';

    SELECT stock INTO v_stock_before FROM products WHERE id = v_product_id;

    -- Remove from real stock AND release reservation simultaneously
    UPDATE products
    SET
      stock          = GREATEST(0, stock - v_quantity),
      stock_reserved = GREATEST(0, stock_reserved - v_quantity)
    WHERE id = v_product_id
    RETURNING stock INTO v_stock_after;

    IF v_supplier_id IS NOT NULL THEN
      UPDATE product_suppliers
      SET
        stock_available = GREATEST(0, stock_available - v_quantity),
        stock_reserved  = GREATEST(0, stock_reserved - v_quantity)
      WHERE product_id = v_product_id AND supplier_id = v_supplier_id::UUID;
    END IF;

    INSERT INTO stock_movements (
      product_id, supplier_id, movement_type,
      quantity_delta, stock_before, stock_after,
      reference_id, reference_type
    ) VALUES (
      v_product_id,
      CASE WHEN v_supplier_id IS NOT NULL THEN v_supplier_id::UUID ELSE NULL END,
      'fulfill',
      -v_quantity,
      v_stock_before,
      v_stock_after,
      p_order_id,
      'order'
    );
  END LOOP;

  RETURN jsonb_build_object('success', true, 'order_id', p_order_id);
END;
$$;

-- ── 4. ORDER STATUS TRIGGER ───────────────────────────────────────────────────
--    Auto-unreserve on rejection/cancellation
--    Auto-fulfill on dispatch
CREATE OR REPLACE FUNCTION handle_order_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Status went to rejected → unreserve stock
  IF NEW.status IN ('rejected') AND OLD.status NOT IN ('rejected') THEN
    PERFORM unreserve_stock_for_order(NEW.id::TEXT);
  END IF;

  -- Status went to dispatched → consume stock
  IF NEW.status = 'dispatched' AND OLD.status != 'dispatched' THEN
    PERFORM fulfill_stock_for_order(NEW.id::TEXT);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER order_status_stock_trigger
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION handle_order_status_change();

-- ── 5. CREDIT ENFORCEMENT ─────────────────────────────────────────────────────
--    Extend reserve_stock_and_create_order to validate credit limit.
--    We add a wrapper that checks credit BEFORE calling the base RPC.
--    Full replacement so we don't break existing calls.
CREATE OR REPLACE FUNCTION reserve_stock_create_order_v2(
  p_client_id  UUID,
  p_products   JSONB,
  p_total      NUMERIC,
  p_notes      TEXT      DEFAULT NULL,
  p_payment    TEXT      DEFAULT 'transferencia',
  p_surcharge  NUMERIC   DEFAULT 0,
  p_ship_type  TEXT      DEFAULT NULL,
  p_ship_addr  TEXT      DEFAULT NULL,
  p_ship_cost  NUMERIC   DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_profile        RECORD;
  v_item           JSONB;
  v_product_id     INTEGER;
  v_quantity       INTEGER;
  v_avail          INTEGER;
  v_reserved       INTEGER;
  v_order_id       UUID;
  v_order_number   TEXT;
  v_stock_before   INTEGER;
  v_stock_after    INTEGER;
BEGIN
  -- ── Load client profile ────────────────────────────────────────────────────
  SELECT credit_limit, credit_used, client_type
  INTO v_profile
  FROM profiles WHERE id = p_client_id;

  -- ── Credit check ────────────────────────────────────────────────────────────
  IF v_profile.credit_limit IS NOT NULL
    AND v_profile.credit_limit > 0
    AND (COALESCE(v_profile.credit_used, 0) + p_total) > v_profile.credit_limit
  THEN
    RAISE EXCEPTION 'Crédito insuficiente. Límite: %. Usado: %. Pedido: %',
      v_profile.credit_limit, COALESCE(v_profile.credit_used, 0), p_total;
  END IF;

  -- ── Stock reservation (same logic as original RPC) ────────────────────────
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_products) LOOP
    v_product_id := (v_item->>'product_id')::INTEGER;
    v_quantity   := (v_item->>'quantity')::INTEGER;

    SELECT stock, COALESCE(stock_reserved, 0)
    INTO v_avail, v_reserved
    FROM products WHERE id = v_product_id FOR UPDATE;

    IF (v_avail - v_reserved) < v_quantity THEN
      RAISE EXCEPTION 'Stock insuficiente para producto %. Disponible: %, Solicitado: %',
        v_product_id, (v_avail - v_reserved), v_quantity;
    END IF;

    SELECT stock INTO v_stock_before FROM products WHERE id = v_product_id;

    UPDATE products
    SET stock_reserved = stock_reserved + v_quantity
    WHERE id = v_product_id
    RETURNING stock INTO v_stock_after;

    -- Audit: reserve movement
    INSERT INTO stock_movements (
      product_id, movement_type, quantity_delta,
      stock_before, stock_after, reference_type
    ) VALUES (
      v_product_id, 'reserve', v_quantity,
      v_stock_before, v_stock_after, 'order'
    );
  END LOOP;

  -- ── Create order ─────────────────────────────────────────────────────────
  v_order_number := 'ORD-' || LPAD(nextval('order_number_seq')::TEXT, 4, '0');

  INSERT INTO orders (
    client_id, products, total, status, order_number,
    notes, payment_method, payment_surcharge_pct,
    shipping_type, shipping_address, shipping_cost
  )
  VALUES (
    p_client_id, p_products, p_total, 'pending', v_order_number,
    p_notes, p_payment, p_surcharge,
    p_ship_type, p_ship_addr, p_ship_cost
  )
  RETURNING id INTO v_order_id;

  -- ── Reserve credit ─────────────────────────────────────────────────────
  IF v_profile.credit_limit IS NOT NULL AND v_profile.credit_limit > 0 THEN
    UPDATE profiles
    SET credit_used = COALESCE(credit_used, 0) + p_total
    WHERE id = p_client_id;
  END IF;

  RETURN jsonb_build_object(
    'id',           v_order_id,
    'order_number', v_order_number,
    'status',       'pending'
  );
END;
$$;

-- ── 6. CREDIT RELEASE ON ORDER RESOLUTION ────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_order_credit_release()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Release credit when order is rejected or delivered
  IF NEW.status IN ('rejected', 'delivered')
    AND OLD.status NOT IN ('rejected', 'delivered')
    AND NEW.total IS NOT NULL
  THEN
    UPDATE profiles
    SET credit_used = GREATEST(0, COALESCE(credit_used, 0) - NEW.total)
    WHERE id = NEW.client_id::UUID;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER order_credit_release_trigger
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION handle_order_credit_release();
