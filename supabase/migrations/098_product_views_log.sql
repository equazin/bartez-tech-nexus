-- ── 098_product_views_log.sql ─────────────────────────────────────────────────
-- Product view log: tracks recently viewed products per client.
-- Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS product_views_log (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  profile_id  UUID    NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
  product_id  INTEGER NOT NULL REFERENCES products(id)  ON DELETE CASCADE,
  viewed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_views_profile
  ON product_views_log(profile_id, viewed_at DESC);

ALTER TABLE product_views_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_views_owner" ON product_views_log;
CREATE POLICY "product_views_owner"
  ON product_views_log FOR ALL TO authenticated
  USING  (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- Upsert-style log: insert new row, keep only last 50 per profile.
CREATE OR REPLACE FUNCTION log_product_view(p_product_id INTEGER)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO product_views_log (profile_id, product_id)
  VALUES (auth.uid(), p_product_id);

  -- Prune to most recent 50
  DELETE FROM product_views_log
  WHERE profile_id = auth.uid()
    AND id NOT IN (
      SELECT id FROM product_views_log
      WHERE profile_id = auth.uid()
      ORDER BY viewed_at DESC
      LIMIT 50
    );
END;
$$;

GRANT EXECUTE ON FUNCTION log_product_view(INTEGER)      TO authenticated;
GRANT SELECT, INSERT, DELETE ON product_views_log        TO authenticated;
