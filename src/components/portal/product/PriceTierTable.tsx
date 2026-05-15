import { TierTable } from "@/components/ui/tier-table";
import type { PriceTier } from "@/components/ui/tier-table";
import type { Product } from "@/models/products";

interface Props {
  product: Product;
  currentQty?: number;
}

export function PriceTierTable({ product, currentQty = 1 }: Props) {
  if (!product.price_tiers || product.price_tiers.length < 2) return null;

  const tiers: PriceTier[] = product.price_tiers.map((t) => ({
    minQty: t.min,
    maxQty: t.max ?? undefined,
    unitPrice: t.price,
  }));

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm shadow-border/20">
      <p className="mb-3 text-sm font-semibold">Precios por volumen</p>
      <TierTable tiers={tiers} currentQty={currentQty} />
    </div>
  );
}
