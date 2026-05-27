-- ── 104_admin_global_search.sql ──────────────────────────────────────────────
-- Trigram-based admin search across products, profiles, orders, invoices,
-- quotes and account_movements (payments).
--
-- Replaces in-memory `.includes()` filtering on the client.
-- The app calls admin_global_search(text) and gets a unified result list
-- pre-ranked by similarity.
--
-- Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─── Trigram indices ─────────────────────────────────────────────────────────
-- Each index covers the columns the admin actually searches by.
-- gin_trgm_ops enables fast similarity (ILIKE + %, <%) lookups.

CREATE INDEX IF NOT EXISTS idx_products_search_trgm
  ON products USING gin (
    (COALESCE(name, '') || ' ' || COALESCE(sku, '') || ' ' || COALESCE(category, '')) gin_trgm_ops
  );

CREATE INDEX IF NOT EXISTS idx_profiles_search_trgm
  ON profiles USING gin (
    (COALESCE(company_name, '') || ' ' || COALESCE(contact_name, '') || ' ' || COALESCE(email, '')) gin_trgm_ops
  );

CREATE INDEX IF NOT EXISTS idx_orders_search_trgm
  ON orders USING gin (
    (COALESCE(order_number, '') || ' ' || COALESCE(numero_remito, '') || ' ' || COALESCE(status, '')) gin_trgm_ops
  );

CREATE INDEX IF NOT EXISTS idx_invoices_search_trgm
  ON invoices USING gin (
    (COALESCE(invoice_number, '') || ' ' || COALESCE(status, '')) gin_trgm_ops
  );

CREATE INDEX IF NOT EXISTS idx_account_movements_search_trgm
  ON account_movements USING gin (
    (COALESCE(descripcion, '') || ' ' || COALESCE(reference_id, '')) gin_trgm_ops
  );

-- ─── Unified search RPC ──────────────────────────────────────────────────────
-- Returns up to `p_per_type` rows per entity type.
-- Ranks by trigram similarity descending.
-- Restricted to staff (admin / vendedor) via security definer + check.

