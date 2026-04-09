import { ArrowRight, GitCompareArrows, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveProductImageUrl } from "@/lib/productImage";
import type { Product } from "@/models/products";

interface ComparisonBarProps {
  compareList: number[];
  products: Product[];
  onCompare: () => void;
  onRemove: (id: number) => void;
  onClear: () => void;
}

export function ComparisonBar({
  compareList,
  products,
  onCompare,
  onRemove,
  onClear,
}: ComparisonBarProps) {
  if (compareList.length === 0) return null;

  const selectedProducts = compareList
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is Product => p != null);

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="mx-auto max-w-4xl px-4 pb-4">
        <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-background/95 px-4 py-3 shadow-2xl backdrop-blur-lg">
          {/* Icon */}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <GitCompareArrows size={16} />
          </div>

          {/* Label */}
          <span className="hidden text-xs font-bold text-foreground sm:block">
            Comparando
          </span>

          {/* Thumbnails */}
          <div className="flex items-center gap-1.5">
            {selectedProducts.map((product) => {
              const imgSrc = resolveProductImageUrl(product.image);
              return (
                <div key={product.id} className="group relative">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/70 bg-white shadow-sm transition-transform hover:scale-110">
                    <img
                      src={imgSrc}
                      alt={product.name}
                      loading="lazy"
                      className="max-h-7 max-w-7 object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/placeholder.png";
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(product.id)}
                    className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
                    title={`Quitar ${product.name}`}
                  >
                    <X size={8} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Actions */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1 rounded-xl px-3 text-xs text-muted-foreground hover:text-destructive"
            onClick={onClear}
          >
            <X size={12} />
            Limpiar
          </Button>

          <Button
            type="button"
            size="sm"
            className="h-9 gap-1.5 rounded-xl bg-gradient-primary px-4 text-xs font-bold shadow-lg shadow-primary/20"
            onClick={onCompare}
            disabled={compareList.length < 2}
          >
            Comparar {compareList.length}
            <ArrowRight size={12} />
          </Button>
        </div>
      </div>
    </div>
  );
}
