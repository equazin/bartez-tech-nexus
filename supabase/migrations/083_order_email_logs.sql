-- Migration: Create order email logs table
CREATE TABLE IF NOT EXISTS public.order_email_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id BIGINT REFERENCES public.orders(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    tipo TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.order_email_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view logs
CREATE POLICY "Admins and users can view order email logs" 
    ON public.order_email_logs FOR SELECT 
    USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert logs
CREATE POLICY "Authenticated users can insert order email logs" 
    ON public.order_email_logs FOR INSERT 
    WITH CHECK (auth.role() = 'authenticated');
