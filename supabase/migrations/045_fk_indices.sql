-- ── 044_fk_indices.sql ──────────────────────────────────────────────────────
-- Add missing FK indices on high-cardinality foreign keys.
-- These are critical for query performance as the dataset grows.
-- Fully idempotent — safe to run multiple times.
-- ─────────────────────────────────────────────────────────────────────────────

-- orders.client_id — used in every client order lookup + RLS policy
CREATE INDEX IF NOT EXISTS idx_orders_client_id
  ON orders(client_id, created_at DESC);

-- invoices.client_id — used in invoice listing per client
CREATE INDEX IF NOT EXISTS idx_invoices_client_id
  ON invoices(client_id, created_at DESC);

-- account_movements.client_id — used in ledger balance queries
CREATE INDEX IF NOT EXISTS idx_account_movements_client_id
  ON account_movements(client_id, created_at DESC);

-- orders.status — used in Kanban board filtering and status aggregations
CREATE INDEX IF NOT EXISTS idx_orders_status
  ON orders(status, created_at DESC);

-- invoices.status — used in overdue invoice queries
CREATE INDEX IF NOT EXISTS idx_invoices_status
  ON invoices(status);

-- products.active — used in portal_products view and catalog queries
CREATE INDEX IF NOT EXISTS idx_products_active
  ON products(active, id);

-- products.supplier_id — used in supplier sync and supplier-filtered reports
CREATE INDEX IF NOT EXISTS idx_products_supplier_id
  ON products(supplier_id);
