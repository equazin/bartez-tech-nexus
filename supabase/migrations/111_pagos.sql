-- =============================================================================
-- Teqo · Fase 7 · Pagos
-- Cada medio es un proveedor intercambiable que se activa por configuración. Un
-- pedido pasa a pagado SOLO por tienda_marcar_pagado, que llaman la función del
-- aviso firmado de Mercado Pago (api/pagos.ts) y la validación manual de una
-- transferencia hecha por un administrador. Los avisos quedan en avisos_recibidos:
-- el mismo aviso dos veces no duplica nada. La tabla payments de Bartez (comprobantes
-- de clientes con cuenta) queda como estaba; la tienda usa `pagos`.
-- =============================================================================

CREATE TABLE IF NOT EXISTS medios_de_pago (
  id             text PRIMARY KEY CHECK (id IN ('mercadopago', 'transferencia')),
  nombre         text NOT NULL,
  detalle        text NOT NULL DEFAULT '',
  activo         boolean NOT NULL DEFAULT true,
  orden          integer NOT NULL DEFAULT 0,
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

INSERT INTO medios_de_pago (id, nombre, detalle, activo, orden) VALUES
  ('mercadopago',   'Mercado Pago',           'Tarjeta de crédito en cuotas, débito o dinero en cuenta. Pagás en Mercado Pago y volvés a la tienda.', true, 1),
  ('transferencia', 'Transferencia bancaria', 'Te damos los datos de la cuenta al confirmar. El pedido se prepara cuando se acredita.', true, 2)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE medios_de_pago ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS medios_de_pago_leer ON medios_de_pago;
CREATE POLICY medios_de_pago_leer ON medios_de_pago FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS pagos (
  id                   bigserial PRIMARY KEY,
  order_id             bigint NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  proveedor            text NOT NULL CHECK (proveedor IN ('mercadopago', 'transferencia')),
  estado               text NOT NULL DEFAULT 'pendiente'
                       CHECK (estado IN ('pendiente', 'aprobado', 'rechazado', 'reintegrado', 'vencido', 'cancelado')),
  monto                numeric(14,2) NOT NULL,
  moneda               text NOT NULL DEFAULT 'ARS',
  id_externo           text,
  referencia           text,
  cuotas               integer,
  detalle              jsonb NOT NULL DEFAULT '{}'::jsonb,
  nota                 text,
  reintegrado_monto    numeric(14,2) NOT NULL DEFAULT 0,
  reintegro_clave      text,
  reintegro_id_externo text,
  validado_por         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  aprobado_en          timestamptz,
  creado_en            timestamptz NOT NULL DEFAULT now(),
  actualizado_en       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pagos_externo ON pagos(proveedor, id_externo) WHERE id_externo IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pagos_pedido ON pagos(order_id, creado_en DESC);

ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pagos_panel ON pagos;
CREATE POLICY pagos_panel ON pagos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND lower(p.role) IN ('admin', 'vendedor', 'sales')));

CREATE TABLE IF NOT EXISTS avisos_recibidos (
  id          bigserial PRIMARY KEY,
  proveedor   text NOT NULL,
  id_externo  text NOT NULL,
  recibido_en timestamptz NOT NULL DEFAULT now(),
  cuerpo      jsonb,
  resultado   text,
  UNIQUE (proveedor, id_externo)
);

ALTER TABLE avisos_recibidos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS avisos_recibidos_panel ON avisos_recibidos;
CREATE POLICY avisos_recibidos_panel ON avisos_recibidos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'admin'));

INSERT INTO tienda_configuracion (clave, valor, descripcion) VALUES
  ('transferencia', '{"titular": null, "cuit": null, "banco": null, "cbu": null, "alias": null}'::jsonb,
   'La cuenta para transferir. Sin cargar, la tienda muestra que los datos están a confirmar.'),
  ('pendiente_vence_horas', 'null'::jsonb,
   'Horas que un pedido puede quedar pendiente de pago antes de vencer y liberar el stock. Nulo: no vence.')
ON CONFLICT (clave) DO NOTHING;

-- ── Liberar la reserva de stock de un pedido ────────────────────────────────
CREATE OR REPLACE FUNCTION tienda_liberar_reserva(p_order_id bigint)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE products p
  SET stock_reserved = greatest(coalesce(p.stock_reserved, 0) - i.cantidad, 0)
  FROM (SELECT product_id, sum(quantity)::integer AS cantidad FROM order_items WHERE order_id = p_order_id GROUP BY product_id) i
  WHERE p.id = i.product_id;
