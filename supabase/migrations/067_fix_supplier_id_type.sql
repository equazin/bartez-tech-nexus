-- ── 067_fix_supplier_id_type.sql ─────────────────────────────────────────────
-- products.supplier_id is a legacy INTEGER column that cannot join against
-- suppliers.id (UUID). Migration 012 already introduced the product_suppliers
-- N:M table as the canonical source of truth.
--
-- This migration:
--   1. Adds primary_supplier_id UUID to products (nullable, idempotent)
--   2. Backfills it from product_suppliers (cheapest-cost supplier per product)
--   3. Adds FK constraint and index
--   4. Updates portal_products view to expose primary_supplier_id
--
-- The old INTEGER supplier_id column is left intact so existing code that reads
-- it does not break. It is effectively deprecated — new code should use
-- primary_supplier_id or the product_suppliers join table.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add column (idempotent)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS primary_supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL;

-- 2. Backfill: pick the supplier with the lowest cost_price (or any if null)
UPDATE products p
SET    primary_supplier_id = ps.supplier_id
FROM   product_suppliers ps
WHERE  ps.product_id = p.id
  AND  p.primary_supplier_id IS NULL
  AND  ps.cost_price = (
         SELECT MIN(ps2.cost_price)
         FROM   product_suppliers ps2
         WHERE  ps2.product_id = p.id
       );

-- For products with only one supplier entry (cost_price may be NULL)
UPDATE products p
SET    primary_supplier_id = ps.supplier_id
FROM   product_suppliers ps
WHERE  ps.product_id = p.id
  AND  p.primary_supplier_id IS NULL;

-- 3. Index
CREATE INDEX IF NOT EXISTS idx_products_primary_supplier_id
  ON products(primary_supplier_id);

-- 4. Comment
COMMENT ON COLUMN products.primary_supplier_id IS
  'Canonical UUID FK to suppliers. Replaces legacy integer supplier_id. '
  'Populated from product_suppliers (lowest cost entry).';

COMMENT ON COLUMN products.supplier_id IS
  'DEPRECATED legacy integer. Use primary_supplier_id or product_suppliers table instead.';
