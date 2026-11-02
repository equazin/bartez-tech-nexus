-- ── 046_auto_invoice_trigger.sql ────────────────────────────────────────────
-- Automatically creates a draft invoice when an order transitions to 'approved'.
-- Idempotent: skips if an invoice for this order already exists.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION auto_create_invoice_on_approve()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only act when status changes TO 'approved'
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status <> 'approved' THEN
    RETURN NEW;
  END IF;

  -- Skip if an invoice already exists for this order (idempotent)
  IF EXISTS (SELECT 1 FROM invoices WHERE order_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Create draft invoice (30-day due date, ARS by default)
  BEGIN
    PERFORM create_invoice_from_order(
      p_order_id  => NEW.id,
      p_due_days  => 30,
      p_currency  => 'ARS',
      p_exch_rate => NULL
    );
  EXCEPTION WHEN OTHERS THEN
    -- Log but never block the order status update
    RAISE WARNING '[auto_invoice] Failed to create invoice for order %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Attach trigger to orders table
DROP TRIGGER IF EXISTS trg_auto_invoice_on_approve ON orders;

CREATE TRIGGER trg_auto_invoice_on_approve
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_invoice_on_approve();
