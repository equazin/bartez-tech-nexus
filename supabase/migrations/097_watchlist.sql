-- ── 097_watchlist.sql ─────────────────────────────────────────────────────────
-- Watchlist: clients track products they want to monitor (stock / price alerts).
-- Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS watchlist (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  profile_id  UUID    NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
  product_id  INTEGER NOT NULL REFERENCES products(id)  ON DELETE CASCADE,
  target_qty  INTEGER NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_watchlist_profile  ON watchlist(profile_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_product  ON watchlist(product_id);

ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "watchlist_owner_all" ON watchlist;
CREATE POLICY "watchlist_owner_all"
  ON watchlist FOR ALL TO authenticated
  USING  (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- Helpers callable from the portal
CREATE OR REPLACE FUNCTION upsert_watchlist(p_product_id INTEGER, p_target_qty INTEGER DEFAULT 1)
RETURNS VOID LANGUAGE sql SECURITY DEFINER AS $$
  INSERT INTO watchlist (profile_id, product_id, target_qty)
  VALUES (auth.uid(), p_product_id, p_target_qty)
  ON CONFLICT (profile_id, product_id)
  DO UPDATE SET target_qty = EXCLUDED.target_qty;
$$;

CREATE OR REPLACE FUNCTION remove_watchlist(p_product_id INTEGER)
RETURNS VOID LANGUAGE sql SECURITY DEFINER AS $$
  DELETE FROM watchlist WHERE profile_id = auth.uid() AND product_id = p_product_id;
$$;

GRANT EXECUTE ON FUNCTION upsert_watchlist(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION remove_watchlist(INTEGER)           TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON watchlist             TO authenticated;
