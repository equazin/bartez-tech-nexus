-- ── 017_credit_terms_notifications.sql ─────────────────────────────────────
-- Credit terms, notifications, and auto-movement trigger from invoices

-- ── 1. Credit term fields on profiles ────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS payment_terms       INTEGER   DEFAULT 30,
  ADD COLUMN IF NOT EXISTS credit_approved     BOOLEAN   DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS credit_approved_by  UUID      REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS credit_approved_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS credit_review_date  DATE,
  ADD COLUMN IF NOT EXISTS notas_credito       TEXT,
  ADD COLUMN IF NOT EXISTS max_order_value     NUMERIC(12,2) DEFAULT 0; -- 0 = sin límite por pedido

-- ── 2. Notifications table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,          -- 'new_order' | 'order_status' | 'invoice_overdue' | 'low_stock' | 'credit_alert'
  title       TEXT NOT NULL,
  body        TEXT,
  read        BOOLEAN NOT NULL DEFAULT FALSE,
  entity_type TEXT,                  -- 'order' | 'invoice' | 'product' | 'client'
  entity_id   TEXT,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Admins can see all notifications; each user sees their own
CREATE POLICY "Admin can read all notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "Authenticated can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "User can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ── 3. Auto account_movement when invoice is created/sent ─────────────────────
-- When an invoice is inserted with status = 'sent', or updated to 'sent',
-- automatically create a 'factura' movement in account_movements.

CREATE OR REPLACE FUNCTION fn_invoice_to_movement()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Only fire on new 'sent' invoices or when transitioning to 'sent'
  IF (TG_OP = 'INSERT' AND NEW.status = 'sent')
     OR (TG_OP = 'UPDATE' AND NEW.status = 'sent' AND OLD.status <> 'sent') THEN

    -- Avoid duplicate movements for the same invoice
    IF NOT EXISTS (
      SELECT 1 FROM account_movements
      WHERE reference_id = NEW.id::TEXT AND reference_type = 'invoice'
    ) THEN
      INSERT INTO account_movements (
        client_id, tipo, monto, descripcion, reference_id, reference_type, fecha
      ) VALUES (
        NEW.client_id,
        'factura',
        NEW.total,
        COALESCE('Factura ' || NEW.invoice_number, 'Factura #' || NEW.id),
        NEW.id::TEXT,
        'invoice',
        COALESCE(NEW.due_date::DATE::TIMESTAMPTZ, NOW())
      );
    END IF;
  END IF;

  -- When invoice is paid → insert a 'pago' movement
  IF (TG_OP = 'UPDATE' AND NEW.status = 'paid' AND OLD.status <> 'paid') THEN
    IF NOT EXISTS (
      SELECT 1 FROM account_movements
      WHERE reference_id = NEW.id::TEXT AND reference_type = 'invoice_payment'
    ) THEN
      INSERT INTO account_movements (
        client_id, tipo, monto, descripcion, reference_id, reference_type, fecha
      ) VALUES (
        NEW.client_id,
        'pago',
        -NEW.total,
        COALESCE('Pago factura ' || NEW.invoice_number, 'Pago factura #' || NEW.id),
        NEW.id::TEXT,
        'invoice_payment',
        NOW()
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_to_movement ON invoices;
CREATE TRIGGER trg_invoice_to_movement
  AFTER INSERT OR UPDATE OF status ON invoices
  FOR EACH ROW EXECUTE FUNCTION fn_invoice_to_movement();

-- ── 4. Notify admins on new order ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_notify_new_order()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  admin_rec RECORD;
  client_name TEXT;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    SELECT COALESCE(company_name, contact_name, 'Cliente') INTO client_name
    FROM profiles WHERE id = NEW.client_id::UUID;

    FOR admin_rec IN
      SELECT id FROM profiles WHERE role = 'admin'
    LOOP
      INSERT INTO notifications (user_id, type, title, body, entity_type, entity_id, metadata)
      VALUES (
        admin_rec.id,
        'new_order',
        'Nuevo pedido recibido',
        COALESCE(NEW.order_number, '#' || LEFT(NEW.id::TEXT, 8)) || ' · ' || COALESCE(client_name, ''),
        'order',
        NEW.id::TEXT,
        jsonb_build_object('order_number', NEW.order_number, 'total', NEW.total, 'client_name', client_name)
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_order ON orders;
CREATE TRIGGER trg_notify_new_order
  AFTER INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION fn_notify_new_order();

-- ── 5. RPC: mark all notifications read ──────────────────────────────────────
CREATE OR REPLACE FUNCTION mark_notifications_read(p_user_id UUID DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE notifications
  SET read = TRUE
  WHERE read = FALSE
    AND (p_user_id IS NULL OR user_id = p_user_id);
END;
$$;
