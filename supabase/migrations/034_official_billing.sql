-- Fase 4.4: Bridge ERP / AFIP (Facturación Electrónica Oficial)
-- Este script prepara la estructura para cumplir con normativas fiscales (Argentina/AFIP)
-- y permite la integración con sistemas contables externos.

-- 1. Campos de Facturación Oficial
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS cae TEXT,
ADD COLUMN IF NOT EXISTS cae_due_date DATE,
ADD COLUMN IF NOT EXISTS point_of_sale TEXT DEFAULT '0001',
ADD COLUMN IF NOT EXISTS invoice_type TEXT DEFAULT 'A', -- A, B, C, M
ADD COLUMN IF NOT EXISTS afip_qr TEXT,
ADD COLUMN IF NOT EXISTS erp_sync_status TEXT DEFAULT 'pending' CHECK (erp_sync_status IN ('pending', 'synced', 'error')),
ADD COLUMN IF NOT EXISTS erp_last_sync TIMESTAMPTZ;

-- 2. Función para Simular Emisión de Factura AFIP
-- En un entorno real, esto llamaría a un servicio externo (ERP/WebService AFIP)
CREATE OR REPLACE FUNCTION simulate_afip_cae()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo generamos CAE si la factura pasa a 'sent' o 'paid' y no tiene uno ya
    IF NEW.status IN ('sent', 'paid') AND (OLD.status IS NULL OR OLD.status != NEW.status) AND NEW.cae IS NULL THEN
        -- Generar un CAE aleatorio de 14 dígitos (típico de AFIP)
        NEW.cae := LPAD(FLOOR(RANDOM() * 100000000000000)::TEXT, 14, '0');
        -- Vencimiento típico del CAE: 10 días desde emisión
        NEW.cae_due_date := (CURRENT_DATE + INTERVAL '10 days')::DATE;
        NEW.erp_sync_status := 'synced';
        NEW.erp_last_sync := NOW();
        
        -- Datos fiscales por defecto si no están
        IF NEW.point_of_sale IS NULL THEN NEW.point_of_sale := '0001'; END IF;
        IF NEW.invoice_type IS NULL THEN NEW.invoice_type := 'A'; END IF;
        
        -- Link QR simulado (v1.afip.gob.ar...)
        NEW.afip_qr := 'https://www.afip.gob.ar/fe/qr/?p=' || encode(NEW.cae::bytea, 'base64');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger para Automatizar Facturación Electrónica
DROP TRIGGER IF EXISTS tr_invoice_afip_simulation ON invoices;
CREATE TRIGGER tr_invoice_afip_simulation
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION simulate_afip_cae();

-- Comentario para documentación
COMMENT ON COLUMN invoices.cae IS 'Código de Autorización Electrónico (AFIP)';
COMMENT ON COLUMN invoices.erp_sync_status IS 'Estado de sincronización con el sistema contable central';
