import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, Star, X, Flame } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SmartCompatibility } from "@/components/b2b/SmartCompatibility";
import { StockBadge } from "@/components/b2b/StockBadge";
import { DeliveryEstimate } from "@/components/b2b/DeliveryEstimate";
import { WarrantyBadge } from "@/components/b2b/WarrantyBadge";
import { RelatedProducts } from "@/components/b2b/RelatedProducts";
import { PriceHistoryChart } from "@/components/b2b/PriceHistoryChart";
import { PriceSparkline } from "@/components/PriceSparkline";
import type { PriceResult } from "@/hooks/usePricing";
import { getAvailableStock } from "@/lib/pricing";
import { resolveProductImageUrl } from "@/lib/productImage";
import type { Product } from "@/models/products";

const HIDDEN_SPEC_PREFIXES = ["elit_", "air_", "invid_", "supplier_", "preferred_supplier_", "sync_", "internal_", "provider_"];
const HIDDEN_SPEC_TOKENS = [
  "cost",
  "precio_costo",
  "precio_compra",
  "markup",
  "pvp",
  "exchange",
  "cotizacion",
  "external_id",
  "uuid",
  "token",
  "source",
  "last_update",
  "stock_cd",
  "stock_total",
  "stock_deposito",
  "lug_stock",
  "link",
];

function isClientVisibleSpecKey(rawKey: string): boolean {
  const key = rawKey.trim().toLowerCase();
  if (!key) return false;
  if (HIDDEN_SPEC_PREFIXES.some((prefix) => key.startsWith(prefix))) return false;
  if (HIDDEN_SPEC_TOKENS.some((token) => key.includes(token))) return false;
  return true;
}

function formatSpecLabel(rawKey: string): string {
  const withSpaces = rawKey.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

function formatSpecValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map((item) => String(item ?? "")).join(", ");
  if (typeof value === "object") return formatStructuredSpecValue(value as Record<string, unknown>);
  return formatStructuredSpecValue(String(value));
}

function formatStructuredSpecValue(rawValue: string | Record<string, unknown>): string {
  const value = typeof rawValue === "string" ? rawValue.trim() : rawValue;
  if (!value) return "";

  const parsedObject = typeof value === "string" ? tryParseStructuredSpec(value) : value;
  if (parsedObject && typeof parsedObject === "object" && !Array.isArray(parsedObject)) {
    return formatObjectSpecValue(parsedObject);
  }

  if (typeof value === "string") {
    return stripHtml(value);
  }

  return JSON.stringify(value);
}

