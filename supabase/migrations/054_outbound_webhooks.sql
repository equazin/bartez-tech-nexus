-- ── 052_outbound_webhooks.sql ─────────────────────────────────────────────────
-- Outbound webhook system for ERP / SAP integrations.
-- Admins register endpoint URLs; a DB trigger enqueues events; a serverless
-- function (or cron) drains the queue and POSTs to each registered endpoint.
-- Fully idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Webhook endpoints registry
CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        TEXT NOT NULL,
  url         TEXT NOT NULL,
  secret      TEXT,                       -- HMAC-SHA256 signing secret
  events      TEXT[] NOT NULL DEFAULT '{}',  -- e.g. {'order.created','invoice.created'}
  active      BOOLEAN NOT NULL DEFAULT true,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE webhook_endpoints IS
  'Registered HTTP endpoints that receive outbound event notifications (ERP/SAP).';
COMMENT ON COLUMN webhook_endpoints.events IS
  'Event types to subscribe to. Supported: order.created, order.status_changed, '
  'invoice.created, quote.approved, rma.created';

-- 2. Webhook delivery queue
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  endpoint_id   BIGINT NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL,
  payload       JSONB NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'delivered', 'failed', 'skipped')),
  attempt_count INT NOT NULL DEFAULT 0,
  last_error    TEXT,
  scheduled_at  TIMESTAMPTZ DEFAULT now(),
  delivered_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE webhook_deliveries IS
  'Outbound webhook delivery queue with retry tracking.';

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status
  ON webhook_deliveries(status, scheduled_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint
  ON webhook_deliveries(endpoint_id);

-- 4. RLS — admin only
ALTER TABLE webhook_endpoints  ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_webhook_endpoints_all"  ON webhook_endpoints;
DROP POLICY IF EXISTS "admin_webhook_deliveries_all" ON webhook_deliveries;

CREATE POLICY "admin_webhook_endpoints_all"
  ON webhook_endpoints FOR ALL TO authenticated
  USING (get_my_role() = 'admin');

CREATE POLICY "admin_webhook_deliveries_all"
  ON webhook_deliveries FOR ALL TO authenticated
  USING (get_my_role() = 'admin');

-- 5. Helper: enqueue an event to all matching active endpoints
CREATE OR REPLACE FUNCTION enqueue_webhook_event(
  p_event_type TEXT,
  p_payload    JSONB
)
RETURNS INT           -- number of deliveries enqueued
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT := 0;
  v_endpoint RECORD;
BEGIN
  FOR v_endpoint IN
    SELECT id FROM webhook_endpoints
     WHERE active = true
       AND p_event_type = ANY(events)
  LOOP
    INSERT INTO webhook_deliveries (endpoint_id, event_type, payload)
    VALUES (v_endpoint.id, p_event_type, p_payload);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- 6. Trigger: enqueue order events automatically
CREATE OR REPLACE FUNCTION trg_enqueue_order_webhook()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM enqueue_webhook_event(
      'order.created',
      jsonb_build_object(
        'order_id',     NEW.id,
        'order_number', NEW.order_number,
        'client_id',    NEW.client_id,
        'total',        NEW.total,
        'status',       NEW.status,
        'created_at',   NEW.created_at
      )
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM enqueue_webhook_event(
      'order.status_changed',
      jsonb_build_object(
        'order_id',     NEW.id,
        'order_number', NEW.order_number,
        'client_id',    NEW.client_id,
        'old_status',   OLD.status,
        'new_status',   NEW.status,
        'updated_at',   now()
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_webhook ON orders;
CREATE TRIGGER trg_order_webhook
  AFTER INSERT OR UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION trg_enqueue_order_webhook();

-- 7. Trigger: enqueue invoice events
CREATE OR REPLACE FUNCTION trg_enqueue_invoice_webhook()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM enqueue_webhook_event(
    'invoice.created',
    jsonb_build_object(
      'invoice_id',     NEW.id,
      'invoice_number', NEW.invoice_number,
      'client_id',      NEW.client_id,
      'total',          NEW.total,
      'status',         NEW.status,
      'created_at',     NEW.created_at
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_webhook ON invoices;
CREATE TRIGGER trg_invoice_webhook
  AFTER INSERT ON invoices
  FOR EACH ROW EXECUTE FUNCTION trg_enqueue_invoice_webhook();
