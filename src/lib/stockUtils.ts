import type { Product } from "@/models/products";

/** Extrae el stock de Lugano desde specs del producto */
export function getLugStock(p: Product): number {
  return p.specs?.lug_stock ? Number(p.specs.lug_stock) : 0;
}

function readNumericSpec(p: Product, key: string): number {
  const raw = p.specs?.[key];
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getAirIncomingStock(p: Product): number {
  return Math.max(0, Math.round(readNumericSpec(p, "air_incoming_stock")));
}

export function getPreferredLeadTimeDays(p: Product): number {
  const preferredLeadTime = readNumericSpec(p, "preferred_supplier_lead_time_days");
  if (preferredLeadTime > 0) {
    return Math.max(0, Math.round(preferredLeadTime));
  }

  const incomingLeadTime = readNumericSpec(p, "air_incoming_lead_days");
  if (incomingLeadTime > 0) {
    return Math.max(0, Math.round(incomingLeadTime));
  }

  const lugStock = getLugStock(p);
  if (lugStock > 0 && (p.stock ?? 0) <= 0) {
    return 3;
  }

  return 0;
}

export function hasIncomingStock(p: Product): boolean {
  return getAirIncomingStock(p) > 0 && Math.max(0, (p.stock ?? 0) - (p.stock_reserved ?? 0)) <= 0;
}
