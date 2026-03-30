-- Ensure POS category exists for B2B portal context and admin filters
INSERT INTO categories (name, slug, active, parent_id)
VALUES ('Punto de Venta', 'pos', true, NULL)
ON CONFLICT (slug)
DO UPDATE SET
  name = EXCLUDED.name,
  active = true,
  parent_id = NULL;
