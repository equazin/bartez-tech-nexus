-- =============================================================
-- 042_robust_auth_trigger.sql
-- Consolidates all auth-to-profile sync logic.
-- Prevents "Database error saving new user" by using UPSERT.
-- =============================================================

-- 1. Limpiar triggers y funciones previas para evitar conflictos
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_email_change ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_v2 ON auth.users;

DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;
DROP FUNCTION IF EXISTS public.sync_profile_email CASCADE;

-- 2. Crear función única y robusta de sincronización
CREATE OR REPLACE FUNCTION public.handle_auth_user_sync()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    phone,
    company_name,
    contact_name,
    client_type,
    default_margin,
    role,
    active
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'company_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'contact_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'client_type', 'reseller'),
    COALESCE((NEW.raw_user_meta_data->>'default_margin')::numeric, 20.0),
    COALESCE(NEW.raw_user_meta_data->>'role', 'client'),
    true
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    phone = CASE 
              WHEN EXCLUDED.phone <> '' THEN EXCLUDED.phone 
              ELSE profiles.phone 
            END,
    company_name = CASE 
                     WHEN EXCLUDED.company_name <> '' THEN EXCLUDED.company_name 
                     ELSE profiles.company_name 
                   END,
    contact_name = CASE 
                     WHEN EXCLUDED.contact_name <> '' THEN EXCLUDED.contact_name 
                     ELSE profiles.contact_name 
                   END,
    client_type = EXCLUDED.client_type,
    default_margin = EXCLUDED.default_margin,
    role = EXCLUDED.role,
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Crear disparador único para INSERT y UPDATE (email)
CREATE TRIGGER on_auth_user_sync
  AFTER INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_sync();
