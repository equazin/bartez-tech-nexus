/**
 * Shipping cost estimator for Andreani / OCA Argentina.
 *
 * Rates are based on published public tariffs (Andreani Envios 2024).
 * For production use, replace with official API calls using credentials.
 *
 * Andreani API: https://developers.andreani.com
 * OCA API:      https://www.oca.com.ar/ServiciosWebEFE
 */

export type Carrier = "andreani" | "oca" | "expreso" | "comisionista" | "otro";

export interface ShippingItem {
  weight_kg: number;
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

export const FREE_SHIPPING_THRESHOLD_USD = 800;

export function isFreeShippingEligible(orderValueUSD: number): boolean {
  return Number.isFinite(orderValueUSD) && orderValueUSD >= FREE_SHIPPING_THRESHOLD_USD;
}

function getZone(postalCode: string): 1 | 2 | 3 {
  const cp = postalCode.trim().replace(/\D/g, "");
  if (!cp) return 2;
  const n = parseInt(cp, 10);
  if (n >= 1000 && n <= 1999) return 1;
  if (n >= 8000) return 3;
  return 2;
}

function totalWeight(items: ShippingItem[]): number {
  return items.reduce((sum, item) => sum + (item.weight_kg || 0.5) * item.quantity, 0);
}

function andreaniRate(weightKg: number, zone: 1 | 2 | 3): number {
  const base =
    weightKg <= 0.5 ? 2_800 :
    weightKg <= 1 ? 3_400 :
    weightKg <= 2 ? 4_200 :
    weightKg <= 5 ? 5_600 :
    weightKg <= 10 ? 7_800 :
    weightKg <= 20 ? 11_500 :
    weightKg <= 30 ? 15_000 :
    18_000 + (weightKg - 30) * 400;

  const zoneMultiplier = zone === 1 ? 1.0 : zone === 2 ? 1.35 : 1.65;
  return Math.ceil(base * zoneMultiplier);
}

function ocaRate(weightKg: number, zone: 1 | 2 | 3): number {
  return Math.ceil(andreaniRate(weightKg, zone) * 0.92);
}

export function estimateShipping(
  items: ShippingItem[],
  postalCode: string,
  exchangeRate: number,
  orderValueUSD: number = 0,
): ShippingEstimate[] {
  const weight = totalWeight(items);
  const zone = getZone(postalCode);
  const freeShippingApplied = isFreeShippingEligible(orderValueUSD);

  const arsToUsd = (ars: number) =>
    exchangeRate > 0 ? Number((ars / exchangeRate).toFixed(2)) : 0;

  const andreaniARS = andreaniRate(weight, zone);
  const ocaARS = ocaRate(weight, zone);
  const freeShippingNote = freeShippingApplied
    ? "Envio gratis por pedido superior a USD 800"
    : undefined;

  return [
    {
      carrier: "andreani",
      label: "Andreani Envios",
      price_ars: freeShippingApplied ? 0 : andreaniARS,
      price_usd: freeShippingApplied ? 0 : arsToUsd(andreaniARS),
      days_min: zone === 1 ? 1 : zone === 2 ? 2 : 4,
      days_max: zone === 1 ? 2 : zone === 2 ? 4 : 7,
      notes: freeShippingNote,
    },
    {
      carrier: "oca",
      label: "OCA e-pak",
      price_ars: freeShippingApplied ? 0 : ocaARS,
      price_usd: freeShippingApplied ? 0 : arsToUsd(ocaARS),
      days_min: zone === 1 ? 1 : zone === 2 ? 3 : 5,
      days_max: zone === 1 ? 3 : zone === 2 ? 5 : 9,
      notes: freeShippingNote,
    },
  ];
}
