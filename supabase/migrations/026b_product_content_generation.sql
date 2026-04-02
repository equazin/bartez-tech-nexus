-- Content generation fields for automated descriptions/specs
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS description_short text,
  ADD COLUMN IF NOT EXISTS description_full text,
  ADD COLUMN IF NOT EXISTS content_review_required boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS content_generation_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id integer REFERENCES products(id) ON DELETE CASCADE,
  mode text NOT NULL,
  source text NOT NULL DEFAULT 'template',
  confidence numeric(4,2),
  action text NOT NULL, -- generated | review_required | skipped
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_generation_log_product_id ON content_generation_log(product_id);
CREATE INDEX IF NOT EXISTS content_generation_log_action ON content_generation_log(action);
