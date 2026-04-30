import { memo, useState } from "react";
import { ChevronDown, Plus, Minus, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StockCell } from "@/components/ui/stock-cell";
import { MoneyCell } from "@/components/ui/money-cell";
import { TierTable } from "@/components/ui/tier-table";
import { cn } from "@/lib/utils";
import { getAvailableStock } from "@/lib/pricing";
import { displayName } from "@/models/products";
import type { Product } from "@/models/products";
import type { PriceTier } from "@/components/ui/tier-table";

interface Props {
  product: Product;
  qty: number;
  onAdd: (product: Product, qty: number) => void;
}

function buildTiers(product: Product): PriceTier[] {
  if (!product.price_tiers || product.price_tiers.length < 2) return [];
  return product.price_tiers.map((t) => ({
    minQty: t.min,
    maxQty: t.max ?? undefined,
    unitPrice: t.price,
  }));
}

export const CatalogTableRow = memo(function CatalogTableRow({ product, qty, onAdd }: Props) {
  const [localQty, setLocalQty] = useState(Math.max(product.min_order_qty ?? 1, 1));
  const [expanded, setExpanded] = useState(false);

  const available = getAvailableStock(product);
  const tiers = buildTiers(product);
  const hasTiers = tiers.length >= 2;
  const canAdd = available > 0 || (product.specs?.eta_days !== undefined);

  function changeQty(delta: number) {
    const min = product.min_order_qty ?? 1;
    setLocalQty((prev) => Math.max(min, prev + delta));
  }

  return (
    <>
      <tr className="group border-b transition-colors hover:bg-muted/40">
        {/* Image */}
        <td className="w-12 py-2 pl-3 pr-1">
          {product.image ? (
            <img
              src={product.image}
              alt=""
              className="h-10 w-10 rounded object-contain"
              loading="lazy"
            />
          ) : (
            <div className="h-10 w-10 rounded bg-muted" />
          )}
        </td>

        {/* Name + SKU */}
        <td className="max-w-[240px] px-2 py-2">
          <p className="line-clamp-2 text-sm font-medium leading-snug">{displayName(product)}</p>
          {product.sku && (
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">{product.sku}</p>
          )}
        </td>

        {/* Brand */}
        <td className="hidden px-2 py-2 text-sm text-muted-foreground md:table-cell">
          {product.brand_name ?? "—"}
        </td>

        {/* Stock */}
        <td className="px-2 py-2">
          <StockCell
            available={available}
            reserved={product.stock_reserved}
            density="compact"
          />
        </td>

        {/* Price */}
        <td className="px-2 py-2 text-right">
          <MoneyCell
            value={product.unit_price ?? 0}
            emphasis="strong"
            hint="+ IVA"
            original={product.special_price && product.special_price < (product.unit_price ?? 0)
              ? product.unit_price
              : undefined}
          />
        </td>

        {/* MOQ */}
        <td className="hidden px-2 py-2 text-center text-xs text-muted-foreground lg:table-cell">
          {product.min_order_qty && product.min_order_qty > 1
            ? `x${product.min_order_qty}`
            : "—"}
        </td>

        {/* Qty stepper + Add */}
        <td className="px-2 py-2 pr-3">
          <div className="flex items-center justify-end gap-1">
            <div className="flex items-center rounded-md border">
              <button
                type="button"
                onClick={() => changeQty(-1)}
                className="flex h-7 w-7 items-center justify-center rounded-l-md text-muted-foreground hover:bg-muted"
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="w-8 text-center text-sm tabular-nums">{localQty}</span>
              <button
                type="button"
                onClick={() => changeQty(1)}
                className="flex h-7 w-7 items-center justify-center rounded-r-md text-muted-foreground hover:bg-muted"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
            <Button
              size="sm"
              disabled={!canAdd}
              onClick={() => onAdd(product, localQty)}
              className="h-7 w-7 p-0"
            >
              <ShoppingCart className="h-3.5 w-3.5" />
            </Button>
            {hasTiers && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted"
                aria-label="Ver precios por volumen"
              >
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
              </button>
            )}
          </div>
        </td>
      </tr>

      {hasTiers && expanded && (
        <tr className="border-b bg-muted/20">
          <td colSpan={7} className="px-4 py-2">
            <TierTable tiers={tiers} currentQty={qty + localQty} className="max-w-sm" />
          </td>
        </tr>
      )}
    </>
  );
});
