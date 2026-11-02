-- ── 058_argentina_b2b_enforcement.sql ──────────────────────────────────────
-- Advanced Credit, Overdue blocking, and Tax calculations
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Helper to check if a client has overdue invoices
CREATE OR REPLACE FUNCTION check_overdue_debt(p_client_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM invoices 
    WHERE client_id = p_client_id 
      AND status NOT IN ('paid', 'cancelled') 
      AND (due_date < now() OR (created_at + INTERVAL '45 days' < now())) -- Fallback if due_date missing
  );
END;
$$;

-- 2. New Version of Order Creation with Overdue Blocking
-- Overwrites reserve_stock_create_order_v2 or creates V3
CREATE OR REPLACE FUNCTION reserve_stock_create_order_v3(
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
  v_has_overdue    BOOLEAN;
BEGIN
  -- ── Load client profile ────────────────────────────────────────────────────
  SELECT credit_limit, credit_used, estado 
  INTO v_profile
  FROM profiles WHERE id = p_client_id;

  -- ── Status check ────────────────────────────────────────────────────────────
  IF v_profile.estado = 'bloqueado' THEN
    RAISE EXCEPTION 'Tu cuenta se encuentra bloqueada por el administrador.';
  END IF;

  -- ── Overdue debt check ──────────────────────────────────────────────────────
  v_has_overdue := check_overdue_debt(p_client_id);
  IF v_has_overdue THEN
    RAISE EXCEPTION 'No podes realizar nuevos pedidos debido a que tenes facturas vencidas pendientes de pago.';
  END IF;

  -- ── Credit check ────────────────────────────────────────────────────────────
  IF v_profile.credit_limit IS NOT NULL
    AND v_profile.credit_limit > 0
    AND (COALESCE(v_profile.credit_used, 0) + p_total) > v_profile.credit_limit
  THEN
    RAISE EXCEPTION 'Límite de crédito excedido. Disponible: %', 
      (v_profile.credit_limit - COALESCE(v_profile.credit_used, 0));
  END IF;

  -- ── Stock reservation ──────────────────────────────────────────────────────
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_products) LOOP
    v_product_id := (v_item->>'product_id')::INTEGER;
    v_quantity   := (v_item->>'quantity')::INTEGER;

    SELECT stock, COALESCE(stock_reserved, 0)
    INTO v_avail, v_reserved
    FROM products WHERE id = v_product_id FOR UPDATE;

    IF (v_avail - v_reserved) < v_quantity THEN
      RAISE EXCEPTION 'Stock insuficiente para producto ID %', v_product_id;
    END IF;

    UPDATE products
    SET stock_reserved = COALESCE(stock_reserved, 0) + v_quantity
    WHERE id = v_product_id;
  END LOOP;

  -- ── Create order ─────────────────────────────────────────────────────────
  v_order_number := 'ORD-' || LPAD(nextval('order_number_seq')::TEXT, 6, '0');

  INSERT INTO orders (
    client_id, products, total, status, order_number,
    notes, payment_method, payment_surcharge_pct,
    shipping_type, shipping_address, shipping_cost,
    price_lock_expires_at
  )
  VALUES (
    p_client_id, p_products, p_total, 'pending', v_order_number,
    p_notes, p_payment, p_surcharge,
    p_ship_type, p_ship_addr, p_ship_cost,
    now() + INTERVAL '48 hours' -- Default price lock for Argentina inflation
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

-- 3. Automatic Tax calculation on Invoice creation (Trigger)
CREATE OR REPLACE FUNCTION calculate_invoice_taxes_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_client_iibb_aliquot NUMERIC;
  v_client_province     TEXT;
BEGIN
  -- Get client tax info
  SELECT iibb_aliquot, iibb_province 
  INTO v_client_iibb_aliquot, v_client_province
  FROM profiles WHERE id = NEW.client_id;

  -- Only if it's an AR client
  IF v_client_province IS NOT NULL THEN
    -- Calculate IIBB amount based on Net (before VAT)
    -- Assuming invoice.total includes VAT 21%. Net = total / 1.21
    NEW.iibb_amount := (NEW.total / 1.21) * (COALESCE(v_client_iibb_aliquot, 0) / 100);
    
    -- Store perception details for PDF rendering
    NEW.perception_details := jsonb_build_array(
      jsonb_build_object(
        'name', 'IIBB ' || v_client_province,
        'aliquot', v_client_iibb_aliquot,
        'amount', NEW.iibb_amount
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_invoice_taxes_trg
  BEFORE INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION calculate_invoice_taxes_trigger();
