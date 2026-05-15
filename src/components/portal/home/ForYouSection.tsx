import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MoneyCell } from "@/components/ui/money-cell";
import { StockCell } from "@/components/ui/stock-cell";
import { Skeleton } from "@/components/ui/skeleton";
import { getAvailableStock } from "@/lib/pricing";
import { displayName } from "@/models/products";
import type { Product } from "@/models/products";
import type { PriceResult } from "@/hooks/usePricing";

interface Props {
  products: Product[];
  loading: boolean;
  getPrice: (product: Product, quantity: number) => PriceResult;
}

export function ForYouSection({ products, loading, getPrice }: Props) {
  const navigate = useNavigate();
  const shown = products.slice(0, 6);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Para vos
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-xs"
          onClick={() => navigate("/portal/catalogo")}
        >
          Ver catálogo <ArrowRight className="h-3 w-3" />
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-xl" />
          ))}
        </div>
      ) : shown.length === 0 ? null : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {shown.map((p) => {
            const quantity = Math.max(p.min_order_qty ?? 1, 1);
            const price = getPrice(p, quantity);

            return (
              <button
                key={p.id}
                type="button"
                onClick={() => navigate(`/portal/p/${p.sku ?? p.id}`)}
                className="group flex min-h-[220px] flex-col rounded-xl border bg-card p-2 text-left transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg hover:shadow-primary/10"
              >
                <div className="aspect-square w-full overflow-hidden rounded-lg border border-border/60 bg-muted/40">
                {p.image ? (
                  <img
                    src={p.image}
                    alt={displayName(p)}
                    className="h-full w-full object-contain p-2 transition-transform duration-200 group-hover:scale-[1.03]"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground/20 text-2xl">□</div>
                )}
                </div>
                <div className="flex flex-1 flex-col gap-2 pt-2">
                  <p className="line-clamp-2 min-h-[32px] text-xs font-semibold leading-snug text-foreground">{displayName(p)}</p>
                  <div className="mt-auto space-y-1.5 rounded-lg bg-muted/35 px-2 py-1.5">
                    <MoneyCell value={price.unitPrice} emphasis="strong" className="[&_span:last-child]:text-[15px]" />
                    <StockCell available={getAvailableStock(p)} density="compact" className="text-xs" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
