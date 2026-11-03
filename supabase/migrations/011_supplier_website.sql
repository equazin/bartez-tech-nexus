-- Add website field to suppliers
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS website TEXT;
