import { useState } from "react";
import { Link } from "react-router-dom";
import { Minus, Plus, ShoppingCart, ExternalLink, Package, Tag } from "lucide-react";

import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MoneyCell } from "@/components/ui/money-cell";
import { StockCell } from "@/components/ui/stock-cell";
import { TierTable, type PriceTier } from "@/components/ui/tier-table";
import { getAvailableStock } from "@/lib/pricing";
import { displayName, type Product } from "@/models/products";
import type { PriceResult } from "@/hooks/usePricing";

interface ProductQuickViewProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (product: Product, qty: number) => void;
  getPrice: (product: Product, quantity: number) => PriceResult;
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
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ProductQuickView({ product, open, onOpenChange, onAdd, getPrice }: ProductQuickViewProps) {
  const [qty, setQty] = useState(1);

  if (!product) return null;

  const available = getAvailableStock(product);
  const price = getPrice(product, qty);
  const canAdd = available > 0;
  const tiers = buildTiers(product);
  const hasTiers = tiers.length >= 2;
  const productPath = `/portal/p/${product.sku ?? product.id}`;
  const specs = product.specs ?? {};
  const specEntries = Object.entries(specs).filter(([, v]) => v != null && String(v).trim() !== "");
  const description = product.description_full || product.description || product.description_short;

  function changeQty(delta: number) {
    const min = product.min_order_qty ?? 1;
    setQty((prev) => Math.max(min, prev + delta));
  }

  function handleAdd() {
    onAdd(product, qty);
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setQty(Math.max(product.min_order_qty ?? 1, 1));
      }}
    >
      <DialogContent className="flex max-h-[92vh] w-[95vw] max-w-3xl flex-col gap-0 overflow-hidden rounded-2xl border border-border/60 bg-background p-0 shadow-xl sm:w-full">
        <DialogTitle className="sr-only">{displayName(product)}</DialogTitle>
        <DialogDescription className="sr-only">
          Vista rápida del producto con precio, stock y especificaciones.
        </DialogDescription>

        <ScrollArea className="max-h-[92vh]">
          <div className="grid gap-5 p-4 sm:p-6 md:grid-cols-[280px_1fr] md:gap-6">
            {/* Image */}
            <div className="flex flex-col gap-3">
              <div className="relative aspect-square overflow-hidden rounded-xl border border-border/60 bg-muted/30">
                {product.image ? (
                  <img
                    src={product.image}
                    alt={displayName(product)}
                    className="h-full w-full object-contain p-3"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-5xl text-muted-foreground/30">
                    <Package className="h-12 w-12" />
                  </div>
                )}
                {product.offer_percent ? (
                  <span className="absolute right-2 top-2 rounded-full bg-danger px-2 py-1 text-xs font-semibold text-danger-foreground shadow-sm">
                    -{product.offer_percent}%
                  </span>
                ) : null}
              </div>

              <Button asChild variant="outline" size="sm" className="w-full gap-2">
                <Link to={productPath} onClick={() => onOpenChange(false)}>
                  <ExternalLink className="h-3.5 w-3.5" />
                  Ver ficha completa
                </Link>
              </Button>
            </div>

            {/* Info */}
            <div className="flex min-w-0 flex-col gap-4">
              {/* Badges */}
              <div className="flex flex-wrap items-center gap-1.5">
                {product.featured ? (
                  <Badge variant="secondary" className="gap-1">
                    <Tag className="h-3 w-3" /> Destacado
                  </Badge>
                ) : null}
                {product.brand_name ? (
                  <Badge variant="outline" className="font-medium">
                    {product.brand_name}
                  </Badge>
                ) : null}
                {product.category ? (
                  <Badge variant="outline" className="font-normal text-muted-foreground">
                    {product.category}
                  </Badge>
                ) : null}
              </div>

              {/* Name + SKU */}
              <div className="space-y-1">
                <h2 className="text-lg font-bold leading-snug text-foreground sm:text-xl">
                  {displayName(product)}
                </h2>
                {product.sku ? (
                  <p className="font-mono text-xs text-muted-foreground">SKU: {product.sku}</p>
                ) : null}
              </div>

              {/* Price + Stock */}
              <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-3">
                <MoneyCell
                  value={price.unitPrice}
                  emphasis="strong"
                  hint="+ IVA"
                  className="text-xl"
                  original={
                    price.isOffer && price.originalUnitPrice > price.unitPrice
                      ? price.originalUnitPrice
                      : undefined
                  }
                />
                <StockCell available={available} reserved={product.stock_reserved} />
              </div>

              {/* Description short */}
              {product.description_short ? (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {product.description_short}
                </p>
              ) : null}

              {/* Add to cart */}
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-lg border border-border/60">
                  <button
                    type="button"
                    onClick={() => changeQty(-1)}
                    aria-label="Restar cantidad"
                    className="flex h-9 w-9 items-center justify-center rounded-l-lg text-muted-foreground transition-colors hover:bg-muted"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-10 text-center text-sm font-semibold tabular-nums">{qty}</span>
                  <button
                    type="button"
                    onClick={() => changeQty(1)}
                    aria-label="Sumar cantidad"
                    className="flex h-9 w-9 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:bg-muted"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <Button onClick={handleAdd} disabled={!canAdd} className="flex-1 gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  Agregar al carrito
                </Button>
              </div>

              {product.min_order_qty && product.min_order_qty > 1 ? (
                <p className="text-[11px] text-muted-foreground">
                  Pedido mínimo: <span className="font-semibold">{product.min_order_qty}</span> unidades.
                </p>
              ) : null}
            </div>
          </div>

          {/* Long description */}
          {description ? (
            <>
              <Separator />
              <div className="space-y-2 p-4 sm:p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Descripción
                </p>
                <div
                  className="prose prose-sm max-w-none text-sm leading-relaxed text-foreground/90 prose-headings:font-display [&_p]:my-2"
                  dangerouslySetInnerHTML={{ __html: description }}
                />
              </div>
            </>
          ) : null}

          {/* Specs */}
          {specEntries.length > 0 ? (
            <>
              <Separator />
              <div className="space-y-3 p-4 sm:p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Especificaciones
                </p>
                <div className="overflow-hidden rounded-xl border border-border/60">
                  {specEntries.map(([key, val], i) => (
                    <div
                      key={key}
                      className={`flex flex-col gap-1 px-3 py-2 text-sm sm:flex-row sm:gap-4 ${i % 2 === 0 ? "bg-muted/40" : ""}`}
                    >
                      <span className="w-full shrink-0 font-medium text-muted-foreground sm:w-44">
                        {formatSpecKey(key)}
                      </span>
                      <span className="flex-1 text-foreground/90">{String(val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}

          {/* Tiers */}
          {hasTiers ? (
            <>
              <Separator />
              <div className="space-y-3 p-4 sm:p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Precios por volumen
                </p>
                <TierTable tiers={tiers} currentQty={qty} />
              </div>
            </>
          ) : null}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
