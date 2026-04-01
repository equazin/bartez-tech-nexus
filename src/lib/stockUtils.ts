import type { Product } from "@/models/products";

/** Extrae el stock de Lugano desde specs del producto */
export function getLugStock(p: Product): number {
  return p.specs?.lug_stock ? Number(p.specs.lug_stock) : 0;
}
