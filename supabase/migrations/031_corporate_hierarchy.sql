-- ── 031_corporate_hierarchy.sql ──────────────────────────────────────────────
-- Enable Corporate Approval: Multi-user per client (Buyer/Manager)

-- 1. Extend profiles for hierarchy
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS parent_id           UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS b2b_role            TEXT DEFAULT 'manager'
    CHECK (b2b_role IN ('manager', 'buyer', 'admin')),
  ADD COLUMN IF NOT EXISTS approval_threshold  NUMERIC(14,2) DEFAULT 0; -- 0 = always requires approval for buyers

-- Index for hierarchy queries
CREATE INDEX IF NOT EXISTS idx_profiles_parent ON profiles(parent_id);

-- 2. Extend orders for approval tracking
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS approved_by    UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at    TIMESTAMPTZ;

-- Update status check to include 'pending_approval'
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending_approval', 'pending', 'approved', 'preparing', 'shipped', 'delivered', 'rejected', 'dispatched'));

-- 3. Upgrade reserve_stock_create_order_v2 to handle hierarchy
CREATE OR REPLACE FUNCTION public.reserve_stock_create_order_v2(
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
  v_target_status  TEXT := 'pending';
BEGIN
  -- ── Load client profile ────────────────────────────────────────────────────
  SELECT credit_limit, credit_used, client_type, b2b_role, approval_threshold, parent_id
  INTO v_profile
  FROM profiles WHERE id = p_client_id;

  -- ── Corporate Approval Logic ───────────────────────────────────────────────
  -- If user is a Buyer, order goes to 'pending_approval' instead of 'pending'
  IF v_profile.b2b_role = 'buyer' AND v_profile.parent_id IS NOT NULL THEN
    IF v_profile.approval_threshold = 0 OR p_total > v_profile.approval_threshold THEN
        v_target_status := 'pending_approval';
    END IF;
  END IF;

  -- ── Credit check (skipped if pending_approval? No, better check now to avoid surprises later)
  IF v_profile.credit_limit IS NOT NULL
    AND v_profile.credit_limit > 0
    AND (COALESCE(v_profile.credit_used, 0) + p_total) > v_profile.credit_limit
  THEN
    RAISE EXCEPTION 'Crédito insuficiente. Límite: %. Usado: %. Pedido: %',
      v_profile.credit_limit, COALESCE(v_profile.credit_used, 0), p_total;
  END IF;

  -- ── Stock reservation ────────────────────────────────────────────────────────
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
    p_client_id, p_products, p_total, v_target_status, v_order_number,
    p_notes, p_payment, p_surcharge,
    p_ship_type, p_ship_addr, p_ship_cost
  )
  RETURNING id INTO v_order_id;

  -- ── Reserve credit (only if it reaches pending? No, reserve it now to be safe) 
  IF v_profile.credit_limit IS NOT NULL AND v_profile.credit_limit > 0 THEN
    UPDATE profiles
    SET credit_used = COALESCE(credit_used, 0) + p_total
    WHERE id = p_client_id;
  END IF;

  RETURN jsonb_build_object(
    'id',           v_order_id,
    'order_number', v_order_number,
    'status',       v_target_status
  );
END;
$$;

-- 4. RPC: approve_order
-- Allows a Manager or Admin to move an order from 'pending_approval' to 'pending'
CREATE OR REPLACE FUNCTION public.approve_b2b_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_order RECORD;
  v_approver RECORD;
BEGIN
  -- Load order and approver
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  SELECT * INTO v_approver FROM profiles WHERE id = auth.uid();

  IF v_order IS NULL THEN
    RAISE EXCEPTION 'Orden no encontrada';
  END IF;

  IF v_order.status != 'pending_approval' THEN
    RAISE EXCEPTION 'La orden no requiere aprobación (Estado: %)', v_order.status;
  END IF;

  -- Permission Check: Approver must be Admin or Manager of the same company (parent_id)
  IF v_approver.role != 'admin' THEN
    IF v_approver.b2b_role != 'manager' OR v_approver.id != (SELECT parent_id FROM profiles WHERE id = v_order.client_id::UUID) THEN
      RAISE EXCEPTION 'Sin permisos para aprobar esta orden';
    END IF;
  END IF;

  -- Approve order
  UPDATE orders
  SET status      = 'pending',
      approved_by = auth.uid(),
      approved_at = now()
  WHERE id = p_order_id;

  -- Notify user? (This would be handled by the existing trigger that monitors status changes)

  RETURN jsonb_build_object('success', true, 'new_status', 'pending');
END;
$$;
