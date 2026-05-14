-- ── 095_category_counts_rpc.sql ──────────────────────────────────────────────
-- RPC: get_category_counts(p_client_id uuid)
-- Returns (category_id, name, parent_id, count) where count is the recursive
-- total of visible products for the given client (respects catalog_segments).
-- Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_category_counts(p_client_id UUID)
RETURNS TABLE(
  category_id BIGINT,
  name        TEXT,
  parent_id   BIGINT,
  count       INT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE
  -- 1. Hidden product IDs for this client
  hidden_ids AS (
    SELECT h.product_id
    FROM get_hidden_product_ids_for_client(p_client_id) h
  ),
  -- 2. Visible products with resolved category
  visible_products AS (
    SELECT
      COALESCE(p.category_id, c_fallback.id) AS cat_id
    FROM products p
    LEFT JOIN categories c_fallback
      ON p.category_id IS NULL
     AND c_fallback.name ILIKE p.category
    WHERE p.active = true
      AND p.id NOT IN (SELECT product_id FROM hidden_ids)
      AND (p.category_id IS NOT NULL OR c_fallback.id IS NOT NULL)
  ),
  -- 3. Direct product count per category
  direct_counts AS (
    SELECT cat_id, COUNT(*)::INT AS cnt
    FROM visible_products
    GROUP BY cat_id
  ),
  -- 4. Recursive rollup: propagate counts up to ancestors
  --    PostgreSQL requires the recursive CTE to be its own WITH RECURSIVE block.
  --    We do it in a separate step using a lateral subquery instead.
  --    Strategy: for each category, sum direct_counts of itself AND all descendants.
  all_ancestors AS (
    -- All (descendant → ancestor) pairs via recursive traversal
    SELECT c.id AS descendant_id, c.id AS ancestor_id
    FROM categories c
    WHERE c.active = true
    UNION ALL
    SELECT aa.descendant_id, c.parent_id AS ancestor_id
    FROM all_ancestors aa
    JOIN categories c ON c.id = aa.ancestor_id
    WHERE c.parent_id IS NOT NULL
  )
  SELECT
    c.id                            AS category_id,
    c.name,
    c.parent_id,
    COALESCE(SUM(dc.cnt), 0)::INT  AS count
  FROM categories c
  LEFT JOIN all_ancestors aa  ON aa.ancestor_id = c.id
  LEFT JOIN direct_counts dc  ON dc.cat_id = aa.descendant_id
  WHERE c.active = true
  GROUP BY c.id, c.name, c.parent_id
  ORDER BY c.name;
END;
$$;

-- Allow authenticated users to call this function.
GRANT EXECUTE ON FUNCTION get_category_counts(UUID) TO authenticated;
