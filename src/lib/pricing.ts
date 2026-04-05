import { Product } from "@/models/products";

/**
 * Costo base del producto para una cantidad dada.
 * Respeta price_tiers de volumen si existen.
 * NO incluye el multiplicador de proveedor (usar getEffectiveCostPrice para eso).
 */
export function getUnitPrice(product: Product, quantity: number): number {
  const baseCost = product.cost_price ?? 0;

  if (!product.price_tiers || product.price_tiers.length === 0) {
    return baseCost;
  }

  const sortedTiers = [...product.price_tiers].sort((a, b) => b.min - a.min);
  const tier = sortedTiers.find((t) => quantity >= t.min);

  return tier ? tier.price : baseCost;
}

/**
 * Returns the next available price tier for a given quantity.
 * Used for "Buy X more to save Y" UI feedback.
 */
export function getNextTier(product: Product, currentQuantity: number) {
  if (!product.price_tiers || product.price_tiers.length === 0) return null;

  const nextTiers = product.price_tiers.filter((t) => t.min > currentQuantity).sort((a, b) => a.min - b.min);

  return nextTiers.length > 0 ? nextTiers[0] : null;
}

/**
 * Costo efectivo = costo base x multiplicador de proveedor.
 */
export function getEffectiveCostPrice(product: Product, quantity: number): number {
  const base = getUnitPrice(product, quantity);
  const multiplier = product.supplier_multiplier ?? 1;
  return base * multiplier;
}

/**
 * Stock disponible real: total menos reservado en pedidos pendientes.
 */
export function getAvailableStock(product: Product): number {
  return Math.max(0, product.stock - (product.stock_reserved ?? 0));
}
