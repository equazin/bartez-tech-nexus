-- Armá tu PC: PC armadas y servicios, con su menú propio en el panel (Armá tu PC).
--
-- pc_armadas      las PC que aparecen arriba del armador. El precio no se guarda: es la suma de las
--                 piezas, así sigue al costo y al dólar. La tienda solo ve las publicadas con todas
--                 las piezas en la tienda, con precio y con stock.
-- servicios_tienda armado, sistema y drivers, o cualquier otro. Precio final con IVA por medio de pago;
--                 sin precio para cada medio activo, la tienda no lo muestra.
-- order_items     una línea puede ser un servicio (servicio_id) en vez de un producto: no reserva stock.

-- ── PC armadas ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pc_armadas (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre         text        NOT NULL CHECK (length(trim(nombre)) BETWEEN 1 AND 80),
  texto          text        NOT NULL DEFAULT '' CHECK (length(texto) <= 300),
  publicada      boolean     NOT NULL DEFAULT false,
  orden          integer     NOT NULL DEFAULT 0,
  -- {"procesador": {"id": 164, "cantidad": 1}, "memoria": {"id": 81, "cantidad": 2}, ...}
  piezas         jsonb       NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(piezas) = 'object'),
  creada_en      timestamptz NOT NULL DEFAULT now(),
  actualizada_en timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pc_armadas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pc_armadas_admin ON pc_armadas;
CREATE POLICY pc_armadas_admin ON pc_armadas FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'admin'));

-- Lo que ve la tienda: publicadas y con todas las piezas disponibles. Si una pieza se queda sin
-- stock o sin precio, la PC armada desaparece sola hasta que vuelva.
CREATE OR REPLACE VIEW tienda_pc_armadas AS
SELECT a.id, a.nombre, a.texto, a.orden, a.piezas
FROM pc_armadas a
WHERE a.publicada
  AND a.piezas <> '{}'::jsonb
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_each(a.piezas) AS e(paso, pieza)
    WHERE NOT EXISTS (
      SELECT 1 FROM tienda_productos tp
      WHERE tp.id = CASE WHEN jsonb_typeof(e.pieza->'id') = 'number' THEN (e.pieza->>'id')::integer END
        AND tp.hay_stock
        AND tp.precio_final_ars IS NOT NULL
    )
  );

GRANT SELECT ON tienda_pc_armadas TO anon, authenticated;

-- ── Servicios ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS servicios_tienda (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        text        NOT NULL CHECK (length(trim(nombre)) BETWEEN 1 AND 80),
  texto         text        NOT NULL DEFAULT '' CHECK (length(texto) <= 400),
  -- Precio final con IVA por medio de pago: {"transferencia": 45000, "mercadopago": 49000}
  precios       jsonb       NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(precios) = 'object'),
  -- true: solo con una PC completa en el carrito; false: con cualquier compra.
  solo_con_pc   boolean     NOT NULL DEFAULT true,
  activo        boolean     NOT NULL DEFAULT false,
  orden         integer     NOT NULL DEFAULT 0,
  iva_rate      numeric     NOT NULL DEFAULT 21 CHECK (iva_rate >= 0 AND iva_rate <= 100),
  creado_en     timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE servicios_tienda ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS servicios_tienda_admin ON servicios_tienda;
CREATE POLICY servicios_tienda_admin ON servicios_tienda FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'admin'));

CREATE OR REPLACE FUNCTION servicio_precio_con_medio(p_precios jsonb, p_medio text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN jsonb_typeof(p_precios->p_medio) = 'number' AND (p_precios->>p_medio)::numeric > 0
              THEN (p_precios->>p_medio)::numeric END;
$$;

-- Lo que ve la tienda: activos y con precio para cada medio de pago activo.
CREATE OR REPLACE VIEW tienda_servicios AS
SELECT
  s.id,
  s.nombre,
  s.texto,
  s.solo_con_pc,
  s.orden,
  (SELECT min(servicio_precio_con_medio(s.precios, m.id)) FROM medios_de_pago m WHERE m.activo)::numeric(14,2) AS precio_final_ars,
  (SELECT jsonb_agg(jsonb_build_object('id', m.id, 'nombre', m.nombre, 'precio', servicio_precio_con_medio(s.precios, m.id))
                    ORDER BY servicio_precio_con_medio(s.precios, m.id), m.orden)
     FROM medios_de_pago m WHERE m.activo) AS precios_por_medio
FROM servicios_tienda s
WHERE s.activo
  AND EXISTS (SELECT 1 FROM medios_de_pago m WHERE m.activo)
  AND NOT EXISTS (SELECT 1 FROM medios_de_pago m WHERE m.activo AND servicio_precio_con_medio(s.precios, m.id) IS NULL);

GRANT SELECT ON tienda_servicios TO anon, authenticated;

-- ── Líneas de servicio en los pedidos ────────────────────────────────────────
ALTER TABLE order_items ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS servicio_id uuid;
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_producto_o_servicio;
ALTER TABLE order_items ADD CONSTRAINT order_items_producto_o_servicio CHECK (product_id IS NOT NULL OR servicio_id IS NOT NULL);

-- Igual que en 110, pero las líneas con servicio_id no reservan stock y se guardan sin producto.
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
  v_productos   integer := 0;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'El pedido no tiene productos.';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    CONTINUE WHEN nullif(v_item->>'servicio_id', '') IS NOT NULL;
    v_productos   := v_productos + 1;
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

  IF v_productos = 0 THEN
    RAISE EXCEPTION 'El pedido no tiene productos.';
  END IF;

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
    order_id, product_id, servicio_id, name, sku, quantity,
    cost_price, unit_price, total_price, margin, iva_rate,
    precio_final, costo_pesos, dolar, costo_moneda, created_at
  )
  SELECT
    v_id,
    CASE WHEN nullif(item->>'servicio_id', '') IS NULL THEN (item->>'product_id')::integer END,
    nullif(item->>'servicio_id', '')::uuid,
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

