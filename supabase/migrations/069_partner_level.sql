-- Migration 069: Partner level + assigned seller on profiles
-- Idempotent

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'partner_level'
  ) THEN
    ALTER TABLE profiles
      ADD COLUMN partner_level TEXT NOT NULL DEFAULT 'cliente'
      CHECK (partner_level IN ('cliente', 'silver', 'gold', 'platinum'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'assigned_seller_id'
  ) THEN
    ALTER TABLE profiles
      ADD COLUMN assigned_seller_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;
