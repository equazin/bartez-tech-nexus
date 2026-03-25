import { Product } from "@/models/product";
import { Supplier } from "@/models/supplier";
import { Client } from "@/models/client";

export function calculateFinalPrice(
  product: Product,
  supplier: Supplier,
  client: Client,
  productMarginOverride?: number
): number {
  const margin =
    typeof productMarginOverride === "number"
      ? productMarginOverride
      : client.default_margin;
  return (
    product.cost_price * supplier.price_multiplier * (1 + margin / 100)
  );
}
