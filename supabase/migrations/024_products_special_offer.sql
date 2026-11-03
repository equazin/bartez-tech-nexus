-- Add optional offer fields for manual product create/edit flows
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS special_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS offer_percent numeric(5,2);

