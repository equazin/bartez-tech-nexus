import { memo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Plus, Minus, ShoppingCart, Heart, Bell, ExternalLink, GitCompareArrows } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StockCell } from "@/components/ui/stock-cell";
import { MoneyCell } from "@/components/ui/money-cell";
import { TierTable } from "@/components/ui/tier-table";
import { cn } from "@/lib/utils";
import { getAvailableStock } from "@/lib/pricing";
import { displayName } from "@/models/products";
import type { Product } from "@/models/products";
import type { PriceTier } from "@/components/ui/tier-table";
import type { PriceResult } from "@/hooks/usePricing";

interface Props {
  product: Product;
  qty: number;
  onAdd: (product: Product, qty: number) => void;
  getPrice: (product: Product, quantity: number) => PriceResult;
  expanded: boolean;
  onToggleExpand: (product: Product) => void;
  onFavorite?: (product: Product) => void;
  isFavorite?: boolean;
  onCompare?: (product: Product) => void;
  isInCompare?: boolean;
  compareDisabled?: boolean;
}

function buildTiers(product: Product): PriceTier[] {
  if (!product.price_tiers || product.price_tiers.length < 2) return [];
  return product.price_tiers.map((t) => ({
    minQty: t.min,
    maxQty: t.max ?? undefined,
    unitPrice: t.price,
  }));
}

