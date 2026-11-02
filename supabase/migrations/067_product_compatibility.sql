-- ── 064_product_compatibility.sql ───────────────────────────────────────
-- AI Compatibility Mapping & Smart Relations
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Compatibility Table
CREATE TABLE IF NOT EXISTS product_compatibility (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id       INTEGER REFERENCES products(id) ON DELETE CASCADE,
  target_id       INTEGER REFERENCES products(id) ON DELETE CASCADE,
  score           NUMERIC DEFAULT 0.5, -- 0.0 to 1.0 confidence
  relation_type   TEXT, -- 'required', 'recommended', 'upgrade'
  ai_rationale    TEXT, -- "Suggesting PSU 750W because GPU consumes 300W+"
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(source_id, target_id)
);

-- 2. View for easy fetching of complements
CREATE OR REPLACE VIEW product_complements_view AS
SELECT 
  c.source_id,
  c.score,
  c.relation_type,
  c.ai_rationale,
  p.*
FROM product_compatibility c
JOIN products p ON p.id = c.target_id
WHERE p.active = true;

-- 3. Mock AI Analysis Function (Keyword based for now, ready for LLM integration)
-- This marks compatibility based on technical specs
CREATE OR REPLACE FUNCTION analyze_compatibility_v1(p_source_id INTEGER)
RETURNS VOID AS $$
DECLARE
  v_source_name TEXT;
  v_source_specs JSONB;
BEGIN
  SELECT name, specs INTO v_source_name, v_source_specs FROM products WHERE id = p_source_id;

  -- Logic for GPUs
  IF v_source_name ILIKE '%RTX 3080%' OR v_source_name ILIKE '%RTX 3090%' OR v_source_name ILIKE '%RTX 40%' THEN
     -- Suggest High Wattage PSUs
     INSERT INTO product_compatibility (source_id, target_id, score, relation_type, ai_rationale)
     SELECT p_source_id, id, 0.95, 'required', 'Requiere potencia de fuente certificada 750W+'
     FROM products 
     WHERE (name ILIKE '%Fuente%' AND name ILIKE '%750W%') OR (name ILIKE '%850W%')
     ON CONFLICT DO NOTHING;
  END IF;

  -- Logic for Motherboards/CPUs (Socket matching)
  IF v_source_specs->>'socket' IS NOT NULL THEN
     INSERT INTO product_compatibility (source_id, target_id, score, relation_type, ai_rationale)
     SELECT p_source_id, id, 0.99, 'required', 'Socket compatible: ' || (v_source_specs->>'socket')
     FROM products 
     WHERE specs->>'socket' = v_source_specs->>'socket' AND id != p_source_id
     ON CONFLICT DO NOTHING;
  END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
