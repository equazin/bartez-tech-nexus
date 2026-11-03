-- Fix: p_client_id was incorrectly cast to text before inserting into
-- orders.client_id which is uuid. Remove the ::text cast.

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
  p_notes                  text    DEFAULT NULL
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
  v_order_number := 'ORD-' || LPAD(nextval('order_number_seq')::text, 4, '0');

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

  INSERT INTO orders (
    client_id, products, total, status, order_number,
    payment_method, payment_surcharge_pct,
    shipping_type, shipping_address, shipping_transport, shipping_cost,
    notes, created_at
  ) VALUES (
    p_client_id, p_products, p_total, p_status, v_order_number,
    p_payment_method, p_payment_surcharge_pct,
    p_shipping_type, p_shipping_address, p_shipping_transport, p_shipping_cost,
    p_notes, now()
  )
  RETURNING id INTO v_order_id;

  RETURN jsonb_build_object(
    'id',           v_order_id,
    'order_number', v_order_number,
    'status',       p_status
  );
END;
$$;
