-- Cleanup duplicates before adding constraint
DELETE FROM image_suggestions
WHERE id IN (
    SELECT id
    FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY product_id, image_url ORDER BY created_at DESC) as row_num
        FROM image_suggestions
    ) t
    WHERE t.row_num > 1
);

-- Add unique constraint to image_suggestions to support upsert and avoid duplicates
ALTER TABLE image_suggestions ADD CONSTRAINT image_suggestions_product_id_image_url_key UNIQUE (product_id, image_url);
