import { useEffect, useMemo, useState } from "react";
import { Star, TrendingUp, Truck, Flame, CalendarClock, ShieldCheck, ListPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { preloadProductImage, resolveProductImageUrl } from "@/lib/productImage";
import { cn } from "@/lib/utils";
import { StockBadge } from "./StockBadge";
import { DeliveryEstimate } from "./DeliveryEstimate";
import { WarrantyBadge } from "./WarrantyBadge";
import { QuickAddControl } from "./QuickAddControl";
import type { Product } from "@/models/products";

/** Devuelve el próximo día hábil desde hoy + `daysToAdd` días hábiles */
function nextBusinessDay(daysToAdd: number): string {
  const d = new Date();
  let added = 0;
  while (added < daysToAdd) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d.toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" });
}

function resolveDeliveryLabel(available: number): string | null {
  if (available <= 0) return null;
  const days = available >= 5 ? 1 : 2;
  return `Llega ${nextBusinessDay(days)}`;
}

function resolveCommercialSignals(product: Product, available: number) {
  return [
    product.min_order_qty && product.min_order_qty > 1 ? `Min. ${product.min_order_qty}u` : "Venta unitaria",
  ].filter(Boolean);
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
  onAddToList?: (product: Product) => void;
  computePrice?: (product: Product, qty: number) => { unitPrice: number };
  isCustomPrice?: boolean;
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
  onAddToList,
  computePrice,
  isCustomPrice = false,
}: ProductItemProps) {
  const available = Math.max(0, product.stock - (product.stock_reserved ?? 0));
  const outOfStock = available === 0;
  const commercialSignals = resolveCommercialSignals(product, available);
  const [imageSrc, setImageSrc] = useState(() => resolveProductImageUrl(product.image));
  const handlePreviewIntent = () => preloadProductImage(product.image);

  const volumeTiers = useMemo(() => {
    if (!computePrice || finalPrice <= 0) return [];
    const thresholds = [
      { qty: 5, label: "5u+" },
      { qty: 10, label: "10u+" },
      { qty: 25, label: "25u+" },
    ];
    return thresholds
      .map(({ qty, label }) => ({ label, price: computePrice(product, qty).unitPrice }))
      .filter(({ price }) => Math.abs(price - finalPrice) / finalPrice > 0.004);
  }, [computePrice, product, finalPrice]);

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
              {isCustomPrice ? (
                <Badge className="gap-1 rounded-full bg-emerald-600 text-white shadow-sm border-none hover:bg-emerald-600 px-2 py-0.5 h-auto text-[10px]">
                  <ShieldCheck size={9} /> Precio pactado
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
              <div className="flex flex-wrap items-center gap-1.5">
                <StockBadge stock={available} />

                {resolveDeliveryLabel(available) ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/20 bg-sky-500/8 px-2 py-0.5 text-[10px] font-semibold text-sky-600 dark:text-sky-400 shrink-0">
                    <CalendarClock size={9} />
                    {resolveDeliveryLabel(available)}
                  </span>
                ) : null}

                {product.supplier_name ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-teal-500/20 bg-teal-500/8 px-2 py-0.5 text-[10px] font-semibold text-teal-600 dark:text-teal-400 shrink-0">
                    <ShieldCheck size={9} />
                    Garantía oficial
                  </span>
                ) : null}

                {product.min_order_qty && product.min_order_qty > 1 ? (
                  <span className="inline-flex items-center rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-600 dark:text-violet-400 shrink-0">
                    Mín. {product.min_order_qty}u
                  </span>
                ) : (
                  <span className="rounded-full border border-border/50 bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground">
                    Venta unitaria
                  </span>
                )}

                {isPosProduct(product) ? (
                  <Badge variant="outline" className="gap-1 bg-background text-[10px]">
                    <Truck size={10} /> POS
                  </Badge>
                ) : null}
                {purchaseHistoryCount > 0 ? (
                  <Badge variant="secondary" className="text-[10px] bg-secondary/80">Compraste {purchaseHistoryCount}u</Badge>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 mt-3 pt-3 border-t border-border/40">

            <div className="flex flex-col gap-2">
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
              </div>

              {product.price_tiers?.length ? (
                <div className="rounded-xl border border-primary/15 bg-primary/5 px-3 py-2">
                  <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-primary/70 flex items-center gap-1">
                    <TrendingUp size={9} /> Precio por volumen
                  </p>
                  <div className="space-y-1">
                    {product.price_tiers.slice(0, 2).map((tier, index) => (
                      <div key={index} className="flex items-center justify-between text-[10px]">
                        <span className="text-muted-foreground">
                          {tier.min}{tier.max ? `–${tier.max}` : "+"} u
                        </span>
                        <span className="font-bold text-primary tabular-nums">{formatPrice(tier.price)}</span>
                      </div>
                    ))}
                    {product.price_tiers.length > 2 ? (
                      <p className="text-[9px] text-muted-foreground/60">+{product.price_tiers.length - 2} escalas más</p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-auto pt-1">
          {onAddToList ? (
            <Button
              type="button"
              variant="outline"
              className="mb-2 h-9 w-full rounded-xl text-xs font-semibold"
              onClick={(event) => {
                event.stopPropagation();
                onAddToList(product);
              }}
            >
              <ListPlus size={14} />
              Agregar a lista
            </Button>
          ) : null}
          <QuickAddControl
            inCart={inCart}
            outOfStock={outOfStock}
            wasAdded={wasAdded}
            minQty={product.min_order_qty ?? 1}
            onAddQty={(qty) => onAddQty(product, qty)}
            onRemoveOne={() => onRemoveFromCart(product)}
            onNotifyClick={outOfStock ? () => onSelect(product) : undefined}
            showShortcuts
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
          
          <div className="flex flex-wrap items-center gap-1.5">
            <StockBadge stock={available} size="md" />

            {/* Fecha estimada de entrega */}
            {resolveDeliveryLabel(available) ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/20 bg-sky-500/8 px-2 py-0.5 text-[10px] font-semibold text-sky-600 dark:text-sky-400 shrink-0">
                <CalendarClock size={10} />
                {resolveDeliveryLabel(available)}
              </span>
            ) : null}

            {/* Garantía oficial — cuando viene de proveedor oficial */}
            {product.supplier_name ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-teal-500/20 bg-teal-500/8 px-2 py-0.5 text-[10px] font-semibold text-teal-600 dark:text-teal-400 shrink-0">
                <ShieldCheck size={10} />
                Garantía oficial
              </span>
            ) : null}

            {/* Categoría */}
            <span className="rounded-full border border-border/50 bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground">
              {product.category}
            </span>

            {/* MOQ / Venta unitaria */}
            {product.min_order_qty && product.min_order_qty > 1 ? (
              <span className="inline-flex items-center rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-600 dark:text-violet-400 shrink-0">
                Mín. {product.min_order_qty}u
              </span>
            ) : (
              <span className="rounded-full border border-border/50 bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground">
                Venta unitaria
              </span>
            )}

            {isPosProduct(product) ? (
              <Badge variant="outline" className="gap-1 text-[9px] h-4 px-1 bg-background text-muted-foreground">
                <Truck size={8} /> POS
              </Badge>
            ) : null}
            {isCustomPrice ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                <ShieldCheck size={9} /> Precio pactado
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="hidden min-w-[136px] shrink-0 border-l border-border/50 bg-muted/10 px-4 py-2 sm:flex sm:flex-col sm:items-end sm:justify-center lg:min-w-[148px]">
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
        {volumeTiers.length > 0 ? (
          <div className="mt-2 space-y-0.5 border-t border-border/40 pt-1.5">
            <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-primary/50">Volumen</p>
            {volumeTiers.slice(0, 2).map(({ label, price }) => (
              <div key={label} className="flex items-center justify-between gap-2 text-[10px]">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{formatPrice(price)}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex w-full flex-wrap items-center justify-between gap-2 border-t border-border/50 bg-muted/10 px-3 py-2 sm:w-auto sm:min-w-[184px] sm:justify-end sm:gap-2 sm:border-l sm:border-t-0 sm:px-3 lg:min-w-[190px] xl:min-w-[246px]">
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
        <Button variant="ghost" size="icon" className={cn("hidden xl:flex h-8 w-8", isCompared && "text-primary")} onClick={() => onToggleCompare(product.id)} title="Comparar">
          <TrendingUp size={13} />
        </Button>
        <Button variant="ghost" size="icon" className={cn("hidden xl:flex h-8 w-8", isFavorite && "text-amber-400")} onClick={() => onToggleFavorite(product.id)} title="Favorito">
          <Star size={13} className={isFavorite ? "fill-current" : undefined} />
        </Button>
        {onAddToList ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 rounded-lg px-2 text-xs"
            onClick={() => onAddToList(product)}
            title="Agregar a lista"
          >
            <ListPlus size={13} />
            Lista
          </Button>
        ) : null}
        <div className="shrink-0">
          <QuickAddControl
            inCart={inCart}
            outOfStock={outOfStock}
            wasAdded={wasAdded}
            compact
            minQty={product.min_order_qty ?? 1}
            onAddQty={(qty) => onAddQty(product, qty)}
            onRemoveOne={() => onRemoveFromCart(product)}
            onNotifyClick={outOfStock ? () => onSelect(product) : undefined}
          />
        </div>
      </div>
    </div>
  );
}
