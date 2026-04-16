import { useMemo, useState } from "react";
import { ArrowLeft, ClipboardList, Minus, Package, Plus, Search, ShoppingCart, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PriceResult } from "@/hooks/usePricing";
import type { Product } from "@/models/products";

interface ExpressItem {
  product: Product;
  qty: number;
}

interface ExpressQuoterProps {
  products: Product[];
  computePrice: (product: Product, qty: number) => PriceResult;
  formatPrice: (price: number) => string;
  onAddToCart: (product: Product, qty: number) => void;
  onRequestQuote?: (items: ExpressItem[]) => void;
}

export function ExpressQuoter({
  products,
  computePrice,
  formatPrice,
  onAddToCart,
  onRequestQuote,
}: ExpressQuoterProps) {
  const [query, setQuery] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [expressItems, setExpressItems] = useState<ExpressItem[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const suggestions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    return products
      .filter((p) =>
        [p.sku, p.name, p.brand_name]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(normalized)),
      )
      .slice(0, 8);
  }, [products, query]);

  const addItem = (product: Product) => {
    setExpressItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, qty: i.qty + Math.max(product.min_order_qty ?? 1, 1) } : i,
        );
      }
      return [...prev, { product, qty: Math.max(product.min_order_qty ?? 1, 1) }];
    });
    setQuery("");
    setDropdownOpen(false);
  };

  const removeItem = (productId: number) => {
    setExpressItems((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const setItemQty = (productId: number, qty: number) => {
    setExpressItems((prev) =>
      prev.map((i) => (i.product.id === productId ? { ...i, qty: Math.max(1, qty) } : i)),
    );
  };

  const totals = useMemo(() => {
    const subtotal = expressItems.reduce((sum, { product, qty }) => {
      return sum + computePrice(product, qty).totalPrice;
    }, 0);
    const totalWithIVA = expressItems.reduce((sum, { product, qty }) => {
      return sum + computePrice(product, qty).totalWithIVA;
    }, 0);
    return { subtotal, totalWithIVA };
  }, [expressItems, computePrice]);

  const handleAddAllToCart = () => {
    expressItems.forEach(({ product, qty }) => onAddToCart(product, qty));
    setExpressItems([]);
    setStep(1);
  };

  const handleRequestQuote = () => {
    onRequestQuote?.(expressItems);
    setExpressItems([]);
    setStep(1);
  };

  // ── STEP 1: Search ──────────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="text-center">
          <h2 className="text-xl font-bold tracking-tight text-foreground">Solicitud guiada de cotización</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Buscá por SKU, marca o nombre y armá tu lista. Al terminar, pedí una cotización formal o agregá todo al carrito.
          </p>
        </div>

        {/* Paso 1 */}
        <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Search size={16} className="text-primary" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Paso 1</p>
              <p className="text-sm font-semibold text-foreground">Buscar y agregar productos</p>
            </div>
          </div>

          {/* Search input */}
          <div className="relative">
            <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-background px-4 py-3">
              <Search size={14} className="shrink-0 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setDropdownOpen(true); }}
                onFocus={() => { if (query) setDropdownOpen(true); }}
                onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
                placeholder="SKU, marca, nombre del producto..."
                className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              {query && (
                <button type="button" onClick={() => { setQuery(""); setDropdownOpen(false); }} className="text-muted-foreground hover:text-foreground">
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Dropdown suggestions */}
            {dropdownOpen && suggestions.length > 0 && (
              <div className="absolute z-20 mt-1 w-full rounded-xl border border-border/70 bg-card shadow-lg overflow-hidden">
                {suggestions.map((product) => {
                  const available = Math.max(0, product.stock - (product.stock_reserved ?? 0));
                  const price = computePrice(product, Math.max(product.min_order_qty ?? 1, 1));
                  const alreadyAdded = expressItems.some((i) => i.product.id === product.id);
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onMouseDown={() => addItem(product)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-secondary"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{product.name}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {[product.brand_name, product.sku].filter(Boolean).join(" · ")} —
                          <span className={cn("ml-1 font-medium", available > 0 ? "text-emerald-500" : "text-rose-500")}>
                            {available > 0 ? `${available} en stock` : "sin stock"}
                          </span>
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-bold text-primary">{formatPrice(price.unitPrice)}</p>
                        {alreadyAdded && (
                          <p className="text-[10px] font-semibold text-amber-500">En lista</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Current express list (mini preview) */}
          {expressItems.length > 0 && (
            <div className="rounded-xl border border-border/60 bg-secondary/30 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  Lista ({expressItems.length} ítem{expressItems.length !== 1 ? "s" : ""})
                </p>
                <button type="button" onClick={() => setExpressItems([])} className="text-[11px] text-muted-foreground hover:text-destructive transition-colors">
                  Limpiar
                </button>
              </div>
              {expressItems.map(({ product, qty }) => (
                <div key={product.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-foreground font-medium">{product.name}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">×{qty}</span>
                </div>
              ))}
            </div>
          )}

          {expressItems.length > 0 && (
            <Button
              type="button"
              onClick={() => setStep(2)}
              className="w-full rounded-xl"
            >
              <ClipboardList size={15} className="mr-2" />
              Revisar lista y cotizar ({expressItems.length} ítem{expressItems.length !== 1 ? "s" : ""})
            </Button>
          )}
        </div>

        {/* Paso 2 hint */}
        {expressItems.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/60 bg-card/50 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60">
              <Package size={22} className="text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-muted-foreground">Empezá buscando productos</p>
            <p className="max-w-xs text-[12px] text-muted-foreground/70">
              Agregá todos los ítems que necesitás, luego revisá precios y solicitá la cotización.
            </p>
          </div>
        )}
      </div>
    );
  }

  // ── STEP 2: Review ──────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setStep(1)}
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={14} />
          Volver a buscar
        </button>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <ClipboardList size={16} className="text-primary" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Paso 2</p>
            <p className="text-sm font-semibold text-foreground">Revisar cantidades y precios</p>
          </div>
        </div>

        {/* Items table */}
        <div className="divide-y divide-border/60">
          {expressItems.map(({ product, qty }) => {
            const price = computePrice(product, qty);
            const available = Math.max(0, product.stock - (product.stock_reserved ?? 0));
            return (
              <div key={product.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground line-clamp-1">{product.name}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {[product.brand_name, product.sku].filter(Boolean).join(" · ")} —
                    <span className={cn("ml-1 font-medium", available > 0 ? "text-emerald-500" : "text-amber-500")}>
                      {available > 0 ? `${available} en stock` : "sin stock"}
                    </span>
                  </p>
                </div>

                {/* Qty control */}
                <div className="flex shrink-0 items-center rounded-xl border border-border/70 bg-background">
                  <button
                    type="button"
                    onClick={() => setItemQty(product.id, qty - 1)}
                    disabled={qty <= 1}
                    className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                  >
                    <Minus size={11} />
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={qty}
                    onChange={(e) => setItemQty(product.id, Number(e.target.value) || 1)}
                    className="h-8 w-10 border-0 bg-transparent text-center text-xs font-semibold tabular-nums text-foreground outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setItemQty(product.id, qty + 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Plus size={11} />
                  </button>
                </div>

                {/* Price */}
                <div className="w-28 shrink-0 text-right">
                  <p className="text-sm font-bold text-primary tabular-nums">{formatPrice(price.totalWithIVA)}</p>
                  <p className="text-[10px] text-muted-foreground tabular-nums">{formatPrice(price.unitPrice)} c/u</p>
                </div>

                <button
                  type="button"
                  onClick={() => removeItem(product.id)}
                  className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Totals */}
        <div className="rounded-xl border border-border/60 bg-secondary/30 p-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Subtotal sin IVA</span>
            <span className="tabular-nums font-medium">{formatPrice(totals.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-sm font-bold text-foreground border-t border-border/60 pt-1.5">
            <span>Total con IVA</span>
            <span className="tabular-nums">{formatPrice(totals.totalWithIVA)}</span>
          </div>
        </div>

        {/* CTAs */}
        <div className="flex flex-col gap-2 sm:flex-row">
          {onRequestQuote && (
            <Button
              type="button"
              onClick={handleRequestQuote}
              className="flex-1 rounded-xl"
            >
              <ClipboardList size={15} className="mr-2" />
              Solicitar cotización formal
            </Button>
          )}
          <Button
            type="button"
            variant={onRequestQuote ? "outline" : "default"}
            onClick={handleAddAllToCart}
            className="flex-1 rounded-xl"
          >
            <ShoppingCart size={15} className="mr-2" />
            Agregar todo al carrito
          </Button>
        </div>
      </div>
    </div>
  );
}
