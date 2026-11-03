-- ── 050_fix_auth_trigger_role_on_update.sql ──────────────────────────────────
-- BUG FIX: On email UPDATE, the trigger from 042 was overwriting `role` and
-- `default_margin` with values from raw_user_meta_data.
-- If metadata didn't have `role`, it defaulted to 'client' — resetting admins
-- and vendedores silently.
--
-- Fix: On INSERT → full upsert (existing behavior, needed for new user creation).
--      On UPDATE → only sync email, never touch role/margin/active/estado.
-- Fully idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_auth_user_sync()
RETURNS trigger AS $$
DECLARE
  v_role   TEXT;
  v_margin NUMERIC;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Full profile creation for new users
    v_role   := COALESCE(NEW.raw_user_meta_data->>'role', 'client');
    v_margin := public.safe_to_numeric(NEW.raw_user_meta_data->>'default_margin', 20.0);

    INSERT INTO public.profiles (
      id,
      email,
      phone,
      company_name,
      contact_name,
      client_type,
      default_margin,
      role,
      active,
      estado,
      precio_lista
    )
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'phone', ''),
      COALESCE(NEW.raw_user_meta_data->>'company_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'contact_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'client_type', 'mayorista'),
      v_margin,
      v_role,
      true,
      'activo',
      CASE WHEN v_role = 'admin' THEN 'standard' ELSE 'mayorista' END
    )
    ON CONFLICT (id) DO UPDATE
    SET
      email        = EXCLUDED.email,
      phone        = CASE WHEN EXCLUDED.phone <> '' THEN EXCLUDED.phone ELSE profiles.phone END,
      company_name = CASE WHEN EXCLUDED.company_name <> '' THEN EXCLUDED.company_name ELSE profiles.company_name END,
      contact_name = CASE WHEN EXCLUDED.contact_name <> '' THEN EXCLUDED.contact_name ELSE profiles.contact_name END,
      default_margin = EXCLUDED.default_margin,
      role         = EXCLUDED.role,
      updated_at   = now();

  ELSIF TG_OP = 'UPDATE' THEN
    -- Email-only sync on UPDATE — never overwrite role, margin, or active status
    UPDATE public.profiles
       SET email      = NEW.email,
           updated_at = now()
     WHERE id = NEW.id
       AND (email IS NULL OR email <> NEW.email);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.handle_auth_user_sync IS
  'INSERT: full profile creation. UPDATE of email: email-only sync, never resets role.';
