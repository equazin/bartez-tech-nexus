-- =============================================================
-- BARTEZ B2B — Migration 004: Purchase Lists
-- Persistent recurring order templates saved by clients.
-- Run in Supabase SQL Editor — idempotent.
-- =============================================================

CREATE TABLE IF NOT EXISTS purchase_lists (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  client_id   uuid   NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text   NOT NULL,
  products    jsonb  NOT NULL DEFAULT '[]'::jsonb,
  -- products: Array<{ product_id: number; name: string; sku?: string; quantity: number }>
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchase_lists_client
  ON purchase_lists(client_id, updated_at DESC);

-- updated_at trigger
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'purchase_lists_updated_at'
  ) THEN
    CREATE TRIGGER purchase_lists_updated_at
      BEFORE UPDATE ON purchase_lists
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- ─── RLS ──────────────────────────────────────────────────────

ALTER TABLE purchase_lists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lists_select_own"   ON purchase_lists;
DROP POLICY IF EXISTS "lists_insert_own"   ON purchase_lists;
DROP POLICY IF EXISTS "lists_update_own"   ON purchase_lists;
DROP POLICY IF EXISTS "lists_delete_own"   ON purchase_lists;
DROP POLICY IF EXISTS "lists_admin"        ON purchase_lists;

CREATE POLICY "lists_select_own" ON purchase_lists FOR SELECT
  USING (client_id = auth.uid());

CREATE POLICY "lists_insert_own" ON purchase_lists FOR INSERT
  WITH CHECK (client_id = auth.uid());

CREATE POLICY "lists_update_own" ON purchase_lists FOR UPDATE
  USING (client_id = auth.uid());

CREATE POLICY "lists_delete_own" ON purchase_lists FOR DELETE
  USING (client_id = auth.uid());

CREATE POLICY "lists_admin" ON purchase_lists FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','vendedor')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','vendedor')
  ));
