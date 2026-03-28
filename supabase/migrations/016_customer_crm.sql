-- ── 016_customer_crm.sql ──────────────────────────────────────────────────────
-- Customer 360: extiende profiles + cuenta corriente + notas CRM
-- NO rompe columnas ni políticas existentes

-- ── 1. Extender profiles ──────────────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS estado       TEXT NOT NULL DEFAULT 'activo'
    CHECK (estado IN ('activo','inactivo','bloqueado')),
  ADD COLUMN IF NOT EXISTS vendedor_id  UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS precio_lista TEXT NOT NULL DEFAULT 'standard'
    CHECK (precio_lista IN ('standard','mayorista','distribuidor','especial')),
  ADD COLUMN IF NOT EXISTS razon_social TEXT,
  ADD COLUMN IF NOT EXISTS cuit         TEXT,
  ADD COLUMN IF NOT EXISTS direccion    TEXT,
  ADD COLUMN IF NOT EXISTS ciudad       TEXT,
  ADD COLUMN IF NOT EXISTS provincia    TEXT,
  ADD COLUMN IF NOT EXISTS notas_internas TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_estado   ON profiles(estado);
CREATE INDEX IF NOT EXISTS idx_profiles_vendedor ON profiles(vendedor_id);

-- ── 2. account_movements (cuenta corriente — ledger inmutable) ────────────────
-- monto > 0 → cargo (deuda sube)
-- monto < 0 → crédito / pago (deuda baja)

CREATE TABLE IF NOT EXISTS account_movements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo           TEXT NOT NULL
                   CHECK (tipo IN ('factura','pago','nota_credito','ajuste')),
  monto          NUMERIC(14,2) NOT NULL,
  descripcion    TEXT,
  reference_id   TEXT,
  reference_type TEXT,
  fecha          DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by     UUID REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_am_client ON account_movements(client_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_am_tipo   ON account_movements(tipo);
CREATE INDEX IF NOT EXISTS idx_am_ref    ON account_movements(reference_id);

ALTER TABLE account_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "am_select"
  ON account_movements FOR SELECT TO authenticated
  USING (
    client_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','vendedor'))
  );

CREATE POLICY "am_admin_write"
  ON account_movements FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','vendedor'))
  );

CREATE POLICY "am_admin_update"
  ON account_movements FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','vendedor'))
  );

-- ── 3. client_notes (notas CRM por cliente) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS client_notes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  tipo       TEXT NOT NULL DEFAULT 'nota'
               CHECK (tipo IN ('nota','llamada','reunion','alerta','seguimiento')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notes_client ON client_notes(client_id, created_at DESC);

ALTER TABLE client_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notes_admin_all"
  ON client_notes FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','vendedor'))
  );

-- ── 4. Vista: client_balance (saldo calculado en tiempo real) ─────────────────

CREATE OR REPLACE VIEW client_balance AS
SELECT
  p.id                                              AS client_id,
  p.company_name,
  p.contact_name,
  p.credit_limit,
  p.credit_used,
  p.estado,
  COALESCE(SUM(am.monto), 0)                        AS saldo_cuenta,
  p.credit_used + COALESCE(SUM(am.monto), 0)        AS deuda_total,
  p.credit_limit - p.credit_used
    - COALESCE(SUM(am.monto), 0)                    AS credito_disponible
FROM profiles p
LEFT JOIN account_movements am ON am.client_id = p.id
WHERE p.role IN ('cliente','client')
GROUP BY p.id, p.company_name, p.contact_name, p.credit_limit, p.credit_used, p.estado;

-- ── 5. RPC: registrar_pago ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION registrar_pago(
  p_client_id   UUID,
  p_monto       NUMERIC,
  p_descripcion TEXT DEFAULT NULL,
  p_reference_id TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_mov_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','vendedor')
  ) THEN
    RAISE EXCEPTION 'Sin permisos para registrar pagos';
  END IF;

  INSERT INTO account_movements
    (client_id, tipo, monto, descripcion, reference_id, reference_type, created_by)
  VALUES
    (p_client_id, 'pago', -ABS(p_monto), p_descripcion, p_reference_id, 'manual', auth.uid())
  RETURNING id INTO v_mov_id;

  -- Reducir credit_used proporcional al pago
  UPDATE profiles
  SET credit_used = GREATEST(0, credit_used - ABS(p_monto))
  WHERE id = p_client_id;

  RETURN v_mov_id;
END;
$$;

-- ── 6. RPC: puede_comprar ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION puede_comprar(p_client_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_profile RECORD;
  v_saldo   NUMERIC;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE id = p_client_id;
  SELECT COALESCE(SUM(monto), 0) INTO v_saldo
  FROM account_movements WHERE client_id = p_client_id;

  IF v_profile.estado = 'bloqueado' THEN
    RETURN jsonb_build_object('puede', false, 'razon', 'cuenta_bloqueada');
  END IF;
  IF v_profile.estado = 'inactivo' THEN
    RETURN jsonb_build_object('puede', false, 'razon', 'cuenta_inactiva');
  END IF;
  IF v_profile.credit_limit > 0
     AND (v_profile.credit_used + v_saldo) >= v_profile.credit_limit THEN
    RETURN jsonb_build_object(
      'puede',     false,
      'razon',     'credito_agotado',
      'limit',     v_profile.credit_limit,
      'usado',     v_profile.credit_used + v_saldo
    );
  END IF;

  RETURN jsonb_build_object(
    'puede',      true,
    'disponible', GREATEST(0, v_profile.credit_limit - v_profile.credit_used - v_saldo)
  );
END;
$$;
