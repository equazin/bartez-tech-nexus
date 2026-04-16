/**
 * Detalle de Bundle/Kit para el portal cliente.
 * Muestra configuración, selector de opciones y precio dinámico.
 * Se abre como Sheet (drawer lateral) desde BundleCard.
 */

import { useState, useEffect, useMemo } from "react";
import { X, Layers, Check, AlertCircle, ShoppingCart, MessageSquare, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import type { BundleWithSlots, BundleSelection } from "@/models/bundle";
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
  /** Callback para agregar cada producto del bundle al carrito. */
  onAddToCart: (product: Product, qty: number) => void;
  /** Catálogo completo para enriquecer los productos del bundle. */
  products: Product[];
  /** Callback para cotizar (mismo comportamiento que productos individuales). */
  onQuote?: () => void;
}

export function BundleDetail({
  bundle,
  open,
  onClose,
  formatPrice,
  onAddToCart,
  products,
  onQuote,
}: BundleDetailProps) {
  const [selection, setSelection] = useState<BundleSelection>({});
  const [adding, setAdding] = useState(false);

  // Init selection from defaults whenever bundle changes
  useEffect(() => {
    if (bundle) setSelection(buildDefaultSelection(bundle));
  }, [bundle]);

  const { subtotal, discountAmount, total } = useMemo(
    () => (bundle ? calculateBundlePrice(bundle, selection) : { subtotal: 0, discountAmount: 0, total: 0 }),
    [bundle, selection]
  );

  const available = useMemo(
    () => (bundle ? isBundleAvailable(bundle, selection) : false),
    [bundle, selection]
  );

  function handleSelectOption(slotId: string, productId: number) {
    setSelection((prev) => ({ ...prev, [slotId]: productId }));
  }

  async function handleAddToCart() {
    if (!bundle || adding) return;
    setAdding(true);
    try {
      for (const slot of bundle.slots) {
        const productId = selection[slot.id];
        if (!productId) continue;
        // Find the full product to pass to the cart handler
        const fullProduct = products.find((p) => p.id === productId);
        if (fullProduct) {
          onAddToCart(fullProduct, 1);
        }
      }
      onClose();
    } finally {
      setAdding(false);
    }
  }

  if (!bundle) return null;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full max-w-lg overflow-y-auto p-0">
        <SheetHeader className="p-5 pb-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                <Badge className="gap-1 text-[10px] py-0 px-1.5 bg-primary/10 text-primary border-primary/30">
                  <Layers size={9} /> Kit
                </Badge>
                {bundle.discount_pct > 0 && (
                  <Badge className="text-[10px] py-0 px-1.5 bg-green-500/10 text-green-500 border-green-500/30">
                    -{bundle.discount_pct}% off
                  </Badge>
                )}
                {bundle.allows_customization && (
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
        </SheetHeader>

        <div className="p-5 space-y-5">
          {/* Slots */}
          <div className="space-y-4">
            {bundle.slots.map((slot) => {
              const selectedId = selection[slot.id];
              const isConfigurable = slot.client_configurable && slot.options.length > 1;

              return (
                <div key={slot.id} className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-foreground">{slot.label}</span>
                    {slot.required && (
                      <span className="text-[10px] text-muted-foreground">(requerido)</span>
                    )}
                  </div>

                  {isConfigurable ? (
                    /* Configurable slot: show option list */
                    <div className="space-y-1">
                      {slot.options.map((opt) => {
                        const isSelected = selectedId === opt.product_id;
                        const noStock = opt.product.stock <= 0;
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
                              {noStock && (
                                <Badge variant="secondary" className="text-[9px] py-0 shrink-0">
                                  Sin stock
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0 ml-2 tabular-nums">
                              {formatPrice(opt.product.unit_price ?? opt.product.cost_price ?? 0)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    /* Fixed slot: show selected product as read-only */
                    (() => {
                      const opt = slot.options.find((o) => o.product_id === selectedId) ?? slot.options[0];
                      if (!opt) return (
                        <p className="text-xs text-muted-foreground italic">Sin opciones configuradas.</p>
                      );
                      return (
                        <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/20 px-3 py-2">
                          <span className="text-sm text-foreground truncate">{opt.product.name}</span>
                          <span className="text-xs text-muted-foreground shrink-0 ml-2 tabular-nums">
                            {formatPrice(opt.product.unit_price ?? opt.product.cost_price ?? 0)}
                          </span>
                        </div>
                      );
                    })()
                  )}
                </div>
              );
            })}
          </div>

          <Separator />

          {/* Price breakdown */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Desglose de precio
            </p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatPrice(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-green-500">
                  <span>Descuento -{bundle.discount_pct}%</span>
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
              Agregar al pedido
            </Button>
            {onQuote && (
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={onQuote}
                size="lg"
              >
                <MessageSquare size={16} />
                Cotizar
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
