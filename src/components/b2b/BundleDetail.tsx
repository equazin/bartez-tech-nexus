/**
 * Detalle de Bundle/Kit para el portal cliente.
 * Soporta tipos pc_armada, esquema y bundle generico.
 * Precios con margen del cliente, slots opcionales toggle, desglose de ahorro.
 */

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Cpu,
  Loader2,
  MessageSquare,
  Minus,
  Package,
  Plus,
  RotateCcw,
  ShieldCheck,
  ShoppingCart,
  Sliders,
  Sparkles,
  Tag,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import {
  buildDefaultSelection,
  calculateBundlePrice,
  getBundleOptionInsights,
  getBundleOptionPrice,
  isBundleSlotConfigurable,
  isBundleAvailable,
} from "@/lib/bundlePricing";
import type { BundleSelection, BundleType, BundleWithSlots } from "@/models/bundle";
import { BUNDLE_TYPE_LABELS } from "@/models/bundle";
import type { Product } from "@/models/products";

interface BundleDetailProps {
  bundle: BundleWithSlots | null;
  open: boolean;
  onClose: () => void;
  formatPrice: (amount: number) => string;
  products: Product[];
  clientMargin?: number;
  onAddBundleItems?: (
    bundleId: string,
    bundleName: string,
    items: Array<{ product: Product; qty: number }>,
  ) => void;
  onAddToCart?: (product: Product, qty: number) => void;
  onRequestQuote?: (
    items: Array<{ product: Product; qty: number }>,
    meta: { bundleId: string; bundleName: string; bundleQty: number },
  ) => void;
}

type BundleOption = BundleWithSlots["slots"][number]["options"][number];

interface SelectedBundleItem {
  slotId: string;
  slotLabel: string;
  required: boolean;
  configurable: boolean;
  option: BundleOption;
  price: number;
}

const TYPE_ICONS: Record<BundleType, typeof Cpu> = {
  pc_armada: Cpu,
  esquema: Sliders,
  bundle: Package,
};

const TYPE_COLORS: Record<BundleType, string> = {
  pc_armada: "border-sky-500/30 bg-sky-500/10 text-sky-500",
  esquema: "border-violet-500/30 bg-violet-500/10 text-violet-500",
  bundle: "border-primary/30 bg-primary/10 text-primary",
};

function getSelectedItems(
  bundle: BundleWithSlots,
  selection: BundleSelection,
  disabledSlots: Set<string>,
  clientMargin: number,
): SelectedBundleItem[] {
  return bundle.slots.flatMap((slot) => {
    if (disabledSlots.has(slot.id)) return [];
    const selectedId = selection[slot.id];
    const option = slot.options.find((candidate) => candidate.product_id === selectedId) ?? slot.options[0];
    if (!option) return [];

    return [{
      slotId: slot.id,
      slotLabel: slot.label,
      required: slot.required,
      configurable: isBundleSlotConfigurable(slot, bundle.type),
      option,
      price: getBundleOptionPrice(option, clientMargin),
    }];
  });
}

function productInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function BundleDetail({
  bundle,
  open,
  onClose,
  formatPrice,
  products,
  clientMargin = 0,
  onAddBundleItems,
  onAddToCart,
  onRequestQuote,
}: BundleDetailProps) {
  const { toast } = useToast();
  const [selection, setSelection] = useState<BundleSelection>({});
  const [disabledSlots, setDisabledSlots] = useState<Set<string>>(new Set());
  const [bundleQty, setBundleQty] = useState(1);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!bundle) return;
    setSelection(buildDefaultSelection(bundle));
    setDisabledSlots(new Set());
    setBundleQty(1);
  }, [bundle]);

  const effectiveSelection = useMemo(() => {
    const next: BundleSelection = { ...selection };
    disabledSlots.forEach((slotId) => {
      next[slotId] = null;
    });
    return next;
  }, [selection, disabledSlots]);

  const selectedItems = useMemo(() => {
    if (!bundle) return [];
    return getSelectedItems(bundle, selection, disabledSlots, clientMargin);
  }, [bundle, selection, disabledSlots, clientMargin]);

  const { subtotal, discountAmount, savingsPct, total } = useMemo(() => {
    if (!bundle) return { subtotal: 0, discountAmount: 0, savingsPct: 0, total: 0 };
    const base = calculateBundlePrice(bundle, effectiveSelection, clientMargin);
    return {
      subtotal: base.subtotal * bundleQty,
      discountAmount: base.discountAmount * bundleQty,
      savingsPct: base.savingsPct,
      total: base.total * bundleQty,
    };
  }, [bundle, effectiveSelection, clientMargin, bundleQty]);

  const available = useMemo(() => {
    if (!bundle) return false;
    return isBundleAvailable(bundle, effectiveSelection);
  }, [bundle, effectiveSelection]);

  const TypeIcon = bundle ? (TYPE_ICONS[bundle.type] ?? Package) : Package;
  const typeColor = bundle ? (TYPE_COLORS[bundle.type] ?? TYPE_COLORS.bundle) : TYPE_COLORS.bundle;
  const typeLabel = bundle ? (BUNDLE_TYPE_LABELS[bundle.type] ?? "Kit") : "Kit";
  const hasDiscount = bundle ? bundle.discount_type !== "none" && subtotal > total && total > 0 : false;
  const stockIssues = selectedItems.filter((item) => item.required && item.option.product.stock <= 0).length;
  const configurableCount = bundle?.slots.filter((slot) => isBundleSlotConfigurable(slot, bundle.type)).length ?? 0;
  const requiredSlots = bundle?.slots.filter((slot) => slot.required) ?? [];
  const optionalSlots = bundle?.slots.filter((slot) => !slot.required) ?? [];
  const canRequestQuote = !!bundle && typeof onRequestQuote === "function";

  function handleSelectOption(slotId: string, productId: number) {
    setSelection((prev) => ({ ...prev, [slotId]: productId }));
  }

  function handleToggleSlot(slotId: string, enabled: boolean) {
    setDisabledSlots((prev) => {
      const next = new Set(prev);
      if (enabled) next.delete(slotId);
      else next.add(slotId);
      return next;
    });
  }

  function handleResetSelection() {
    if (!bundle) return;
    setSelection(buildDefaultSelection(bundle));
    setDisabledSlots(new Set());
    setBundleQty(1);
  }

  async function handleAddToCart() {
    if (!bundle || adding) return;
    setAdding(true);
    try {
      const items: Array<{ product: Product; qty: number }> = [];
      for (const slot of bundle.slots) {
        if (disabledSlots.has(slot.id)) continue;
        const productId = selection[slot.id];
        if (!productId) continue;
        const option = slot.options.find((candidate) => candidate.product_id === productId);
        const qty = (option?.quantity ?? 1) * bundleQty;
        const fullProduct = products.find((product) => product.id === productId);
        if (fullProduct) items.push({ product: fullProduct, qty });
      }

      if (onAddBundleItems) {
        onAddBundleItems(bundle.id, bundle.title, items);
      } else if (onAddToCart) {
        items.forEach(({ product, qty }) => onAddToCart(product, qty));
      }

      toast({
        title: "Kit agregado",
        description: `${items.length} producto${items.length !== 1 ? "s" : ""} agregado${items.length !== 1 ? "s" : ""} al pedido.`,
      });
      onClose();
    } finally {
      setAdding(false);
    }
  }

  function buildSelectedQuoteItems() {
    if (!bundle) return [];
    return bundle.slots.flatMap((slot) => {
      if (disabledSlots.has(slot.id)) return [];
      const productId = selection[slot.id];
      if (!productId) return [];
      const option = slot.options.find((candidate) => candidate.product_id === productId);
      if (!option) return [];
      const fullProduct = products.find((product) => product.id === productId);
      if (!fullProduct) return [];
      return [{ product: fullProduct, qty: (option.quantity ?? 1) * bundleQty }];
    });
  }

  function handleQuoteRequest() {
    if (!bundle || !onRequestQuote) return;
    onRequestQuote(buildSelectedQuoteItems(), {
      bundleId: bundle.id,
      bundleName: bundle.title,
      bundleQty,
    });
    onClose();
  }

  const primaryAction = available || !canRequestQuote
    ? {
        label: `Agregar${bundleQty > 1 ? ` x${bundleQty}` : ""}`,
        icon: ShoppingCart,
        disabled: !available || adding,
        onClick: handleAddToCart,
      }
    : {
        label: "Cotizar esta configuración",
        icon: MessageSquare,
        disabled: false,
        onClick: handleQuoteRequest,
      };

  function renderSlot(slot: BundleWithSlots["slots"][number]) {
    const selectedId = selection[slot.id];
    const isDisabled = disabledSlots.has(slot.id);
    const isOptional = !slot.required;
    const isConfigurable = isBundleSlotConfigurable(slot, bundle?.type);
    const selectedOption = slot.options.find((option) => option.product_id === selectedId) ?? slot.options[0];
    const optionSignals = getBundleOptionInsights(slot, clientMargin);

    return (
      <div
        key={slot.id}
        className={`rounded-2xl border border-border/70 bg-card/45 p-3 transition ${isDisabled ? "opacity-60" : ""}`}
      >
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-foreground">{slot.label}</span>
              <span className="text-[10px] text-muted-foreground">
                {slot.required ? "Requerido" : "Opcional"}
              </span>
            </div>
            {selectedOption && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {selectedOption.product.category || "Componente del kit"}
              </p>
            )}
          </div>

          {isOptional && (
            <button
              type="button"
              onClick={() => handleToggleSlot(slot.id, isDisabled)}
              className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold transition ${
                isDisabled
                  ? "bg-muted text-muted-foreground hover:bg-muted/80"
                  : "bg-primary/10 text-primary hover:bg-primary/20"
              }`}
            >
              {isDisabled ? "Agregar" : "Quitar"}
            </button>
          )}
        </div>

        {!isDisabled && (
          isConfigurable ? (
            <div className="space-y-2">
              {slot.options.map((option) => {
                const isSelected = selectedId === option.product_id;
                const noStock = option.product.stock <= 0;
                const optionPrice = getBundleOptionPrice(option, clientMargin);
                const isCheapest = optionSignals.cheapestProductId === option.product_id;
                const isBestStock = optionSignals.bestStockProductId === option.product_id;

                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={noStock}
                    onClick={() => handleSelectOption(slot.id, option.product_id)}
                    className={`group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                      isSelected
                        ? "border-primary/70 bg-primary/10 shadow-sm"
                        : noStock
                          ? "cursor-not-allowed border-border/40 opacity-45"
                          : "border-border/70 bg-background/60 hover:border-primary/40 hover:bg-muted/30"
                    }`}
                  >
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      isSelected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/35 text-transparent"
                    }`}>
                      <Check size={12} />
                    </span>

                    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-muted/45 text-xs font-bold text-muted-foreground">
                      {option.product.image ? (
                        <img src={option.product.image} alt="" className="h-full w-full object-cover" />
                      ) : (
                        productInitials(option.product.name)
                      )}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {option.product.name}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                        {option.quantity > 1 && <span>x{option.quantity}</span>}
                        {noStock ? (
                          <span className="text-amber-500">Sin stock</span>
                        ) : (
                          <span>Stock {option.product.stock}</span>
                        )}
                        {option.is_default && (
                          <Badge variant="outline" className="h-5 px-1.5 text-[9px] border-primary/30 text-primary">
                            Recomendado
                          </Badge>
                        )}
                        {isCheapest && (
                          <Badge variant="outline" className="h-5 px-1.5 text-[9px] border-emerald-500/30 text-emerald-500">
                            Menor precio
                          </Badge>
                        )}
                        {isBestStock && (
                          <Badge variant="outline" className="h-5 px-1.5 text-[9px] border-sky-500/30 text-sky-500">
                            Mejor stock
                          </Badge>
                        )}
                      </span>
                    </span>

                    <span className="shrink-0 text-right text-xs font-semibold text-muted-foreground tabular-nums">
                      {formatPrice(optionPrice)}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : selectedOption ? (
            <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/60 px-3 py-2.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-muted/45 text-xs font-bold text-muted-foreground">
                {selectedOption.product.image ? (
                  <img src={selectedOption.product.image} alt="" className="h-full w-full object-cover" />
                ) : (
                  productInitials(selectedOption.product.name)
                )}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{selectedOption.product.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {selectedOption.product.stock > 0 ? (
                    <Badge className="border border-emerald-500/25 bg-emerald-500/10 py-0 text-[10px] text-emerald-500">
                      Stock {selectedOption.product.stock}
                    </Badge>
                  ) : (
                    <Badge className="border border-amber-500/25 bg-amber-500/10 py-0 text-[10px] text-amber-500">
                      Sin stock
                    </Badge>
                  )}
                  {selectedOption.quantity > 1 && (
                    <Badge variant="outline" className="py-0 text-[10px]">x{selectedOption.quantity}</Badge>
                  )}
                </div>
              </div>

              <span className="shrink-0 text-xs font-semibold text-muted-foreground tabular-nums">
                {formatPrice(getBundleOptionPrice(selectedOption, clientMargin))}
              </span>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-border/70 px-3 py-4 text-center text-xs text-muted-foreground">
              Sin opciones configuradas.
            </p>
          )
        )}
      </div>
    );
  }

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col overflow-hidden border-l border-border/70 bg-background p-0 sm:max-w-[620px]"
      >
        {!bundle && (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <Loader2 size={28} className="animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Cargando kit...</p>
          </div>
        )}

        {bundle && (
          <>
            <div className="flex-1 overflow-y-auto">
              <div className="relative overflow-hidden border-b border-border/70 bg-card/70">
                {bundle.image_url ? (
                  <img
                    src={bundle.image_url}
                    alt={bundle.title}
                    className="h-44 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-28 items-end bg-muted/30 px-5 pb-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary shadow-sm">
                      <TypeIcon size={27} strokeWidth={1.8} />
                    </div>
                  </div>
                )}

                <div className="px-5 pb-5 pt-4">
                  <SheetHeader className="space-y-3 pr-8 text-left">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={`gap-1 border px-2 py-0.5 text-[11px] ${typeColor}`}>
                        <TypeIcon size={11} />
                        {typeLabel}
                      </Badge>
                      {hasDiscount && (
                        <Badge className="gap-1 border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-500">
                          <Tag size={10} />
                          -{Math.round(savingsPct)}% off
                        </Badge>
                      )}
                      {bundle.allows_customization && (
                        <Badge variant="outline" className="gap-1 px-2 py-0.5 text-[11px] text-muted-foreground">
                          <Sliders size={10} />
                          Configurable
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-2">
                      <SheetTitle className="text-2xl font-bold leading-tight tracking-normal text-foreground">
                        {bundle.title}
                      </SheetTitle>
                      {bundle.description && (
                        <SheetDescription className="line-clamp-4 text-sm leading-6 text-muted-foreground">
                          {bundle.description}
                        </SheetDescription>
                      )}
                    </div>
                  </SheetHeader>

                  <div className="mt-5 grid grid-cols-3 gap-2">
                    <div className="rounded-xl border border-border/60 bg-background/70 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase text-muted-foreground">Items</p>
                      <p className="mt-0.5 text-base font-bold text-foreground">{selectedItems.length}</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-background/70 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase text-muted-foreground">Opciones</p>
                      <p className="mt-0.5 text-base font-bold text-foreground">{configurableCount}</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-background/70 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase text-muted-foreground">Stock</p>
                      <p className={`mt-0.5 text-base font-bold ${stockIssues > 0 ? "text-amber-500" : "text-emerald-500"}`}>
                        {stockIssues > 0 ? "Revisar" : "OK"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-end justify-between gap-4 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase text-muted-foreground">Total del kit</p>
                      {available ? (
                        <p className="mt-1 text-3xl font-black leading-none text-foreground tabular-nums">
                          {formatPrice(total)}
                        </p>
                      ) : (
                        <p className="mt-1 text-xl font-bold text-muted-foreground">Consultar disponibilidad</p>
                      )}
                    </div>
                    {hasDiscount && discountAmount > 0 && (
                      <div className="text-right">
                        <p className="text-[11px] text-muted-foreground line-through tabular-nums">
                          {formatPrice(subtotal)}
                        </p>
                        <p className="mt-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-500">
                          Ahorro {formatPrice(discountAmount)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-5 px-5 py-5">
                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Componentes requeridos</h3>
                      <p className="text-xs text-muted-foreground">Definen la configuración base del kit.</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1.5 px-2 text-xs text-muted-foreground"
                      onClick={handleResetSelection}
                    >
                      <RotateCcw size={13} />
                      Restablecer
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {requiredSlots.map(renderSlot)}
                  </div>
                </section>

                {optionalSlots.length > 0 && (
                  <section className="space-y-3">
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Componentes opcionales</h3>
                      <p className="text-xs text-muted-foreground">Podés incluirlos o quitarlos según el caso de uso.</p>
                    </div>

                    <div className="space-y-3">
                      {optionalSlots.map(renderSlot)}
                    </div>
                  </section>
                )}

                {!available && (
                  <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-500">
                    <AlertCircle size={18} className="mt-0.5 shrink-0" />
                    <span>
                      Hay componentes requeridos sin stock. Podes cotizarlo para consultar reemplazos o disponibilidad.
                    </span>
                  </div>
                )}

                <section className="rounded-2xl border border-border/70 bg-card/45 p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <ShieldCheck size={16} className="text-primary" />
                    Resumen comercial
                  </div>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal</span>
                      <span className="tabular-nums">{formatPrice(subtotal)}</span>
                    </div>
                    {hasDiscount && discountAmount > 0 && (
                      <div className="flex justify-between text-emerald-500">
                        <span>
                          {bundle.discount_type === "percentage"
                            ? `Descuento ${bundle.discount_pct}%`
                            : "Precio fijo especial"}
                        </span>
                        <span className="tabular-nums">-{formatPrice(discountAmount)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between text-base font-bold text-foreground">
                      <span>Total</span>
                      <span className="tabular-nums">{available ? formatPrice(total) : "Consultar"}</span>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <div className="border-t border-border/70 bg-background/95 px-5 py-4 shadow-[0_-18px_45px_-34px_rgba(0,0,0,0.65)] backdrop-blur">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase text-muted-foreground">Total final</p>
                  <p className="mt-0.5 text-xl font-black text-foreground tabular-nums">
                    {available ? formatPrice(total) : "Consultar"}
                  </p>
                </div>

                <div className="flex items-center rounded-xl border border-border/70 bg-card/50 p-1">
                  <button
                    type="button"
                    aria-label="Restar kit"
                    onClick={() => setBundleQty((qty) => Math.max(1, qty - 1))}
                    disabled={bundleQty <= 1}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted disabled:opacity-40"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-9 text-center text-sm font-bold tabular-nums">{bundleQty}</span>
                  <button
                    type="button"
                    aria-label="Sumar kit"
                    onClick={() => setBundleQty((qty) => Math.min(10, qty + 1))}
                    disabled={bundleQty >= 10}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted disabled:opacity-40"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={primaryAction.onClick}
                  disabled={primaryAction.disabled}
                  className="h-11 flex-1 gap-2"
                >
                  {adding && available ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <primaryAction.icon size={16} />
                  )}
                  {primaryAction.label}
                </Button>

                <Button
                  variant="outline"
                  className="h-11 w-11 px-0"
                  onClick={handleResetSelection}
                  title="Restablecer configuracion"
                  aria-label="Restablecer configuracion"
                >
                  <RotateCcw size={16} />
                </Button>
              </div>

              {available && hasDiscount && discountAmount > 0 && (
                <p className="mt-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-500">
                  <Sparkles size={13} />
                  Ahorro aplicado: {formatPrice(discountAmount)}
                </p>
              )}

              {!available && (
                <p className="mt-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-amber-500">
                  <CheckCircle2 size={13} />
                  Cotizá esta configuración y validamos alternativas.
                </p>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
