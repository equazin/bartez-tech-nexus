ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS tax_status TEXT;

COMMENT ON COLUMN profiles.tax_status IS
'Condicion fiscal argentina del cliente (responsable_inscripto, monotributista, exento, consumidor_final, no_especificado).';

UPDATE profiles AS p
SET tax_status = req.tax_status
FROM (
  SELECT DISTINCT ON (COALESCE(NULLIF(email, ''), cuit))
    COALESCE(NULLIF(email, ''), cuit) AS lookup_key,
    tax_status
  FROM b2b_registration_requests
  WHERE status = 'approved'
    AND tax_status IS NOT NULL
  ORDER BY COALESCE(NULLIF(email, ''), cuit), updated_at DESC, created_at DESC
) AS req
WHERE p.tax_status IS NULL
  AND (
    LOWER(COALESCE(p.email, '')) = LOWER(req.lookup_key)
    OR COALESCE(p.cuit, '') = req.lookup_key
  );
