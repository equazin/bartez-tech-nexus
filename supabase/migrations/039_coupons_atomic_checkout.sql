-- --- PHASE 5.4: INTEGRACIÓN ATÓMICA DE CUPONES EN CHECKOUT ---

-- 1. Agregar columnas de cupones a la tabla de órdenes
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS coupon_id UUID REFERENCES coupons(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0;

-- 2. Actualizar el RPC para manejar cupones de forma segura y atómica
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
  p_coupon_id             uuid    DEFAULT NULL,
  p_discount_amount        numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_number  text;
  v_order_id      bigint; -- Corregido a bigint para coincidir con orders.id
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

  -- Validate and reserve stock for each product atomically
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_products)
  LOOP
    v_product_id := (v_item->>'product_id')::integer;
    v_quantity   := (v_item->>'quantity')::integer;

    -- Lock the row to prevent concurrent modifications
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

    -- Reserve stock
    UPDATE products
       SET stock_reserved = v_reserved + v_quantity
     WHERE id = v_product_id;
  END LOOP;

  -- Create the order
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

  -- Si hay un cupón, registrar uso y actualizar contador
  IF p_coupon_id IS NOT NULL THEN
    -- Incrementar contador de usos del cupón
    UPDATE coupons 
       SET used_count = used_count + 1 
     WHERE id = p_coupon_id;

    -- Registrar en el log de usos
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

COMMENT ON COLUMN orders.coupon_id IS 'ID del cupón aplicado a esta orden';
COMMENT ON COLUMN orders.discount_amount IS 'Monto total descontado por el cupón';
