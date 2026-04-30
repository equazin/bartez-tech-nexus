import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MoneyCell } from "@/components/ui/money-cell";
import { StockCell } from "@/components/ui/stock-cell";
import { Skeleton } from "@/components/ui/skeleton";
import { getAvailableStock } from "@/lib/pricing";
import { displayName } from "@/models/products";
import type { Product } from "@/models/products";

interface Props {
  products: Product[];
  loading: boolean;
}

export function ForYouSection({ products, loading }: Props) {
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
          {shown.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => navigate(`/portal/p/${p.sku ?? p.id}`)}
              className="flex flex-col gap-1.5 rounded-xl border bg-card p-2 text-left transition-shadow hover:shadow-md"
            >
              <div className="aspect-square w-full overflow-hidden rounded-lg bg-muted">
                {p.image ? (
                  <img
                    src={p.image}
                    alt={displayName(p)}
                    className="h-full w-full object-contain p-1"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground/20 text-2xl">□</div>
                )}
              </div>
              <p className="line-clamp-2 text-xs font-medium leading-snug">{displayName(p)}</p>
              <div className="flex items-center justify-between gap-1">
                <MoneyCell value={p.unit_price ?? 0} emphasis="strong" className="text-xs" />
                <StockCell available={getAvailableStock(p)} density="compact" className="text-xs" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
