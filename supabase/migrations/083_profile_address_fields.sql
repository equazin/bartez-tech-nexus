-- Agrega campos de dirección de facturación y envío al perfil del cliente
-- Idempotente: usa IF NOT EXISTS
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS billing_address JSONB;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS shipping_addresses JSONB DEFAULT '[]';

COMMENT ON COLUMN profiles.billing_address IS
'Dirección de facturación del cliente: {calle, numero, ciudad, provincia, codigo_postal}';

COMMENT ON COLUMN profiles.shipping_addresses IS
'Lista de direcciones de envío del cliente: [{label, calle, numero, ciudad, provincia, codigo_postal, is_default}]';
