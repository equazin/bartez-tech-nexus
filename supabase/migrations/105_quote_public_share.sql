-- ── 105_quote_public_share.sql ───────────────────────────────────────────────
-- Public share token for quotes.
--
-- Adds a UUID `public_token` to quotes plus an unauthenticated RPC
-- `get_public_quote(token)` so clients can view a read-only quote via WhatsApp
-- link without logging in.
--
-- The token is generated on demand (NULL until first share) so legacy quotes
-- don't accidentally become public.
--
-- Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Column + index ──────────────────────────────────────────────────────────
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS public_token UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_quotes_public_token
  ON quotes(public_token)
  WHERE public_token IS NOT NULL;

-- 2. Issuer: returns existing token or creates one ───────────────────────────
CREATE OR REPLACE FUNCTION issue_quote_public_token(p_quote_id BIGINT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_role  TEXT;
  v_owner UUID;
  v_token UUID;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid();
  SELECT client_id, public_token INTO v_owner, v_token
    FROM quotes WHERE id = p_quote_id;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Quote not found';
  END IF;

  -- Owner or staff can issue
  IF v_owner <> auth.uid() AND v_role NOT IN ('admin', 'vendedor') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF v_token IS NULL THEN
    v_token := gen_random_uuid();
    UPDATE quotes SET public_token = v_token WHERE id = p_quote_id;
  END IF;

  RETURN v_token;
END;
$$;

GRANT EXECUTE ON FUNCTION issue_quote_public_token(BIGINT) TO authenticated;

-- 3. Public reader: returns quote payload without auth ───────────────────────
-- Returns a JSONB envelope to avoid exposing the bigint client_id directly.
CREATE OR REPLACE FUNCTION get_public_quote(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_row   RECORD;
  v_company TEXT;
BEGIN
  SELECT q.*, pr.company_name, pr.contact_name
    INTO v_row
    FROM quotes q
    LEFT JOIN profiles pr ON pr.id = q.client_id
    WHERE q.public_token = p_token
    LIMIT 1;

  IF v_row IS NULL THEN
    RETURN NULL;
  END IF;

  -- Expired quotes are still viewable but flagged.
  RETURN JSONB_BUILD_OBJECT(
    'id',           v_row.id,
    'client_name',  v_row.client_name,
    'company_name', v_row.company_name,
    'items',        v_row.items,
    'subtotal',     v_row.subtotal,
    'iva_total',    v_row.iva_total,
    'total',        v_row.total,
    'currency',     v_row.currency,
    'status',       v_row.status,
    'created_at',   v_row.created_at,
    'expires_at',   v_row.expires_at
  );
END;
$$;

-- Allow both anonymous and authenticated to read public quotes.
GRANT EXECUTE ON FUNCTION get_public_quote(UUID) TO anon, authenticated;

-- 4. Mark as 'viewed' when a public read happens (optional, best effort) ─────
CREATE OR REPLACE FUNCTION mark_quote_viewed(p_token UUID)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE quotes
     SET status = 'viewed'
   WHERE public_token = p_token
     AND status IN ('draft', 'sent');
$$;

GRANT EXECUTE ON FUNCTION mark_quote_viewed(UUID) TO anon, authenticated;
