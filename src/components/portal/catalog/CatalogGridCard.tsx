import { memo, useState } from "react";
import { Link } from "react-router-dom";
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
  const productPath = `/portal/p/${product.sku ?? product.id}`;

  function changeQty(delta: number) {
    const min = product.min_order_qty ?? 1;
    setLocalQty((prev) => Math.max(min, prev + delta));
  }

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm shadow-border/20 transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg hover:shadow-primary/10">
      {/* Image */}
      <Link to={productPath} className="relative block aspect-square overflow-hidden border-b border-border/60 bg-muted/40">
        {product.image ? (
          <img
            src={product.image}
            alt={displayName(product)}
            className="h-full w-full object-contain p-4 transition-transform duration-200 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground/30 text-4xl">
            □
          </div>
        )}
        {product.offer_percent && (
          <span className="absolute right-2 top-2 rounded-full bg-danger px-2 py-1 text-xs font-semibold text-danger-foreground shadow-sm">
            -{product.offer_percent}%
          </span>
        )}
      </Link>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-3 p-3">
        <div className="flex-1 space-y-2">
          <div className="flex min-h-[18px] items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="min-w-0 truncate">{product.brand_name ?? "Bartez"}</span>
            {product.sku ? <span className="shrink-0 font-mono text-[11px]">{product.sku}</span> : null}
          </div>
          <Link
            to={productPath}
            className="line-clamp-2 min-h-[40px] text-sm font-semibold leading-snug text-foreground transition-colors hover:text-primary"
          >
            {displayName(product)}
          </Link>
        </div>

        <div className="flex items-end justify-between gap-3 rounded-xl border border-border/60 bg-muted/30 px-2.5 py-2">
          <MoneyCell
            value={price.unitPrice}
            emphasis="strong"
            hint="+ IVA"
            original={price.isOffer && price.originalUnitPrice > price.unitPrice ? price.originalUnitPrice : undefined}
          />
          <StockCell available={available} density="compact" align="right" />
        </div>

        {/* Qty + Add */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center rounded-md border">
            <button
              type="button"
              onClick={() => changeQty(-1)}
              aria-label="Restar cantidad"
              className="flex h-8 w-8 items-center justify-center rounded-l-md hover:bg-muted"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="w-9 text-center text-sm font-semibold tabular-nums">{localQty}</span>
            <button
              type="button"
              onClick={() => changeQty(1)}
              aria-label="Sumar cantidad"
              className="flex h-8 w-8 items-center justify-center rounded-r-md hover:bg-muted"
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
