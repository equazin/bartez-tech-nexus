-- Migration 078: Ensure all onboarding columns exist on b2b_registration_requests
-- Safe to run multiple times (IF NOT EXISTS guards).
-- Fixes: "Could not find the 'approved_user_id' column in the schema cache"

ALTER TABLE b2b_registration_requests
  ADD COLUMN IF NOT EXISTS requested_password  TEXT,
  ADD COLUMN IF NOT EXISTS assigned_seller_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_user_id    UUID;

-- Indices (safe to re-create)
CREATE INDEX IF NOT EXISTS b2b_reg_requests_assigned_seller_idx
  ON b2b_registration_requests (assigned_seller_id);

CREATE INDEX IF NOT EXISTS b2b_reg_requests_approved_user_idx
  ON b2b_registration_requests (approved_user_id);

-- Backfill assigned_seller_id from assigned_to (email) for existing rows
UPDATE b2b_registration_requests AS req
SET    assigned_seller_id = p.id
FROM   profiles AS p
WHERE  req.assigned_seller_id IS NULL
  AND  req.assigned_to        IS NOT NULL
  AND  lower(req.assigned_to) = lower(p.email)
  AND  p.role IN ('vendedor', 'sales', 'admin');

-- Notify PostgREST to reload its schema cache immediately
NOTIFY pgrst, 'reload schema';