function tryParseStructuredSpec(value: string): Record<string, unknown> | null {
  if (!(value.startsWith("{") && value.endsWith("}"))) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function formatObjectSpecValue(record: Record<string, unknown>): string {
  const unit = typeof record.unit === "string" ? record.unit.trim() : "";

  if ("value" in record && typeof record.value !== "object") {
    return [String(record.value).trim(), unit].filter(Boolean).join(" ");
  }

  const orderedDimensionKeys = ["width", "height", "length", "depth"];
  const dimensions = orderedDimensionKeys
    .filter((key) => record[key] !== undefined && record[key] !== null && String(record[key]).trim())
    .map((key) => String(record[key]).trim());

  if (dimensions.length >= 2) {
    return [dimensions.join(" x "), unit].filter(Boolean).join(" ");
  }

  return Object.entries(record)
    .filter(([key, entryValue]) => key !== "unit" && entryValue !== null && entryValue !== undefined && String(entryValue).trim())
    .map(([key, entryValue]) => `${formatSpecLabel(key)}: ${stripHtml(String(entryValue).trim())}`)
    .join(" · ");
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function findCommercialSpec(product: Product, candidates: string[]) {
  const entry = Object.entries(product.specs ?? {}).find(([key]) => {
    const normalized = key.trim().toLowerCase();
    return candidates.some((candidate) => normalized.includes(candidate));
  });

  return entry ? formatSpecValue(entry[1]) : null;
}

export interface ProductDetailModalProps {
  product: Product;
  inCart: number;
  computePrice: (p: Product, qty: number) => PriceResult;
  formatPrice: (n: number) => string;
  formatARS: (n: number) => string;
  formatUSD: (n: number) => string;
  currency: "ARS" | "USD";
  setCurrency: (c: "ARS" | "USD") => void;
  isDark: boolean;
  onClose: () => void;
  onAddToCart: (p: Product) => void;
  onRemoveFromCart: (p: Product) => void;
  onSelectProduct?: (p: Product) => void;
  allProducts?: Product[];
  profileId?: string | null;
  purchaseHistoryCount?: number;
}

export function ProductDetailModal({
  product,
  inCart,
  computePrice,
  formatPrice,
  formatARS,
  formatUSD,
  currency,
  setCurrency,
  isDark,
  onClose,
  onAddToCart,
  onRemoveFromCart,
  onSelectProduct,
  allProducts = [],
  profileId,
  purchaseHistoryCount = 0,
}: ProductDetailModalProps) {
  const SPEC_PREVIEW_LIMIT = 20;
  const SPEC_VIRTUALIZE_THRESHOLD = 80;
  const SPEC_ROW_HEIGHT = 52;
  const SPEC_OVERSCAN = 6;
  const ANIMATION_MS = 140;
  const priceInfo = computePrice(product, Math.max(inCart, 1));
  const { unitPrice, ivaAmount, ivaRate, totalWithIVA, originalUnitPrice, isOffer, calculatedOfferPercent } = priceInfo;
  const availableStock = getAvailableStock(product);
  const outOfStock = availableStock === 0;
  const warrantyLabel = findCommercialSpec(product, ["garantia", "warranty"]) ?? "Garantía oficial de fábrica";
  const deliveryLabel = findCommercialSpec(product, ["lead_time", "entrega", "plazo"])
    ?? (availableStock > 0 ? "Entrega inmediata / stock operativo" : "Entrega bajo confirmación comercial");
  const priceStatusLabel = isOffer ? "Precio promocional vigente" : "Precio mayorista visible para tu cuenta";
  const commercialSignals = [
    { label: "Stock", value: availableStock > 0 ? `${availableStock} unidades operativas` : "Sin stock inmediato" },
    { label: "Entrega", value: deliveryLabel },
    { label: "Garantía", value: warrantyLabel },
    { label: "Condición", value: product.min_order_qty && product.min_order_qty > 1 ? `Pedido mínimo ${product.min_order_qty} unidades` : "Venta directa disponible" },
  ];
  const [imageSrc, setImageSrc] = useState(() => resolveProductImageUrl(product.image));
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [compatibilityReady, setCompatibilityReady] = useState(false);
  const [compatibilityInView, setCompatibilityInView] = useState(true);
  const [showAllSpecs, setShowAllSpecs] = useState(false);
  const [specScrollTop, setSpecScrollTop] = useState(0);
  const [showStickyBar, setShowStickyBar] = useState(false);
  const [showPriceHistory, setShowPriceHistory] = useState(false);
  const modalScrollRef = useRef<HTMLDivElement | null>(null);
  const compatibilityRef = useRef<HTMLDivElement | null>(null);
  const ctaRef = useRef<HTMLDivElement | null>(null);

  const publicSpecs = useMemo(() => (
    product.specs
      ? Object.entries(product.specs)
          .filter(([key]) => isClientVisibleSpecKey(key))
          .map(([key, value]) => ({
            key,
            label: formatSpecLabel(key),
            value: formatSpecValue(value),
          }))
          .filter((entry) => entry.value.trim().length > 0)
      : []
  ), [product.specs]);

  const visibleSpecs = showAllSpecs ? publicSpecs : publicSpecs.slice(0, SPEC_PREVIEW_LIMIT);
  const shouldVirtualizeSpecs = showAllSpecs && publicSpecs.length > SPEC_VIRTUALIZE_THRESHOLD;
  const specViewportHeight = Math.min(publicSpecs.length, 7) * SPEC_ROW_HEIGHT;
  const virtualStartIndex = shouldVirtualizeSpecs
    ? Math.max(0, Math.floor(specScrollTop / SPEC_ROW_HEIGHT) - SPEC_OVERSCAN)
    : 0;
  const virtualEndIndex = shouldVirtualizeSpecs
    ? Math.min(publicSpecs.length, Math.ceil((specScrollTop + specViewportHeight) / SPEC_ROW_HEIGHT) + SPEC_OVERSCAN)
    : visibleSpecs.length;
  const virtualSpecs = shouldVirtualizeSpecs
    ? publicSpecs.slice(virtualStartIndex, virtualEndIndex)
    : visibleSpecs;

  useEffect(() => {
    setImageSrc(resolveProductImageUrl(product.image));
  }, [product.image]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    setShowAllSpecs(false);
    setCompatibilityReady(false);
    setCompatibilityInView(true);
    setIsClosing(false);
    setSpecScrollTop(0);

    const raf = window.requestAnimationFrame(() => setIsVisible(true));
    const timer = window.setTimeout(() => setCompatibilityReady(true), 180);

    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [product.id]);

  useEffect(() => {
    if (!compatibilityRef.current || !modalScrollRef.current) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setCompatibilityInView(entry.isIntersecting || entry.intersectionRatio > 0.05);
      },
      {
        root: modalScrollRef.current,
        threshold: [0, 0.05, 0.2],
      },
    );

    observer.observe(compatibilityRef.current);
    return () => observer.disconnect();
  }, [product.id, compatibilityReady]);

  // Sticky bar observer — watches main CTA to toggle sticky bar
  useEffect(() => {
    if (!ctaRef.current || !modalScrollRef.current) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowStickyBar(!entry.isIntersecting);
      },
      {
        root: modalScrollRef.current,
        threshold: 0,
      },
    );

    observer.observe(ctaRef.current);
    return () => observer.disconnect();
  }, [product.id]);

  function handleRequestClose() {
    if (isClosing) return;
    setIsClosing(true);
    setIsVisible(false);
    window.setTimeout(() => onClose(), ANIMATION_MS);
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3 transition-opacity duration-150 md:p-4",
        isVisible ? "opacity-100" : "opacity-0",
      )}
      onClick={handleRequestClose}
    >
      <div
        className={cn(
          "flex max-h-[88vh] w-full max-w-[960px] flex-col overflow-hidden rounded-[24px] border border-border/70 bg-card text-card-foreground shadow-2xl shadow-black/25 transition-transform duration-150 will-change-transform",
          isVisible ? "translate-y-0 scale-100" : "translate-y-2 scale-[0.985]",
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/70 bg-card px-4 py-3 md:px-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-border/70 bg-surface text-muted-foreground">
              {product.category}
            </Badge>
            {product.featured ? (
              <Badge variant="outline" className="gap-1 border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Star size={10} fill="currentColor" />
                Destacado
              </Badge>
            ) : null}
          </div>
          <Button variant="ghost" size="icon" onClick={handleRequestClose}>
            <X size={16} />
          </Button>
        </div>

        <div ref={modalScrollRef} className="flex-1 overflow-y-auto overscroll-contain">
          <div className="grid gap-4 px-4 py-4 md:grid-cols-[240px_minmax(0,1fr)] md:px-5">
            <div className="space-y-3">
              <div className="flex h-48 items-center justify-center rounded-2xl border border-border/70 bg-surface/70 p-4 md:sticky md:top-4">
                <img
                  src={imageSrc}
                  alt={product.name}
                  onError={() => setImageSrc("/placeholder.png")}
                  className="max-h-40 max-w-full object-contain drop-shadow-lg"
                />
              </div>
              <div ref={compatibilityRef}>
                {compatibilityReady ? (
                  compatibilityInView ? (
                    <SmartCompatibility productId={product.id} isDark={isDark} onAddToCart={onAddToCart} formatPrice={formatPrice} />
                  ) : (
                    <div className="flex min-h-24 items-center justify-center rounded-2xl border border-dashed border-border/60 bg-surface/30 px-4 py-3 text-center text-[11px] text-muted-foreground">
                      Compatibilidad pausada hasta volver a esta seccion.
                    </div>
                  )
                ) : (
                  <div className="h-24 w-full animate-pulse rounded-2xl border border-border/50 bg-surface/50" />
                )}
              </div>
            </div>

            <div className="min-w-0 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-2">
                  <h2 className="text-lg font-extrabold leading-tight text-foreground">{product.name}</h2>
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    {product.sku ? (
                      <Badge variant="outline" className="border-border/70 bg-card font-mono text-muted-foreground">
                        SKU: {product.sku}
                      </Badge>
                    ) : null}
                    {availableStock > 0 ? <span className="text-muted-foreground">{availableStock} disponibles</span> : null}
                    {product.stock_min && product.stock_min > 0 ? <span className="text-muted-foreground">min. {product.stock_min}</span> : null}
                    {purchaseHistoryCount > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        ✓ Ya compraste este producto · {purchaseHistoryCount} {purchaseHistoryCount === 1 ? "vez" : "veces"}
                      </span>
                    ) : null}
                  </div>
                </div>
                <StockBadge stock={product.stock} />
              </div>

              <div className="rounded-2xl border border-border/70 bg-surface/70 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-col gap-1.5">
                      {isOffer && calculatedOfferPercent && calculatedOfferPercent > 0 ? (
                        <div className="inline-flex max-w-fit items-center gap-1 rounded-lg bg-orange-600 px-2 py-1 text-[10px] font-black uppercase text-white shadow-sm ring-1 ring-orange-500/10">
                          <Flame size={10} fill="currentColor" />
                          {calculatedOfferPercent.toFixed(1)}% OFF
                        </div>
                      ) : null}

                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[11px] text-muted-foreground">{isOffer ? "Oferta especial" : "Precio unitario"}</span>
                        <div className="text-right">
                          {isOffer && originalUnitPrice && originalUnitPrice > unitPrice ? (
                            <div className="mb-0.5 text-[11px] font-medium leading-none text-muted-foreground/60 line-through tabular-nums">
                              Antes: {formatPrice(originalUnitPrice)}
                            </div>
                          ) : null}
                          <span className={cn(
                            "text-2xl font-black tabular-nums",
                            isOffer ? "text-orange-600" : "text-primary"
                          )}>
                            {formatPrice(unitPrice)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] text-muted-foreground">IVA ({ivaRate}%)</span>
                      <span className="text-sm font-semibold tabular-nums text-muted-foreground">+ {formatPrice(ivaAmount)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-2">
                      <span className="text-[11px] font-semibold text-foreground">Precio final</span>
                      <span className="text-base font-extrabold tabular-nums text-foreground">{formatPrice(totalWithIVA)}</span>
                    </div>
                    <div className="font-mono text-[10px] text-muted-foreground">
                      {currency === "USD" ? formatARS(totalWithIVA) : formatUSD(totalWithIVA)}
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-card/80 px-3 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Lectura comercial</p>
                      <p className="mt-2 text-sm font-semibold text-foreground">{priceStatusLabel}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Precio con IVA visible para decidir rápido si avanzás por compra directa o por cotización.
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <div className="mb-1 text-[10px] text-muted-foreground">Moneda</div>
                    <div className="flex items-center gap-1 rounded-lg border border-border/70 bg-card p-1">
                      {(["USD", "ARS"] as const).map((value) => (
                        <button
                          key={value}
                          onClick={() => setCurrency(value)}
                          className={cn(
                            "rounded-md px-2 py-1 text-[11px] font-bold transition",
                            currency === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                          )}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 bg-surface/30 overflow-hidden">
                <div className="px-3 py-2 border-b border-border/50">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Información de compra</p>
                </div>
                <div className="divide-y divide-border/40">
                  <div className="px-3 py-3 flex items-center justify-between gap-3">
                    <span className="text-[11px] font-medium text-muted-foreground">Entrega</span>
                    <DeliveryEstimate stock={product.stock} stockReserved={product.stock_reserved} compact />
                  </div>
                  <div className="px-3 py-3 flex items-center justify-between gap-3">
                    <span className="text-[11px] font-medium text-muted-foreground">Garantía</span>
                    <WarrantyBadge product={product} compact />
                  </div>
                  <div className="px-3 py-3 flex items-center justify-between gap-3">
                    <span className="text-[11px] font-medium text-muted-foreground">Stock</span>
                    <span className="text-sm font-semibold text-foreground">
                      {availableStock > 0 ? `${availableStock} unidades disponibles` : "Sin stock inmediato"}
                    </span>
                  </div>
                  <div className="px-3 py-3 flex items-center justify-between gap-3">
                    <span className="text-[11px] font-medium text-muted-foreground">Condición</span>
                    <span className="text-sm font-semibold text-foreground">
                      {product.min_order_qty && product.min_order_qty > 1
                        ? `Pedido mínimo ${product.min_order_qty} unidades`
                        : "Venta directa disponible"}
                    </span>
                  </div>
                </div>
              </div>

              {product.price_tiers?.length ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Precio por volumen</p>
                  <div className="overflow-hidden rounded-2xl border border-border/70">
                    <div className="grid grid-cols-3 bg-surface px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                      <span>Cantidad</span>
                      <span className="text-center">Precio unit.</span>
                      <span className="text-right">Ahorro</span>
                    </div>
                    {product.price_tiers.map((tier, index) => {
                      const costBase = product.cost_price ?? tier.price;
                      const saving = costBase > 0 ? ((costBase - tier.price) / costBase) * 100 : 0;
                      const isActiveTier = inCart >= tier.min && (tier.max === null || inCart <= tier.max);

                      return (
                        <div
                          key={`${tier.min}-${tier.max ?? "plus"}`}
                          className={cn(
                            "grid grid-cols-3 px-3 py-2 text-xs",
                            isActiveTier
                              ? "bg-primary/10 text-primary"
                              : index % 2 === 0
                                ? "bg-card text-foreground"
                                : "bg-surface/60 text-foreground",
                          )}
                        >
                          <span className="font-medium">
                            {tier.min}
                            {tier.max ? `-${tier.max}` : "+"} u.
                            {isActiveTier ? <span className="ml-1 text-[9px] font-bold uppercase">actual</span> : null}
                          </span>
                          <span className="text-center font-bold tabular-nums">{formatPrice(tier.price)}</span>
                          <span className="text-right text-[10px]">
                            {saving > 0 ? <span className="font-semibold text-emerald-600 dark:text-emerald-400">-{saving.toFixed(0)}%</span> : "-"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {product.description ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Descripcion</p>
                  <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">{product.description}</p>
                </div>
              ) : null}

              {publicSpecs.length ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Especificaciones</p>
                  {shouldVirtualizeSpecs ? (
                    <div
                      className="overflow-y-auto overscroll-contain rounded-2xl border border-border/70"
                      style={{ maxHeight: `${specViewportHeight}px` }}
                      onScroll={(event) => setSpecScrollTop(event.currentTarget.scrollTop)}
                    >
                      <div className="relative" style={{ height: `${publicSpecs.length * SPEC_ROW_HEIGHT}px` }}>
                        {virtualSpecs.map((spec, index) => {
                          const actualIndex = virtualStartIndex + index;
                          return (
                            <div
                              key={spec.key}
                              className={cn(
                                "absolute inset-x-0 grid text-xs md:grid-cols-[220px_minmax(0,1fr)]",
                                actualIndex % 2 === 0 ? "bg-surface/60" : "bg-card",
                              )}
                              style={{
                                height: `${SPEC_ROW_HEIGHT}px`,
                                transform: `translateY(${actualIndex * SPEC_ROW_HEIGHT}px)`,
                              }}
                            >
                              <span className="flex items-center px-3 py-2 font-medium text-muted-foreground">{spec.label}</span>
                              <span
                                className="line-clamp-2 flex items-center break-words px-3 py-2 text-foreground"
                                title={spec.value}
                              >
                                {spec.value}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-2xl border border-border/70">
                      {visibleSpecs.map((spec, index) => (
                        <div key={spec.key} className={cn("grid text-xs md:grid-cols-[220px_minmax(0,1fr)]", index % 2 === 0 ? "bg-surface/60" : "bg-card")}>
                          <span className="px-3 py-2 font-medium text-muted-foreground">{spec.label}</span>
                          <span className="break-words px-3 py-2 text-foreground">{spec.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {publicSpecs.length > SPEC_PREVIEW_LIMIT ? (
                    <Button
                      variant="toolbar"
                      size="sm"
                      onClick={() => setShowAllSpecs((prev) => !prev)}
                    >
                      {showAllSpecs ? "Ver menos" : `Ver todas (${publicSpecs.length})`}
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {product.tags?.length ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {product.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="border-border/70 bg-surface text-muted-foreground">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="rounded-2xl border border-border/70 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowPriceHistory((prev) => !prev)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-muted/40"
                >
                  <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Historial de precio · 90 días
                  </span>
                  <svg
                    width="12" height="12" viewBox="0 0 12 12" fill="none"
                    className={cn("text-muted-foreground transition-transform", showPriceHistory ? "rotate-180" : "")}
                  >
                    <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                {showPriceHistory && (
                  <div className="border-t border-border/70 px-4 py-3">
                    <PriceSparkline productId={product.id} currentPrice={unitPrice} isDark={isDark} />
                  </div>
                )}
              </div>

              {profileId && purchaseHistoryCount > 0 ? (
                <PriceHistoryChart
                  productId={product.id}
                  profileId={profileId}
                  currentPrice={unitPrice}
                  formatPrice={formatPrice}
                />
              ) : null}
            </div>

              {/* Related Products */}
              {allProducts.length > 0 && (
                <RelatedProducts
                  currentProduct={product}
                  allProducts={allProducts}
                  computePrice={computePrice}
                  formatPrice={formatPrice}
                  onSelect={(p) => {
                    if (onSelectProduct) {
                      handleRequestClose();
                      window.setTimeout(() => onSelectProduct(p), ANIMATION_MS + 50);
                    }
                  }}
                  onAddToCart={(p) => onAddToCart(p)}
                />
              )}

              {/* CTA anchor for IntersectionObserver */}
              <div ref={ctaRef} />
          </div>
        </div>

        <div className="sticky bottom-0 z-10 border-t border-border/70 bg-card px-4 py-3 md:px-5">
          {outOfStock ? (
            <div className="flex h-11 w-full items-center justify-center rounded-xl border border-border/70 bg-surface text-sm font-medium text-muted-foreground">
              Sin stock disponible
            </div>
          ) : inCart > 0 ? (
            <div className="flex items-center gap-3">
              <Button variant="toolbar" size="icon" className="h-11 w-11" onClick={() => onRemoveFromCart(product)}>
                <Minus size={16} />
              </Button>
              <span className="flex-1 text-center text-xl font-extrabold text-foreground">{inCart}</span>
              <Button size="icon" className="h-11 w-11" onClick={() => onAddToCart(product)}>
                <Plus size={16} />
              </Button>
            </div>
          ) : (
            <Button className="h-11 w-full text-sm font-semibold" onClick={() => onAddToCart(product)}>
              Agregar al carrito
            </Button>
          )}
        </div>

        {/* Sticky add-to-cart bar — appears when main CTA scrolls out */}
        {showStickyBar && !outOfStock && (
          <div className="absolute inset-x-0 bottom-[68px] z-20 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="mx-3 flex items-center gap-3 rounded-2xl border border-primary/20 bg-background/95 px-4 py-2.5 shadow-xl backdrop-blur-lg">
              <p className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">{product.name}</p>
              <span className="shrink-0 text-sm font-bold tabular-nums text-primary">{formatPrice(unitPrice)}</span>
              {inCart > 0 ? (
                <div className="flex items-center gap-1.5">
                  <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => onRemoveFromCart(product)}>
                    <Minus size={12} />
                  </Button>
                  <span className="w-8 text-center text-sm font-bold text-foreground">{inCart}</span>
                  <Button size="icon" className="h-8 w-8 rounded-lg" onClick={() => onAddToCart(product)}>
                    <Plus size={12} />
                  </Button>
                </div>
              ) : (
                <Button size="sm" className="h-8 rounded-xl px-4 text-xs font-bold" onClick={() => onAddToCart(product)}>
                  Agregar
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
