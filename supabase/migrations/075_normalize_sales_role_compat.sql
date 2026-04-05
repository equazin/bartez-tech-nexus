-- 075_normalize_sales_role_compat.sql
-- Mantiene compatibilidad con las policies actuales mientras la UI se unifica en "sales".

UPDATE public.profiles
SET role = 'vendedor'
WHERE role = 'sales';

UPDATE auth.users
SET raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'vendedor')
WHERE coalesce(raw_user_meta_data ->> 'role', '') = 'sales';
