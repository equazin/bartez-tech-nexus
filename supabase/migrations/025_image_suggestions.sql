-- image_suggestions: candidate images pending admin review
CREATE TABLE IF NOT EXISTS image_suggestions (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id  integer     NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url   text        NOT NULL,
  score       numeric(4,2) NOT NULL,
  source      text        NOT NULL, -- 'elit', 'bing', 'manual'
  status      text        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS image_suggestions_product_id ON image_suggestions(product_id);
CREATE INDEX IF NOT EXISTS image_suggestions_status     ON image_suggestions(status);

-- image_processing_log: audit trail for every processing action
CREATE TABLE IF NOT EXISTS image_processing_log (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id  integer     REFERENCES products(id) ON DELETE CASCADE,
  query       text,
  source      text,
  image_url   text,
  score       numeric(4,2),
  action      text        NOT NULL, -- 'auto_assigned','suggested','discarded','approved','rejected'
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS image_processing_log_product_id ON image_processing_log(product_id);
CREATE INDEX IF NOT EXISTS image_processing_log_action     ON image_processing_log(action);