function formatSpecKey(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const CatalogTableRow = memo(function CatalogTableRow({
  product,
  qty,
  onAdd,
  getPrice,
  expanded,
  onToggleExpand,
  onFavorite,
  isFavorite,
  onCompare,
  isInCompare,
  compareDisabled,
}: Props) {
  const [localQty, setLocalQty] = useState(Math.max(product.min_order_qty ?? 1, 1));

  const available = getAvailableStock(product);
  const price = getPrice(product, localQty);
  const tiers = buildTiers(product);
  const hasTiers = tiers.length >= 2;
  const canAdd = available > 0 || (product.specs?.eta_days !== undefined);
  const productPath = `/portal/p/${product.sku ?? product.id}`;
  const specs = product.specs ?? {};
  const specEntries = Object.entries(specs).filter(
    ([, v]) => v != null && String(v).trim() !== "",
  );
  const description =
    product.description_full || product.description || product.description_short;
  const warranty = (specs as Record<string, unknown>).garantia ?? (specs as Record<string, unknown>).warranty;

  function changeQty(delta: number) {
    const min = product.min_order_qty ?? 1;
    setLocalQty((prev) => Math.max(min, prev + delta));
  }

  return (
    <>
      <tr
        className={cn(
          "group cursor-pointer border-b border-border/50 transition-colors last:border-b-0 hover:bg-muted/40",
          expanded && "bg-muted/30",
        )}
        onClick={() => onToggleExpand(product)}
      >
        {/* Image */}
        <td className="w-12 py-2 pl-3 pr-1">
          <div className="block h-10 w-10 overflow-hidden rounded-lg border border-border/40 bg-muted/40">
            {product.image ? (
              <img
                src={product.image}
                alt=""
                className="h-full w-full object-contain"
                loading="lazy"
              />
            ) : null}
          </div>
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
            value={price.unitPrice}
            emphasis="strong"
            hint="+ IVA"
            original={price.isOffer && price.originalUnitPrice > price.unitPrice
              ? price.originalUnitPrice
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
        <td className="px-2 py-2 pr-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-1">
            <div className="flex items-center rounded-lg border border-border/60">
              <button
                type="button"
                onClick={() => changeQty(-1)}
                aria-label="Restar cantidad"
                className="flex h-7 w-7 items-center justify-center rounded-l-lg text-muted-foreground hover:bg-muted"
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="w-8 text-center text-sm font-semibold tabular-nums">{localQty}</span>
              <button
                type="button"
                onClick={() => changeQty(1)}
                aria-label="Sumar cantidad"
                className="flex h-7 w-7 items-center justify-center rounded-r-lg text-muted-foreground hover:bg-muted"
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
            <button
              type="button"
              onClick={() => onToggleExpand(product)}
              className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted"
              aria-label={expanded ? "Cerrar detalle" : "Ver detalle"}
            >
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
            </button>
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="border-b border-border/50 bg-muted/20">
          <td colSpan={7} className="p-0">
            <div className="grid gap-4 p-4 md:grid-cols-[220px_1fr_220px] md:gap-5">
              {/* Image gallery */}
              <div className="flex flex-col gap-2">
                <div className="relative aspect-square overflow-hidden rounded-xl border border-border/60 bg-background">
                  {product.image ? (
                    <img
                      src={product.image}
                      alt={displayName(product)}
                      className="h-full w-full object-contain p-3"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-3xl text-muted-foreground/30">□</div>
                  )}
                  {product.offer_percent ? (
                    <span className="absolute right-2 top-2 rounded-full bg-danger px-2 py-1 text-[10px] font-semibold text-danger-foreground shadow-sm">
                      -{product.offer_percent}%
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Description + specs */}
              <div className="flex min-w-0 flex-col gap-3">
                {description ? (
                  <div className="relative rounded-xl border border-border/60 bg-background p-3 text-sm">
                    <div
                      className="prose prose-sm max-h-[200px] max-w-none overflow-y-auto pr-2 leading-relaxed text-foreground/90 [&_p]:my-1.5"
                      dangerouslySetInnerHTML={{ __html: description }}
                    />
                  </div>
                ) : null}

                {specEntries.length > 0 ? (
                  <details className="rounded-xl border border-border/60 bg-background">
                    <summary className="cursor-pointer list-none px-3 py-2 text-sm font-semibold text-foreground/90 transition-colors hover:text-primary">
                      + Propiedades ({specEntries.length})
                    </summary>
                    <div className="border-t border-border/60">
                      {specEntries.map(([key, val], i) => (
                        <div
                          key={key}
                          className={cn(
                            "flex flex-col gap-1 px-3 py-1.5 text-xs sm:flex-row sm:gap-4",
                            i % 2 === 0 && "bg-muted/40",
                          )}
                        >
                          <span className="w-full shrink-0 font-medium text-muted-foreground sm:w-40">
                            {formatSpecKey(key)}
                          </span>
                          <span className="flex-1 text-foreground/90">{String(val)}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}

                {hasTiers ? (
                  <div className="rounded-xl border border-border/60 bg-background p-3">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                      Precios por volumen
                    </p>
                    <TierTable tiers={tiers} currentQty={qty + localQty} />
                  </div>
                ) : null}
              </div>

              {/* Side info: warranty, actions */}
              <div className="flex flex-col gap-3">
                {warranty ? (
                  <div className="rounded-xl border border-border/60 bg-background px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                      Garantía
                    </p>
                    <p className="text-sm font-semibold text-foreground">{String(warranty)}</p>
                  </div>
                ) : null}

                <div className="rounded-xl border border-border/60 bg-background px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                    Entrante
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {product.specs?.eta_days ? `${product.specs.eta_days} días` : "No disponible"}
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  {onFavorite ? (
                    <Button
                      type="button"
                      variant={isFavorite ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => onFavorite(product)}
                      className="gap-2"
                    >
                      <Heart className={cn("h-4 w-4", isFavorite && "fill-current text-danger")} />
                      {isFavorite ? "Quitar favorito" : "Marcar favorito"}
                    </Button>
                  ) : null}

                  {onCompare ? (
                    <Button
                      type="button"
                      variant={isInCompare ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => onCompare(product)}
                      disabled={compareDisabled && !isInCompare}
                      className="gap-2"
                      title={isInCompare ? "Quitar de la comparación" : compareDisabled ? "Ya tenés 4 productos para comparar" : "Agregar a comparar"}
                    >
                      <GitCompareArrows className="h-3.5 w-3.5" />
                      {isInCompare ? "Quitar de comparar" : "Comparar"}
                    </Button>
                  ) : null}

                  <Button asChild variant="outline" size="sm" className="gap-2">
                    <Link to={productPath}>
                      <ExternalLink className="h-3.5 w-3.5" />
                      Ficha completa
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
});
