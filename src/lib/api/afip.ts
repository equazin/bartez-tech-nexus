/**
 * AFIP Integration Module (Mocked/Structure)
 * Handles WSFE (Web Services de Facturacion Electronica) logic.
 *
 * In a real production environment, these calls should be proxied
 * via a secure backend (Vercel Functions) to protect AFIP certificates.
 */

export interface AfipInvoiceData {
  pointOfSale: number;
  type: 1 | 6 | 11; // 1: A, 6: B, 11: C
  cuit: string; // Recipient CUIT
  total: number;
  netAmount: number;
  ivaAmount: number;
  perceptionsAmount: number;
  concept: number; // 1: Productos, 2: Servicios, 3: Productos y Servicios
}

export interface AfipResponse {
  cae?: string;
  caeDueDate?: string;
  qrCode?: string;
  status: "approved" | "rejected" | "error";
  msg?: string;
}

export type CuitEntityType = "empresa" | "persona_fisica";
export type TaxStatus = "responsable_inscripto" | "monotributista" | "exento" | "consumidor_final";

/** Returns entity type from the first 2 digits of a CUIT/CUIL */
export function detectCuitEntityType(cuit: string): CuitEntityType {
  const prefix = parseInt(cuit.slice(0, 2), 10);
  return [30, 33, 34].includes(prefix) ? "empresa" : "persona_fisica";
}

/** Validates CUIT/CUIL checksum (mod 11). Returns true if valid. */
export function isCuitChecksumValid(cuit: string): boolean {
  const digits = cuit.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((acc, w, i) => acc + w * Number(digits[i]), 0);
  const remainder = sum % 11;
  if (remainder === 1) return false;
  const expected = remainder === 0 ? 0 : 11 - remainder;
  return expected === Number(digits[10]);
}

/** Formats a raw digit string as XX-XXXXXXXX-X */
export function formatCuit(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 10) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
}

export type ValidateCuitResult = {
  companyName: string;
  taxStatus: TaxStatus;
  entityType: CuitEntityType;
  active: boolean;
};

/** Validate a CUIT/CUIL via the /api/afip-cuit proxy (AFIP Padron). */
export async function validateCuit(cuit: string): Promise<ValidateCuitResult> {
  const digits = cuit.replace(/\D/g, "");

  try {
    const res = await fetch(`/api/afip-cuit?cuit=${digits}`);
    const text = await res.text();

    // If response is not JSON (e.g. raw TS source in dev without vercel dev), fall through to mock
    let json: { ok: boolean; data?: ValidateCuitResult; error?: string };
    try {
      json = JSON.parse(text) as typeof json;
    } catch {
      throw new Error("__use_mock__");
    }

    if (!json.ok || !json.data) {
      throw new Error(json.error ?? "No se pudo validar el CUIT.");
    }

    return json.data;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    // In local dev without `vercel dev`, fall back to a mock based on prefix
    if (msg === "__use_mock__" || msg.includes("Failed to fetch")) {
      const entityType = detectCuitEntityType(digits);
      return {
        companyName: entityType === "empresa" ? "Empresa de Prueba S.A." : "Juan Carlos Pérez",
        taxStatus: entityType === "empresa" ? "responsable_inscripto" : "monotributista",
        entityType,
        active: true,
      };
    }
    throw err;
  }
}

/**
 * Generates an Electronic Invoice via AFIP WSFE.
 * Returns CAE and QR data.
 */
export async function generateElectronicInvoice(data: AfipInvoiceData): Promise<AfipResponse> {
  console.log(`[AFIP] Generating Invoice Type ${data.type} for CUIT ${data.cuit} Total: $${data.total}`);

  // Mock delay
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Simulating an approval
  const cae = Math.floor(Math.random() * 100000000000000).toString().padStart(14, '0');
  const now = new Date();
  const dueDate = new Date(now.setDate(now.getDate() + 10)).toISOString().slice(0, 10);

  // Generate AFIP QR content (Simplified version for Mock)
  const qrData = btoa(JSON.stringify({
    ver: 1,
    fecha: now.toISOString().slice(0, 10),
    cuit: 30123456789,
    tipoComprobante: data.type,
    numeroComprobante: 123,
    importe: data.total,
    moneda: "PES",
    ctz: 1,
  }));

  return {
    cae,
    caeDueDate: dueDate,
    qrCode: `https://www.afip.gob.ar/fe/qr/?p=${qrData}`,
    status: "approved",
  };
}
