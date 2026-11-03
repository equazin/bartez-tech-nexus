-- =============================================================================
-- Teqo · New Bytes, un mayorista que despacha directo al cliente
--
-- 1. suppliers: despacho_directo y la tarifa plana de envío (una por pedido) con su demora.
--    New Bytes despacha con Entregar; la tarifa la carga Andrés en Configuración › Envíos.
-- 2. tienda_proveedor_de: quién despacha un producto. La fila activa con stock más barata
--    (si ninguna tiene stock, la activa más barata), la misma que pone el costo.
-- 3. reconciliar_costos_y_stock toma esa misma fila.
-- 4. order_items.despacha_proveedor_id: quién despacha cada línea, guardado al vender.
-- 5. tienda_cotizar_envio_carrito: si el carrito mezcla lo que despacha Teqo con lo que
--    despacha un mayorista, se cobra solo el envío más alto (decisión de Nico del 3/11/2026).
-- Idempotente.
-- =============================================================================

-- 1. Proveedores que despachan directo
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS despacho_directo boolean NOT NULL DEFAULT false;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS envio_tarifa_plana numeric(12,2);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS envio_demora_dias_min integer;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS envio_demora_dias_max integer;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'suppliers_envio_directo_valido') THEN
    ALTER TABLE suppliers ADD CONSTRAINT suppliers_envio_directo_valido CHECK (
      (envio_tarifa_plana IS NULL OR envio_tarifa_plana >= 0)
      AND (envio_demora_dias_min IS NULL OR envio_demora_dias_min >= 0)
      AND (envio_demora_dias_max IS NULL OR envio_demora_dias_min IS NULL OR envio_demora_dias_max >= envio_demora_dias_min)
    );
  END IF;
END $$;

INSERT INTO suppliers (name, lead_time_days, default_margin, price_multiplier, active, notes, website, despacho_directo)
SELECT 'New Bytes', 0, 0, 1, true,
  'Mayorista por API (api.nb.com.ar). Despacha directo al cliente con Entregar. Credenciales en Vercel: NB_API_USER y NB_API_PASSWORD.',
  'https://www.nb.com.ar', true
WHERE NOT EXISTS (SELECT 1 FROM suppliers s WHERE lower(replace(trim(s.name), ' ', '')) = 'newbytes');

UPDATE suppliers SET despacho_directo = true WHERE lower(replace(trim(name), ' ', '')) = 'newbytes' AND NOT despacho_directo;

-- 2. Quién despacha un producto
CREATE OR REPLACE FUNCTION tienda_proveedor_de(p_product_id integer)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ps.supplier_id
  FROM product_suppliers ps
  WHERE ps.product_id = p_product_id
  ORDER BY (NOT ps.active),
           (coalesce(ps.stock_available, 0) - coalesce(ps.stock_reserved, 0) <= 0),
           ps.cost_price,
           ps.id
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION tienda_proveedor_de(integer) FROM public, anon, authenticated;

