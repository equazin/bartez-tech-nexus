-- ── 011_brands.sql ──────────────────────────────────────────────────────────
-- Brands as first-class catalog entity

-- 1. Brands table
CREATE TABLE IF NOT EXISTS brands (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  logo_url   TEXT,
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brands_slug   ON brands(slug);
CREATE INDEX IF NOT EXISTS idx_brands_active ON brands(active);

-- 2. Extend products table
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS brand_id   UUID REFERENCES brands(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS brand_name TEXT;

CREATE INDEX IF NOT EXISTS idx_products_brand_id ON products(brand_id);

-- 3. RLS
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brands_select"
  ON brands FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "brands_insert"
  ON brands FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'vendedor'))
  );

CREATE POLICY "brands_update"
  ON brands FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'vendedor'))
  );

CREATE POLICY "brands_delete"
  ON brands FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 4. Seed common IT brands
INSERT INTO brands (name, slug) VALUES
  ('Western Digital',  'western-digital'),
  ('ASUS',             'asus'),
  ('HP',               'hp'),
  ('Lenovo',           'lenovo'),
  ('Dell',             'dell'),
  ('Acer',             'acer'),
  ('Samsung',          'samsung'),
  ('LG',               'lg'),
  ('Logitech',         'logitech'),
  ('Corsair',          'corsair'),
  ('Kingston',         'kingston'),
  ('Seagate',          'seagate'),
  ('WD',               'wd'),
  ('Intel',            'intel'),
  ('AMD',              'amd'),
  ('NVIDIA',           'nvidia'),
  ('Cisco',            'cisco'),
  ('TP-Link',          'tp-link'),
  ('D-Link',           'd-link'),
  ('Epson',            'epson'),
  ('Canon',            'canon'),
  ('Brother',          'brother'),
  ('Ubiquiti',         'ubiquiti'),
  ('Mikrotik',         'mikrotik'),
  ('Netgear',          'netgear'),
  ('APC',              'apc'),
  ('Eaton',            'eaton'),
  ('Hikvision',        'hikvision'),
  ('Dahua',            'dahua'),
  ('MSI',              'msi'),
  ('Gigabyte',         'gigabyte'),
  ('Crucial',          'crucial'),
  ('Tenda',            'tenda'),
  ('Xiaomi',           'xiaomi'),
  ('Belkin',           'belkin'),
  ('Anker',            'anker')
ON CONFLICT (slug) DO NOTHING;

-- 5. Auto-assign brand_id from product name (best-effort, longer names first)
DO $$
DECLARE
  b RECORD;
BEGIN
  FOR b IN SELECT id, name FROM brands ORDER BY LENGTH(name) DESC LOOP
    UPDATE products
    SET
      brand_id   = b.id,
      brand_name = b.name
    WHERE
      brand_id IS NULL
      AND (
           name          ILIKE '%' || b.name || '%'
        OR name_original ILIKE '%' || b.name || '%'
        OR name_custom   ILIKE '%' || b.name || '%'
      );
  END LOOP;
END;
$$;
