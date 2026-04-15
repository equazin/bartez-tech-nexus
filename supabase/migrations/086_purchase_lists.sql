-- 086_purchase_lists.sql
-- Extiende purchase_lists existente para listas persistentes y compartibles.
-- Mantiene compatibilidad con la tabla legacy (client_id/products).

CREATE TABLE IF NOT EXISTS purchase_lists (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  products JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE purchase_lists
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE purchase_lists
  ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE purchase_lists
  ADD COLUMN IF NOT EXISTS shared_with UUID[] NOT NULL DEFAULT '{}'::uuid[];

UPDATE purchase_lists
SET profile_id = client_id
WHERE profile_id IS NULL
  AND client_id IS NOT NULL;

UPDATE purchase_lists
SET items = products
WHERE (
    items IS NULL
    OR jsonb_typeof(items) <> 'array'
    OR items = '[]'::jsonb
  )
  AND jsonb_typeof(products) = 'array'
  AND products <> '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_purchase_lists_profile_updated
  ON purchase_lists (profile_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_purchase_lists_shared_with
  ON purchase_lists USING gin (shared_with);

CREATE INDEX IF NOT EXISTS idx_purchase_lists_items_gin
  ON purchase_lists USING gin (items);

ALTER TABLE purchase_lists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lists_select_own ON purchase_lists;
DROP POLICY IF EXISTS lists_insert_own ON purchase_lists;
DROP POLICY IF EXISTS lists_update_own ON purchase_lists;
DROP POLICY IF EXISTS lists_delete_own ON purchase_lists;
DROP POLICY IF EXISTS lists_admin ON purchase_lists;

DROP POLICY IF EXISTS purchase_lists_client_select ON purchase_lists;
CREATE POLICY purchase_lists_client_select
ON purchase_lists
FOR SELECT
USING (
  profile_id = auth.uid()
  OR client_id = auth.uid()
  OR auth.uid() = ANY(shared_with)
);

DROP POLICY IF EXISTS purchase_lists_client_insert ON purchase_lists;
CREATE POLICY purchase_lists_client_insert
ON purchase_lists
FOR INSERT
WITH CHECK (
  profile_id = auth.uid()
  OR client_id = auth.uid()
);

DROP POLICY IF EXISTS purchase_lists_client_update ON purchase_lists;
CREATE POLICY purchase_lists_client_update
ON purchase_lists
FOR UPDATE
USING (
  profile_id = auth.uid()
  OR client_id = auth.uid()
)
WITH CHECK (
  profile_id = auth.uid()
  OR client_id = auth.uid()
);

DROP POLICY IF EXISTS purchase_lists_client_delete ON purchase_lists;
CREATE POLICY purchase_lists_client_delete
ON purchase_lists
FOR DELETE
USING (
  profile_id = auth.uid()
  OR client_id = auth.uid()
);

DROP POLICY IF EXISTS purchase_lists_staff_all ON purchase_lists;
CREATE POLICY purchase_lists_staff_all
ON purchase_lists
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'vendedor', 'sales')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'vendedor', 'sales')
  )
);

