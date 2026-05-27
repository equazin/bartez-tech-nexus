-- ── 103_client_export_templates.sql ──────────────────────────────────────────
-- Templates for "Descargar lista de precios" exports.
-- One row per template definition (global, reusable). Clients pick at export time.
-- Future iteration may attach a default template per client_id.
--
-- Each template defines:
--   columns: ordered list of { key, label } where `key` must match a column
--            returned by get_price_list_for_client().
--   filters: optional flags applied before export (eg. drop rows with stock = 0).
--   filename_pattern: text with placeholders {client_name} and {date}.
--
-- Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS client_export_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  description     TEXT,
  format          TEXT NOT NULL DEFAULT 'csv' CHECK (format IN ('csv', 'xlsx')),
  columns         JSONB NOT NULL,
  filters         JSONB NOT NULL DEFAULT '{}'::JSONB,
  filename_pattern TEXT NOT NULL DEFAULT 'lista_precios_{date}',
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_export_templates_active
  ON client_export_templates(active);

ALTER TABLE client_export_templates ENABLE ROW LEVEL SECURITY;

-- Authenticated clients can read active templates (to populate the selector).
DROP POLICY IF EXISTS "export_templates_read" ON client_export_templates;
CREATE POLICY "export_templates_read" ON client_export_templates
  FOR SELECT TO authenticated
  USING (active = TRUE);

-- Only admins can manage templates.
DROP POLICY IF EXISTS "export_templates_admin" ON client_export_templates;
CREATE POLICY "export_templates_admin" ON client_export_templates
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- updated_at trigger
DROP TRIGGER IF EXISTS client_export_templates_updated_at ON client_export_templates;
CREATE TRIGGER client_export_templates_updated_at
  BEFORE UPDATE ON client_export_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Seed: 3 starter templates ───────────────────────────────────────────────

INSERT INTO client_export_templates (slug, name, description, format, columns, filters, filename_pattern)
VALUES
  (
    'default',
    'Lista completa',
    'Todas las columnas (SKU, Nombre, Marca, Categoría, Precio, Stock, Mínimo).',
    'csv',
    '[
      {"key": "sku", "label": "SKU"},
      {"key": "name", "label": "Nombre"},
      {"key": "brand_name", "label": "Marca"},
      {"key": "category", "label": "Categoría"},
      {"key": "unit_price", "label": "Precio"},
      {"key": "stock", "label": "Stock"},
      {"key": "min_order_qty", "label": "Cant. mínima"}
    ]'::JSONB,
    '{}'::JSONB,
    'lista_precios_{date}'
  ),
  (
    'in_stock_only',
    'Solo con stock disponible',
    'Igual a la completa pero excluye productos con stock = 0.',
    'csv',
    '[
      {"key": "sku", "label": "SKU"},
      {"key": "name", "label": "Nombre"},
      {"key": "brand_name", "label": "Marca"},
      {"key": "category", "label": "Categoría"},
      {"key": "unit_price", "label": "Precio"},
      {"key": "stock", "label": "Stock"}
    ]'::JSONB,
    '{"drop_zero_stock": true}'::JSONB,
    'lista_precios_disponible_{date}'
  ),
  (
    'minimal',
    'Mínimo (SKU + Nombre + Precio)',
    'Tres columnas para clientes que solo quieren confirmar precios.',
    'csv',
    '[
      {"key": "sku", "label": "SKU"},
      {"key": "name", "label": "Producto"},
      {"key": "unit_price", "label": "Precio"}
    ]'::JSONB,
    '{}'::JSONB,
    'precios_{date}'
  )
ON CONFLICT (slug) DO NOTHING;
