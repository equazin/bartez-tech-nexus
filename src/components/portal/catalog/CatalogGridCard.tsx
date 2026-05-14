import { memo, useState } from "react";
import { Plus, Minus, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StockCell } from "@/components/ui/stock-cell";
import { MoneyCell } from "@/components/ui/money-cell";
import { cn } from "@/lib/utils";
import { getAvailableStock } from "@/lib/pricing";
import { displayName } from "@/models/products";
import type { Product } from "@/models/products";
import type { PriceResult } from "@/hooks/usePricing";

interface Props {
  product: Product;
  qty: number;
  onAdd: (product: Product, qty: number) => void;
  getPrice: (product: Product, quantity: number) => PriceResult;
}

export const CatalogGridCard = memo(function CatalogGridCard({ product, onAdd, getPrice }: Props) {
  const [localQty, setLocalQty] = useState(Math.max(product.min_order_qty ?? 1, 1));
  const available = getAvailableStock(product);
  const price = getPrice(product, localQty);
  const canAdd = available > 0;

  function changeQty(delta: number) {
    const min = product.min_order_qty ?? 1;
    setLocalQty((prev) => Math.max(min, prev + delta));
  }

  return (
    <div className="flex flex-col rounded-lg border bg-card transition-shadow hover:shadow-md">
      {/* Image */}
      <div className="relative aspect-square overflow-hidden rounded-t-lg bg-muted">
        {product.image ? (
          <img
            src={product.image}
            alt={displayName(product)}
            className="h-full w-full object-contain p-2"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground/30 text-4xl">
            □
          </div>
        )}
        {product.offer_percent && (
          <span className="absolute right-1.5 top-1.5 rounded bg-danger px-1.5 py-0.5 text-xs font-semibold text-danger-foreground">
            -{product.offer_percent}%
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex-1">
          <p className="line-clamp-2 text-sm font-medium leading-snug">{displayName(product)}</p>
          {product.brand_name && (
            <p className="mt-0.5 text-xs text-muted-foreground">{product.brand_name}</p>
          )}
          {product.sku && (
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">{product.sku}</p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <MoneyCell
            value={price.unitPrice}
            emphasis="strong"
            hint="+ IVA"
            original={price.isOffer && price.originalUnitPrice > price.unitPrice ? price.originalUnitPrice : undefined}
          />
          <StockCell available={available} density="compact" />
        </div>

        {/* Qty + Add */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center rounded-md border">
            <button
              type="button"
              onClick={() => changeQty(-1)}
              className="flex h-7 w-7 items-center justify-center rounded-l-md hover:bg-muted"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="w-8 text-center text-sm tabular-nums">{localQty}</span>
            <button
              type="button"
              onClick={() => changeQty(1)}
              className="flex h-7 w-7 items-center justify-center rounded-r-md hover:bg-muted"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
          <Button
            size="sm"
            disabled={!canAdd}
            onClick={() => onAdd(product, localQty)}
            className={cn("flex-1 gap-1.5")}
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            <span>Agregar</span>
          </Button>
        </div>
      </div>
    </div>
  );
});
