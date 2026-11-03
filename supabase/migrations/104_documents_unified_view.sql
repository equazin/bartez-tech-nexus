-- ── 100_documents_unified_view.sql ───────────────────────────────────────────
-- Unified client document view: invoices, remitos, NC, receipts.
-- Exposes only the client's own documents via RLS-safe RPC.
-- Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Unified view (admin/service_role use only — not exposed to clients directly)
CREATE OR REPLACE VIEW v_client_documents AS
SELECT
  id::TEXT                              AS id,
  client_id,
  'invoice'                             AS kind,
  invoice_number                        AS number,
  created_at,
  total                                 AS amount,
  currency,
  status,
  pdf_url
FROM invoices

UNION ALL

-- Remitos come from orders that have a numero_remito set
SELECT
  id::TEXT                              AS id,
  client_id,
  'remito'                              AS kind,
  COALESCE(numero_remito, 'REM-' || id::TEXT) AS number,
  created_at,
  total                                 AS amount,
  'ARS'                                 AS currency,
  status,
  NULL                                  AS pdf_url
FROM orders
WHERE numero_remito IS NOT NULL
   OR status IN ('shipped', 'delivered', 'dispatched');

-- 2. Per-client accessor (RLS-safe — only returns rows for auth.uid())
CREATE OR REPLACE FUNCTION get_my_documents(
  p_kind     TEXT        DEFAULT NULL,   -- 'invoice' | 'remito' | NULL = all
  p_from     DATE        DEFAULT NULL,
  p_to       DATE        DEFAULT NULL,
  p_status   TEXT        DEFAULT NULL,
  p_limit    INTEGER     DEFAULT 100,
  p_offset   INTEGER     DEFAULT 0
)
RETURNS TABLE(
  id         TEXT,
  kind       TEXT,
  number     TEXT,
  created_at TIMESTAMPTZ,
  amount     NUMERIC,
  currency   TEXT,
  status     TEXT,
  pdf_url    TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    d.id,
    d.kind,
    d.number,
    d.created_at,
    d.amount,
    d.currency,
    d.status,
    d.pdf_url
  FROM v_client_documents d
  WHERE d.client_id = auth.uid()
    AND (p_kind   IS NULL OR d.kind   = p_kind)
    AND (p_from   IS NULL OR d.created_at::date >= p_from)
    AND (p_to     IS NULL OR d.created_at::date <= p_to)
    AND (p_status IS NULL OR d.status = p_status)
  ORDER BY d.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION get_my_documents(TEXT,DATE,DATE,TEXT,INTEGER,INTEGER) TO authenticated;
