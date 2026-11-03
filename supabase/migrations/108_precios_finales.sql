-- =============================================================================
-- Teqo · Fase 4 · Precios finales en pesos
-- El precio que ve el consumidor se calcula acá, en la base, y se guarda en
-- products.precio_final_ars (con IVA incluido) y products.precio_lista_ars (el
-- tachado de una oferta). La tienda nunca convierte moneda en el navegador.
--
--   costo en pesos  = cost_price × supplier_multiplier × (dólar vigente si el proveedor cotiza en USD)
--   precio de lista = redondear( costo en pesos × (1 + margen) × (1 + IVA) )
--   precio final    = el menor entre la lista, special_price y la lista con offer_percent
--
-- El margen sale de pricing_rules (producto, categoría, proveedor, etiqueta o prefijo
-- de SKU; las reglas por cliente no aplican) y, si ninguna coincide, del margen base
-- de tienda_configuracion. Un producto con precio_manual conserva lo que cargó el panel.
-- =============================================================================

CREATE TABLE IF NOT EXISTS tienda_configuracion (
  clave           text PRIMARY KEY,
  valor           jsonb NOT NULL,
  descripcion     text,
  actualizado_en  timestamptz NOT NULL DEFAULT now(),
  actualizado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

INSERT INTO tienda_configuracion (clave, valor, descripcion) VALUES
  ('margen_base',    '20'::jsonb,   'Margen en % cuando ninguna regla de precios coincide. Lo define Andrés en Precios › Dólar y margen.'),
  ('redondeo_pesos', '10'::jsonb,   'Los precios finales se redondean al múltiplo de este valor en pesos.'),
  ('cuotas_maximas', 'null'::jsonb, 'Tope de cuotas que la tienda muestra y ofrece. Nulo: las que da Mercado Pago.')
ON CONFLICT (clave) DO NOTHING;

CREATE TABLE IF NOT EXISTS cotizacion_dolar (
  id            bigserial PRIMARY KEY,
  valor         numeric(12,4) NOT NULL CHECK (valor > 0),
  fuente        text NOT NULL DEFAULT 'manual' CHECK (fuente IN ('manual', 'api')),
  nota          text,
  vigente_desde timestamptz NOT NULL DEFAULT now(),
  cargado_por   uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_cotizacion_dolar_vigente ON cotizacion_dolar(vigente_desde DESC);

ALTER TABLE products ADD COLUMN IF NOT EXISTS precio_manual        boolean NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS precio_calculado_en  timestamptz;

-- Solo el panel (usuarios con sesión) lee la configuración y el dólar; escribe el servidor con la clave de servicio.
ALTER TABLE tienda_configuracion ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotizacion_dolar     ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tienda_configuracion_leer ON tienda_configuracion;
CREATE POLICY tienda_configuracion_leer ON tienda_configuracion FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS cotizacion_dolar_leer ON cotizacion_dolar;
CREATE POLICY cotizacion_dolar_leer ON cotizacion_dolar FOR SELECT TO authenticated USING (true);

-- ── Lecturas de configuración ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION tienda_config_numero(p_clave text, p_defecto numeric)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN jsonb_typeof(c.valor) = 'number' THEN (c.valor #>> '{}')::numeric
    ELSE p_defecto
  END
  FROM tienda_configuracion c
  WHERE c.clave = p_clave
  UNION ALL
  SELECT p_defecto
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION dolar_vigente()
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT valor FROM cotizacion_dolar ORDER BY vigente_desde DESC, id DESC LIMIT 1;
$$;

-- ── Margen: la mejor regla que coincide, como en src/lib/pricingEngine.ts ─────
CREATE OR REPLACE FUNCTION tienda_margen_para(p products)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(
    (
      SELECT CASE WHEN r.fixed_markup IS NOT NULL THEN r.fixed_markup ELSE r.min_margin END
      FROM pricing_rules r
      WHERE r.active = true
        AND (r.expires_at IS NULL OR r.expires_at > now())
        AND (
             (r.condition_type = 'product'    AND r.condition_value = p.id::text)
          OR (r.condition_type = 'category'   AND lower(trim(r.condition_value)) = lower(trim(coalesce(p.category, ''))))
          OR (r.condition_type = 'supplier'   AND (r.condition_value = coalesce(p.supplier_id::text, '') OR lower(trim(r.condition_value)) = lower(trim(coalesce(p.supplier_name, '')))))
          OR (r.condition_type = 'tag'        AND lower(trim(r.condition_value)) IN (SELECT lower(trim(t)) FROM unnest(coalesce(p.tags, ARRAY[]::text[])) AS t))
          OR (r.condition_type = 'sku_prefix' AND upper(coalesce(p.sku, '')) LIKE upper(r.condition_value) || '%')
        )
      ORDER BY r.priority DESC,
               CASE r.condition_type WHEN 'product' THEN 4 WHEN 'category' THEN 2 ELSE 1 END DESC
      LIMIT 1
    ),
    tienda_config_numero('margen_base', 20)
  );
$$;

CREATE OR REPLACE FUNCTION tienda_redondear(p_valor numeric)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN p_valor IS NULL THEN NULL
    ELSE round(p_valor / greatest(tienda_config_numero('redondeo_pesos', 10), 1)) * greatest(tienda_config_numero('redondeo_pesos', 10), 1)
  END;
$$;

-- ── El precio de un producto con un dólar dado ──────────────────────────────
CREATE OR REPLACE FUNCTION tienda_calcular_precio(p products, p_dolar numeric)
RETURNS TABLE (precio_final numeric, precio_lista numeric)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_moneda   text;
  v_factor   numeric;
  v_costo    numeric;
  v_iva      numeric;
  v_margen   numeric;
  v_lista    numeric;
  v_final    numeric;
  v_oferta   numeric;
BEGIN
  -- La moneda del costo vive en product_suppliers (migración 022): la fila del proveedor principal, o la preferida.
  SELECT ps.source_currency INTO v_moneda
  FROM product_suppliers ps
  WHERE ps.product_id = p.id
  ORDER BY (ps.supplier_id = p.primary_supplier_id) DESC, ps.is_preferred DESC, ps.updated_at DESC
  LIMIT 1;
  v_moneda := coalesce(v_moneda, 'USD');

  IF v_moneda = 'USD' AND (p_dolar IS NULL OR p_dolar <= 0) THEN
    RETURN QUERY SELECT NULL::numeric, NULL::numeric;
    RETURN;
  END IF;

  v_factor := CASE WHEN v_moneda = 'USD' THEN p_dolar ELSE 1 END;
  v_costo  := coalesce(p.cost_price, 0) * coalesce(p.supplier_multiplier, 1) * v_factor;

  IF v_costo <= 0 THEN
    RETURN QUERY SELECT NULL::numeric, NULL::numeric;
    RETURN;
  END IF;

  v_iva    := coalesce(p.iva_rate, 21);
  v_margen := tienda_margen_para(p);
  v_lista  := tienda_redondear(v_costo * (1 + v_margen / 100) * (1 + v_iva / 100));
  v_final  := v_lista;

  IF p.special_price IS NOT NULL AND p.special_price > 0 THEN
    v_oferta := tienda_redondear(p.special_price * v_factor * (1 + v_iva / 100));
    IF v_oferta < v_final THEN v_final := v_oferta; END IF;
  END IF;

  IF p.offer_percent IS NOT NULL AND p.offer_percent > 0 THEN
    v_oferta := tienda_redondear(v_lista * (1 - p.offer_percent / 100));
    IF v_oferta < v_final THEN v_final := v_oferta; END IF;
  END IF;

  RETURN QUERY SELECT v_final, CASE WHEN v_final < v_lista THEN v_lista ELSE NULL::numeric END;
END;
$$;

-- ── Recalcular todo (o un producto) con el dólar vigente ────────────────────
CREATE OR REPLACE FUNCTION recalcular_precios(p_solo_id integer DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_dolar numeric := dolar_vigente();
  v_cantidad integer;
BEGIN
  UPDATE products p
  SET precio_final_ars   = c.precio_final,
      precio_lista_ars   = c.precio_lista,
      precio_calculado_en = now()
  FROM LATERAL tienda_calcular_precio(p, v_dolar) AS c
  WHERE p.precio_manual = false
    AND (p_solo_id IS NULL OR p.id = p_solo_id);
  GET DIAGNOSTICS v_cantidad = ROW_COUNT;
  RETURN v_cantidad;
END;
$$;

REVOKE ALL ON FUNCTION recalcular_precios(integer) FROM public, anon, authenticated;

-- ── Cada producto se recalcula solo cuando cambia lo que lo define ───────────
CREATE OR REPLACE FUNCTION tienda_precio_en_el_producto()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_dolar numeric := dolar_vigente();
  v_final numeric;
  v_lista numeric;
BEGIN
  IF NEW.precio_manual THEN
    RETURN NEW;
  END IF;
  SELECT c.precio_final, c.precio_lista INTO v_final, v_lista
  FROM tienda_calcular_precio(NEW, v_dolar) AS c;
  NEW.precio_final_ars := v_final;
  NEW.precio_lista_ars := v_lista;
  NEW.precio_calculado_en := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tienda_precio_en_el_producto ON products;
CREATE TRIGGER trg_tienda_precio_en_el_producto
  BEFORE INSERT OR UPDATE OF cost_price, supplier_multiplier, special_price, offer_percent, iva_rate,
                             primary_supplier_id, category, tags, sku, precio_manual ON products
  FOR EACH ROW EXECUTE FUNCTION tienda_precio_en_el_producto();

-- Cambió una regla o la configuración: se recalcula todo.
CREATE OR REPLACE FUNCTION tienda_recalcular_todo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM recalcular_precios();
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_pricing_rules_recalcular ON pricing_rules;
CREATE TRIGGER trg_pricing_rules_recalcular
  AFTER INSERT OR UPDATE OR DELETE ON pricing_rules
  FOR EACH STATEMENT EXECUTE FUNCTION tienda_recalcular_todo();

DROP TRIGGER IF EXISTS trg_tienda_configuracion_recalcular ON tienda_configuracion;
CREATE TRIGGER trg_tienda_configuracion_recalcular
  AFTER INSERT OR UPDATE ON tienda_configuracion
  FOR EACH STATEMENT EXECUTE FUNCTION tienda_recalcular_todo();

DROP TRIGGER IF EXISTS trg_cotizacion_dolar_recalcular ON cotizacion_dolar;
CREATE TRIGGER trg_cotizacion_dolar_recalcular
  AFTER INSERT ON cotizacion_dolar
  FOR EACH STATEMENT EXECUTE FUNCTION tienda_recalcular_todo();
