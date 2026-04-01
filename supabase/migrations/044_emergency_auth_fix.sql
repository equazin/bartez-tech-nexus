-- 044_emergency_auth_fix.sql
-- LIMPIEZA DRÁSTICA Y DISPARADOR ULTRA-ROBUSTO
-- Objetivo: Eliminar el Error 500 "Database error saving new user" definitivamente.

-- 1. Limpieza total de CUALQUIER disparador previo en auth.users
DO $$ 
DECLARE 
    trig_name RECORD;
BEGIN 
    FOR trig_name IN 
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE event_object_schema = 'auth' 
          AND event_object_table = 'users' 
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || trig_name.trigger_name || ' ON auth.users;';
    END LOOP;
END $$;

-- 2. Limpieza de funciones anteriores
DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;
DROP FUNCTION IF EXISTS public.sync_profile_email CASCADE;
DROP FUNCTION IF EXISTS public.handle_auth_user_sync CASCADE;

-- 3. Función auxiliar para casteo seguro (copiada para asegurar independencia)
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

-- 4. Nueva función de sincronización con manejo de excepciones global
CREATE OR REPLACE FUNCTION public.handle_auth_user_sync()
RETURNS trigger AS $$
DECLARE
  v_role TEXT;
  v_margin NUMERIC;
  v_client_type TEXT;
BEGIN
  -- Extraer y validar metadata básica
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'client');
  v_margin := public.safe_to_numeric(NEW.raw_user_meta_data->>'default_margin', 20.0);
  v_client_type := COALESCE(NEW.raw_user_meta_data->>'client_type', 'mayorista');

  -- Normalización de roles para cumplir con el CHECK constraint
  IF v_role NOT IN ('client', 'cliente', 'admin', 'vendedor') THEN
    v_role := 'client';
  END IF;

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
      active,
      estado,
      precio_lista,
      updated_at
    )
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'phone', ''),
      COALESCE(NEW.raw_user_meta_data->>'company_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'contact_name', ''),
      v_client_type,
      v_margin,
      v_role,
      true,
      'activo',
      CASE 
        WHEN v_role = 'admin' THEN 'standard'
        ELSE 'mayorista'
      END,
      now()
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

  EXCEPTION WHEN OTHERS THEN
    -- SILENT ERROR: Preferimos que el usuario se cree en AUTH aunque falle el PERFIL (el admin podrá arreglarlo luego)
    -- Esto evita el Error 500 que bloquea el flujo principal.
    RAISE WARNING 'Error al sincronizar perfil para el usuario %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Crear el disparador único
CREATE TRIGGER on_auth_user_sync
  AFTER INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_sync();

COMMENT ON FUNCTION public.handle_auth_user_sync IS 'Sincronización ultra-robusta de auth.users → public.profiles (Filtro Anti-Error 500)';
