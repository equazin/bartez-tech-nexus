-- =============================================================================
-- Teqo · Sin INVID
--
-- Decisión de Nico del 3/11/2026: Teqo trabaja con ELIT (y AIR) y deja de lado a INVID.
-- El código ya no tiene su proxy, su sincronización ni su costo fijo; acá se borra el
-- proveedor si no quedó nada vinculado. Si algo lo usa, queda inactivo en lugar de borrarse.
-- Idempotente.
-- =============================================================================

DO $$
DECLARE
  v_id uuid;
  v_en_uso boolean;
BEGIN
  SELECT id INTO v_id FROM suppliers WHERE upper(trim(name)) = 'INVID' LIMIT 1;
  IF v_id IS NULL THEN
    RETURN;
  END IF;

  v_en_uso :=
       EXISTS (SELECT 1 FROM product_suppliers WHERE supplier_id = v_id)
    OR EXISTS (SELECT 1 FROM category_mapping WHERE supplier_id = v_id)
    OR EXISTS (SELECT 1 FROM products WHERE primary_supplier_id = v_id);

  IF v_en_uso THEN
    UPDATE suppliers SET active = false WHERE id = v_id;
  ELSE
    DELETE FROM suppliers WHERE id = v_id;
  END IF;
END $$;
