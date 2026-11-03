-- =============================================================================
-- Teqo · Fase 6 · Envíos iguales a todo el país
-- Una tarifa nacional por rango de peso, a domicilio, sin zonas por código postal,
-- sin retiro en sucursal y sin transportes a elegir. Sin tarifas cargadas la tienda
-- no cotiza: los valores reales los carga Andrés en Configuración › Envíos.
-- =============================================================================

CREATE TABLE IF NOT EXISTS tarifas_envio (
  id              bigserial PRIMARY KEY,
  peso_hasta_kg   numeric(8,3) NOT NULL CHECK (peso_hasta_kg > 0),
  precio          numeric(12,2) NOT NULL CHECK (precio >= 0),
  demora_dias_min integer NOT NULL DEFAULT 3 CHECK (demora_dias_min >= 0),
  demora_dias_max integer NOT NULL DEFAULT 7 CHECK (demora_dias_max >= demora_dias_min),
  activo          boolean NOT NULL DEFAULT true,
  actualizado_en  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tarifas_envio_peso ON tarifas_envio(peso_hasta_kg) WHERE activo;

INSERT INTO tienda_configuracion (clave, valor, descripcion) VALUES
  ('envio_gratis_desde',   'null'::jsonb, 'Subtotal en pesos desde el que el envío es gratis. Nulo: nunca.'),
  ('peso_por_defecto_kg',  '1'::jsonb,    'Peso que se asume para cotizar un producto sin peso cargado.')
ON CONFLICT (clave) DO NOTHING;

-- Cualquiera lee las tarifas (la tienda cotiza con ellas); solo un administrador las cambia.
ALTER TABLE tarifas_envio ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tarifas_envio_leer ON tarifas_envio;
CREATE POLICY tarifas_envio_leer ON tarifas_envio FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS tarifas_envio_admin ON tarifas_envio;
CREATE POLICY tarifas_envio_admin ON tarifas_envio FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'admin'));

-- ── La cotización: la primera tarifa cuyo tope cubre el peso; si ninguna, la más pesada ──
CREATE OR REPLACE FUNCTION tienda_cotizar_envio(p_peso_kg numeric, p_subtotal numeric DEFAULT 0)
RETURNS TABLE (precio numeric, demora_dias_min integer, demora_dias_max integer, gratis boolean, disponible boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_peso   numeric := greatest(coalesce(p_peso_kg, 0), 0.001);
  v_gratis numeric := tienda_config_numero('envio_gratis_desde', NULL);
  t        tarifas_envio%ROWTYPE;
BEGIN
  SELECT * INTO t FROM tarifas_envio WHERE activo AND peso_hasta_kg >= v_peso ORDER BY peso_hasta_kg ASC LIMIT 1;
  IF NOT FOUND THEN
    SELECT * INTO t FROM tarifas_envio WHERE activo ORDER BY peso_hasta_kg DESC LIMIT 1;
  END IF;
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::numeric, NULL::integer, NULL::integer, false, false;
    RETURN;
  END IF;
  IF v_gratis IS NOT NULL AND coalesce(p_subtotal, 0) >= v_gratis THEN
    RETURN QUERY SELECT 0::numeric, t.demora_dias_min, t.demora_dias_max, true, true;
  ELSE
    RETURN QUERY SELECT t.precio, t.demora_dias_min, t.demora_dias_max, false, true;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION tienda_cotizar_envio(numeric, numeric) TO anon, authenticated;

-- Nadie retira en ningún depósito: la tienda manda todo a domicilio.
UPDATE warehouses SET allows_pickup = false WHERE allows_pickup = true;
