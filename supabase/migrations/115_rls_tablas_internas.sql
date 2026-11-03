-- =============================================================================
-- Teqo · RLS en las tablas que el baseline heredado de Bartez dejaba abiertas
-- Sin esto, cualquiera con la clave pública leía products entero por la API
-- (cost_price y supplier_multiplier incluidos), salteando la vista tienda_productos.
-- La tienda nunca lee estas tablas directo: usa la vista y las funciones
-- SECURITY DEFINER, que no dependen de estas políticas; la API de Vercel usa la
-- clave de servicio. Solo el panel (admin, vendedor, sales) las lee y escribe con
-- su sesión. Idempotente.
-- =============================================================================

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'products', 'content_generation_log', 'shipping_carriers', 'warehouses', 'product_stocks',
    'product_serials', 'client_scoring', 'e_checks', 'product_compatibility', 'client_custom_prices', 'shared_carts'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_panel', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated '
      'USING (lower(get_my_role()) IN (''admin'', ''vendedor'', ''sales'')) '
      'WITH CHECK (lower(get_my_role()) IN (''admin'', ''vendedor'', ''sales''))',
      t || '_panel', t
    );
  END LOOP;
END $$;
