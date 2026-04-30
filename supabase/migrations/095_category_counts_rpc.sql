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
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH hidden_ids AS (
    -- Collect hidden product IDs for this client (reuses existing RPC logic inline
    -- to avoid a nested function call, keeping the plan simple).
    SELECT DISTINCT h.product_id
    FROM get_hidden_product_ids_for_client(p_client_id) h
  ),
  visible_products AS (
    -- Active products not hidden for this client, with their resolved category_id.
    -- Falls back to joining on category name for legacy rows without category_id.
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
  direct_counts AS (
    -- Count products directly assigned to each category.
    SELECT cat_id, COUNT(*)::INT AS cnt
    FROM visible_products
    GROUP BY cat_id
  ),
  recursive_counts AS (
    -- Recursively roll up child counts into each ancestor.
    -- Base: each category with its own direct count.
    SELECT
      c.id          AS cat_id,
      c.id          AS ancestor_id,
      COALESCE(dc.cnt, 0) AS cnt
    FROM categories c
    LEFT JOIN direct_counts dc ON dc.cat_id = c.id

    UNION ALL

    -- Walk up the tree: each child's count is added to the parent.
    SELECT
      rc.cat_id,
      c.parent_id   AS ancestor_id,
      rc.cnt
    FROM recursive_counts rc
    JOIN categories c ON c.id = rc.cat_id
    WHERE c.parent_id IS NOT NULL
  )
  SELECT
    c.id          AS category_id,
    c.name        AS name,
    c.parent_id   AS parent_id,
    COALESCE(SUM(rc.cnt), 0)::INT AS count
  FROM categories c
  LEFT JOIN recursive_counts rc ON rc.ancestor_id = c.id
  WHERE c.active = true
  GROUP BY c.id, c.name, c.parent_id
  ORDER BY c.name;
$$;

-- Allow authenticated users to call this function.
GRANT EXECUTE ON FUNCTION get_category_counts(UUID) TO authenticated;
