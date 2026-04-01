import type { Product } from "@/models/products";

/**
 * Costo base del producto para una cantidad dada.
 * Respeta price_tiers de volumen si existen.
 * NO incluye el multiplicador de proveedor (usar getEffectiveCostPrice para eso).
 */
export function getUnitPrice(product: Product, quantity: number): number {
  if (!product.price_tiers || product.price_tiers.length === 0) {
    return product.cost_price;
  }
  // Sort tiers by min quantity descending to find the highest applicable tier
  const sortedTiers = [...product.price_tiers].sort((a, b) => b.min - a.min);
  const tier = sortedTiers.find((t) => quantity >= t.min);
  
  return tier ? tier.price : product.cost_price;
}

/**
 * Returns the next available price tier for a given quantity.
 * Used for "Buy X more to save Y" UI feedback.
 */
export function getNextTier(product: Product, currentQuantity: number) {
  if (!product.price_tiers || product.price_tiers.length === 0) return null;
  
  const nextTiers = product.price_tiers
    .filter((t) => t.min > currentQuantity)
    .sort((a, b) => a.min - b.min);
    
  return nextTiers.length > 0 ? nextTiers[0] : null;
}

/**
 * Costo efectivo = costo base × multiplicador de proveedor.
 * Esta es la base correcta para calcular el precio de venta al cliente:
 *   precio_venta = getEffectiveCostPrice(product, qty) × (1 + margin/100)
 *
 * El multiplicador cubre overhead de logística/importación del proveedor.
 * Si no hay multiplicador definido, retorna el costo base sin cambios.
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
