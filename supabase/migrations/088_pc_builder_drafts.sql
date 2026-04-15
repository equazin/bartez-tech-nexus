-- 088_pc_builder_drafts.sql
-- Armador PC: borradores persistentes para flujo guiado/manual.

CREATE TABLE IF NOT EXISTS pc_builds (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  mode        TEXT NOT NULL CHECK (mode IN ('guided', 'manual')),
  goal        TEXT CHECK (goal IN ('office', 'gaming', 'workstation')),
  budget_min  NUMERIC(14,2),
  budget_max  NUMERIC(14,2),
  currency    TEXT NOT NULL DEFAULT 'ARS' CHECK (currency IN ('ARS', 'USD')),
  priority    TEXT CHECK (priority IN ('price', 'balanced', 'performance')),
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'quoted', 'ordered')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pc_builds_client_id ON pc_builds(client_id);
CREATE INDEX IF NOT EXISTS idx_pc_builds_updated_at ON pc_builds(updated_at DESC);

CREATE TABLE IF NOT EXISTS pc_build_items (
  id                   BIGSERIAL PRIMARY KEY,
  build_id             UUID NOT NULL REFERENCES pc_builds(id) ON DELETE CASCADE,
  slot_key             TEXT NOT NULL CHECK (slot_key IN ('cpu', 'motherboard', 'ram', 'gpu', 'storage', 'psu', 'case', 'cooler')),
  product_id           INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity             INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  compatibility_state  TEXT NOT NULL DEFAULT 'unknown' CHECK (compatibility_state IN ('compatible', 'incompatible', 'incomplete', 'unknown')),
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(build_id, slot_key)
);

CREATE INDEX IF NOT EXISTS idx_pc_build_items_build_id ON pc_build_items(build_id);
CREATE INDEX IF NOT EXISTS idx_pc_build_items_product_id ON pc_build_items(product_id);

ALTER TABLE pc_build_items
  ADD COLUMN IF NOT EXISTS locked BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE pc_build_items
  ADD COLUMN IF NOT EXISTS notes TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'pc_build_items'
  ) THEN
    ALTER TABLE pc_build_items
      DROP CONSTRAINT IF EXISTS pc_build_items_slot_key_check;

    ALTER TABLE pc_build_items
      ADD CONSTRAINT pc_build_items_slot_key_check
      CHECK (
        slot_key IN ('cpu', 'motherboard', 'ram', 'gpu', 'storage', 'psu', 'case', 'cooler', 'monitor')
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION set_updated_at_pc_builder()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pc_builds_set_updated_at ON pc_builds;
CREATE TRIGGER pc_builds_set_updated_at
  BEFORE UPDATE ON pc_builds
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_pc_builder();

DROP TRIGGER IF EXISTS pc_build_items_set_updated_at ON pc_build_items;
CREATE TRIGGER pc_build_items_set_updated_at
  BEFORE UPDATE ON pc_build_items
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_pc_builder();

ALTER TABLE pc_builds ENABLE ROW LEVEL SECURITY;
ALTER TABLE pc_build_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pc_builds_select_own_or_staff" ON pc_builds;
CREATE POLICY "pc_builds_select_own_or_staff"
  ON pc_builds FOR SELECT
  USING (
    client_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'vendedor')
    )
  );

DROP POLICY IF EXISTS "pc_builds_insert_own_or_staff" ON pc_builds;
CREATE POLICY "pc_builds_insert_own_or_staff"
  ON pc_builds FOR INSERT
  WITH CHECK (
    client_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'vendedor')
    )
  );

DROP POLICY IF EXISTS "pc_builds_update_own_or_staff" ON pc_builds;
CREATE POLICY "pc_builds_update_own_or_staff"
  ON pc_builds FOR UPDATE
  USING (
    client_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'vendedor')
    )
  )
  WITH CHECK (
    client_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'vendedor')
    )
  );

DROP POLICY IF EXISTS "pc_builds_delete_own_or_staff" ON pc_builds;
CREATE POLICY "pc_builds_delete_own_or_staff"
  ON pc_builds FOR DELETE
  USING (
    client_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'vendedor')
    )
  );

DROP POLICY IF EXISTS "pc_build_items_select_own_or_staff" ON pc_build_items;
CREATE POLICY "pc_build_items_select_own_or_staff"
  ON pc_build_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM pc_builds b
      WHERE b.id = pc_build_items.build_id
        AND (
          b.client_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid() AND p.role IN ('admin', 'vendedor')
          )
        )
    )
  );

DROP POLICY IF EXISTS "pc_build_items_insert_own_or_staff" ON pc_build_items;
CREATE POLICY "pc_build_items_insert_own_or_staff"
  ON pc_build_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM pc_builds b
      WHERE b.id = pc_build_items.build_id
        AND (
          b.client_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid() AND p.role IN ('admin', 'vendedor')
          )
        )
    )
  );

DROP POLICY IF EXISTS "pc_build_items_update_own_or_staff" ON pc_build_items;
CREATE POLICY "pc_build_items_update_own_or_staff"
  ON pc_build_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM pc_builds b
      WHERE b.id = pc_build_items.build_id
        AND (
          b.client_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid() AND p.role IN ('admin', 'vendedor')
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM pc_builds b
      WHERE b.id = pc_build_items.build_id
        AND (
          b.client_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid() AND p.role IN ('admin', 'vendedor')
          )
        )
    )
  );

DROP POLICY IF EXISTS "pc_build_items_delete_own_or_staff" ON pc_build_items;
CREATE POLICY "pc_build_items_delete_own_or_staff"
  ON pc_build_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM pc_builds b
      WHERE b.id = pc_build_items.build_id
        AND (
          b.client_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid() AND p.role IN ('admin', 'vendedor')
          )
        )
    )
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'quotes'
  ) THEN
    ALTER TABLE quotes
      ADD COLUMN IF NOT EXISTS build_id UUID REFERENCES pc_builds(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_quotes_build_id ON quotes(build_id);
  END IF;
END $$;
