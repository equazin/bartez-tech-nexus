import type { Product } from "@/models/products";

/**
 * Devuelve el precio unitario (cost base) para un producto dado una cantidad.
 * Si el producto no tiene price_tiers definidos, retorna cost_price.
 */
export function getUnitPrice(product: Product, quantity: number): number {
  if (!product.price_tiers || product.price_tiers.length === 0) {
    return product.cost_price;
  }
  const tier = product.price_tiers.find(
    (t) => quantity >= t.min && (t.max === null || quantity <= t.max)
  );
  return tier ? tier.price : product.cost_price;
}

/**
 * Stock disponible real: total menos reservado en pedidos pendientes.
 */
export function getAvailableStock(product: Product): number {
  return Math.max(0, product.stock - (product.stock_reserved ?? 0));
}
