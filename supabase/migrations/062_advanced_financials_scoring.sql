-- ── 062_advanced_financials_scoring.sql ────────────────────────────────────
-- advanced credit scoring, interests and e-check support
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Dynamic Credit Scoring table
CREATE TABLE IF NOT EXISTS client_scoring (
  client_id       UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  behavioral_score INTEGER DEFAULT 100, -- 0 to 1000
  payment_history  JSONB DEFAULT '[]', -- List of late payments
  last_calculation TIMESTAMPTZ DEFAULT now()
);

-- 2. Automated Interest Calculation (Intereses Punitorios)
-- This logic can be triggered via Edge Function or Cron
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS interest_amount NUMERIC DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS last_interest_calc TIMESTAMPTZ;

-- 3. E-Check tracking
CREATE TABLE IF NOT EXISTS e_checks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID REFERENCES profiles(id),
  check_number    TEXT UNIQUE NOT NULL,
  bank_name       TEXT,
  amount          NUMERIC NOT NULL,
  due_date        DATE NOT NULL,
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'deposited', 'rejected', 'cancelled')),
  id_echeck       TEXT, -- Transacciones de COELSA / Interbanking
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- 4. Activity Logs for Price Changes (Forensics)
-- Ensures any price change is logged with previous/new value
CREATE OR REPLACE FUNCTION log_product_price_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.cost_price IS DISTINCT FROM NEW.cost_price OR OLD.stock IS DISTINCT FROM NEW.stock THEN
    INSERT INTO activity_logs (user_id, action, entity_type, entity_id, metadata)
    VALUES (
      auth.uid(),
      'price_stock_update',
      'product',
      NEW.id::text,
      jsonb_build_object(
        'sku', NEW.sku,
        'old_cost', OLD.cost_price,
        'new_cost', NEW.cost_price,
        'old_stock', OLD.stock,
        'new_stock', NEW.stock
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_log_price_change
AFTER UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION log_product_price_change();

-- 5. User Hierarchies (Comprador vs Dueño)
-- In this schema, 'role' is a TEXT column in 'profiles'. 
-- We'll just define the concept of 'buyer' in our app logic.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS needs_approval BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS parent_client_id UUID REFERENCES profiles(id); -- For multi-user corporate accounts