-- 3. El costo sale de la misma fila que despacha
CREATE OR REPLACE FUNCTION reconciliar_costos_y_stock(p_ids integer[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cambiados integer;
BEGIN
  WITH elegido AS (
    SELECT DISTINCT ON (ps.product_id) ps.product_id, ps.cost_price
    FROM product_suppliers ps
    WHERE ps.product_id = ANY (p_ids)
    ORDER BY ps.product_id,
             (NOT ps.active),
             (coalesce(ps.stock_available, 0) - coalesce(ps.stock_reserved, 0) <= 0),
             ps.cost_price,
             ps.id
  ),
  neto AS (
    SELECT ps.product_id, greatest(0, coalesce(sum(ps.stock_available), 0) - coalesce(sum(ps.stock_reserved), 0))::integer AS stock
    FROM product_suppliers ps
    WHERE ps.active AND ps.product_id = ANY (p_ids)
    GROUP BY ps.product_id
  )
  UPDATE products p
  SET cost_price = e.cost_price,
      stock = coalesce(n.stock, 0),
      updated_at = now()
  FROM elegido e
  LEFT JOIN neto n ON n.product_id = e.product_id
  WHERE p.id = e.product_id
    AND (p.cost_price IS DISTINCT FROM e.cost_price OR coalesce(p.stock, 0) <> coalesce(n.stock, 0));

  GET DIAGNOSTICS v_cambiados = ROW_COUNT;
  RETURN v_cambiados;
END;
$$;

REVOKE ALL ON FUNCTION reconciliar_costos_y_stock(integer[]) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION reconciliar_costos_y_stock(integer[]) TO service_role;

-- 4. Quién despacha cada línea vendida
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS despacha_proveedor_id uuid REFERENCES suppliers(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION tienda_order_item_despacho()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.product_id IS NOT NULL AND NEW.despacha_proveedor_id IS NULL THEN
    NEW.despacha_proveedor_id := tienda_proveedor_de(NEW.product_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_items_despacho ON order_items;
CREATE TRIGGER trg_order_items_despacho BEFORE INSERT ON order_items
  FOR EACH ROW EXECUTE FUNCTION tienda_order_item_despacho();

-- 5. El envío del carrito: p_items = [{"product_id": 1, "cantidad": 2}, ...]
CREATE OR REPLACE FUNCTION tienda_cotizar_envio_carrito(p_items jsonb, p_subtotal numeric DEFAULT 0)
RETURNS TABLE (precio numeric, demora_dias_min integer, demora_dias_max integer, gratis boolean, disponible boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_defecto     numeric := coalesce(tienda_config_numero('peso_por_defecto_kg', 1), 1);
  v_gratis      numeric := tienda_config_numero('envio_gratis_desde', NULL);
  v_peso_propio numeric := 0;
  v_hay_propio  boolean := false;
  v_precio      numeric := NULL;
  v_min         integer := NULL;
  v_max         integer := NULL;
  v_cotizable   boolean := true;
  r             record;
  t             record;
BEGIN
  FOR r IN
    SELECT coalesce(p.weight_kg, 0) AS peso,
           greatest(1, coalesce((i->>'cantidad')::integer, 1)) AS cantidad,
           coalesce(s.despacho_directo, false) AS directo,
           s.envio_tarifa_plana AS tarifa,
           s.envio_demora_dias_min AS dmin,
           s.envio_demora_dias_max AS dmax
    FROM jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) AS i
    JOIN products p ON p.id = (i->>'product_id')::integer
    LEFT JOIN suppliers s ON s.id = tienda_proveedor_de(p.id)
  LOOP
    IF r.directo THEN
      IF r.tarifa IS NULL THEN
        v_cotizable := false;
      ELSE
        -- Una tarifa plana por pedido: varios productos del mismo mayorista no la suman.
        v_precio := greatest(coalesce(v_precio, 0), r.tarifa);
        v_min := greatest(coalesce(v_min, 0), coalesce(r.dmin, 0));
        v_max := greatest(coalesce(v_max, 0), coalesce(r.dmax, r.dmin, 0));
      END IF;
    ELSE
      v_hay_propio := true;
      v_peso_propio := v_peso_propio + (CASE WHEN r.peso > 0 THEN r.peso ELSE v_defecto END) * r.cantidad;
    END IF;
  END LOOP;

  IF v_hay_propio THEN
    SELECT * INTO t FROM tienda_cotizar_envio(v_peso_propio, 0);
    IF NOT coalesce(t.disponible, false) OR t.precio IS NULL THEN
      v_cotizable := false;
    ELSE
      v_precio := greatest(coalesce(v_precio, 0), t.precio);
      v_min := greatest(coalesce(v_min, 0), coalesce(t.demora_dias_min, 0));
      v_max := greatest(coalesce(v_max, 0), coalesce(t.demora_dias_max, 0));
    END IF;
  END IF;

  IF NOT v_cotizable OR v_precio IS NULL THEN
    RETURN QUERY SELECT NULL::numeric, NULL::integer, NULL::integer, false, false;
    RETURN;
  END IF;
  IF v_gratis IS NOT NULL AND coalesce(p_subtotal, 0) >= v_gratis THEN
    RETURN QUERY SELECT 0::numeric, v_min, v_max, true, true;
    RETURN;
  END IF;
  RETURN QUERY SELECT v_precio, v_min, v_max, false, true;
END;
$$;

GRANT EXECUTE ON FUNCTION tienda_cotizar_envio_carrito(jsonb, numeric) TO anon, authenticated;
