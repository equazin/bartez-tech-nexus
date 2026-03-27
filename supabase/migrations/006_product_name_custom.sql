-- =============================================================
-- BARTEZ B2B — Product custom name override
-- =============================================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS name_original text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS name_custom   text;

-- Backfill: productos existentes sin name_original heredan name
UPDATE products
SET name_original = name
WHERE name_original IS NULL;
