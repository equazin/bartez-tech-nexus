-- 085_recurring_orders.sql
-- Reposicion automatica / ordenes recurrentes para clientes B2B.
-- Totalmente idempotente y additive-only.

CREATE TABLE IF NOT EXISTS recurring_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id UUID,
  name TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'custom')),
  custom_days INTEGER,
  next_run_at TIMESTAMPTZ NOT NULL,
  mode TEXT NOT NULL DEFAULT 'confirm' CHECK (mode IN ('auto', 'confirm')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recurring_orders_profile_next_run
  ON recurring_orders (profile_id, active, next_run_at);

CREATE INDEX IF NOT EXISTS idx_recurring_orders_active_next_run
  ON recurring_orders (active, next_run_at);

ALTER TABLE recurring_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS recurring_orders_client_own_select ON recurring_orders;
CREATE POLICY recurring_orders_client_own_select
ON recurring_orders
FOR SELECT
USING (profile_id = auth.uid());

DROP POLICY IF EXISTS recurring_orders_client_own_insert ON recurring_orders;
CREATE POLICY recurring_orders_client_own_insert
ON recurring_orders
FOR INSERT
WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS recurring_orders_client_own_update ON recurring_orders;
CREATE POLICY recurring_orders_client_own_update
ON recurring_orders
FOR UPDATE
USING (profile_id = auth.uid())
WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS recurring_orders_client_own_delete ON recurring_orders;
CREATE POLICY recurring_orders_client_own_delete
ON recurring_orders
FOR DELETE
USING (profile_id = auth.uid());

DROP POLICY IF EXISTS recurring_orders_staff_all ON recurring_orders;
CREATE POLICY recurring_orders_staff_all
ON recurring_orders
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'vendedor', 'sales')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'vendedor', 'sales')
  )
);

