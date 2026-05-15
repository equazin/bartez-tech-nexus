import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Minus,
  Plus,
  ShoppingCart,
  ExternalLink,
  Package,
  Heart,
  Sparkles,
  TrendingDown,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MoneyCell } from "@/components/ui/money-cell";
import { StockCell } from "@/components/ui/stock-cell";
import { TierTable, type PriceTier } from "@/components/ui/tier-table";
import { WatchlistPanel } from "@/components/portal/product/WatchlistPanel";
import { useCurrency } from "@/context/CurrencyContext";
import { getFavoriteProducts, toggleFavoriteProduct } from "@/lib/favoriteProducts";
import { getAvailableStock } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { displayName, type Product } from "@/models/products";
import type { PriceResult } from "@/hooks/usePricing";

interface ProductQuickViewProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (product: Product, qty: number) => void;
  getPrice: (product: Product, quantity: number) => PriceResult;
  /** Caller profile id — used for favorites + watchlist */
  profileId?: string;
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

export function ProductQuickView({
  product,
  open,
  onOpenChange,
  onAdd,
  getPrice,
  profileId,
}: ProductQuickViewProps) {
  const [qty, setQty] = useState(1);
  const [isFavorite, setIsFavorite] = useState(false);
  const [activeTab, setActiveTab] = useState<"info" | "specs" | "tiers">("info");
  const { formatPrice } = useCurrency();

  useEffect(() => {
    if (product) {
      setQty(Math.max(product.min_order_qty ?? 1, 1));
      setActiveTab("info");
    }
    if (product && profileId) {
      setIsFavorite(getFavoriteProducts(profileId).includes(product.id));
    }
  }, [product, profileId]);

  if (!product) return null;

  const available = getAvailableStock(product);
  const price = getPrice(product, qty);
  const canAdd = available > 0;
  const tiers = buildTiers(product);
  const hasTiers = tiers.length >= 2;
  const productPath = `/portal/p/${product.sku ?? product.id}`;
  const specs = product.specs ?? {};
  const specEntries = Object.entries(specs).filter(
    ([, v]) => v != null && String(v).trim() !== "",
  );
  const hasSpecs = specEntries.length > 0;
  const description =
    product.description_full || product.description || product.description_short;
  const hasDescription = !!description;

  // Total + ahorro calculations (ivaRate is a percentage, e.g. 21)
  const lineSubtotal = price.unitPrice * qty;
  const ivaRatePct = price.ivaRate ?? 21;
  const ivaAmount = lineSubtotal * (ivaRatePct / 100);
  const lineTotal = lineSubtotal + ivaAmount;

  const baseUnit =
    price.isOffer && price.originalUnitPrice > price.unitPrice
      ? price.originalUnitPrice
      : tiers[0]?.unitPrice;
  const savingsPerUnit =
    baseUnit && baseUnit > price.unitPrice ? baseUnit - price.unitPrice : 0;
  const savingsTotal = savingsPerUnit * qty;
  const savingsPct = baseUnit && baseUnit > 0 ? (savingsPerUnit / baseUnit) * 100 : 0;

  function changeQty(delta: number) {
    const min = product.min_order_qty ?? 1;
    setQty((prev) => Math.max(min, prev + delta));
  }

  function handleAdd() {
    onAdd(product, qty);
    onOpenChange(false);
  }

  function handleToggleFavorite() {
    if (!profileId) return;
    const next = toggleFavoriteProduct(profileId, product.id);
    setIsFavorite(next.includes(product.id));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[95vw] max-w-3xl flex-col gap-0 overflow-hidden rounded-2xl border border-border/60 bg-background p-0 shadow-xl sm:w-full">
        <DialogTitle className="sr-only">{displayName(product)}</DialogTitle>
        <DialogDescription className="sr-only">
          Vista rápida del producto con precio, stock y especificaciones.
        </DialogDescription>

        <ScrollArea className="max-h-[92vh]">
          {/* Hero: image + summary */}
          <div className="grid gap-5 p-4 sm:p-6 md:grid-cols-[260px_1fr] md:gap-6">
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
                  <div className="flex h-full items-center justify-center text-muted-foreground/30">
                    <Package className="h-12 w-12" />
                  </div>
                )}
                {product.offer_percent ? (
                  <span className="absolute right-2 top-2 rounded-full bg-danger px-2 py-1 text-xs font-semibold text-danger-foreground shadow-sm">
                    -{product.offer_percent}%
                  </span>
                ) : null}
              </div>

              {/* Action rail */}
              <div className="flex flex-wrap gap-2">
                {profileId ? (
                  <Button
                    type="button"
                    variant={isFavorite ? "secondary" : "outline"}
                    size="sm"
                    onClick={handleToggleFavorite}
                    className="flex-1 gap-1.5"
                  >
                    <Heart
                      className={cn(
                        "h-4 w-4",
                        isFavorite && "fill-current text-danger",
                      )}
                    />
                    {isFavorite ? "Favorito" : "Favorito"}
                  </Button>
                ) : null}
                {profileId ? <WatchlistPanel productId={product.id} profileId={profileId} /> : null}
              </div>

              <Button asChild variant="ghost" size="sm" className="w-full gap-2">
                <Link to={productPath} onClick={() => onOpenChange(false)}>
                  <ExternalLink className="h-3.5 w-3.5" />
                  Ficha completa
                </Link>
              </Button>
            </div>

            {/* Summary */}
            <div className="flex min-w-0 flex-col gap-4">
              <div className="flex flex-wrap items-center gap-1.5">
                {product.featured ? (
                  <Badge variant="secondary" className="gap-1">
                    <Sparkles className="h-3 w-3" />
                    Destacado
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

              <div className="space-y-1">
                <h2 className="text-lg font-bold leading-snug text-foreground sm:text-xl">
                  {displayName(product)}
                </h2>
                {product.sku ? (
                  <p className="font-mono text-xs text-muted-foreground">SKU: {product.sku}</p>
                ) : null}
              </div>

              {/* Price + Stock summary */}
              <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-3">
                <MoneyCell
                  value={price.unitPrice}
                  emphasis="strong"
                  hint="por unidad + IVA"
                  className="text-xl"
                  original={
                    price.isOffer && price.originalUnitPrice > price.unitPrice
                      ? price.originalUnitPrice
                      : undefined
                  }
                />
                <StockCell available={available} reserved={product.stock_reserved} />
              </div>

              {product.description_short ? (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {product.description_short}
                </p>
              ) : null}

              {/* Qty + add */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex items-center rounded-lg border border-border/60">
                    <button
                      type="button"
                      onClick={() => changeQty(-1)}
                      aria-label="Restar cantidad"
                      className="flex h-10 w-10 items-center justify-center rounded-l-lg text-muted-foreground transition-colors hover:bg-muted"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-12 text-center text-sm font-bold tabular-nums">{qty}</span>
                    <button
                      type="button"
                      onClick={() => changeQty(1)}
                      aria-label="Sumar cantidad"
                      className="flex h-10 w-10 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:bg-muted"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <Button onClick={handleAdd} disabled={!canAdd} className="h-10 flex-1 gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    Agregar
                  </Button>
                </div>

                {/* Total + savings */}
                <div className="rounded-xl border border-border/60 bg-card p-3 shadow-sm shadow-border/20">
                  <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Total línea
                      </p>
                      <p className="font-display text-xl font-bold tabular-nums text-foreground">
                        {formatPrice(lineTotal)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatPrice(lineSubtotal)} + IVA {formatPrice(ivaAmount)}
                      </p>
                    </div>
                    {savingsTotal > 0 ? (
                      <div className="shrink-0 rounded-lg border border-success/30 bg-success/10 px-2.5 py-1.5 text-right">
                        <p className="flex items-center justify-end gap-1 text-[10px] font-semibold uppercase tracking-wide text-success">
                          <TrendingDown className="h-3 w-3" />
                          Ahorrás
                        </p>
                        <p className="font-display text-sm font-bold tabular-nums text-success">
                          {formatPrice(savingsTotal)}
                        </p>
                        {savingsPct > 0 ? (
                          <p className="text-[10px] text-success/80">-{savingsPct.toFixed(0)}%</p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>

                {product.min_order_qty && product.min_order_qty > 1 ? (
                  <p className="text-[11px] text-muted-foreground">
                    Pedido mínimo:{" "}
                    <span className="font-semibold">{product.min_order_qty}</span> unidades.
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {/* Tabs */}
          {hasDescription || hasSpecs || hasTiers ? (
            <div className="border-t border-border/60 px-4 pb-4 pt-2 sm:px-6 sm:pb-6">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
                <TabsList className="w-full justify-start gap-1 rounded-xl bg-muted/40 p-1">
                  {hasDescription ? (
                    <TabsTrigger value="info" className="rounded-lg text-xs">
                      Descripción
                    </TabsTrigger>
                  ) : null}
                  {hasSpecs ? (
                    <TabsTrigger value="specs" className="rounded-lg text-xs">
                      Specs <span className="ml-1 text-muted-foreground">({specEntries.length})</span>
                    </TabsTrigger>
                  ) : null}
                  {hasTiers ? (
                    <TabsTrigger value="tiers" className="rounded-lg text-xs">
                      Por volumen
                    </TabsTrigger>
                  ) : null}
                </TabsList>

                {hasDescription ? (
                  <TabsContent value="info" className="pt-4">
                    <div
                      className="prose prose-sm max-w-none text-sm leading-relaxed text-foreground/90 [&_p]:my-2"
                      dangerouslySetInnerHTML={{ __html: description ?? "" }}
                    />
                  </TabsContent>
                ) : null}

                {hasSpecs ? (
                  <TabsContent value="specs" className="pt-4">
                    <div className="overflow-hidden rounded-xl border border-border/60">
                      {specEntries.map(([key, val], i) => (
                        <div
                          key={key}
                          className={cn(
                            "flex flex-col gap-1 px-3 py-2 text-sm sm:flex-row sm:gap-4",
                            i % 2 === 0 && "bg-muted/40",
                          )}
                        >
                          <span className="w-full shrink-0 font-medium text-muted-foreground sm:w-44">
                            {formatSpecKey(key)}
                          </span>
                          <span className="flex-1 text-foreground/90">{String(val)}</span>
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                ) : null}

                {hasTiers ? (
                  <TabsContent value="tiers" className="pt-4">
                    <TierTable tiers={tiers} currentQty={qty} />
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      El precio se ajusta automáticamente al subir la cantidad.
                    </p>
                  </TabsContent>
                ) : null}
              </Tabs>
            </div>
          ) : null}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
