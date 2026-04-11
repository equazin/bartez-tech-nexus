-- Tabla de preferencias de notificación por cliente
-- Idempotente: IF NOT EXISTS en todas las operaciones

CREATE TABLE IF NOT EXISTS notification_preferences (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event       TEXT NOT NULL,
  channel     TEXT NOT NULL,
  enabled     BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_id, event, channel)
);

-- Eventos soportados:
-- 'order_status'   → cambio de estado de pedido
-- 'quote_ready'    → cotización lista para revisar
-- 'invoice_due'    → factura próxima a vencer
-- 'stock_restock'  → producto favorito volvió a stock

-- Canales soportados: 'email', 'whatsapp'

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notification_preferences'
      AND policyname = 'clients_own_preferences'
  ) THEN
    CREATE POLICY clients_own_preferences
      ON notification_preferences
      FOR ALL
      USING (profile_id = auth.uid())
      WITH CHECK (profile_id = auth.uid());
  END IF;
END;
$$;

-- Índice para lookups por cliente
CREATE INDEX IF NOT EXISTS idx_notification_preferences_profile_id
  ON notification_preferences (profile_id);
