-- Public POS combo options shown on /puntos-de-venta.
-- These are manually curated offers, independent from portal products/bundles.

CREATE TABLE IF NOT EXISTS public_pos_kits (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  price_usd NUMERIC(12, 2) NOT NULL CHECK (price_usd > 0),
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT public_pos_kits_items_array CHECK (jsonb_typeof(items) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_public_pos_kits_active_order
  ON public_pos_kits (active, sort_order, name);

CREATE OR REPLACE FUNCTION update_public_pos_kits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_public_pos_kits_updated_at ON public_pos_kits;
CREATE TRIGGER trg_public_pos_kits_updated_at
  BEFORE UPDATE ON public_pos_kits
  FOR EACH ROW
  EXECUTE FUNCTION update_public_pos_kits_updated_at();

ALTER TABLE public_pos_kits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_pos_kits_public_read_active" ON public_pos_kits;
CREATE POLICY "public_pos_kits_public_read_active"
  ON public_pos_kits
  FOR SELECT
  USING (active = TRUE);

DROP POLICY IF EXISTS "public_pos_kits_admin_read_all" ON public_pos_kits;
CREATE POLICY "public_pos_kits_admin_read_all"
  ON public_pos_kits
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "public_pos_kits_admin_write" ON public_pos_kits;
CREATE POLICY "public_pos_kits_admin_write"
  ON public_pos_kits
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

INSERT INTO public_pos_kits (id, name, description, stock, price_usd, items, active, sort_order)
VALUES
  (
    'comercio-esencial',
    'Comercio Esencial',
    'Terminal, impresora y lector para abrir caja con una base operativa completa.',
    3,
    775,
    '[
      {"sku":"COMBO-POS-ESENCIAL","name":"Terminal POS touch para caja","category":"Terminales POS","quantity":1},
      {"sku":"IMP-80-COMBO","name":"Impresora termica 80 mm","category":"Impresoras termicas","quantity":1},
      {"sku":"LECTOR-2D-COMBO","name":"Lector de codigo 1D/2D","category":"Lectores de codigo","quantity":1}
    ]'::jsonb,
    TRUE,
    10
  ),
  (
    'etiquetado-stock',
    'Etiquetado y Stock',
    'Impresion de etiquetas y lectura 1D/2D para inventario, deposito y mostrador.',
    9,
    390,
    '[
      {"sku":"IMP-ETQ-COMBO","name":"Impresora de etiquetas","category":"Impresoras termicas","quantity":1},
      {"sku":"LECTOR-2D-STOCK","name":"Lector de codigo 1D/2D para inventario","category":"Lectores de codigo","quantity":1}
    ]'::jsonb,
    TRUE,
    20
  ),
  (
    'caja-pro',
    'Caja Pro',
    'Equipo POS de mayor capacidad con impresion de tickets y lector para alto movimiento.',
    1,
    940,
    '[
      {"sku":"COMBO-POS-PRO","name":"Terminal POS touch de alto rendimiento","category":"Terminales POS","quantity":1},
      {"sku":"IMP-80-PRO","name":"Impresora termica 80 mm para tickets","category":"Impresoras termicas","quantity":1},
      {"sku":"LECTOR-2D-PRO","name":"Lector omnidireccional 1D/2D","category":"Lectores de codigo","quantity":1}
    ]'::jsonb,
    TRUE,
    30
  )
ON CONFLICT (id) DO NOTHING;
