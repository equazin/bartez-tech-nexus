-- Merchandising fields for public POS combos.

ALTER TABLE public_pos_kits
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS badge TEXT,
  ADD COLUMN IF NOT EXISTS cta_label TEXT NOT NULL DEFAULT 'Comprar',
  ADD COLUMN IF NOT EXISTS whatsapp_message TEXT;

UPDATE public_pos_kits
SET
  badge = COALESCE(badge, CASE id
    WHEN 'comercio-esencial' THEN 'Ideal kioscos'
    WHEN 'etiquetado-stock' THEN 'Inventario'
    WHEN 'caja-pro' THEN 'Alto movimiento'
    ELSE NULL
  END),
  cta_label = COALESCE(NULLIF(cta_label, ''), 'Comprar')
WHERE id IN ('comercio-esencial', 'etiquetado-stock', 'caja-pro');
