import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2, ShoppingCart, Minus, Plus, X, BookmarkPlus, TrendingUp, Sparkles } from "lucide-react";
import type { Product } from "@/models/products";
import { getNextTier } from "@/lib/pricing";
import { generateQuotePdfOnDemand } from "@/lib/quotePdfClient";
import { UserProfile } from "@/lib/supabase";
import { useCurrency } from "@/context/CurrencyContext";

interface CartDrawerItem {
  product: Product;
  quantity: number;
  cost?: number;
  margin: number;
  unitPrice: number;
  totalPrice: number;
  ivaRate: number;
  ivaAmount: number;
  totalWithIVA: number;
}

interface AppliedCoupon {
  id: string;
  code: string;
  discount_type: 'fixed' | 'percentage';
  discount_value: number;
}

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  cartItems: CartDrawerItem[];
  cartSubtotal: number;
  cartIVATotal: number;
  cartTotal: number;
  globalMargin: number;
  profile?: UserProfile | null;
  onAddToCart: (product: Product) => void;
  onRemoveFromCart: (product: Product) => void;
  onMarginChange?: (productId: number, margin: number) => void;
  onConfirmOrder?: () => void;
  onSaveQuote?: () => void;
  confirming?: boolean;
  // Marketing / Coupons (Phase 5.4)
  couponCode: string;
  onCouponCodeChange: (code: string) => void;
  onApplyCoupon: (code: string) => void;
  onRemoveCoupon: () => void;
  appliedCoupon?: AppliedCoupon | null;
  couponError?: string;
  validatingCoupon?: boolean;
  discountAmount?: number;
}