$$;

-- ── Volver a reservar lo de un pedido (una transferencia que llega tarde). Devuelve falso si no alcanza. ──
CREATE OR REPLACE FUNCTION tienda_reservar_de_nuevo(p_order_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_linea record;
  v_disponible integer;
BEGIN
  FOR v_linea IN SELECT product_id, sum(quantity)::integer AS cantidad FROM order_items WHERE order_id = p_order_id GROUP BY product_id LOOP
    SELECT stock - coalesce(stock_reserved, 0) INTO v_disponible FROM products WHERE id = v_linea.product_id FOR UPDATE;
    IF v_disponible IS NULL OR v_disponible < v_linea.cantidad THEN
      RETURN false;
    END IF;
  END LOOP;
  FOR v_linea IN SELECT product_id, sum(quantity)::integer AS cantidad FROM order_items WHERE order_id = p_order_id GROUP BY product_id LOOP
    UPDATE products SET stock_reserved = coalesce(stock_reserved, 0) + v_linea.cantidad WHERE id = v_linea.product_id;
  END LOOP;
  RETURN true;
END;
$$;

-- ── El único lugar que marca un pedido como pagado ──────────────────────────
CREATE OR REPLACE FUNCTION tienda_marcar_pagado(p_order_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_estado text;
  v_reservado boolean := true;
BEGIN
  SELECT status INTO v_estado FROM orders WHERE id = p_order_id FOR UPDATE;
  IF v_estado IS NULL THEN
    RAISE EXCEPTION 'El pedido % no existe.', p_order_id;
  END IF;
  IF v_estado = 'pagado' THEN
    RETURN false;
  END IF;
  IF v_estado NOT IN ('pendiente_pago', 'vencido') THEN
    RAISE EXCEPTION 'El pedido % está "%": no se puede marcar pagado.', p_order_id, v_estado;
  END IF;
  IF v_estado = 'vencido' THEN
    v_reservado := tienda_reservar_de_nuevo(p_order_id);
  END IF;
  UPDATE orders
  SET status = 'pagado',
      pagado_en = now(),
      notes = CASE WHEN v_reservado THEN notes ELSE concat_ws(' · ', notes, 'Pagada sin stock: el pago llegó cuando el pedido ya había vencido y no quedaba stock. Revisar.') END
  WHERE id = p_order_id;
  RETURN true;
END;
$$;

-- ── Cancelar o vencer un pedido pendiente: libera el stock ──────────────────
CREATE OR REPLACE FUNCTION tienda_cancelar_pedido(p_order_id bigint, p_estado text DEFAULT 'cancelado', p_motivo text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_estado text;
BEGIN
  IF p_estado NOT IN ('cancelado', 'vencido') THEN
    RAISE EXCEPTION 'Estado de cancelación inválido: %', p_estado;
  END IF;
  SELECT status INTO v_estado FROM orders WHERE id = p_order_id FOR UPDATE;
  IF v_estado IS NULL OR v_estado <> 'pendiente_pago' THEN
    RETURN false;
  END IF;
  PERFORM tienda_liberar_reserva(p_order_id);
  UPDATE orders SET status = p_estado, notes = concat_ws(' · ', notes, p_motivo) WHERE id = p_order_id;
  UPDATE pagos SET estado = p_estado, actualizado_en = now() WHERE order_id = p_order_id AND estado = 'pendiente';
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION tienda_vencer_pendientes(p_horas integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id bigint;
  v_cantidad integer := 0;
BEGIN
  IF p_horas IS NULL OR p_horas <= 0 THEN
    RETURN 0;
  END IF;
  FOR v_id IN
    SELECT id FROM orders
    WHERE status = 'pendiente_pago' AND origen = 'tienda' AND created_at < now() - make_interval(hours => p_horas)
    ORDER BY created_at
    LIMIT 500
  LOOP
    IF tienda_cancelar_pedido(v_id, 'vencido', 'Venció el plazo para pagar.') THEN
      v_cantidad := v_cantidad + 1;
    END IF;
  END LOOP;
  RETURN v_cantidad;
END;
$$;

REVOKE ALL ON FUNCTION tienda_liberar_reserva(bigint) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION tienda_reservar_de_nuevo(bigint) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION tienda_marcar_pagado(bigint) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION tienda_cancelar_pedido(bigint, text, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION tienda_vencer_pendientes(integer) FROM public, anon, authenticated;
