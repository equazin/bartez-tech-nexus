-- ── 030_credit_intelligence.sql ──────────────────────────────────────────────
-- Professional Credit Management: Grace periods, status, and automated blocking

-- 1. Extend profiles with more credit control
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS grace_period_days INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS credit_status     TEXT DEFAULT 'active'
    CHECK (credit_status IN ('active', 'suspended', 'over_limit', 'manual_block'));

-- 2. Function to check for overdue debt (mora)
-- Returns true if the client has any invoice that is:
-- - status IN ('sent', 'overdue')
-- - due_date + grace_period_days < current_date
CREATE OR REPLACE FUNCTION public.is_client_in_mora(p_client_id UUID)
RETURNS BOOLEAN 
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
    v_grace_days INTEGER;
    v_has_overdue BOOLEAN;
BEGIN
    SELECT COALESCE(grace_period_days, 5) INTO v_grace_days 
    FROM profiles WHERE id = p_client_id;

    SELECT EXISTS (
        SELECT 1 FROM invoices
        WHERE client_id = p_client_id
          AND status IN ('sent', 'overdue')
          AND (due_date + (v_grace_days || ' days')::INTERVAL) < now()
    ) INTO v_has_overdue;

    RETURN v_has_overdue;
END;
$$;

-- 3. Upgrade puede_comprar RPC to include overdue check
CREATE OR REPLACE FUNCTION public.puede_comprar(p_client_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_profile RECORD;
  v_saldo   NUMERIC;
  v_mora    BOOLEAN;
BEGIN
  -- Basic profile data
  SELECT * INTO v_profile FROM profiles WHERE id = p_client_id;
  
  -- Calculate current debt from account movements
  SELECT COALESCE(SUM(monto), 0) INTO v_saldo
  FROM account_movements WHERE client_id = p_client_id;

  -- Check for overdue invoices (Mora)
  v_mora := is_client_in_mora(p_client_id);

  -- ── REJECTION LOGIC ────────────────────────────────────────────────────────
  
  -- 1. Manual/Administrative block
  IF v_profile.estado = 'bloqueado' OR v_profile.credit_status = 'manual_block' THEN
    RETURN jsonb_build_object('puede', false, 'razon', 'cuenta_bloqueada', 'mensaje', 'Su cuenta se encuentra bloqueada administrativamente.');
  END IF;

  -- 2. Inactive account
  IF v_profile.estado = 'inactivo' THEN
    RETURN jsonb_build_object('puede', false, 'razon', 'cuenta_inactiva', 'mensaje', 'Su cuenta se encuentra inactiva.');
  END IF;

  -- 3. Overdue debt (Mora)
  IF v_mora THEN
    RETURN jsonb_build_object(
        'puede', false, 
        'razon', 'mora_vencida', 
        'mensaje', 'Posee facturas vencidas fuera del periodo de gracia. Por favor regularice su deuda.'
    );
  END IF;

  -- 4. Credit Limit exhaustion
  -- If credit_limit is 0, we assume it's cash-only unless specified otherwise,
  -- but checking if (used + current balance) >= limit
  IF v_profile.credit_limit > 0
     AND (v_profile.credit_used + v_saldo) >= v_profile.credit_limit THEN
    RETURN jsonb_build_object(
      'puede',     false,
      'razon',     'credito_agotado',
      'mensaje',   'Ha excedido su límite de crédito disponible.',
      'limit',     v_profile.credit_limit,
      'usado',     v_profile.credit_used + v_saldo
    );
  END IF;

  -- ── SUCCESS ────────────────────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'puede',      true,
    'disponible', GREATEST(0, v_profile.credit_limit - v_profile.credit_used - v_saldo),
    'mensaje',    'Crédito disponible para operar.'
  );
END;
$$;

-- 4. Create credit_activity_log for auditing limit changes
CREATE TABLE IF NOT EXISTS credit_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    changed_by    UUID REFERENCES auth.users(id),
    old_limit     NUMERIC(14,2),
    new_limit     NUMERIC(14,2),
    reason        TEXT,
    created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE credit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "credit_logs_admin" ON credit_logs FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'vendedor'))
);
CREATE POLICY "credit_logs_client" ON credit_logs FOR SELECT USING (client_id = auth.uid());
