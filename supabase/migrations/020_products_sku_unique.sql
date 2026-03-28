-- ── 020_products_sku_unique.sql ─────────────────────────────────────────────
-- The CSV import upserts on conflict "sku", which requires a unique constraint.
-- Remove any duplicate SKUs first, then add the constraint.
-- ──────────────────────────────────────────────────────────────────────────────

-- Delete duplicate SKUs keeping the row with the highest id (most recent)
DELETE FROM products
WHERE id NOT IN (
  SELECT MAX(id)
  FROM products
  WHERE sku IS NOT NULL
  GROUP BY sku
)
AND sku IS NOT NULL;

-- Add unique constraint (idempotent)
ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_sku_key;

ALTER TABLE products
  ADD CONSTRAINT products_sku_key UNIQUE (sku);
