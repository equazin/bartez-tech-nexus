/**
 * Detalle de Bundle/Kit para el portal cliente.
 * Soporta tipos pc_armada, esquema y bundle genérico.
 * Precios con margen del cliente, slots opcionales toggle, desglose de ahorro.
 */

import { useState, useEffect, useMemo } from "react";
import { X, Check, AlertCircle, ShoppingCart, MessageSquare, Loader2,
         Cpu, Sliders, Package, Tag, ChevronDown, RotateCcw, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import type { BundleWithSlots, BundleSelection, BundleType } from "@/models/bundle";
import { BUNDLE_TYPE_LABELS } from "@/models/bundle";
import {
  calculateBundlePrice,
  buildDefaultSelection,
  isBundleAvailable,
} from "@/lib/bundlePricing";
import type { Product } from "@/models/products";

interface BundleDetailProps {
  bundle: BundleWithSlots | null;
  open: boolean;
  onClose: () => void;
  formatPrice: (amount: number) => string;
  /** Catálogo completo para enriquecer productos del bundle al agregar al carrito. */
  products: Product[];
  onQuote?: () => void;
  /** Margen del cliente para calcular precios desde cost_price. Default 0. */
  clientMargin?: number;
  /**
   * Agrega todos los items del bundle al carrito de una vez, con trazabilidad de bundle.
   * Si no se provee, se usa onAddToCart como fallback individual por producto.
   */
  onAddBundleItems?: (
    bundleId: string,
    bundleName: string,
    items: Array<{ product: Product; qty: number }>,
  ) => void;
  /** Fallback individual (sin bundle meta). */
  onAddToCart?: (product: Product, qty: number) => void;
}

const TYPE_ICONS: Record<BundleType, typeof Cpu> = {
  pc_armada: Cpu,
  esquema:   Sliders,
  bundle:    Package,
};

const TYPE_COLORS: Record<BundleType, string> = {
  pc_armada: "bg-blue-500/10 text-blue-500 border-blue-500/30",
  esquema:   "bg-violet-500/10 text-violet-500 border-violet-500/30",
  bundle:    "bg-primary/10 text-primary border-primary/30",
};

/** Precio de una opción con margen aplicado (espejo de resolveOptionPrice en bundlePricing). */
function resolveDisplayPrice(
  opt: BundleWithSlots["slots"][number]["options"][number],
  clientMargin: number,
): number {
  const qty = opt.quantity ?? 1;
  const { cost_price, unit_price } = opt.product;
  const base =
    cost_price != null && cost_price > 0
      ? cost_price * (1 + clientMargin / 100)
      : unit_price ?? 0;
  return base * qty;
}

export function BundleDetail({
  bundle,
  open,
  onClose,
  formatPrice,
  products,
  onQuote,
  clientMargin = 0,
  onAddBundleItems,
  onAddToCart,
}: BundleDetailProps) {
  const { toast } = useToast();
  const [selection, setSelection]           = useState<BundleSelection>({});
  const [disabledSlots, setDisabledSlots]   = useState<Set<string>>(new Set());
  const [bundleQty, setBundleQty]           = useState(1);
  const [adding, setAdding]                 = useState(false);

  // Init selection, disabled slots and qty whenever bundle changes
  useEffect(() => {
    if (!bundle) return;
    setSelection(buildDefaultSelection(bundle));
    setDisabledSlots(new Set());
    setBundleQty(1);
  }, [bundle]);

  const { subtotal, discountAmount, savingsPct, total } = useMemo(() => {
    if (!bundle) return { subtotal: 0, discountAmount: 0, savingsPct: 0, total: 0 };
    const effectiveSel: BundleSelection = { ...selection };
    disabledSlots.forEach((slotId) => { effectiveSel[slotId] = null; });
    const base = calculateBundlePrice(bundle, effectiveSel, clientMargin);
    return {
      subtotal:       base.subtotal       * bundleQty,
      discountAmount: base.discountAmount * bundleQty,
      savingsPct:     base.savingsPct,
      total:          base.total          * bundleQty,
    };
  }, [bundle, selection, disabledSlots, clientMargin, bundleQty]);

  const available = useMemo(() => {
    if (!bundle) return false;
    const effectiveSel: BundleSelection = { ...selection };
    disabledSlots.forEach((slotId) => { effectiveSel[slotId] = null; });
    return isBundleAvailable(bundle, effectiveSel);
  }, [bundle, selection, disabledSlots]);

  function handleSelectOption(slotId: string, productId: number) {
    setSelection((prev) => ({ ...prev, [slotId]: productId }));
  }

  function handleToggleSlot(slotId: string, enabled: boolean) {
    setDisabledSlots((prev) => {
      const next = new Set(prev);
      if (enabled) next.delete(slotId); else next.add(slotId);
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
        const opt         = slot.options.find((o) => o.product_id === productId);
        const qty         = (opt?.quantity ?? 1) * bundleQty;
        const fullProduct = products.find((p) => p.id === productId);
        if (fullProduct) items.push({ product: fullProduct, qty });
      }

      if (onAddBundleItems) {
        onAddBundleItems(bundle.id, bundle.title, items);
      } else if (onAddToCart) {
        items.forEach(({ product, qty }) => onAddToCart(product, qty));
      }

      toast({
        title: "Bundle agregado",
        description: `${items.length} producto${items.length !== 1 ? "s" : ""} ${bundleQty > 1 ? `(×${bundleQty}) ` : ""}agregado${items.length !== 1 ? "s" : ""} al pedido.`,
      });
      onClose();
    } finally {
      setAdding(false);
    }
  }

  const TypeIcon  = bundle ? (TYPE_ICONS[bundle.type] ?? Package) : Package;
  const typeColor = bundle ? (TYPE_COLORS[bundle.type] ?? TYPE_COLORS.bundle) : TYPE_COLORS.bundle;
  const typeLabel = bundle ? (BUNDLE_TYPE_LABELS[bundle.type] ?? "Kit") : "Kit";
  const hasDiscount = bundle
    ? bundle.discount_type !== "none" && subtotal > total && total > 0
    : false;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full max-w-lg overflow-y-auto p-0">

        {/* Loading state */}
        {!bundle && (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <Loader2 size={28} className="animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Cargando kit...</p>
          </div>
        )}

        {bundle && (
          <>
            {/* Imagen de portada */}
            {bundle.image_url && (
              <div className="relative overflow-hidden bg-muted/40">
                <img
                  src={bundle.image_url}
                  alt={bundle.title}
                  className="h-40 w-full object-cover"
                />
                {hasDiscount && (
                  <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-green-500 px-2.5 py-1 text-xs font-bold text-white shadow">
                    <Tag size={11} />
                    -{Math.round(savingsPct)}%
                  </div>
                )}
              </div>
            )}

            <SheetHeader className="p-5 pb-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* Type badge row */}
                  <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                    <Badge className={`gap-1 text-[10px] py-0 px-1.5 ${typeColor}`}>
                      <TypeIcon size={9} />
                      {typeLabel}
                    </Badge>
                    {hasDiscount && !bundle.image_url && (
                      <Badge className="text-[10px] py-0 px-1.5 bg-green-500/10 text-green-500 border-green-500/30">
                        <Tag size={9} className="mr-0.5" />
                        -{Math.round(savingsPct)}% off
                      </Badge>
                    )}
                    {bundle.allows_customization && bundle.type === "esquema" && (
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-muted-foreground">
                        Personalizable
                      </Badge>
                    )}
                  </div>
                  <SheetTitle className="text-lg leading-snug">{bundle.title}</SheetTitle>
                  {bundle.description && (
                    <p className="text-sm text-muted-foreground mt-1">{bundle.description}</p>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
                  aria-label="Cerrar"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Esquema hint */}
              {bundle.type === "esquema" && (
                <p className="mt-2 text-xs text-muted-foreground rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-2">
                  <ChevronDown size={10} className="inline mr-1 text-violet-500" />
                  Este esquema es personalizable: podés elegir la variante de cada componente según tus necesidades.
                </p>
              )}
            </SheetHeader>

            <div className="p-5 space-y-5">
              {/* Slots */}
              <div className="space-y-4">
                {bundle.slots.map((slot) => {
                  const selectedId     = selection[slot.id];
                  const isDisabled     = disabledSlots.has(slot.id);
                  const isOptional     = !slot.required;
                  const isConfigurable = slot.client_configurable && slot.options.length > 1;

                  return (
                    <div key={slot.id} className={`space-y-1.5 ${isDisabled ? "opacity-50" : ""}`}>
                      {/* Slot header */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-foreground">{slot.label}</span>
                          {isOptional && (
                            <span className="text-[10px] text-muted-foreground italic">(opcional)</span>
                          )}
                          {!isOptional && (
                            <span className="text-[10px] text-muted-foreground">(requerido)</span>
                          )}
                        </div>
                        {/* Toggle for optional slots */}
                        {isOptional && (
                          <button
                            onClick={() => handleToggleSlot(slot.id, isDisabled)}
                            className={`text-[10px] font-medium rounded-full px-2 py-0.5 transition
                              ${isDisabled
                                ? "bg-muted text-muted-foreground hover:bg-muted/80"
                                : "bg-primary/10 text-primary hover:bg-primary/20"
                              }`}
                          >
                            {isDisabled ? "Agregar" : "Quitar"}
                          </button>
                        )}
                      </div>

                      {/* Slot content */}
                      {!isDisabled && (
                        isConfigurable ? (
                          <div className="space-y-1">
                            {slot.options.map((opt) => {
                              const isSelected = selectedId === opt.product_id;
                              const noStock    = opt.product.stock <= 0;
                              const optPrice   = resolveDisplayPrice(opt, clientMargin);
                              return (
                                <button
                                  key={opt.id}
                                  disabled={noStock}
                                  onClick={() => handleSelectOption(slot.id, opt.product_id)}
                                  className={`w-full flex items-center justify-between rounded-xl border px-3 py-2 text-left transition
                                    ${isSelected
                                      ? "border-primary bg-primary/5 text-foreground"
                                      : noStock
                                        ? "border-border/40 opacity-40 cursor-not-allowed"
                                        : "border-border/70 hover:border-primary/40 text-foreground hover:bg-muted/30"
                                    }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span
                                      className={`shrink-0 w-4 h-4 rounded-full border flex items-center justify-center
                                        ${isSelected ? "border-primary bg-primary" : "border-muted-foreground/40"}`}
                                    >
                                      {isSelected && <Check size={10} className="text-primary-foreground" />}
                                    </span>
                                    <span className="text-sm truncate">{opt.product.name}</span>
                                    {opt.quantity > 1 && (
                                      <span className="shrink-0 text-[10px] text-muted-foreground">×{opt.quantity}</span>
                                    )}
                                    {noStock && (
                                      <Badge variant="secondary" className="text-[9px] py-0 shrink-0">Sin stock</Badge>
                                    )}
                                  </div>
                                  <span className="text-xs text-muted-foreground shrink-0 ml-2 tabular-nums">
                                    {formatPrice(optPrice)}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          /* Fixed slot: read-only with stock badge */
                          (() => {
                            const opt = slot.options.find((o) => o.product_id === selectedId) ?? slot.options[0];
                            if (!opt) return (
                              <p className="text-xs text-muted-foreground italic">Sin opciones configuradas.</p>
                            );
                            const optPrice = resolveDisplayPrice(opt, clientMargin);
                            const noStock  = opt.product.stock <= 0;
                            return (
                              <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/20 px-3 py-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-sm text-foreground truncate">{opt.product.name}</span>
                                  {opt.quantity > 1 && (
                                    <span className="shrink-0 text-[10px] text-muted-foreground">×{opt.quantity}</span>
                                  )}
                                  {opt.is_optional && (
                                    <span className="shrink-0 text-[9px] text-muted-foreground/50 italic">(opc.)</span>
                                  )}
                                  {noStock && (
                                    <Badge variant="secondary" className="text-[9px] py-0 shrink-0">Sin stock</Badge>
                                  )}
                                  {!noStock && (
                                    <Badge className="text-[9px] py-0 shrink-0 bg-green-500/10 text-green-600 border-green-500/30">
                                      Stock: {opt.product.stock}
                                    </Badge>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground shrink-0 ml-2 tabular-nums">
                                  {formatPrice(optPrice)}
                                </span>
                              </div>
                            );
                          })()
                        )
                      )}
                    </div>
                  );
                })}
              </div>

              <Separator />

              {/* Price breakdown + qty spinner */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Desglose de precio
                  </p>
                  {/* Bundle quantity spinner */}
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground mr-1">Cantidad:</span>
                    <button
                      onClick={() => setBundleQty((q) => Math.max(1, q - 1))}
                      disabled={bundleQty <= 1}
                      className="w-6 h-6 rounded-md border border-border/70 flex items-center justify-center text-muted-foreground hover:bg-muted transition disabled:opacity-40"
                    >
                      <Minus size={11} />
                    </button>
                    <span className="w-7 text-center text-sm font-medium tabular-nums">{bundleQty}</span>
                    <button
                      onClick={() => setBundleQty((q) => Math.min(10, q + 1))}
                      disabled={bundleQty >= 10}
                      className="w-6 h-6 rounded-md border border-border/70 flex items-center justify-center text-muted-foreground hover:bg-muted transition disabled:opacity-40"
                    >
                      <Plus size={11} />
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal{bundleQty > 1 ? ` ×${bundleQty}` : ""}</span>
                    <span className="tabular-nums">{formatPrice(subtotal)}</span>
                  </div>
                  {hasDiscount && discountAmount > 0 && (
                    <div className="flex justify-between text-green-500">
                      <span>
                        {bundle.discount_type === "percentage"
                          ? `Descuento -${bundle.discount_pct}%`
                          : "Precio fijo especial"}
                      </span>
                      <span className="tabular-nums">-{formatPrice(discountAmount)}</span>
                    </div>
                  )}
                  <Separator className="my-1" />
                  <div className="flex justify-between font-bold text-foreground text-base">
                    <span>Total</span>
                    {available ? (
                      <span className="tabular-nums">{formatPrice(total)}</span>
                    ) : (
                      <span className="text-muted-foreground">Consultar</span>
                    )}
                  </div>
                  {hasDiscount && discountAmount > 0 && (
                    <div className="flex items-center justify-end gap-1.5 pt-0.5">
                      <span className="rounded-full bg-green-500/10 px-2.5 py-0.5 text-[11px] font-bold text-green-600 dark:text-green-400">
                        Ahorrás {formatPrice(discountAmount)} ({Math.round(savingsPct)}%)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Availability warning */}
              {!available && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-600 dark:text-amber-400">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span>
                    Uno o más componentes requeridos no tienen stock disponible. Podés cotizarlo para consultar disponibilidad.
                  </span>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-1">
                <Button
                  onClick={handleAddToCart}
                  disabled={!available || adding}
                  className="w-full gap-2"
                  size="lg"
                >
                  {adding
                    ? <Loader2 size={16} className="animate-spin" />
                    : <ShoppingCart size={16} />
                  }
                  Agregar al pedido{bundleQty > 1 ? ` (×${bundleQty})` : ""}
                </Button>

                <div className="flex gap-2">
                  {onQuote && (
                    <Button
                      variant="outline"
                      className="flex-1 gap-2"
                      onClick={onQuote}
                      size="lg"
                    >
                      <MessageSquare size={16} />
                      Cotizar
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    className="gap-1.5 text-muted-foreground"
                    onClick={handleResetSelection}
                    size="lg"
                    title="Restablecer configuración"
                  >
                    <RotateCcw size={14} />
                    Restablecer
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
