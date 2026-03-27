-- =============================================================
-- BARTEZ B2B — Categories & Provider Mapping
-- =============================================================

-- ─── 1. CATEGORÍAS INTERNAS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text,
  name        text NOT NULL,
  parent_id   uuid REFERENCES categories(id) ON DELETE SET NULL,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Agregar columnas si la tabla ya existía sin ellas
ALTER TABLE categories ADD COLUMN IF NOT EXISTS slug   text;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- Poblar slug desde name para filas existentes que no lo tengan
UPDATE categories
SET slug = lower(regexp_replace(trim(name), '\s+', '_', 'g'))
WHERE slug IS NULL OR slug = '';

-- Ahora sí forzar NOT NULL + UNIQUE en slug
ALTER TABLE categories ALTER COLUMN slug SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'categories_slug_key'
  ) THEN
    ALTER TABLE categories ADD CONSTRAINT categories_slug_key UNIQUE (slug);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug   ON categories(slug);

-- Seed categorías internas base
INSERT INTO categories (slug, name) VALUES
  ('networking',       'Redes'),
  ('security',         'Seguridad'),
  ('infrastructure',   'Infraestructura'),
  ('computing',        'Computación'),
  ('storage',          'Almacenamiento'),
  ('software',         'Software'),
  ('accessories',      'Accesorios'),
  ('uncategorized',    'Sin categoría')
ON CONFLICT (slug) DO NOTHING;


-- ─── 2. MAPEO PROVEEDOR → INTERNO ───────────────────────────
CREATE TABLE IF NOT EXISTS category_mapping (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id             uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  external_category_id    text NOT NULL,
  external_category_name  text,
  internal_category_id    uuid NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  confidence              text NOT NULL DEFAULT 'manual'
    CHECK (confidence IN ('manual', 'auto_high', 'auto_low')),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supplier_id, external_category_id)
);

CREATE INDEX IF NOT EXISTS idx_category_mapping_supplier
  ON category_mapping(supplier_id, external_category_id);


-- ─── 3. FK EN PRODUCTS (category_id) ────────────────────────
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);

-- Migrar datos existentes: texto → UUID donde coincida por slug
UPDATE products p
SET category_id = c.id
FROM categories c
WHERE lower(trim(p.category)) = c.slug
  AND p.category_id IS NULL;


-- ─── 4. FUNCIÓN: resolver mapping con fallback ───────────────
CREATE OR REPLACE FUNCTION resolve_category(
  p_supplier_id          uuid,
  p_external_category_id text
) RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (
      SELECT internal_category_id
      FROM   category_mapping
      WHERE  supplier_id          = p_supplier_id
        AND  external_category_id = p_external_category_id
      LIMIT 1
    ),
    (SELECT id FROM categories WHERE slug = 'uncategorized' LIMIT 1)
  );
$$;


-- ─── 5. RLS ──────────────────────────────────────────────────
ALTER TABLE categories       ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_mapping ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='categories' AND policyname='categories_read_all'
  ) THEN
    CREATE POLICY "categories_read_all"
      ON categories FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='categories' AND policyname='categories_write_admin'
  ) THEN
    CREATE POLICY "categories_write_admin"
      ON categories FOR ALL
      USING  (auth.jwt() ->> 'role' = 'admin')
      WITH CHECK (auth.jwt() ->> 'role' = 'admin');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='category_mapping' AND policyname='category_mapping_read_admin'
  ) THEN
    CREATE POLICY "category_mapping_read_admin"
      ON category_mapping FOR SELECT
      USING (auth.jwt() ->> 'role' = 'admin');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='category_mapping' AND policyname='category_mapping_write_admin'
  ) THEN
    CREATE POLICY "category_mapping_write_admin"
      ON category_mapping FOR ALL
      USING  (auth.jwt() ->> 'role' = 'admin')
      WITH CHECK (auth.jwt() ->> 'role' = 'admin');
  END IF;
END$$;
