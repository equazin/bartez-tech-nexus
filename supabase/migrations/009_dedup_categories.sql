-- Deduplicate categories by slug/name and add UNIQUE constraint
-- Keeps the row with the lowest id for each duplicate name

-- 1. Delete duplicate categories (keep lowest id per name)
DELETE FROM categories
WHERE id NOT IN (
  SELECT MIN(id)
  FROM categories
  GROUP BY LOWER(TRIM(name))
);

-- 2. Add UNIQUE constraint on name (case-insensitive via index)
CREATE UNIQUE INDEX IF NOT EXISTS categories_name_lower_unique
  ON categories (LOWER(TRIM(name)));
