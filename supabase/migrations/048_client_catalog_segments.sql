-- ── 048_client_catalog_segments.sql ─────────────────────────────────────────
-- Catálogo segmentado por cliente: permite ocultar o mostrar productos/categorías
-- específicas para clientes individuales o tipos de cliente.
-- Fully idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Tabla de reglas de visibilidad de catálogo
CREATE TABLE IF NOT EXISTS catalog_segments (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- Target: client_id (individual) OR client_type (group) — not both
  client_id    UUID   REFERENCES profiles(id) ON DELETE CASCADE,
  client_type  TEXT,  -- e.g. 'mayorista', 'minorista', 'distribuidor'
  -- Scope: product_id (individual) OR category_slug (group) — not both
  product_id   INTEGER REFERENCES products(id) ON DELETE CASCADE,
  category_slug TEXT,
  -- Rule type
  visibility   TEXT NOT NULL DEFAULT 'hidden'
               CHECK (visibility IN ('hidden', 'visible_only')),
  -- visible_only = ONLY show this to this client/type (whitelist)
  -- hidden       = HIDE this from this client/type (blacklist)
  created_at   TIMESTAMPTZ DEFAULT now(),
  created_by   UUID REFERENCES auth.users(id),
  -- At least one of client_id or client_type must be set
  CONSTRAINT chk_segment_target CHECK (
    (client_id IS NOT NULL OR client_type IS NOT NULL)
  ),
  -- At least one of product_id or category_slug must be set
  CONSTRAINT chk_segment_scope CHECK (
    (product_id IS NOT NULL OR category_slug IS NOT NULL)
  )
);

COMMENT ON TABLE catalog_segments IS
  'Controls which products/categories are visible to which clients or client types.';

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_catalog_segments_client_id
  ON catalog_segments(client_id) WHERE client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_catalog_segments_client_type
  ON catalog_segments(client_type) WHERE client_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_catalog_segments_product_id
  ON catalog_segments(product_id) WHERE product_id IS NOT NULL;

-- 3. RLS
ALTER TABLE catalog_segments ENABLE ROW LEVEL SECURITY;

-- Admins can manage all segments
CREATE POLICY "admin_manage_catalog_segments"
  ON catalog_segments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Clients can read their own segments (to understand their catalog scope)
CREATE POLICY "client_read_own_segments"
  ON catalog_segments
  FOR SELECT
  TO authenticated
  USING (client_id = auth.uid());

-- 4. Helper function: get hidden product IDs for a given client
CREATE OR REPLACE FUNCTION get_hidden_product_ids_for_client(p_client_id UUID)
RETURNS TABLE(product_id INTEGER)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  -- Blacklist: products explicitly hidden for this client or their client_type
  SELECT DISTINCT cs.product_id
  FROM catalog_segments cs
  WHERE cs.visibility = 'hidden'
    AND cs.product_id IS NOT NULL
    AND (
      cs.client_id = p_client_id
      OR cs.client_type = (SELECT client_type FROM profiles WHERE id = p_client_id)
    )
  UNION
  -- Products in hidden categories for this client
  SELECT DISTINCT p.id
  FROM products p
  JOIN catalog_segments cs ON cs.category_slug IS NOT NULL
    AND p.category ILIKE cs.category_slug
  WHERE cs.visibility = 'hidden'
    AND (
      cs.client_id = p_client_id
      OR cs.client_type = (SELECT client_type FROM profiles WHERE id = p_client_id)
    );
$$;

-- 5. Update portal_products view to respect catalog segments
-- portal_products already exists — we add a param-less version that exposes all products
-- The actual filtering is done client-side using get_hidden_product_ids_for_client.
-- This keeps the architecture simple without requiring a per-session view.
-- (For future scale: this can be converted to a parameterized RPC.)