-- ── Datos iniciales ──────────────────────────────────────────────────────────
-- Los dos servicios de la maqueta, inactivos y sin precio: se activan desde el panel al cargar los precios.
INSERT INTO servicios_tienda (nombre, texto, solo_con_pc, activo, orden)
SELECT v.nombre, v.texto, true, false, v.orden
FROM (VALUES
  ('Armado y prueba', 'Armamos la PC, ordenamos los cables, actualizamos el BIOS si hace falta y la probamos antes de enviarla.', 1),
  ('Sistema operativo y drivers', 'Te llega con el sistema operativo y los drivers instalados y actualizados.', 2)
) AS v(nombre, texto, orden)
WHERE NOT EXISTS (SELECT 1 FROM servicios_tienda);

-- Las tres PC armadas de la maqueta aprobada, por SKU. Si falta alguna pieza en esta base, esa PC no se crea.
DO $$
DECLARE
  v_armada record;
  v_piezas jsonb;
  v_par    record;
  v_id     integer;
  v_falta  boolean;
BEGIN
  IF EXISTS (SELECT 1 FROM pc_armadas) THEN
    RETURN;
  END IF;
  FOR v_armada IN
    SELECT * FROM (VALUES
      (1, 'Estudio y oficina', 'Para clases, trabajo y navegar. Usa los gráficos del procesador, sin placa de video.',
        '{"procesador": ["YD3200C5FHBOX", 1], "motherboard": ["A520M-A PRO", 1], "memoria": ["LD4AU016G-B3200GSST", 1], "almacenamiento": ["LNF100X500G- RNNNG", 1], "fuente": ["GP-P550SS", 1], "gabinete": ["E461-KGNN-S00", 1]}'::jsonb),
      (2, 'Gaming Full HD', 'Pensada para jugar en 1080p.',
        '{"procesador": ["100-100001015BOX", 1], "motherboard": ["B650M GAMING WIFI", 1], "memoria": ["AD5U56008G-S", 2], "almacenamiento": ["TM8FPK500G0C101", 1], "video": ["DUAL-RTX5060TI-O8G", 1], "fuente": ["MPE-6502-ACAAG-3BAR", 1], "gabinete": ["GB-C201P", 1]}'::jsonb),
      (3, 'Gaming 1440p', 'Pensada para jugar en 1440p y transmitir.',
        '{"procesador": ["BX80768225", 1], "motherboard": ["B860M AYW GAMING WIFI", 1], "memoria": ["CMK32GX5M2B5200C40", 1], "almacenamiento": ["SDSP71500GAN-000E0", 1], "video": ["PRIME-RX9070GRE-O12G", 1], "fuente": ["GP-UD750GM PG5", 1], "gabinete": ["CC-9011319-WW", 1]}'::jsonb)
    ) AS t(orden, nombre, texto, skus)
  LOOP
    v_piezas := '{}'::jsonb;
    v_falta := false;
    FOR v_par IN SELECT key, value FROM jsonb_each(v_armada.skus) LOOP
      SELECT id INTO v_id FROM products WHERE sku = v_par.value->>0 ORDER BY id LIMIT 1;
      IF v_id IS NULL THEN
        v_falta := true;
        EXIT;
      END IF;
      v_piezas := v_piezas || jsonb_build_object(v_par.key, jsonb_build_object('id', v_id, 'cantidad', (v_par.value->>1)::integer));
    END LOOP;
    IF NOT v_falta THEN
      INSERT INTO pc_armadas (nombre, texto, publicada, orden, piezas) VALUES (v_armada.nombre, v_armada.texto, true, v_armada.orden, v_piezas);
    END IF;
  END LOOP;
END;
$$;
