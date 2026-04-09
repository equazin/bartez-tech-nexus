import { X, Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveProductImageUrl } from "@/lib/productImage";
import { cn } from "@/lib/utils";
import type { Product } from "@/models/products";
import type { PriceResult } from "@/hooks/usePricing";

const RECENTLY_VIEWED_KEY = "b2b_recently_viewed";
const MAX_ITEMS = 8;

/** Read recently viewed IDs from localStorage */
export function getRecentlyViewedIds(): number[] {
  try {
    const raw = localStorage.getItem(RECENTLY_VIEWED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is number => typeof id === "number") : [];
  } catch {
    return [];
  }
}

/** Add a product ID to the recently viewed list (most recent first) */
export function addRecentlyViewed(productId: number): number[] {
  const current = getRecentlyViewedIds().filter((id) => id !== productId);
  const updated = [productId, ...current].slice(0, MAX_ITEMS);
  localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(updated));
  return updated;
}

/** Clear all recently viewed */
export function clearRecentlyViewed(): void {
  localStorage.removeItem(RECENTLY_VIEWED_KEY);
}

interface RecentlyViewedProps {
  recentIds: number[];
  products: Product[];
  computePrice: (p: Product, qty: number) => PriceResult;
  formatPrice: (n: number) => string;
  onSelect: (p: Product) => void;
  onAddToCart: (p: Product, qty: number) => void;
  onClear: () => void;
}

export function RecentlyViewed({
  recentIds,
  products,
  computePrice,
  formatPrice,
  onSelect,
  onAddToCart,
  onClear,
}: RecentlyViewedProps) {
  const recentProducts = recentIds
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is Product => p != null)
    .slice(0, MAX_ITEMS);

  if (recentProducts.length < 2) return null;

  return (
    <div className="animate-in fade-in slide-in-from-top-3 duration-500">
      <div className="rounded-[20px] border border-border/70 bg-card/85 p-3 shadow-sm">
        <div className="mb-2.5 flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Clock size={12} className="text-muted-foreground" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Vistos recientemente
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 gap-1 rounded-lg px-2 text-[10px] text-muted-foreground hover:text-destructive"
            onClick={onClear}
          >
            <X size={10} />
            Limpiar
          </Button>
        </div>

        <div className="flex gap-2.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {recentProducts.map((product) => {
            const price = computePrice(product, 1);
            const imgSrc = resolveProductImageUrl(product.image);
            return (
              <div
                key={product.id}
                className="group flex w-[140px] shrink-0 flex-col gap-2 rounded-2xl border border-border/60 bg-background/80 p-2.5 transition-all hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-md"
              >
                <button
                  type="button"
                  onClick={() => onSelect(product)}
                  className="flex flex-col items-center gap-1.5 text-center"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border/50 bg-white shadow-sm">
                    <img
                      src={imgSrc}
                      alt={product.name}
                      loading="lazy"
                      className="max-h-9 max-w-9 object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/placeholder.png";
                      }}
                    />
                  </div>
                  <p className="line-clamp-2 text-[10px] font-semibold leading-tight text-foreground">
                    {product.name}
                  </p>
                </button>

                <div className="mt-auto flex items-center justify-between gap-1">
                  <span className="text-xs font-bold tabular-nums text-primary">
                    {formatPrice(price.unitPrice)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onAddToCart(product, 1)}
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-lg text-primary-foreground transition-all",
                      "bg-primary hover:bg-primary/90 active:scale-90",
                    )}
                    title="Agregar al carrito"
                  >
                    <ArrowRight size={10} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
