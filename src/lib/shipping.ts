/**
 * Shipping cost estimator for Andreani / OCA Argentina.
 *
 * Rates are based on published public tariffs (Andreani Envíos 2024).
 * For production use, replace with official API calls using credentials.
 *
 * Andreani API: https://developers.andreani.com
 * OCA API:      https://www.oca.com.ar/ServiciosWebEFE
 */

export type Carrier = "andreani" | "oca" | "expreso" | "comisionista" | "otro";

export interface ShippingItem {
  weight_kg: number;    // product weight in kg
  quantity: number;
}

export interface ShippingEstimate {
  carrier: Carrier;
  label: string;
  price_usd: number;
  price_ars: number;
  days_min: number;
  days_max: number;
  notes?: string;
}

/** Buenos Aires / GBA postal codes start with 1 */
function getZone(postalCode: string): 1 | 2 | 3 {
  const cp = postalCode.trim().replace(/\D/g, "");
  if (!cp) return 2;
  const n = parseInt(cp, 10);
  // GBA / CABA: 1000–1999 → Zone 1
  if (n >= 1000 && n <= 1999) return 1;
  // Patagonia: 8000–9999 → Zone 3
  if (n >= 8000) return 3;
  // Rest of country → Zone 2
  return 2;
}

/**
 * Weight in kg based on items (uses 0.5 kg per unit if product weight unknown).
 */
function totalWeight(items: ShippingItem[]): number {
  return items.reduce((sum, i) => sum + (i.weight_kg || 0.5) * i.quantity, 0);
}

/** Andreani tiered rates (ARS, ex-IVA) by zone + weight */
function andreaniRate(weightKg: number, zone: 1 | 2 | 3): number {
  // Base rate table (ARS 2024, Zone 1 GBA)
  const base =
    weightKg <= 0.5  ? 2_800 :
    weightKg <= 1    ? 3_400 :
    weightKg <= 2    ? 4_200 :
    weightKg <= 5    ? 5_600 :
    weightKg <= 10   ? 7_800 :
    weightKg <= 20   ? 11_500 :
    weightKg <= 30   ? 15_000 :
    18_000 + (weightKg - 30) * 400;

  const zoneMultiplier = zone === 1 ? 1.0 : zone === 2 ? 1.35 : 1.65;
  return Math.ceil(base * zoneMultiplier);
}

/** OCA is ~8% cheaper than Andreani for interior but slower */
function ocaRate(weightKg: number, zone: 1 | 2 | 3): number {
  return Math.ceil(andreaniRate(weightKg, zone) * 0.92);
}

/**
 * Estimate shipping costs for a given order.
 *
 * @param items       Array of { weight_kg, quantity } per product line
 * @param postalCode  Destination postal code (Argentina)
 * @param exchangeRate ARS per USD for price conversion
 * @param orderValueUSD Total order value in USD (for insurance threshold)
 */
export function estimateShipping(
  items: ShippingItem[],
  postalCode: string,
  exchangeRate: number,
  orderValueUSD: number = 0
): ShippingEstimate[] {
  const weight = totalWeight(items);
  const zone   = getZone(postalCode);

  const arsToUsd = (ars: number) =>
    exchangeRate > 0 ? Number((ars / exchangeRate).toFixed(2)) : 0;

  const andreaniARS = andreaniRate(weight, zone);
  const ocaARS      = ocaRate(weight, zone);

  // Free shipping threshold: orders over USD 500 get a discount note
  const freeNote = orderValueUSD >= 500
    ? "Negociable — pedido supera USD 500"
    : undefined;

  const estimates: ShippingEstimate[] = [
    {
      carrier:   "andreani",
      label:     "Andreani Envíos",
      price_ars:  andreaniARS,
      price_usd:  arsToUsd(andreaniARS),
      days_min:  zone === 1 ? 1 : zone === 2 ? 2 : 4,
      days_max:  zone === 1 ? 2 : zone === 2 ? 4 : 7,
      notes:     freeNote,
    },
    {
      carrier:   "oca",
      label:     "OCA e-pak",
      price_ars:  ocaARS,
      price_usd:  arsToUsd(ocaARS),
      days_min:  zone === 1 ? 1 : zone === 2 ? 3 : 5,
      days_max:  zone === 1 ? 3 : zone === 2 ? 5 : 9,
      notes:     freeNote,
    },
  ];

  return estimates;
}
