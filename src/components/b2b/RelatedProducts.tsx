import { useMemo } from "react";
import { ArrowRight, Layers } from "lucide-react";
import { StockBadge } from "@/components/b2b/StockBadge";
import { resolveProductImageUrl } from "@/lib/productImage";
import { getAirIncomingStock } from "@/lib/stockUtils";
import { cn } from "@/lib/utils";
import type { PriceResult } from "@/hooks/usePricing";
import type { Product } from "@/models/products";

interface RelatedProductsProps {
  currentProduct: Product;
  allProducts: Product[];
  computePrice: (p: Product, qty: number) => PriceResult;
  formatPrice: (n: number) => string;
  onSelect: (p: Product) => void;
  onAddToCart: (p: Product) => void;
}

export function RelatedProducts({
  currentProduct,
  allProducts,
  computePrice,
  formatPrice,
  onSelect,
  onAddToCart,
}: RelatedProductsProps) {
  const related = useMemo(() => {
    const candidates = allProducts.filter((p) => p.id !== currentProduct.id);

    // Priority 1: same category + same brand
    const sameCategoryAndBrand = candidates.filter(
      (p) =>
        p.category === currentProduct.category &&
        p.brand_name === currentProduct.brand_name,
    );

    // Priority 2: same category (different brand)
    const sameCategory = candidates.filter(
      (p) =>
        p.category === currentProduct.category &&
        p.brand_name !== currentProduct.brand_name,
    );

    // Priority 3: same brand (different category)
    const sameBrand = candidates.filter(
      (p) =>
        p.brand_name === currentProduct.brand_name &&
        p.category !== currentProduct.category,
    );

    // Merge with priority, deduplicate, limit to 4
    const seen = new Set<number>();
    const result: Product[] = [];
    for (const pool of [sameCategoryAndBrand, sameCategory, sameBrand]) {
      for (const p of pool) {
        if (result.length >= 4) break;
        if (!seen.has(p.id)) {
          seen.add(p.id);
          result.push(p);
        }
      }
      if (result.length >= 4) break;
    }

    return result;
  }, [currentProduct, allProducts]);

  if (related.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <Layers size={13} className="text-muted-foreground" />
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Productos relacionados
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {related.map((product) => {
          const price = computePrice(product, 1);
          const available = Math.max(0, product.stock - (product.stock_reserved ?? 0));
          const incomingStock = getAirIncomingStock(product);
          const imgSrc = resolveProductImageUrl(product.image);

          return (
            <div
              key={product.id}
              className="group flex flex-col gap-2 rounded-2xl border border-border/60 bg-card/80 p-2.5 transition-all hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-md"
            >
              <button
                type="button"
                onClick={() => onSelect(product)}
                className="flex flex-col items-center gap-2 text-center"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-border/50 bg-white shadow-sm transition-transform group-hover:scale-105">
                  <img
                    src={imgSrc}
                    alt={product.name}
                    loading="lazy"
                    className="max-h-10 max-w-10 object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/placeholder.png";
                    }}
                  />
                </div>
                {product.brand_name && (
                  <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
                    {product.brand_name}
                  </span>
                )}
                <p className="line-clamp-2 text-[11px] font-semibold leading-tight text-foreground">
                  {product.name}
                </p>
              </button>

              <div className="mt-auto space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <StockBadge stock={available} incomingStock={incomingStock} />
                </div>

                <div className="flex items-center justify-between gap-1">
                  <span className="text-sm font-bold tabular-nums text-primary">
                    {formatPrice(price.unitPrice)}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddToCart(product);
                    }}
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-xl text-primary-foreground transition-all",
                      "bg-primary hover:bg-primary/90 active:scale-90",
                    )}
                    title="Agregar al carrito"
                  >
                    <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
