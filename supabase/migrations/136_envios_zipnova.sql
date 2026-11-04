-- Envíos con Zipnova: lo que despacha Teqo desde su depósito se cotiza por código postal, peso y medidas
-- (a domicilio o retiro en sucursal del transporte), con un margen configurable. Lo que despacha un
-- mayorista directo (New Bytes) sigue con su tarifa plana; si el carrito mezcla, se cobra el envío más alto.
-- El envío en Zipnova se crea con un botón del panel y los avisos de Zipnova actualizan el pedido.

-- 1. Configuración (el token y el secret van en variables de entorno, nunca acá).
INSERT INTO tienda_configuracion (clave, valor)
VALUES ('zipnova', '{"activo": false, "account_id": null, "origen_id": null, "margen_porcentaje": 0, "margen_fijo": 0, "sucursal": true}'::jsonb)
ON CONFLICT (clave) DO NOTHING;

INSERT INTO tienda_configuracion (clave, valor)
VALUES ('envio_medidas_defecto', '{"alto": 15, "ancho": 25, "largo": 30}'::jsonb)
ON CONFLICT (clave) DO NOTHING;

-- 2. Medidas de la caja por categoría, en cm. Los productos tienen peso pero no medidas: se usa la medida de su
-- categoría, si no la de la categoría padre, si no la medida por defecto. Son estimadas y se ajustan en el panel.
CREATE TABLE IF NOT EXISTS envio_medidas (
  categoria_id integer PRIMARY KEY REFERENCES categories(id) ON DELETE CASCADE,
  alto_cm integer NOT NULL CHECK (alto_cm BETWEEN 1 AND 500),
  ancho_cm integer NOT NULL CHECK (ancho_cm BETWEEN 1 AND 500),
  largo_cm integer NOT NULL CHECK (largo_cm BETWEEN 1 AND 500),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE envio_medidas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS envio_medidas_admin ON envio_medidas;
CREATE POLICY envio_medidas_admin ON envio_medidas FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'admin'));

INSERT INTO envio_medidas (categoria_id, alto_cm, ancho_cm, largo_cm)
SELECT c.id, m.alto, m.ancho, m.largo
FROM (VALUES
  ('notebooks', 8, 32, 45),
  ('monitores', 15, 50, 75),
  ('pc-y-componentes', 12, 25, 35),
  ('gabinetes', 30, 50, 55),
  ('perifericos', 8, 20, 50),
  ('gaming', 20, 35, 40),
  ('accesorios-y-red', 10, 25, 30),
  ('sim-racing', 40, 50, 60),
  ('sillas-y-escritorios', 35, 60, 80),
  ('smart-tv', 15, 85, 135)
) AS m(slug, alto, ancho, largo)
JOIN categories c ON c.slug = m.slug
ON CONFLICT (categoria_id) DO NOTHING;

-- 3. El envío en cada pedido.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS envio_detalle jsonb;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS zipnova_envio_id bigint;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS envio_seguimiento_url text;
CREATE UNIQUE INDEX IF NOT EXISTS orders_zipnova_envio_id_key ON orders (zipnova_envio_id) WHERE zipnova_envio_id IS NOT NULL;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_shipping_provider_check;
ALTER TABLE orders ADD CONSTRAINT orders_shipping_provider_check
  CHECK (shipping_provider = ANY (ARRAY['andreani', 'oca', 'propio', 'otro', 'zipnova']));

-- 4. Las partes del envío de un carrito, para el servidor: p_items = [{"product_id": 1, "cantidad": 2}, ...].
-- Cada producto dice si lo despacha un mayorista directo (con su tarifa plana) o Teqo (con peso y medidas).
CREATE OR REPLACE FUNCTION tienda_envio_partes(p_items jsonb)
RETURNS TABLE (
  product_id integer,
  nombre text,
  cantidad integer,
  directo boolean,
  tarifa numeric,
  demora_dias_min integer,
  demora_dias_max integer,
  peso_kg numeric,
  alto_cm integer,
  ancho_cm integer,
  largo_cm integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH defecto AS (
    SELECT coalesce((valor->>'alto')::integer, 15) AS alto,
           coalesce((valor->>'ancho')::integer, 25) AS ancho,
           coalesce((valor->>'largo')::integer, 30) AS largo
    FROM tienda_configuracion WHERE clave = 'envio_medidas_defecto'
    UNION ALL SELECT 15, 25, 30
    LIMIT 1
  )
  SELECT p.id,
         coalesce(nullif(trim(p.name_custom), ''), nullif(trim(p.name_original), ''), p.name),
         greatest(1, coalesce((i->>'cantidad')::integer, 1)),
         coalesce(s.despacho_directo, false),
         s.envio_tarifa_plana,
         s.envio_demora_dias_min,
         s.envio_demora_dias_max,
         CASE WHEN coalesce(p.weight_kg, 0) > 0 THEN p.weight_kg ELSE coalesce(tienda_config_numero('peso_por_defecto_kg', 1), 1) END,
         coalesce(mc.alto_cm, mp.alto_cm, d.alto),
         coalesce(mc.ancho_cm, mp.ancho_cm, d.ancho),
         coalesce(mc.largo_cm, mp.largo_cm, d.largo)
  FROM jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) AS i
  JOIN products p ON p.id = (i->>'product_id')::integer
  LEFT JOIN suppliers s ON s.id = tienda_proveedor_de(p.id)
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN envio_medidas mc ON mc.categoria_id = c.id
  LEFT JOIN envio_medidas mp ON mp.categoria_id = c.parent_id
  CROSS JOIN defecto d;
$$;

REVOKE ALL ON FUNCTION tienda_envio_partes(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION tienda_envio_partes(jsonb) TO service_role;
