-- =============================================================================
-- Teqo · Fase 5 · Checkout de invitado
-- Un pedido de la tienda no necesita cuenta: guarda los datos del comprador y la
-- dirección, y se consulta con un token (o con el email y el número de pedido).
-- Cada línea guarda el precio final cobrado, el costo en pesos, el dólar y la
-- moneda del costo del momento de la venta: las métricas nunca recalculan con
-- costos de hoy. El pedido nace "pendiente_pago"; solo la fase de pagos lo marca pagado.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE orders ALTER COLUMN client_id DROP NOT NULL;

-- Los estados de la tienda conviven con los del portal mayorista heredado.
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN (
  'pending_approval', 'pending', 'approved', 'confirmed', 'preparing', 'picked', 'shipped', 'dispatched', 'delivered', 'rejected', 'cancelled',
  'pendiente_pago', 'pagado', 'preparando', 'enviado', 'entregado', 'cancelado', 'reintegrado', 'vencido'
));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS comprador_email       text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS comprador_nombre      text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS comprador_telefono    text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS comprador_documento   text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS direccion_envio       jsonb;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS token_acceso          text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal              numeric(14,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS envio_demora_dias_min integer;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS envio_demora_dias_max integer;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS origen                text NOT NULL DEFAULT 'panel';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pagado_en             timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_token_acceso ON orders(token_acceso) WHERE token_acceso IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_comprador_email ON orders(lower(comprador_email)) WHERE comprador_email IS NOT NULL;

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS precio_final numeric(14,2);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS costo_pesos  numeric(14,2);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS dolar        numeric(12,4);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS costo_moneda text;

-- ── Crear el pedido de un invitado: reserva el stock y escribe todo en una transacción ──
CREATE OR REPLACE FUNCTION tienda_crear_pedido(
  p_items            jsonb,
  p_comprador        jsonb,
  p_direccion        jsonb,
  p_medio_pago       text,
  p_subtotal         numeric,
  p_envio_costo      numeric,
  p_envio_demora_min integer,
  p_envio_demora_max integer,
  p_descuento        numeric,
  p_cupon_id         uuid,
  p_total            numeric,
  p_notas            text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_numero      text;
  v_id          bigint;
  v_token       text;
  v_item        jsonb;
  v_producto_id integer;
  v_cantidad    integer;
  v_stock       integer;
  v_reservado   integer;
  v_nombre      text;
  v_direccion   text;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'El pedido no tiene productos.';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_producto_id := (v_item->>'product_id')::integer;
    v_cantidad    := (v_item->>'quantity')::integer;
    SELECT stock, coalesce(stock_reserved, 0), coalesce(name_custom, name_original, name)
      INTO v_stock, v_reservado, v_nombre
      FROM products WHERE id = v_producto_id AND active = true FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Un producto del carrito ya no está en la tienda.';
    END IF;
    IF v_cantidad <= 0 OR v_cantidad > v_stock - v_reservado THEN
      RAISE EXCEPTION 'No queda stock suficiente de "%": quedan % unidades.', v_nombre, greatest(v_stock - v_reservado, 0);
    END IF;
    UPDATE products SET stock_reserved = v_reservado + v_cantidad WHERE id = v_producto_id;
  END LOOP;

  v_numero := 'ORD-' || lpad(nextval('order_number_seq')::text, 4, '0');
  v_token  := encode(gen_random_bytes(24), 'hex');
  v_direccion := concat_ws(', ',
    nullif(concat_ws(' ', p_direccion->>'calle', p_direccion->>'numero', p_direccion->>'piso'), ''),
    nullif(p_direccion->>'localidad', ''),
    nullif(p_direccion->>'provincia', ''),
    nullif('CP ' || (p_direccion->>'codigo_postal'), 'CP ')
  );

  INSERT INTO orders (
    client_id, products, total, subtotal, status, order_number,
    payment_method, shipping_type, shipping_address, direccion_envio, shipping_cost,
    envio_demora_dias_min, envio_demora_dias_max,
    notes, coupon_id, discount_amount,
    comprador_email, comprador_nombre, comprador_telefono, comprador_documento,
    token_acceso, origen, created_at
  ) VALUES (
    NULL, p_items, p_total, p_subtotal, 'pendiente_pago', v_numero,
    p_medio_pago, 'envio', v_direccion, p_direccion, p_envio_costo,
    p_envio_demora_min, p_envio_demora_max,
    p_notas, p_cupon_id, coalesce(p_descuento, 0),
    lower(trim(p_comprador->>'email')), p_comprador->>'nombre', p_comprador->>'telefono', nullif(p_comprador->>'documento', ''),
    v_token, 'tienda', now()
  )
  RETURNING id INTO v_id;

  INSERT INTO order_items (
    order_id, product_id, name, sku, quantity,
    cost_price, unit_price, total_price, margin, iva_rate,
    precio_final, costo_pesos, dolar, costo_moneda, created_at
  )
  SELECT
    v_id,
    (item->>'product_id')::integer,
    coalesce(item->>'name', 'Producto'),
    item->>'sku',
    greatest(1, (item->>'quantity')::integer),
    (item->>'cost_price')::numeric,
    coalesce((item->>'unit_price')::numeric, 0),
    coalesce((item->>'total_price')::numeric, 0),
    (item->>'margin')::numeric,
    coalesce((item->>'iva_rate')::numeric, 21),
    (item->>'precio_final')::numeric,
    (item->>'costo_pesos')::numeric,
    (item->>'dolar')::numeric,
    item->>'costo_moneda',
    now()
  FROM jsonb_array_elements(p_items) AS item;

  IF p_cupon_id IS NOT NULL THEN
    UPDATE coupons SET used_count = coalesce(used_count, 0) + 1 WHERE id = p_cupon_id;
    INSERT INTO coupon_usage (coupon_id, order_id, client_id, discount_amount, used_at)
    VALUES (p_cupon_id, v_id, NULL, coalesce(p_descuento, 0), now());
  END IF;

  RETURN jsonb_build_object('id', v_id, 'numero', v_numero, 'token', v_token);
END;
$$;

REVOKE ALL ON FUNCTION tienda_crear_pedido(jsonb, jsonb, jsonb, text, numeric, numeric, integer, integer, numeric, uuid, numeric, text) FROM public, anon, authenticated;

-- ── Ver un pedido sin cuenta: con el token, o con el email y el número ───────
CREATE OR REPLACE FUNCTION tienda_pedido(p_id bigint, p_token text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT jsonb_build_object(
    'id', o.id,
    'numero', o.order_number,
    'estado', o.status,
    'creado_en', o.created_at,
    'pagado_en', o.pagado_en,
    'total', o.total,
    'subtotal', o.subtotal,
    'envio_costo', o.shipping_cost,
    'envio_demora_dias_min', o.envio_demora_dias_min,
    'envio_demora_dias_max', o.envio_demora_dias_max,
    'descuento', o.discount_amount,
    'medio_pago', o.payment_method,
    'seguimiento', o.tracking_number,
    'transporte', o.shipping_provider,
    'comprador', jsonb_build_object('nombre', o.comprador_nombre, 'email', o.comprador_email),
    'direccion', o.direccion_envio,
    'items', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'producto_id', i.product_id,
        'nombre', i.name,
        'sku', i.sku,
        'cantidad', i.quantity,
        'precio_final', i.precio_final,
        'slug', p.slug,
        'categoria_slug', c.slug,
        'imagen', p.image
      ) ORDER BY i.id)
      FROM order_items i
      LEFT JOIN products p ON p.id = i.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE i.order_id = o.id
    ), '[]'::jsonb)
  )
  FROM orders o
  WHERE o.id = p_id AND o.token_acceso IS NOT NULL AND o.token_acceso = p_token;
$$;

CREATE OR REPLACE FUNCTION tienda_pedido_por_email(p_email text, p_numero text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT tienda_pedido(o.id, o.token_acceso)
  FROM orders o
  WHERE o.token_acceso IS NOT NULL
    AND lower(o.comprador_email) = lower(trim(p_email))
    AND upper(o.order_number) = upper(trim(p_numero))
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION tienda_pedido(bigint, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION tienda_pedido_por_email(text, text) TO anon, authenticated;
