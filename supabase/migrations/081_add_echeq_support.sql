-- ── 081_add_echeq_support.sql ───────────────────────────────────────────────
-- Add support for echeq details in payments
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Update the check constraint for payment_method
-- Since it's often anonymous, we can recreate it or just rely on the new one.
-- To be safe, we'll try to find the constraint name or use a common migration pattern:
-- Drop existing constraint, add new one.

DO $$
BEGIN
    -- Drop old check constraint if exists (Postgres usually names them like [table]_[column]_check)
    ALTER TABLE IF EXISTS payments DROP CONSTRAINT IF EXISTS payments_payment_method_check;
    
    -- Add new check constraint including 'echeq'
    ALTER TABLE paymentS ADD CONSTRAINT payments_payment_method_check 
        CHECK (payment_method IN ('transferencia', 'deposito', 'efectivo', 'echeq', 'otro'));
END $$;

-- 2. Add echeq_details column (JSONB)
-- This will store { count: number, dates: string[] }
ALTER TABLE payments ADD COLUMN IF NOT EXISTS echeq_details JSONB;

COMMENT ON COLUMN payments.echeq_details IS 'Detailed information for echeq payments (count and individual due dates).';
