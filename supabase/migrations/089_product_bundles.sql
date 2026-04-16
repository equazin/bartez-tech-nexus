-- 089_product_bundles.sql
-- Sistema de Bundles/Kits: conjuntos de productos prearmados con descuento configurable.
-- Los slots referencian categorías internas (category_mapping es la única fuente de verdad).

-- ── 1. TABLA PRINCIPAL: product_bundles ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS product_bundles (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  title                 TEXT         NOT NULL,
  description           TEXT,
  discount_pct          NUMERIC(5,2) NOT NULL DEFAULT 0
                          CHECK (discount_pct >= 0 AND discount_pct <= 100),
  allows_customization  BOOLEAN      NOT NULL DEFAULT true,
  active                BOOLEAN      NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_bundles_active ON product_bundles(active);

-- ── 2. SLOTS DE BUNDLE ────────────────────────────────────────────────────────
-- Cada slot es una posición dentro del kit (Procesador, RAM, SSD, etc.).
-- category_id referencia la categoría INTERNA del portal (jamás una externa).

CREATE TABLE IF NOT EXISTS bundle_slots (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id           UUID        NOT NULL REFERENCES product_bundles(id) ON DELETE CASCADE,
  label               TEXT        NOT NULL,
  category_id         BIGINT      REFERENCES categories(id) ON DELETE SET NULL,
  required            BOOLEAN     NOT NULL DEFAULT true,
  client_configurable BOOLEAN     NOT NULL DEFAULT false,
  sort_order          INTEGER     NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bundle_slots_bundle_id   ON bundle_slots(bundle_id);
CREATE INDEX IF NOT EXISTS idx_bundle_slots_category_id ON bundle_slots(category_id);

-- ── 3. OPCIONES POR SLOT ─────────────────────────────────────────────────────
-- Qué productos del catálogo están disponibles en cada slot.

CREATE TABLE IF NOT EXISTS bundle_slot_options (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id     UUID        NOT NULL REFERENCES bundle_slots(id) ON DELETE CASCADE,
  product_id  INTEGER     NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  is_default  BOOLEAN     NOT NULL DEFAULT false,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (slot_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_bundle_slot_options_slot_id    ON bundle_slot_options(slot_id);
CREATE INDEX IF NOT EXISTS idx_bundle_slot_options_product_id ON bundle_slot_options(product_id);

-- ── 4. TRIGGER updated_at ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at_bundle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS product_bundles_set_updated_at ON product_bundles;
CREATE TRIGGER product_bundles_set_updated_at
  BEFORE UPDATE ON product_bundles
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_bundle();

-- ── 5. RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE product_bundles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundle_slots         ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundle_slot_options  ENABLE ROW LEVEL SECURITY;

-- product_bundles ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "admins manage product_bundles"        ON product_bundles;
DROP POLICY IF EXISTS "authenticated read active bundles"    ON product_bundles;

CREATE POLICY "admins manage product_bundles"
  ON product_bundles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'staff')
    )
  );

CREATE POLICY "authenticated read active bundles"
  ON product_bundles FOR SELECT
  TO authenticated
  USING (active = true);

-- bundle_slots ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "admins manage bundle_slots"      ON bundle_slots;
DROP POLICY IF EXISTS "authenticated read bundle_slots" ON bundle_slots;

CREATE POLICY "admins manage bundle_slots"
  ON bundle_slots FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'staff')
    )
  );

CREATE POLICY "authenticated read bundle_slots"
  ON bundle_slots FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM product_bundles pb
      WHERE pb.id = bundle_slots.bundle_id
        AND pb.active = true
    )
  );

-- bundle_slot_options ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "admins manage bundle_slot_options"      ON bundle_slot_options;
DROP POLICY IF EXISTS "authenticated read bundle_slot_options" ON bundle_slot_options;

CREATE POLICY "admins manage bundle_slot_options"
  ON bundle_slot_options FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'staff')
    )
  );

CREATE POLICY "authenticated read bundle_slot_options"
  ON bundle_slot_options FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bundle_slots bs
      JOIN product_bundles pb ON pb.id = bs.bundle_id
      WHERE bs.id = bundle_slot_options.slot_id
        AND pb.active = true
    )
  );
