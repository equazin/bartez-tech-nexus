-- ── 035_logstics_tracking.sql ──────────────────────────────────────────────
-- Phase 5.2: Logistics & Tracking (Andreani / OCA)

-- 1. Add tracking information to orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shipping_provider TEXT CHECK (shipping_provider IN ('andreani', 'oca', 'propio', 'otro')),
  ADD COLUMN IF NOT EXISTS tracking_number  TEXT,
  ADD COLUMN IF NOT EXISTS shipping_label_url TEXT;

-- 2. Index for logistics audits
CREATE INDEX IF NOT EXISTS idx_orders_tracking ON orders(tracking_number);

-- Comentario para documentación
COMMENT ON COLUMN orders.shipping_provider IS 'Proveedor logístico (Andreani, OCA, etc.)';
COMMENT ON COLUMN orders.tracking_number IS 'Número de seguimiento oficial del transporte';
