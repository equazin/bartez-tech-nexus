-- =============================================================
-- BARTEZ B2B — Migration 002: Orders extended columns + Products price_tiers
-- Run in Supabase SQL Editor (Dashboard > SQL Editor)
-- Safe to run multiple times (IF NOT EXISTS / idempotent)
-- =============================================================

-- ─── 1. ORDERS — extended checkout fields ────────────────────

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS order_number        text,
  ADD COLUMN IF NOT EXISTS notes               text,
  ADD COLUMN IF NOT EXISTS payment_method      text,
  ADD COLUMN IF NOT EXISTS payment_surcharge_pct numeric(5,2),
  ADD COLUMN IF NOT EXISTS shipping_type       text,
  ADD COLUMN IF NOT EXISTS shipping_address    text,
  ADD COLUMN IF NOT EXISTS shipping_transport  text,
  ADD COLUMN IF NOT EXISTS shipping_cost       numeric(12,2),
  ADD COLUMN IF NOT EXISTS numero_remito       text,
  ADD COLUMN IF NOT EXISTS tracking_number     text,
  ADD COLUMN IF NOT EXISTS shipped_at          timestamptz,
  ADD COLUMN IF NOT EXISTS payment_proofs      jsonb DEFAULT '[]'::jsonb;

-- Extend status to support full workflow
-- (if using a CHECK constraint, add the new values)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending','approved','preparing','shipped','delivered','rejected','dispatched'));

-- ─── 2. PRODUCTS — volume pricing tiers ──────────────────────

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS price_tiers   jsonb,
  ADD COLUMN IF NOT EXISTS stock_reserved integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_order_qty  integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS iva_rate       numeric(5,2) NOT NULL DEFAULT 21;

-- ─── 3. PROFILES — credit fields ─────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS credit_limit  numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_used   numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS client_type   text DEFAULT 'mayorista';

-- ─── 4. INDEX for order_number lookup ────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number)
  WHERE order_number IS NOT NULL;

-- ─── 5. pricing_rules: add client + product condition types ──

ALTER TABLE pricing_rules DROP CONSTRAINT IF EXISTS pricing_rules_condition_type_check;
ALTER TABLE pricing_rules ADD CONSTRAINT pricing_rules_condition_type_check
  CHECK (condition_type IN ('product','client','category','supplier','tag','sku_prefix'));

-- Add quantity_breaks column if missing
ALTER TABLE pricing_rules
  ADD COLUMN IF NOT EXISTS quantity_breaks jsonb;
