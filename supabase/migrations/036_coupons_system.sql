-- --- PHASE 5.4: MARKETING & FIDELIZACIÓN (CUPONES) ---
-- Este esquema implementa un sistema robusto de cupones de descuento.

-- 1. Tabla de cupones
CREATE TABLE IF NOT EXISTS coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,                       -- Ej: "BIENVENIDO10"
    discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value NUMERIC NOT NULL,
    min_purchase NUMERIC DEFAULT 0,                  -- Compra mínima requerida
    max_discount NUMERIC,                             -- Descuento máximo (para porcentajes)
    max_uses INTEGER,                                 -- Límite total de usos
    used_count INTEGER DEFAULT 0,                     -- Contador actual
    expires_at TIMESTAMPTZ,                           -- Fecha de expiración
    client_id UUID REFERENCES public.profiles(id),    -- Opcional: Cupón exclusivo para un cliente
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabla de uso de cupones (Log)
CREATE TABLE IF NOT EXISTS coupon_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id UUID REFERENCES coupons(id) ON DELETE CASCADE,
    order_id BIGINT REFERENCES orders(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    discount_amount NUMERIC NOT NULL,
    used_at TIMESTAMPTZ DEFAULT now()
);

-- 3. RLS Admins (Control total)
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_usage ENABLE ROW LEVEL SECURITY;

-- Política Admins: Pueden hacer de todo
CREATE POLICY "Admins full access coupons" ON coupons
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins full access usage" ON coupon_usage
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Política Clientes: Pueden LEER solo si el cupón está activo y no expiró
-- Nota: En la práctica, el cliente "validador" hará un match por código.
CREATE POLICY "Clients read active coupons" ON coupons
    FOR SELECT USING (
        is_active = true 
        AND (expires_at IS NULL OR expires_at > now()) 
        AND (client_id IS NULL OR client_id = auth.uid())
    );

-- Habilitar réplicas para realtime
ALTER PUBLICATION supabase_realtime ADD TABLE coupons;

COMMENT ON TABLE coupons IS 'Tabla de cupones de descuento para marketing B2B';
