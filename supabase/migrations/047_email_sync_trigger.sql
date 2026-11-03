-- ── 045_email_sync_trigger.sql ──────────────────────────────────────────────
-- Keeps profiles.email in sync with auth.users.email automatically.
-- Fires on every UPDATE to auth.users (e.g., email confirmation, email change).
-- Also backfills missing emails on initial run.
-- Fully idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Function: copy email from auth.users → profiles on update
CREATE OR REPLACE FUNCTION sync_profile_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
     SET email = NEW.email
   WHERE id = NEW.id
     AND (email IS NULL OR email <> NEW.email);
  RETURN NEW;
END;
$$;

-- 2. Trigger: fire after every email-relevant change on auth.users
DROP TRIGGER IF EXISTS on_auth_user_email_change ON auth.users;

CREATE TRIGGER on_auth_user_email_change
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION sync_profile_email();

-- 3. Backfill: sync existing rows where profile.email is missing or stale
UPDATE profiles p
   SET email = u.email
  FROM auth.users u
 WHERE p.id = u.id
   AND (p.email IS NULL OR p.email <> u.email);