export function CartDrawer({
  open, onClose, cartItems, cartSubtotal, cartIVATotal, cartTotal, profile,
  onAddToCart, onRemoveFromCart, onConfirmOrder, onSaveQuote, confirming,
  couponCode, onCouponCodeChange, onApplyCoupon, onRemoveCoupon, appliedCoupon, couponError, validatingCoupon, discountAmount = 0
}: CartDrawerProps) {
  const { formatPrice, formatUSD, formatARS, currency, exchangeRate, convertPrice } = useCurrency();

  async function handleExportPDF() {
    await generateQuotePdfOnDemand({
      clientName:  profile?.company_name || profile?.contact_name || "Cliente",
      companyName: profile?.company_name || profile?.contact_name || "Cliente",
      whiteLabel:  true,   // client-facing: no Bartez branding
      currency,
      products: cartItems.map((item) => ({
        name:         item.product.name,
        quantity:     item.quantity,
        price:        Number(convertPrice(item.unitPrice).toFixed(2)),
        total:        Number(convertPrice(item.totalPrice).toFixed(2)),
        ivaRate:      item.ivaRate,
        ivaAmount:    Number(convertPrice(item.ivaAmount).toFixed(2)),
        totalWithIVA: Number(convertPrice(item.totalWithIVA).toFixed(2)),
        margin:       item.margin,
        cost:         item.cost,
      })),
      total:    Number(convertPrice(cartTotal).toFixed(2)),
      subtotal: Number(convertPrice(cartSubtotal).toFixed(2)),
      ivaTotal: Number(convertPrice(cartIVATotal).toFixed(2)),
      date:     new Date().toLocaleDateString("es-AR"),
      showCost: false,
      iva:      true,
    });
  }

  const itemCount  = cartItems.reduce((s, i) => s + i.quantity, 0);
  const totalCost  = cartItems.reduce((s, i) => s + (i.cost ?? 0) * i.quantity, 0);
  const totalProfit = cartSubtotal - totalCost;
  const avgMarginPct = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()} direction="right">
      <DrawerContent className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-[#0d0d0d] border-l border-[#1a1a1a] shadow-2xl shadow-black/60 flex flex-col">

        {/* Header */}
        <DrawerHeader className="flex items-center justify-between border-b border-[#1a1a1a] px-5 py-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <ShoppingCart size={16} className="text-[#2D9F6A]" />
            <DrawerTitle className="text-base font-bold text-white">
              Carrito
            </DrawerTitle>
            {itemCount > 0 && (
              <span className="text-xs text-[#525252] bg-[#171717] border border-[#222] px-2 py-0.5 rounded-full font-medium">
                {itemCount} {itemCount === 1 ? "item" : "items"}
              </span>
            )}
          </div>
          <DrawerClose asChild>
            <button className="text-gray-600 hover:text-white transition p-1.5 rounded-lg hover:bg-[#1e1e1e]">
              <X size={15} />
            </button>
          </DrawerClose>
        </DrawerHeader>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
          {cartItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 text-gray-600 py-16">
              <ShoppingCart size={32} className="mb-3 opacity-20" />
              <p className="text-sm font-medium text-gray-500">El carrito está vacío</p>
              <p className="text-xs text-gray-700 mt-1">Agregá productos del catálogo</p>
            </div>
          ) : (
            cartItems.map((item) => (
              <div key={item.product.id}
                className="bg-[#111] border border-[#1f1f1f] rounded-xl p-3 hover:border-[#252525] hover:bg-[#141414] transition-colors">
                <div className="flex items-start gap-3">
                  {/* Image */}
                  <div className="h-12 w-12 bg-[#0a0a0a] rounded-lg flex items-center justify-center shrink-0 border border-[#1a1a1a]">
                    <img src={item.product.image} alt={item.product.name}
                      className="max-h-10 max-w-10 object-contain" />
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white line-clamp-1 leading-tight">{item.product.name}</p>
                    <p className="text-[11px] text-gray-600 mt-0.5">{item.product.category}</p>
                    <p className="text-xs font-bold text-[#2D9F6A] mt-1 tabular-nums">
                      {formatPrice(item.unitPrice)} <span className="font-normal text-[#525252]">s/IVA c/u</span>
                    </p>
                    <p className="text-[10px] text-[#525252] tabular-nums">
                      IVA {item.ivaRate}% · c/IVA {formatPrice(item.totalWithIVA / item.quantity)}
                    </p>
                  </div>
                </div>

                {/* Savings Progress (Phase 4.2) */}
                {(() => {
                  const nextTier = getNextTier(item.product, item.quantity);
                  if (!nextTier) return null;
                  
                  const diff = nextTier.min - item.quantity;
                  const progress = Math.min(100, (item.quantity / nextTier.min) * 100);
                  
                  return (
                    <div className="mt-3 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-2">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[10px] font-bold text-amber-500 flex items-center gap-1 uppercase tracking-wider">
                          <Sparkles size={10} /> ¡Ahorrá más!
                        </span>
                        <span className="text-[10px] text-gray-500 font-medium">
                          Agregá <span className="text-white">{diff}</span> más para bajar a <span className="text-[#2D9F6A] font-bold">{formatPrice(nextTier.price)}</span>
                        </span>
                      </div>
                      <div className="h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-amber-500 transition-all duration-500 rounded-full"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  );
                })()}

                {/* Qty + subtotal */}
                <div className="flex items-center justify-between mt-2.5">
                  <div className="flex items-center gap-1">
                    <button onClick={() => onRemoveFromCart(item.product)}
                      className="h-7 w-7 bg-[#1c1c1c] hover:bg-[#252525] active:scale-95 text-white rounded-lg transition-all flex items-center justify-center border border-[#262626]">
                      <Minus size={11} />
                    </button>
                    <span className="w-8 text-center text-white font-bold text-sm tabular-nums">{item.quantity}</span>
                    <button onClick={() => onAddToCart(item.product)}
                      className="h-7 w-7 bg-[#2D9F6A] hover:bg-[#25835A] active:scale-95 text-white rounded-lg transition-all flex items-center justify-center">
                      <Plus size={11} />
                    </button>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-[#525252] tabular-nums">
                      s/IVA {formatPrice(item.totalPrice)}
                    </div>
                    <div className="text-sm font-extrabold text-white tabular-nums">
                      {formatPrice(item.totalWithIVA)}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {cartItems.length > 0 && (
          <DrawerFooter className="border-t border-[#1a1a1a] px-4 py-4 bg-[#070707] space-y-2.5 shrink-0">
            
            {/* Marketing / Coupons (Phase 5.4) */}
            <div className="space-y-2 mb-2">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Código de cupón"
                    value={couponCode}
                    onChange={(e) => onCouponCodeChange(e.target.value.toUpperCase())}
                    className={`w-full bg-[#111] border ${couponError ? 'border-red-500/50' : 'border-[#1f1f1f]'} rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#2D9F6A]/50 transition-all`}
                  />
                  {validatingCoupon && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 size={12} className="animate-spin text-gray-500" />
                    </div>
                  )}
                </div>
                <button
                  onClick={() => onApplyCoupon(couponCode)}
                  disabled={!couponCode || validatingCoupon || !!appliedCoupon}
                  className="bg-[#1a1a1a] border border-[#262626] hover:border-[#333] text-white px-3 py-2 rounded-xl text-[11px] font-bold transition-all disabled:opacity-50"
                >
                  Aplicar
                </button>
              </div>
              
              {couponError && (
                <p className="text-[10px] text-red-400 font-medium ml-1">{couponError}</p>
              )}

              {appliedCoupon && (
                <div className="flex items-center justify-between bg-[#2D9F6A]/10 border border-[#2D9F6A]/20 rounded-xl px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Sparkles size={12} className="text-[#2D9F6A]" />
                    <span className="text-[11px] font-bold text-white tracking-wide">{appliedCoupon.code}</span>
                    <span className="text-[10px] text-[#2D9F6A] font-medium">
                      ({appliedCoupon.discount_type === 'percentage' ? `-${appliedCoupon.discount_value}%` : `-${formatPrice(appliedCoupon.discount_value)}`})
                    </span>
                  </div>
                  <button onClick={onRemoveCoupon} className="text-gray-500 hover:text-white transition-colors">
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>

            {/* Total breakdown */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600">Subtotal s/IVA</span>
                <span className="text-xs font-semibold text-gray-400 tabular-nums">{formatPrice(cartSubtotal)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600">IVA</span>
                <span className="text-xs font-semibold text-gray-400 tabular-nums">+ {formatPrice(cartIVATotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#2D9F6A] font-medium">Descuento</span>
                  <span className="text-xs font-bold text-[#2D9F6A] tabular-nums">- {formatPrice(discountAmount)}</span>
                </div>
              )}
              {totalProfit > 0 && (
                <div className="flex justify-between items-center py-1.5 border-t border-[#1a1a1a] mt-1">
                  <span className="flex items-center gap-1 text-xs text-[#2D9F6A]">
                    <TrendingUp size={11} /> Ganancia estimada
                  </span>
                  <span className="text-xs font-bold text-[#2D9F6A] tabular-nums">
                    {formatPrice(totalProfit)} ({avgMarginPct.toFixed(1)}%)
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center pt-1.5 border-t border-[#1a1a1a]">
                <div>
                  <span className="text-sm text-gray-400 font-medium">Total c/IVA</span>
                  <div className="text-[10px] text-gray-600 font-mono mt-0.5">
                    @ {exchangeRate.rate.toLocaleString("es-AR")} ARS/USD
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-extrabold text-[#2D9F6A] tabular-nums">
                    {formatPrice(cartTotal)}
                  </div>
                  <div className="text-[10px] text-gray-600 font-mono">
                    {currency === "USD" ? formatARS(cartTotal) : formatUSD(cartTotal)}
                  </div>
                </div>
              </div>
            </div>

            {/* Save quote + Export PDF */}
            <div className="flex gap-2">
              <button
                onClick={onSaveQuote}
                className="flex-1 flex items-center justify-center gap-2 border border-[#1f1f1f] hover:border-[#2D9F6A]/40 text-[#737373] hover:text-[#2D9F6A] bg-transparent hover:bg-[#0d1f17] rounded-xl py-2.5 text-sm transition-all"
              >
                <BookmarkPlus size={14} />
                Guardar cotización
              </button>
              <button
                onClick={() => { void handleExportPDF(); }}
                className="flex-1 flex items-center justify-center gap-2 border border-[#1f1f1f] hover:border-[#2e2e2e] text-[#737373] hover:text-white bg-transparent hover:bg-[#171717] rounded-xl py-2.5 text-sm transition-all"
              >
                <FileDown size={14} />
                Exportar PDF
              </button>
            </div>

            {/* Confirm */}
            <button
              disabled={confirming}
              onClick={onConfirmOrder}
              className="w-full flex items-center justify-center gap-2 bg-[#2D9F6A] hover:bg-[#25835A] active:scale-[0.98] text-white font-bold rounded-xl py-3 text-sm transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              {confirming ? (
                <><Loader2 size={14} className="animate-spin" /> Confirmando pedido...</>
              ) : (
                "Confirmar pedido"
              )}
            </button>
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  );
}
