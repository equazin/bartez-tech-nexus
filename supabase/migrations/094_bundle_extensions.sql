-- 090_bundle_extensions.sql
-- Extiende el sistema de bundles con tipo, imagen, slug, descuento flexible y
-- opciones por slot (cantidad, opcional, reemplazable).
-- Compatible con las tablas creadas en 089_product_bundles.sql.

-- ── 1. EXTENDER product_bundles ───────────────────────────────────────────────

-- Tipo de bundle: pc_armada (fija), esquema (configurable por cliente), bundle (genérico)
ALTER TABLE product_bundles
  ADD COLUMN IF NOT EXISTS type          TEXT NOT NULL DEFAULT 'bundle'
    CHECK (type IN ('bundle', 'pc_armada', 'esquema')),
  ADD COLUMN IF NOT EXISTS slug          TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS image_url     TEXT,
  -- Tipo de descuento: percentage (usa discount_pct), fixed (monto fijo), none
  ADD COLUMN IF NOT EXISTS discount_type TEXT NOT NULL DEFAULT 'percentage'
    CHECK (discount_type IN ('percentage', 'fixed', 'none')),
  -- Precio fijo manual (cuando discount_type = 'fixed' o se quiere ignorar el cálculo)
  ADD COLUMN IF NOT EXISTS fixed_price   NUMERIC(12,2);

-- Índice para slug (queries por URL amigable)
CREATE INDEX IF NOT EXISTS idx_product_bundles_slug ON product_bundles(slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_bundles_type ON product_bundles(type);

-- ── 2. EXTENDER bundle_slot_options ──────────────────────────────────────────

ALTER TABLE bundle_slot_options
  -- Cantidad de unidades de este producto en el slot (default 1)
  ADD COLUMN IF NOT EXISTS quantity      INTEGER NOT NULL DEFAULT 1
    CHECK (quantity >= 1),
  -- El cliente puede omitir este item (ej: mouse en un kit de oficina)
  ADD COLUMN IF NOT EXISTS is_optional   BOOLEAN NOT NULL DEFAULT false,
  -- El cliente puede cambiar este item por otro del catálogo libre
  ADD COLUMN IF NOT EXISTS is_replaceable BOOLEAN NOT NULL DEFAULT false;

-- ── 3. FUNCIÓN HELPER: auto-generar slug desde title ─────────────────────────

CREATE OR REPLACE FUNCTION generate_bundle_slug(title TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter   INT := 0;
BEGIN
  base_slug := lower(
    regexp_replace(
      regexp_replace(
        unaccent(title),
        '[^a-zA-Z0-9\s-]', '', 'g'
      ),
      '\s+', '-', 'g'
    )
  );

  final_slug := base_slug;

  LOOP
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM product_bundles WHERE slug = final_slug
    );
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  RETURN final_slug;
END;
$$;

-- ── 4. TRIGGER: auto-fill slug si no se provee ────────────────────────────────

CREATE OR REPLACE FUNCTION auto_set_bundle_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := generate_bundle_slug(NEW.title);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS product_bundles_auto_slug ON product_bundles;
CREATE TRIGGER product_bundles_auto_slug
  BEFORE INSERT ON product_bundles
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_bundle_slug();
