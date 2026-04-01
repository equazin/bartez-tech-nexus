-- ── 034_support_tickets.sql ──────────────────────────────────────────────
-- Phase 5.1: Professional Support & RMA (Post-Sales)

-- 1. Create Support Tickets table
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id     UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    order_id      BIGINT REFERENCES orders(id) ON DELETE SET NULL,
    product_id    INTEGER REFERENCES products(id) ON DELETE SET NULL,
    
    subject       TEXT NOT NULL,
    description   TEXT NOT NULL,
    status        TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_analysis', 'tech_assigned', 'resolved', 'closed')),
    priority      TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    
    internal_notes TEXT, -- Visible only to Admins/Sellers
    
    created_at    TIMESTAMPTZ DEFAULT now(),
    updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Index for searching/filtering
CREATE INDEX IF NOT EXISTS idx_tickets_client ON support_tickets(client_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status);

-- 2. Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Clients can only see and create their own tickets
CREATE POLICY "Clients can view their own tickets"
    ON public.support_tickets FOR SELECT
    USING (auth.uid() = client_id);

CREATE POLICY "Clients can create their own tickets"
    ON public.support_tickets FOR INSERT
    WITH CHECK (auth.uid() = client_id);

-- Admins and Sellers can see and manage all tickets
CREATE POLICY "Admins can manage all tickets"
    ON public.support_tickets FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'vendedor')
        )
    );

-- 3. Trigger for updated_at
CREATE OR REPLACE FUNCTION update_support_ticket_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_update_support_ticket_timestamp ON support_tickets;
CREATE TRIGGER tr_update_support_ticket_timestamp
    BEFORE UPDATE ON support_tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_support_ticket_timestamp();

-- 4. Initial categories or predefined subjects (optional, but good for UX)
-- Not needed in table, but we will define them in the UI.

-- Comentario para documentación
COMMENT ON TABLE support_tickets IS 'Sistema de tickets de soporte y reclamos (RMA) para clientes B2B';
