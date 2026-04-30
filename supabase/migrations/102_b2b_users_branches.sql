-- ── 102_b2b_users_branches.sql ────────────────────────────────────────────────
-- Sprint 6: Multi-user + Multi-branch + Approval management
--
-- Builds on top of 031_corporate_hierarchy.sql which already added:
--   • profiles.b2b_role (manager | buyer | admin)
--   • profiles.approval_threshold
--   • profiles.parent_id (buyer → manager link)
--   • orders.approved_by / approved_at
--   • orders.status includes 'pending_approval' and 'rejected'
--   • approve_b2b_order(UUID) RPC
--
-- This migration adds:
--   1. client_branches table — shipping addresses per company
--   2. b2b_invitations table — pending invitations (pre-signup)
--   3. orders.branch_id FK
--   4. reject_b2b_order(UUID, TEXT) RPC
--   5. get_pending_approvals() — manager sees orders awaiting approval
--   6. get_my_b2b_team() — list sub-users for the authenticated manager
--   7. invite_b2b_user(email, role, threshold) — creates invitation record
--   8. remove_b2b_user(profile_id) — unlinks a buyer from this manager
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. client_branches ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_branches (
  id           BIGSERIAL   PRIMARY KEY,
  client_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  address      TEXT,
  city         TEXT,
  province     TEXT,
  postal_code  TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  is_default   BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_branches_client ON client_branches(client_id);

ALTER TABLE client_branches ENABLE ROW LEVEL SECURITY;

-- Owner: full CRUD on own branches
DROP POLICY IF EXISTS "branches_owner_all" ON client_branches;
CREATE POLICY "branches_owner_all"
  ON client_branches FOR ALL TO authenticated
  USING  (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

-- Manager can also manage branches of their sub-users
DROP POLICY IF EXISTS "branches_manager_select" ON client_branches;
CREATE POLICY "branches_manager_select"
  ON client_branches FOR SELECT TO authenticated
  USING (
    client_id IN (
      SELECT id FROM profiles WHERE parent_id = auth.uid()
    )
  );

-- Admin full access
DROP POLICY IF EXISTS "branches_admin_all" ON client_branches;
CREATE POLICY "branches_admin_all"
  ON client_branches FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON client_branches TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE client_branches_id_seq TO authenticated;

-- 2. b2b_invitations ──────────────────────────────────────────────────────────
-- Tracks pending email invitations before the user has signed up.
CREATE TABLE IF NOT EXISTS b2b_invitations (
  id                BIGSERIAL   PRIMARY KEY,
  manager_id        UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invited_email     TEXT        NOT NULL,
  role              TEXT        NOT NULL DEFAULT 'buyer'
                    CHECK (role IN ('buyer', 'manager')),
  approval_threshold NUMERIC(14,2) NOT NULL DEFAULT 0,
  token             TEXT        NOT NULL UNIQUE DEFAULT gen_random_uuid()::TEXT,
  accepted_at       TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_b2b_invitations_manager ON b2b_invitations(manager_id);
CREATE INDEX IF NOT EXISTS idx_b2b_invitations_email   ON b2b_invitations(invited_email);

ALTER TABLE b2b_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invitations_manager_select" ON b2b_invitations;
CREATE POLICY "invitations_manager_select"
  ON b2b_invitations FOR SELECT TO authenticated
  USING (manager_id = auth.uid());

DROP POLICY IF EXISTS "invitations_admin_all" ON b2b_invitations;
CREATE POLICY "invitations_admin_all"
  ON b2b_invitations FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

GRANT SELECT, INSERT, DELETE ON b2b_invitations TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE b2b_invitations_id_seq TO authenticated;

-- 3. orders.branch_id ─────────────────────────────────────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS branch_id BIGINT REFERENCES client_branches(id) ON DELETE SET NULL;

-- 4. reject_b2b_order ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reject_b2b_order(
  p_order_id UUID,
  p_reason   TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_order    RECORD;
  v_approver RECORD;
BEGIN
  SELECT * INTO v_order    FROM orders   WHERE id = p_order_id;
  SELECT * INTO v_approver FROM profiles WHERE id = auth.uid();

  IF v_order IS NULL THEN
    RAISE EXCEPTION 'Orden no encontrada';
  END IF;

  IF v_order.status != 'pending_approval' THEN
    RAISE EXCEPTION 'La orden no está pendiente de aprobación (Estado: %)', v_order.status;
  END IF;

  IF v_approver.role != 'admin' THEN
    IF v_approver.b2b_role != 'manager'
       OR v_approver.id != (SELECT parent_id FROM profiles WHERE id = v_order.client_id::UUID)
    THEN
      RAISE EXCEPTION 'Sin permisos para rechazar esta orden';
    END IF;
  END IF;

  UPDATE orders
  SET status      = 'rejected',
      approved_by = auth.uid(),
      approved_at = now(),
      notes       = CASE
                      WHEN p_reason IS NOT NULL
                      THEN COALESCE(notes || E'\n', '') || 'Rechazado: ' || p_reason
                      ELSE notes
                    END
  WHERE id = p_order_id;

  -- Release reserved stock
  DECLARE
    v_item       JSONB;
    v_product_id INTEGER;
    v_quantity   INTEGER;
  BEGIN
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_order.products) LOOP
      v_product_id := (v_item->>'product_id')::INTEGER;
      v_quantity   := (v_item->>'quantity')::INTEGER;
      UPDATE products
        SET stock_reserved = GREATEST(0, COALESCE(stock_reserved, 0) - v_quantity)
      WHERE id = v_product_id;
    END LOOP;
  END;

  RETURN jsonb_build_object('success', true, 'new_status', 'rejected');
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_b2b_order(UUID, TEXT) TO authenticated;

-- 5. get_pending_approvals ─────────────────────────────────────────────────────
-- Returns orders in 'pending_approval' placed by sub-users of the current manager.
-- Also returns all pending_approval orders if caller is admin.
CREATE OR REPLACE FUNCTION public.get_pending_approvals()
RETURNS TABLE(
  order_id      UUID,
  order_number  TEXT,
  client_id     UUID,
  client_name   TEXT,
  buyer_name    TEXT,
  total         NUMERIC,
  currency      TEXT,
  created_at    TIMESTAMPTZ,
  products      JSONB
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    o.id            AS order_id,
    o.order_number,
    o.client_id::UUID,
    p_manager.company_name  AS client_name,
    p_buyer.contact_name    AS buyer_name,
    o.total,
    COALESCE(o.currency, 'ARS') AS currency,
    o.created_at,
    o.products
  FROM orders o
  JOIN profiles p_buyer   ON p_buyer.id = o.client_id::UUID
  JOIN profiles p_manager ON p_manager.id = p_buyer.parent_id
  WHERE o.status = 'pending_approval'
    AND (
      -- Admin sees all
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
      OR
      -- Manager sees their buyers
      p_buyer.parent_id = auth.uid()
    )
  ORDER BY o.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_pending_approvals() TO authenticated;

-- 6. get_my_b2b_team ──────────────────────────────────────────────────────────
-- Lists all buyer profiles whose parent_id = auth.uid().
CREATE OR REPLACE FUNCTION public.get_my_b2b_team()
RETURNS TABLE(
  id                 UUID,
  email              TEXT,
  contact_name       TEXT,
  b2b_role           TEXT,
  approval_threshold NUMERIC,
  active             BOOLEAN,
  created_at         TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    p.id,
    p.email,
    p.contact_name,
    p.b2b_role,
    p.approval_threshold,
    p.active,
    p.created_at
  FROM profiles p
  WHERE p.parent_id = auth.uid()
  ORDER BY p.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_b2b_team() TO authenticated;

-- 7. invite_b2b_user ──────────────────────────────────────────────────────────
-- Creates a pending invitation record. Caller must be manager or admin.
-- Actual email sending is handled by an Edge Function that polls this table.
CREATE OR REPLACE FUNCTION public.invite_b2b_user(
  p_email     TEXT,
  p_role      TEXT    DEFAULT 'buyer',
  p_threshold NUMERIC DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_caller RECORD;
  v_inv_id BIGINT;
BEGIN
  SELECT * INTO v_caller FROM profiles WHERE id = auth.uid();

  IF v_caller.role != 'admin' AND v_caller.b2b_role != 'manager' THEN
    RAISE EXCEPTION 'Solo managers y admins pueden invitar usuarios';
  END IF;

  -- Upsert: refresh if expired invitation for same email exists
  INSERT INTO b2b_invitations (manager_id, invited_email, role, approval_threshold)
  VALUES (auth.uid(), lower(p_email), p_role, p_threshold)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_inv_id;

  RETURN jsonb_build_object(
    'success', true,
    'invitation_id', v_inv_id,
    'email', p_email
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.invite_b2b_user(TEXT, TEXT, NUMERIC) TO authenticated;

-- 8. remove_b2b_user ──────────────────────────────────────────────────────────
-- Unlinks a buyer from this manager (nullifies parent_id, resets b2b_role).
-- Does NOT delete the auth user.
CREATE OR REPLACE FUNCTION public.remove_b2b_user(p_profile_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_caller RECORD;
  v_target RECORD;
BEGIN
  SELECT * INTO v_caller FROM profiles WHERE id = auth.uid();
  SELECT * INTO v_target FROM profiles WHERE id = p_profile_id;

  IF v_target IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;

  -- Only manager of this user or admin can remove
  IF v_caller.role != 'admin' THEN
    IF v_target.parent_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Sin permisos para remover este usuario';
    END IF;
  END IF;

  UPDATE profiles
  SET parent_id  = NULL,
      b2b_role   = 'manager',
      approval_threshold = 0
  WHERE id = p_profile_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_b2b_user(UUID) TO authenticated;

-- 9. update_b2b_user ──────────────────────────────────────────────────────────
-- Manager can change role and approval threshold for their sub-users.
CREATE OR REPLACE FUNCTION public.update_b2b_user(
  p_profile_id UUID,
  p_role       TEXT    DEFAULT NULL,
  p_threshold  NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_caller RECORD;
  v_target RECORD;
BEGIN
  SELECT * INTO v_caller FROM profiles WHERE id = auth.uid();
  SELECT * INTO v_target FROM profiles WHERE id = p_profile_id;

  IF v_target IS NULL THEN RAISE EXCEPTION 'Usuario no encontrado'; END IF;

  IF v_caller.role != 'admin' THEN
    IF v_target.parent_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Sin permisos para modificar este usuario';
    END IF;
  END IF;

  UPDATE profiles
  SET b2b_role           = COALESCE(p_role, b2b_role),
      approval_threshold = COALESCE(p_threshold, approval_threshold)
  WHERE id = p_profile_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_b2b_user(UUID, TEXT, NUMERIC) TO authenticated;

-- 10. get_my_branches ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_branches()
RETURNS TABLE(
  id            BIGINT,
  name          TEXT,
  address       TEXT,
  city          TEXT,
  province      TEXT,
  postal_code   TEXT,
  contact_name  TEXT,
  contact_phone TEXT,
  is_default    BOOLEAN,
  created_at    TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id, name, address, city, province, postal_code,
         contact_name, contact_phone, is_default, created_at
  FROM client_branches
  WHERE client_id = auth.uid()
  ORDER BY is_default DESC, name ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_branches() TO authenticated;

-- 11. upsert_branch ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.upsert_branch(
  p_id            BIGINT  DEFAULT NULL,
  p_name          TEXT    DEFAULT '',
  p_address       TEXT    DEFAULT NULL,
  p_city          TEXT    DEFAULT NULL,
  p_province      TEXT    DEFAULT NULL,
  p_postal_code   TEXT    DEFAULT NULL,
  p_contact_name  TEXT    DEFAULT NULL,
  p_contact_phone TEXT    DEFAULT NULL,
  p_is_default    BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id BIGINT;
BEGIN
  -- If marking as default, clear previous default
  IF p_is_default THEN
    UPDATE client_branches SET is_default = false WHERE client_id = auth.uid();
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO client_branches
      (client_id, name, address, city, province, postal_code, contact_name, contact_phone, is_default)
    VALUES
      (auth.uid(), p_name, p_address, p_city, p_province, p_postal_code, p_contact_name, p_contact_phone, p_is_default)
    RETURNING id INTO v_id;
  ELSE
    UPDATE client_branches
    SET name          = p_name,
        address       = p_address,
        city          = p_city,
        province      = p_province,
        postal_code   = p_postal_code,
        contact_name  = p_contact_name,
        contact_phone = p_contact_phone,
        is_default    = p_is_default,
        updated_at    = now()
    WHERE id = p_id AND client_id = auth.uid()
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'Sucursal no encontrada o sin permisos';
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_branch(BIGINT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;

-- 12. delete_branch ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_branch(p_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM client_branches WHERE id = p_id AND client_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sucursal no encontrada o sin permisos';
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_branch(BIGINT) TO authenticated;

-- 13. get_my_pending_invitations ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_pending_invitations()
RETURNS TABLE(
  id             BIGINT,
  invited_email  TEXT,
  role           TEXT,
  approval_threshold NUMERIC,
  expires_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id, invited_email, role, approval_threshold, expires_at, created_at
  FROM b2b_invitations
  WHERE manager_id = auth.uid()
    AND accepted_at IS NULL
    AND expires_at > now()
  ORDER BY created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_pending_invitations() TO authenticated;
