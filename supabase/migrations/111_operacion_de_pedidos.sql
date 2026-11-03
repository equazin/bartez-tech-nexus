-- =============================================================================
-- Teqo · Fase 8 · Pedidos, operación y emails
-- Estados de la tienda: pendiente_pago → pagado → preparando → enviado → entregado,
-- más cancelado, reintegrado y vencido. Al enviar se descuenta el stock reservado.
-- Cada aviso al comprador queda anotado: el mismo aviso no se manda dos veces.
-- =============================================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS preparando_en timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS enviado_en    timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS entregado_en  timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelado_en  timestamptz;

CREATE TABLE IF NOT EXISTS avisos_al_comprador (
  id         bigserial PRIMARY KEY,
  order_id   bigint NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  tipo       text NOT NULL,
  email      text NOT NULL,
  enviado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, tipo)
);

ALTER TABLE avisos_al_comprador ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS avisos_al_comprador_panel ON avisos_al_comprador;
CREATE POLICY avisos_al_comprador_panel ON avisos_al_comprador FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND lower(p.role) IN ('admin', 'vendedor', 'sales')));

-- ── Al despachar: lo reservado sale del stock ───────────────────────────────
CREATE OR REPLACE FUNCTION tienda_descontar_stock(p_order_id bigint)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE products p
  SET stock          = greatest(p.stock - i.cantidad, 0),
      stock_reserved = greatest(coalesce(p.stock_reserved, 0) - i.cantidad, 0)
  FROM (SELECT product_id, sum(quantity)::integer AS cantidad FROM order_items WHERE order_id = p_order_id GROUP BY product_id) i
  WHERE p.id = i.product_id;
$$;

REVOKE ALL ON FUNCTION tienda_descontar_stock(bigint) FROM public, anon, authenticated;
