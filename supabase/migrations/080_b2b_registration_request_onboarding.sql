-- Migration 077: Make B2B registration onboarding fully actionable
ALTER TABLE b2b_registration_requests
  ADD COLUMN IF NOT EXISTS requested_password TEXT,
  ADD COLUMN IF NOT EXISTS assigned_seller_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_user_id UUID;

CREATE INDEX IF NOT EXISTS b2b_reg_requests_assigned_seller_idx
  ON b2b_registration_requests (assigned_seller_id);

CREATE INDEX IF NOT EXISTS b2b_reg_requests_approved_user_idx
  ON b2b_registration_requests (approved_user_id);

UPDATE b2b_registration_requests AS req
SET assigned_seller_id = profile.id
FROM profiles AS profile
WHERE req.assigned_seller_id IS NULL
  AND req.assigned_to IS NOT NULL
  AND lower(req.assigned_to) = lower(profile.email)
  AND profile.role IN ('vendedor', 'sales');
