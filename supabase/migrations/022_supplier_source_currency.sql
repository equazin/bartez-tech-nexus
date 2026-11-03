-- 021_supplier_source_currency.sql
-- Conserva la moneda original de cada proveedor y la cotizacion usada
-- para comparar costos entre APIs distintas sin romper el catalogo base.

ALTER TABLE product_suppliers
  ADD COLUMN IF NOT EXISTS source_cost_price NUMERIC(14,4);

ALTER TABLE product_suppliers
  ADD COLUMN IF NOT EXISTS source_currency TEXT
  CHECK (source_currency IN ('USD', 'ARS'));

ALTER TABLE product_suppliers
  ADD COLUMN IF NOT EXISTS source_exchange_rate NUMERIC(14,4);

UPDATE product_suppliers
SET
  source_cost_price = COALESCE(source_cost_price, cost_price),
  source_currency = COALESCE(source_currency, 'USD')
WHERE source_cost_price IS NULL
   OR source_currency IS NULL;
