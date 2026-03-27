-- Add phone column to profiles table for WhatsApp contact
-- Migrates from localStorage sidecar to proper DB column

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
