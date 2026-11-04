-- Teqo · Mercado Pago en 1 pago y en 3 cuotas sin interés, con margen propio cada uno
--
-- Decisión de Nico del 4/11/2026: un solo precio de Mercado Pago (36 %) hacía pagar de más al que paga en 1 pago o
-- con débito. Cobrar en 1 pago le cuesta a Teqo 6,42 % + IVA; ofrecer 3 cuotas sin interés suma 10,49 % + IVA.
--   - mercadopago          → 1 pago (débito, crédito en 1 pago o dinero en cuenta): margen 17 %.
--   - mercadopago_cuotas   → 3 cuotas sin interés con tarjeta de crédito: margen 36 %.
-- Los dos cobran por Mercado Pago (pagos.proveedor = 'mercadopago'); la preferencia limita las cuotas de cada uno.

ALTER TABLE medios_de_pago DROP CONSTRAINT IF EXISTS medios_de_pago_id_check;
ALTER TABLE medios_de_pago ADD CONSTRAINT medios_de_pago_id_check CHECK (id IN ('mercadopago', 'mercadopago_cuotas', 'transferencia'));

UPDATE medios_de_pago
SET margen_porcentaje = 17,
    detalle = 'Débito, crédito en 1 pago o dinero en cuenta. Pagás en Mercado Pago y volvés a la tienda.',
    actualizado_en = now()
WHERE id = 'mercadopago';

INSERT INTO medios_de_pago (id, nombre, detalle, activo, orden, margen_porcentaje)
VALUES (
  'mercadopago_cuotas',
  '3 cuotas sin interés',
  'Con tarjeta de crédito, por Mercado Pago: el total en 3 cuotas sin interés. Pagás en Mercado Pago y volvés a la tienda.',
  true,
  3,
  36
)
ON CONFLICT (id) DO NOTHING;

-- Un servicio sin precio propio en cuotas toma el de Mercado Pago: así no desaparece de la tienda al sumar el medio.
CREATE OR REPLACE FUNCTION servicio_precio_con_medio(p_precios jsonb, p_medio text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(
    CASE WHEN jsonb_typeof(p_precios->p_medio) = 'number' AND (p_precios->>p_medio)::numeric > 0
         THEN (p_precios->>p_medio)::numeric END,
    CASE WHEN p_medio = 'mercadopago_cuotas' AND jsonb_typeof(p_precios->'mercadopago') = 'number' AND (p_precios->>'mercadopago')::numeric > 0
         THEN (p_precios->>'mercadopago')::numeric END
  );
$$;
