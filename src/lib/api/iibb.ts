/**
 * IIBB (Ingresos Brutos) Perceptions Module
 * Handles calculation and lookup for per-province taxes in Argentina.
 */

export type ProvinceCode = 
  | "CABA" | "BA" | "CD" | "SF" | "MN" | "ER" | "TU" | "SA" | "JU" | "CH" | "CO" | "SC" | "RN" | "NE" | "LP" | "LR" | "SJ" | "SL" | "CA" | "SE" | "FO" | "MI" | "TF";

export interface PerceptionRule {
  province: ProvinceCode;
  aliquot: number; // e.g. 1.5 | 3.0 | 5.0
  minAmount: number; // Only apply if the net amount exceeds this
}

/**
 * Standard IIBB Aliquots based on Province code (Fallback defaults).
 * In a real-world scenario, these should be periodically updated from ARBA/AGIP/etc APIs.
 */
const DEFAULT_ALIQUOTS: Record<ProvinceCode, number> = {
  "CABA": 3.0,  // AGIP
  "BA": 1.5,    // ARBA
  "CD": 2.5,    // Cordoba (DGR)
  "SF": 3.0,    // Santa Fe (API)
  "MN": 5.0,    // Misiones (DGR)
  "ER": 2.5,    // Entre Rios
  "TU": 3.0,    // Tucuman
  "SA": 3.0,    // Salta
  "JU": 3.0,    // Jujuy
  "CH": 2.5,    // Chaco
  "CO": 2.0,    // Corrientes
  "SC": 1.5,    // Santa Cruz
  "RN": 2.0,    // Rio Negro
  "NE": 2.0,    // Neuquen
  "LP": 2.0,    // La Pampa
  "LR": 2.0,    // La Rioja
  "SJ": 2.0,    // San Juan
  "SL": 2.0,    // San Luis
  "CA": 2.0,    // Catamarca
  "SE": 2.0,    // Santiago del Estero
  "FO": 2.0,    // Formosa
  "MI": 2.0,    // Misiones
  "TF": 1.2,    // Tierra del Fuego (Promocion Industrial)
};

/**
 * Calculates IIBB Perception based on the net amount and province.
 */
export function calculatePerception(netAmount: number, province: ProvinceCode, clientAliquot?: number): number {
  // Use the specific client aliquot if defined (Padron-based), otherwise fallback to province default.
  const aliquot = clientAliquot != null ? clientAliquot : (DEFAULT_ALIQUOTS[province] || 0);

  // Perceptions are applied on top of the net amount (before IVA)
  // Usually there's a minimum threshold (e.g., $1000) for it to apply.
  const minThreshold = 2500; // Mock threshold for demonstration
  if (netAmount < minThreshold || aliquot <= 0) return 0;

  return Number((netAmount * (aliquot / 100)).toFixed(2));
}

/**
 * Fetches the specific aliquot for a client from the ARBA/AGIP Padron APIs.
 */
export async function lookupClientAliquot(cuit: string, province: ProvinceCode): Promise<number> {
  console.log(`[IIBB] Looking up aliquot for ${cuit} in ${province}`);

  // Mocked API call for now (Calls ARBA/AGIP endpoints)
  // fetch(`/api/iibb/lookup?cuit=${cuit}&province=${province}`)
  const mockAliquots: Record<string, number> = {
    "30123456789": 1.5,
    "30987654321": 0.0, // Exento
  };

  return mockAliquots[cuit] ?? DEFAULT_ALIQUOTS[province] ?? 0;
}
