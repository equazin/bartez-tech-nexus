import { useEffect, useState } from "react";
import { Star, TrendingUp, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { preloadProductImage, resolveProductImageUrl } from "@/lib/productImage";
import { cn } from "@/lib/utils";
import { StockBadge } from "./StockBadge";
import { QuickAddControl } from "./QuickAddControl";
import type { Product } from "@/models/products";

interface ProductItemProps {
  product: Product;
  viewMode: "grid" | "list";
  inCart: number;
  isFavorite: boolean;
  isCompared: boolean;
  finalPrice: number;
  formatPrice: (p: number) => string;
  onAddQty: (p: Product, qty: number) => void;
  onRemoveFromCart: (p: Product) => void;
  onToggleFavorite: (id: number) => void;
  onToggleCompare: (id: number) => void;
  onSelect: (p: Product) => void;
  isPosProduct: (p: Product) => boolean;
  wasAdded?: boolean;
  purchaseHistoryCount?: number;
  lastPurchaseUnitPriceDelta?: number;
}

export function ProductItem({
  product,
  viewMode,
  inCart,
  isFavorite,
  isCompared,
  finalPrice,
  formatPrice,
  onAddQty,
  onRemoveFromCart,
  onToggleFavorite,
  onToggleCompare,
  onSelect,
  isPosProduct,
  wasAdded,
  purchaseHistoryCount = 0,
  lastPurchaseUnitPriceDelta = 0,
}: ProductItemProps) {
  const available = Math.max(0, product.stock - (product.stock_reserved ?? 0));
  const outOfStock = available === 0;
  const [imageSrc, setImageSrc] = useState(() => resolveProductImageUrl(product.image));
  const handlePreviewIntent = () => preloadProductImage(product.image);

  useEffect(() => {
    setImageSrc(resolveProductImageUrl(product.image));
  }, [product.image]);

  if (viewMode === "grid") {
    return (
      <SurfaceCard
        tone="glass"
        padding="md"
        className={cn(
          "group relative flex h-full flex-col gap-2.5 overflow-hidden rounded-[22px] transition-all duration-200",
          outOfStock && "opacity-60",
          wasAdded && "ring-1 ring-primary/30 shadow-md shadow-primary/10",
        )}
        onMouseEnter={handlePreviewIntent}
        onFocusCapture={handlePreviewIntent}
      >
        {product.featured ? <div className="pointer-events-none absolute inset-0 glow-sm" /> : null}

        <div className="cursor-pointer space-y-3" onClick={() => onSelect(product)}>
          <div className="relative">
            <div className="flex h-28 w-full items-center justify-center rounded-2xl border border-border/70 bg-gradient-subtle transition-transform duration-300 group-hover:scale-[1.01]">
              <img
                src={imageSrc}
                alt={product.name}
                loading="lazy"
                decoding="async"
                onError={() => setImageSrc("/placeholder.png")}
                className="max-h-24 max-w-full object-contain p-2.5 drop-shadow-xl"
              />
            </div>

            {inCart > 0 ? (
              <Badge className="absolute right-3 top-3 rounded-full bg-primary text-primary-foreground shadow-sm">{inCart}</Badge>
            ) : null}

            {product.featured ? (
              <Badge variant="outline" className="absolute left-3 top-3 gap-1 rounded-full border-primary/40 text-primary shadow-sm">
                <Star size={12} className="fill-current" />
                Destacado
              </Badge>
            ) : null}

            <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 opacity-0 transition-all duration-200 group-hover:opacity-100">
              <Button
                variant={isCompared ? "soft" : "ghost"}
                size="sm"
                className="rounded-full border border-border/70 bg-background/80 backdrop-blur"
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleCompare(product.id);
                }}
              >
                {isCompared ? "Comparando" : "Comparar"}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn("rounded-full border border-border/70 bg-background/80 backdrop-blur", isFavorite && "border-amber-200/40 text-amber-400")}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleFavorite(product.id);
                }}
              >
                <Star size={16} className={isFavorite ? "fill-current" : undefined} />
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-foreground">{product.name}</h3>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {product.brand_name ? <Badge variant="secondary" className="text-[11px]">{product.brand_name}</Badge> : null}
              <span className="truncate">{product.category}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {product.sku ? <Badge variant="outline" className="font-mono text-[11px]">{product.sku}</Badge> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StockBadge stock={available} />
              {isPosProduct(product) ? (
                <Badge variant="outline" className="gap-1">
                  <Truck size={12} /> POS
                </Badge>
              ) : null}
              {purchaseHistoryCount > 0 ? (
                <Badge variant="secondary" className="text-[11px]">Compraste {purchaseHistoryCount}u</Badge>
              ) : null}
            </div>
          </div>

          <div className="flex items-end justify-between gap-2">
            <div>
              <div className="text-2xl font-bold leading-none tabular-nums text-primary">{formatPrice(finalPrice)}</div>
              <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Precio neto + IVA {product.iva_rate ?? 21}%</p>
              {lastPurchaseUnitPriceDelta > 0 ? (
                <p className="mt-1 text-xs font-semibold text-amber-500">+{lastPurchaseUnitPriceDelta.toFixed(1)}% vs ultima compra</p>
              ) : null}
            </div>

            {product.price_tiers?.length ? (
              <div className="group/tiers relative">
                <Button variant="soft" size="sm" className="rounded-full border border-primary/20 text-primary">
                  <TrendingUp size={14} />
                  Escala
                </Button>
                <div className="pointer-events-none absolute bottom-full right-0 mb-2 w-56 rounded-2xl border border-border/60 bg-card p-4 shadow-xl opacity-0 transition-all duration-200 group-hover/tiers:pointer-events-auto group-hover/tiers:-translate-y-1 group-hover/tiers:opacity-100">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Escala especial</p>
                  <div className="space-y-2 text-sm text-foreground">
                    {product.price_tiers.map((tier, index) => (
                      <div key={index} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {tier.min}
                          {tier.max ? `-${tier.max}` : "+"} unidades
                        </span>
                        <span className="font-semibold text-primary">{formatPrice(tier.price)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-auto pt-1">
          <QuickAddControl
            inCart={inCart}
            outOfStock={outOfStock}
            wasAdded={wasAdded}
            onAddQty={(qty) => onAddQty(product, qty)}
            onRemoveOne={() => onRemoveFromCart(product)}
          />
        </div>
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard
      tone="default"
      padding="md"
      className={cn(
        "group relative flex items-center gap-3 rounded-[22px] transition-all duration-200",
        product.featured && "border-primary/40 shadow-md shadow-primary/10",
        outOfStock && "opacity-60",
        wasAdded && "ring-1 ring-primary/25 shadow-sm shadow-primary/10",
      )}
      onMouseEnter={handlePreviewIntent}
      onFocusCapture={handlePreviewIntent}
    >
      <div className="flex min-w-0 flex-1 cursor-pointer items-center gap-3" onClick={() => onSelect(product)}>
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-secondary/60">
          <img src={imageSrc} alt={product.name} loading="lazy" decoding="async" onError={() => setImageSrc("/placeholder.png")} className="max-h-12 max-w-12 object-contain" />
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">{product.name}</p>
            {product.featured ? <Star size={12} className="text-amber-400" fill="currentColor" /> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {product.brand_name ? <Badge variant="secondary" className="text-[11px]">{product.brand_name}</Badge> : null}
            <span>{product.category}</span>
            <StockBadge stock={available} />
            {isPosProduct(product) ? (
              <Badge variant="outline" className="gap-1 text-[11px]">
                <Truck size={11} /> POS
              </Badge>
            ) : null}
            {product.sku ? <Badge variant="secondary" className="font-mono text-[11px]">{product.sku}</Badge> : null}
          </div>
        </div>

        <div className="hidden min-w-[156px] shrink-0 text-right sm:block">
          <div className="text-xl font-bold leading-none tabular-nums text-primary">{formatPrice(finalPrice)}</div>
          <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Neto + IVA {product.iva_rate ?? 21}%</div>
          {lastPurchaseUnitPriceDelta > 0 ? <div className="text-[11px] font-semibold text-amber-500">+{lastPurchaseUnitPriceDelta.toFixed(1)}% vs ultima compra</div> : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="icon" className={cn("hidden sm:flex", isCompared && "text-primary")} onClick={() => onToggleCompare(product.id)} title="Comparar">
          <TrendingUp size={14} />
        </Button>
        <Button variant="ghost" size="icon" className={cn("hidden sm:flex", isFavorite && "text-amber-400")} onClick={() => onToggleFavorite(product.id)} title="Favorito">
          <Star size={14} className={isFavorite ? "fill-current" : undefined} />
        </Button>
        <QuickAddControl
          inCart={inCart}
          outOfStock={outOfStock}
          wasAdded={wasAdded}
          compact
          onAddQty={(qty) => onAddQty(product, qty)}
          onRemoveOne={() => onRemoveFromCart(product)}
        />
      </div>
    </SurfaceCard>
  );
}
