-- 028_phase2_improvements.sql
-- 1. Create carts table for persistence
CREATE TABLE IF NOT EXISTS public.carts (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    items jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS on carts
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only see their own cart"
    ON public.carts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can only update their own cart"
    ON public.carts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own cart (update)"
    ON public.carts FOR UPDATE
    USING (auth.uid() = user_id);

-- 2. Add Full-Text Search to products
-- First, add the searchable column if it doesn't exist
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS fts tsvector;

-- Create function to update fts
CREATE OR REPLACE FUNCTION public.products_update_fts() RETURNS trigger AS $$
BEGIN
    NEW.fts := 
        setweight(to_tsvector('spanish', coalesce(NEW.name, '')), 'A') ||
        setweight(to_tsvector('spanish', coalesce(NEW.sku, '')), 'B') ||
        setweight(to_tsvector('spanish', coalesce(NEW.category, '')), 'C') ||
        setweight(to_tsvector('spanish', coalesce(NEW.description, '')), 'D');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updates
DROP TRIGGER IF EXISTS tr_products_update_fts ON public.products;
CREATE TRIGGER tr_products_update_fts
    BEFORE INSERT OR UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.products_update_fts();

-- Update existing data
UPDATE public.products SET fts = 
    setweight(to_tsvector('spanish', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(sku, '')), 'B') ||
    setweight(to_tsvector('spanish', coalesce(category, '')), 'C') ||
    setweight(to_tsvector('spanish', coalesce(description, '')), 'D');

-- Create the GIN index for search
CREATE INDEX IF NOT EXISTS products_fts_idx ON public.products USING GIN (fts);

-- 3. Update portal_products view to include fts
DROP VIEW IF EXISTS public.portal_products CASCADE;
CREATE OR REPLACE VIEW public.portal_products AS
SELECT 
    id, name, description, image, category, stock, sku, 
    stock_min, min_order_qty, supplier_id, supplier_name,
    tags, active, featured, specs, fts,
    get_portal_price(id::INTEGER, auth.uid()) as unit_price
FROM public.products
WHERE active = true;