CREATE OR REPLACE FUNCTION admin_global_search(
  p_query   TEXT,
  p_per_type INTEGER DEFAULT 5
)
RETURNS TABLE(
  result_type   TEXT,
  result_id     TEXT,
  label         TEXT,
  sub           TEXT,
  client_id     TEXT,
  score         REAL
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_role TEXT;
  v_query TEXT := TRIM(COALESCE(p_query, ''));
  v_like  TEXT := '%' || v_query || '%';
BEGIN
  -- Authorize: only admin/vendedor
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid();
  IF v_role NOT IN ('admin', 'vendedor') THEN
    RETURN;
  END IF;

  IF LENGTH(v_query) < 2 THEN
    RETURN;
  END IF;

  -- Products
  RETURN QUERY
  SELECT
    'product'::TEXT,
    p.id::TEXT,
    p.name,
    NULLIF(CONCAT_WS(' · ', p.sku, p.category), ''),
    NULL::TEXT,
    GREATEST(
      similarity(COALESCE(p.name, ''),    v_query),
      similarity(COALESCE(p.sku, ''),     v_query),
      similarity(COALESCE(p.category, ''), v_query)
    )::REAL
  FROM products p
  WHERE p.name ILIKE v_like
     OR p.sku ILIKE v_like
     OR p.category ILIKE v_like
  ORDER BY 6 DESC, p.name
  LIMIT p_per_type;

  -- Clients (profiles)
  RETURN QUERY
  SELECT
    'client'::TEXT,
    pr.id::TEXT,
    COALESCE(NULLIF(pr.company_name, ''), NULLIF(pr.contact_name, ''), pr.email, pr.id::TEXT),
    NULLIF(CONCAT_WS(' · ', pr.contact_name, pr.email), ''),
    pr.id::TEXT,
    GREATEST(
      similarity(COALESCE(pr.company_name, ''),  v_query),
      similarity(COALESCE(pr.contact_name, ''),  v_query),
      similarity(COALESCE(pr.email, ''),         v_query)
    )::REAL
  FROM profiles pr
  WHERE pr.role IN ('client', 'cliente')
    AND (
      pr.company_name ILIKE v_like
      OR pr.contact_name ILIKE v_like
      OR pr.email ILIKE v_like
    )
  ORDER BY 6 DESC, pr.company_name NULLS LAST
  LIMIT p_per_type;

  -- Orders
  RETURN QUERY
  SELECT
    'order'::TEXT,
    o.id::TEXT,
    COALESCE(o.order_number, '#' || LEFT(o.id::TEXT, 8)),
    NULLIF(
      CONCAT_WS(' · ',
        COALESCE(NULLIF(cp.company_name, ''), cp.email, o.client_id::TEXT),
        o.status
      ),
      ''
    ),
    o.client_id::TEXT,
    GREATEST(
      similarity(COALESCE(o.order_number, ''),    v_query),
      similarity(COALESCE(o.numero_remito, ''),    v_query),
      similarity(COALESCE(o.status, ''),           v_query)
    )::REAL
  FROM orders o
  LEFT JOIN profiles cp ON cp.id = o.client_id
  WHERE o.order_number ILIKE v_like
     OR o.numero_remito ILIKE v_like
     OR o.status ILIKE v_like
  ORDER BY 6 DESC, o.created_at DESC
  LIMIT p_per_type;

  -- Shipments (orders.numero_remito present)
  RETURN QUERY
  SELECT
    'shipment'::TEXT,
    'shipment-' || o.id::TEXT,
    COALESCE(o.numero_remito, 'REM-' || LEFT(o.id::TEXT, 8)),
    NULLIF(COALESCE(cp.company_name, cp.email, o.client_id::TEXT), ''),
    o.client_id::TEXT,
    similarity(COALESCE(o.numero_remito, ''), v_query)::REAL
  FROM orders o
  LEFT JOIN profiles cp ON cp.id = o.client_id
  WHERE o.numero_remito IS NOT NULL
    AND o.numero_remito ILIKE v_like
  ORDER BY 6 DESC, o.created_at DESC
  LIMIT p_per_type;

  -- Invoices
  RETURN QUERY
  SELECT
    'invoice'::TEXT,
    i.id::TEXT,
    i.invoice_number,
    NULLIF(
      CONCAT_WS(' · ',
        COALESCE(NULLIF(cp.company_name, ''), cp.email, i.client_id::TEXT),
        i.status
      ),
      ''
    ),
    i.client_id::TEXT,
    GREATEST(
      similarity(COALESCE(i.invoice_number, ''), v_query),
      similarity(COALESCE(i.status, ''),         v_query)
    )::REAL
  FROM invoices i
  LEFT JOIN profiles cp ON cp.id = i.client_id
  WHERE i.invoice_number ILIKE v_like
     OR i.status ILIKE v_like
  ORDER BY 6 DESC, i.created_at DESC
  LIMIT p_per_type;

  -- Quotes (numeric ID, support COT-NNNNN search via padded form)
  RETURN QUERY
  SELECT
    'quote'::TEXT,
    q.id::TEXT,
    'COT-' || LPAD(q.id::TEXT, 5, '0'),
    NULLIF(
      CONCAT_WS(' · ',
        COALESCE(NULLIF(cp.company_name, ''), cp.email, q.client_id::TEXT),
        q.status
      ),
      ''
    ),
    q.client_id::TEXT,
    GREATEST(
      similarity('COT-' || LPAD(q.id::TEXT, 5, '0'), v_query),
      similarity(COALESCE(q.status, ''),              v_query),
      similarity(q.id::TEXT,                          v_query)
    )::REAL
  FROM quotes q
  LEFT JOIN profiles cp ON cp.id = q.client_id
  WHERE ('COT-' || LPAD(q.id::TEXT, 5, '0')) ILIKE v_like
     OR q.status ILIKE v_like
     OR q.id::TEXT ILIKE v_like
  ORDER BY 6 DESC, q.created_at DESC
  LIMIT p_per_type;

  -- Payments (account_movements)
  RETURN QUERY
  SELECT
    'payment'::TEXT,
    am.id::TEXT,
    COALESCE(NULLIF(am.descripcion, ''), 'Pago ' || LEFT(am.id::TEXT, 8)),
    NULLIF(
      CONCAT_WS(' · ',
        COALESCE(NULLIF(cp.company_name, ''), cp.email, am.client_id::TEXT),
        am.tipo
      ),
      ''
    ),
    am.client_id::TEXT,
    GREATEST(
      similarity(COALESCE(am.descripcion, ''),  v_query),
      similarity(COALESCE(am.reference_id, ''), v_query)
    )::REAL
  FROM account_movements am
  LEFT JOIN profiles cp ON cp.id = am.client_id
  WHERE am.tipo = 'pago'
    AND (am.descripcion ILIKE v_like OR am.reference_id ILIKE v_like)
  ORDER BY 6 DESC, am.fecha DESC
  LIMIT p_per_type;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_global_search(TEXT, INTEGER) TO authenticated;
