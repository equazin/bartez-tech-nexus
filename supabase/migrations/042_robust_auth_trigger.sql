-- 042_robust_auth_trigger.sql
-- FIX: Arreglo definitivo para "Database error saving new user" (Error 500)
-- Este script limpia triggers anteriores y usa lógica de casteo segura.

-- 1. Limpieza total de triggers previos (incluyendo nombres antiguos)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_email_change ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_v2 ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_sync ON auth.users;

DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;
DROP FUNCTION IF EXISTS public.sync_profile_email CASCADE;
DROP FUNCTION IF EXISTS public.handle_auth_user_sync CASCADE;

-- 2. Función auxiliar para casteo seguro de texto a numérico
CREATE OR REPLACE FUNCTION public.safe_to_numeric(val text, default_val numeric)
RETURNS numeric AS $$
BEGIN
  IF val IS NULL OR val = '' OR val !~ '^[0-9]+(\.[0-9]+)?$' THEN
    RETURN default_val;
  END IF;
  RETURN val::numeric;
EXCEPTION WHEN OTHERS THEN
  RETURN default_val;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. Nueva función de sincronización robusta
CREATE OR REPLACE FUNCTION public.handle_auth_user_sync()
RETURNS trigger AS $$
DECLARE
  v_role TEXT;
  v_margin NUMERIC;
BEGIN
  -- Extraer y validar metadata
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'client');
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
    CASE 
      WHEN v_role = 'admin' THEN 'standard'
      ELSE 'mayorista'
    END
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    phone = CASE WHEN EXCLUDED.phone <> '' THEN EXCLUDED.phone ELSE profiles.phone END,
    company_name = CASE WHEN EXCLUDED.company_name <> '' THEN EXCLUDED.company_name ELSE profiles.company_name END,
    contact_name = CASE WHEN EXCLUDED.contact_name <> '' THEN EXCLUDED.contact_name ELSE profiles.contact_name END,
    default_margin = EXCLUDED.default_margin,
    role = EXCLUDED.role,
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Re-crear disparador único
CREATE TRIGGER on_auth_user_sync
  AFTER INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_sync();

COMMENT ON FUNCTION public.handle_auth_user_sync IS 'Sincroniza auth.users con public.profiles de forma ultra-robusta';
