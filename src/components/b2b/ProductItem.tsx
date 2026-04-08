import { useEffect, useState } from "react";
import { Star, TrendingUp, Truck, Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { preloadProductImage, resolveProductImageUrl } from "@/lib/productImage";
import { cn } from "@/lib/utils";
import { StockBadge } from "./StockBadge";
import { QuickAddControl } from "./QuickAddControl";
import type { Product } from "@/models/products";

function resolveCommercialSignals(product: Product, available: number) {
  return [
    available > 0 ? `Entrega ${available > 5 ? "inmediata" : "sujeta a confirmación"}` : "Bajo consulta",
    product.supplier_name ? `Origen ${product.supplier_name}` : "Canal partner",
    product.min_order_qty && product.min_order_qty > 1 ? `Min. ${product.min_order_qty}u` : "Venta unitaria",
  ];
}

interface ProductItemProps {
  product: Product;
  viewMode: "grid" | "list";
  inCart: number;
  isFavorite: boolean;
  isCompared: boolean;
  finalPrice: number;
  formatPrice: (p: number) => string;
  originalPrice?: number;
  isOffer?: boolean;
  offerPercent?: number;
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
  originalPrice,
  isOffer,
  offerPercent,
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
  const commercialSignals = resolveCommercialSignals(product, available);
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

            <div className="absolute left-3 top-3 flex flex-col gap-1.5 items-start">
              {product.featured ? (
                <Badge variant="outline" className="gap-1 rounded-full border-primary/40 text-primary shadow-sm bg-background/90 backdrop-blur-sm px-2 py-0.5 h-auto text-[10px]">
                  <Star size={10} className="fill-current" />
                  Destacado
                </Badge>
              ) : null}
              {isOffer && offerPercent && offerPercent > 0 ? (
                <Badge className="gap-1 rounded-full bg-orange-600 text-white shadow-sm border-none hover:bg-orange-600 px-2 py-0.5 h-auto text-[10px]">
                  <Flame size={10} fill="currentColor" /> {offerPercent.toFixed(1)}% OFF
                </Badge>
              ) : null}
            </div>

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

          <div className="flex flex-col flex-1 mt-2">
            {product.brand_name ? (
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1 leading-none">
                {product.brand_name}
              </span>
            ) : null}
            <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-foreground mb-3">{product.name}</h3>
            
            <div className="flex flex-col gap-2.5 mt-auto">
              <div className="flex flex-wrap items-center gap-2">
                {product.sku ? <span className="font-mono text-[10px] text-muted-foreground/80 bg-muted/50 border border-border/50 px-1.5 py-0.5 rounded-md">{product.sku}</span> : null}
                <span className="text-[11px] text-muted-foreground truncate">{product.category}</span>
              </div>
              <div className="flex items-center gap-2">
                <StockBadge stock={available} />
                {isPosProduct(product) ? (
                  <Badge variant="outline" className="gap-1 bg-background text-[10px]">
                    <Truck size={10} /> POS
                  </Badge>
                ) : null}
                {purchaseHistoryCount > 0 ? (
                  <Badge variant="secondary" className="text-[10px] bg-secondary/80">Compraste {purchaseHistoryCount}u</Badge>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {commercialSignals.map((signal) => (
                  <span key={signal} className="rounded-full bg-secondary/30 px-2 py-0.5 border border-border/40 text-[9px] font-medium text-muted-foreground">
                    {signal}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 mt-3 pt-3 border-t border-border/40">

            <div className="flex items-end justify-between gap-2">
              <div>
                {isOffer && originalPrice && originalPrice > finalPrice ? (
                  <div className="mb-0.5 text-[11px] font-medium leading-none text-muted-foreground/60 line-through tabular-nums">
                    Antes: {formatPrice(originalPrice)}
                  </div>
                ) : null}
                <div className={cn(
                  "text-3xl font-extrabold leading-none tabular-nums",
                  isOffer ? "text-orange-600" : "text-primary"
                )}>
                  {formatPrice(finalPrice)}
                </div>
                <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Precio + IVA</p>
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
    <div
      className={cn(
        "group relative flex flex-col sm:flex-row items-stretch gap-0 overflow-hidden rounded-xl border transition-all duration-200 border-l-[3px] shadow-sm hover:shadow-md",
        product.featured ? "border-l-primary/60 border-t-border/50 border-r-border/50 border-b-border/50" : "border-l-primary/0 border-border/50",
        outOfStock && "opacity-60 grayscale-[10%]",
        wasAdded ? "bg-primary/5 border-primary/20" : "bg-card hover:bg-white/5"
      )}
      onMouseEnter={handlePreviewIntent}
      onFocusCapture={handlePreviewIntent}
    >
      <div 
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-4 py-2 pl-3 pr-2" 
        onClick={() => onSelect(product)}
      >
        <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg border border-border/70 bg-white shadow-sm transition-transform group-hover:scale-[1.02]">
          <img src={imageSrc} alt={product.name} loading="lazy" decoding="async" onError={() => setImageSrc("/placeholder.png")} className="max-h-10 max-w-10 object-contain drop-shadow-sm" />
        </div>

        <div className="min-w-0 flex-1 py-1">
          <div className="flex items-center gap-2 mb-0.5">
            {product.brand_name ? (
               <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 leading-none">
                 {product.brand_name}
               </span>
            ) : null}
            {product.sku ? <span className="font-mono text-[9px] bg-muted border border-border/50 px-1 rounded text-muted-foreground">{product.sku}</span> : null}
          </div>
          
          <div className="flex items-center gap-2 mb-1">
            <p className="truncate text-[13px] font-bold text-foreground leading-tight">{product.name}</p>
            {product.featured ? <Star size={10} className="text-amber-400 shrink-0" fill="currentColor" /> : null}
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <StockBadge stock={available} />
            <span className="text-[10px] text-muted-foreground">{product.category}</span>
            {isPosProduct(product) ? (
              <Badge variant="outline" className="gap-1 text-[9px] h-4 px-1 bg-background text-muted-foreground">
                <Truck size={8} /> POS
              </Badge>
            ) : null}
            {commercialSignals.map((signal) => (
              <span key={signal} className="rounded-sm bg-secondary/40 px-1 py-0 border border-border/40 text-[9px] font-medium text-muted-foreground">
                {signal}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="hidden min-w-[130px] shrink-0 sm:flex flex-col items-end justify-center py-2 px-4 border-l border-border/50 bg-muted/10">
        {isOffer && offerPercent && offerPercent > 0 ? (
          <div className="mb-0.5 inline-flex items-center gap-1 rounded bg-orange-600 px-1.5 py-0.5 text-[9px] font-black uppercase text-white ring-1 ring-orange-500/20 shadow-sm">
            <Flame size={8} fill="currentColor" />
            {offerPercent.toFixed(1)}% OFF
          </div>
        ) : null}
        {isOffer && originalPrice && originalPrice > finalPrice ? (
          <div className="mb-0.5 text-[10px] font-medium text-muted-foreground/60 line-through tabular-nums">
            {formatPrice(originalPrice)}
          </div>
        ) : null}
        <div className={cn(
          "text-[17px] font-black leading-none tabular-nums",
          isOffer ? "text-orange-600" : "text-primary"
        )}>
          {formatPrice(finalPrice)}
        </div>
        <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">Precio + IVA</div>
        {lastPurchaseUnitPriceDelta > 0 ? <div className="text-[10px] mt-1 font-semibold text-amber-500">+{lastPurchaseUnitPriceDelta.toFixed(1)}% vs anterior</div> : null}
      </div>

      <div className="flex w-full shrink-0 items-center justify-between gap-2 border-t border-border/50 bg-muted/10 px-3 py-2 sm:w-[130px] sm:justify-end sm:gap-1 sm:border-l sm:border-t-0 sm:pr-3">
        <div className="min-w-0 sm:hidden">
          {isOffer && originalPrice && originalPrice > finalPrice ? (
            <div className="mb-0.5 text-[10px] font-medium text-muted-foreground/60 line-through tabular-nums">
              {formatPrice(originalPrice)}
            </div>
          ) : null}
          <div className={cn(
            "text-sm font-black leading-none tabular-nums",
            isOffer ? "text-orange-600" : "text-primary"
          )}>
            {formatPrice(finalPrice)}
          </div>
          <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">Precio + IVA</div>
        </div>
        <Button variant="ghost" size="icon" className={cn("hidden lg:flex h-8 w-8", isCompared && "text-primary")} onClick={() => onToggleCompare(product.id)} title="Comparar">
          <TrendingUp size={13} />
        </Button>
        <Button variant="ghost" size="icon" className={cn("hidden lg:flex h-8 w-8", isFavorite && "text-amber-400")} onClick={() => onToggleFavorite(product.id)} title="Favorito">
          <Star size={13} className={isFavorite ? "fill-current" : undefined} />
        </Button>
        <div className="min-w-0 sm:origin-right sm:scale-[0.85]">
          <QuickAddControl
            inCart={inCart}
            outOfStock={outOfStock}
            wasAdded={wasAdded}
            compact
            onAddQty={(qty) => onAddQty(product, qty)}
            onRemoveOne={() => onRemoveFromCart(product)}
          />
        </div>
      </div>
    </div>
  );
}
