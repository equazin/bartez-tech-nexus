-- 074_seller_monthly_target.sql
-- Objetivo comercial mensual por vendedor

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS monthly_target numeric(14,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_profiles_monthly_target ON public.profiles(monthly_target);
