import { useState } from "react";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2, ShoppingCart, Minus, Plus, X, BookmarkPlus, TrendingUp, Download, Image as ImageIcon, MessageCircle, UserCircle, Sparkles, Zap } from "lucide-react";
import type { Product } from "@/models/products";
import { generateWhatsAppCartUrl } from "@/lib/api/whatsapp";
import { calculateResellerPrice } from "@/lib/api/resellerQuotes";
import { getNextTier } from "@/lib/pricing";
import { generateQuotePdfOnDemand } from "@/lib/quotePdfClient";
import { UserProfile, supabase } from "@/lib/supabase";
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
  const [resellerMarkup, setResellerMarkup] = useState(25);
  const [resellerMode, setResellerMode] = useState(false);
  const [resellerLogo, setResellerLogo] = useState<string | null>(null);
  const [resellerName, setResellerName] = useState(profile?.company_name || "");
  const [generatingQuote, setGeneratingQuote] = useState(false);

  async function handleExportPDF() {
    await generateQuotePdfOnDemand({
      clientName:  profile?.company_name || profile?.contact_name || "Cliente",
      companyName: profile?.company_name || profile?.contact_name || "Cliente",
      whiteLabel:  true,
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

  const handleExportQuote = async () => {
    setGeneratingQuote(true);
    try {
      console.log("Generating Reseller Quote PDF with markup:", resellerMarkup, "Logo:", resellerLogo);
      setTimeout(() => {
        setGeneratingQuote(false);
        setResellerMode(false);
      }, 1500);
    } catch (err) {
      setGeneratingQuote(false);
    }
  };

  async function handleWhatsAppShare() {
    try {
      // 1. Create a shared cart token in DB
      const items = cartItems.map(item => ({
        product_id: item.product.id,
        quantity: item.quantity
      }));
      
      const { data, error } = await supabase
        .from("shared_carts")
        .insert({ items, created_by: profile?.id })
        .select("id")
        .single();
        
      if (error) throw error;
      
      // 2. Generate WhatsApp URL
      const shareUrl = `${window.location.origin}/b2b?cart_token=${data.id}`;
      const message = `¡Hola! Te comparto mi pedido sugerido en Bartez Tech Nexus: \n\n${shareUrl}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
    } catch (err) {
      console.error("WhatsApp Share Error:", err);
    }
  }

  const itemCount  = cartItems.reduce((s, i) => s + i.quantity, 0);
  const totalCost  = cartItems.reduce((s, i) => s + (i.cost ?? 0) * i.quantity, 0);
  const totalProfit = cartSubtotal - totalCost;
  const avgMarginPct = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()} direction="right">
      <DrawerContent className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-[#0d0d0d] border-l border-[#1a1a1a] shadow-2xl shadow-black/60 flex flex-col">

        <DrawerHeader className="flex items-center justify-between border-b border-[#1a1a1a] px-5 py-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <ShoppingCart size={16} className="text-[#2D9F6A]" />
            <div>
              <DrawerTitle className="text-base font-bold text-white leading-none">
                {resellerMode ? "Configurar Presupuesto" : "Carrito"}
              </DrawerTitle>
              {!resellerMode && itemCount > 0 && (
                <p className="text-[10px] text-gray-500 mt-0.5 leading-none">
                  {itemCount} {itemCount !== 1 ? "artículos" : "artículo"} · {formatPrice(cartTotal)}
                </p>
              )}
            </div>
          </div>
          <DrawerClose asChild>
            <button className="text-gray-600 hover:text-white transition p-1.5 rounded-lg hover:bg-[#1e1e1e]">
              <X size={15} />
            </button>
          </DrawerClose>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
          {resellerMode ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold uppercase text-gray-500">Markup Personalizado (%)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0" max="100" step="5"
                    value={resellerMarkup}
                    onChange={(e) => setResellerMarkup(Number(e.target.value))}
                    className="flex-1 h-1 bg-[#1a1a1a] rounded-lg appearance-none cursor-pointer accent-[#2D9F6A]"
                  />
                  <span className="text-sm font-bold text-[#2D9F6A] w-12 text-right">+{resellerMarkup}%</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold uppercase text-gray-500">Identidad del Presupuesto</label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-xl border flex flex-col items-center justify-center gap-2 aspect-square group relative overflow-hidden bg-[#111] border-[#1f1f1f]">
                    {resellerLogo ? (
                      <img src={resellerLogo} alt="Logo" className="w-full h-full object-contain" />
                    ) : (
                      <>
                        <ImageIcon size={20} className="text-gray-500" />
                        <span className="text-[9px] text-gray-500 text-center">Subir Logo</span>
                      </>
                    )}
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="absolute inset-0 opacity-0 cursor-pointer" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => setResellerLogo(ev.target?.result as string);
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </div>
                  <div className="p-3 rounded-xl border flex flex-col justify-between bg-[#111] border-[#1f1f1f]">
                    <label className="text-[9px] font-bold text-gray-500">Razón Social</label>
                    <input 
                      value={resellerName}
                      onChange={(e) => setResellerName(e.target.value)}
                      className="w-full bg-transparent border-none text-[11px] font-bold outline-none text-white"
                      placeholder="Nombre de tu empresa..."
                    />
                    <div className="h-px w-full bg-gray-500/20" />
                    <span className="text-[9px] text-gray-500">Se usará en el encabezado del PDF.</span>
                  </div>
                </div>
              </div>

              <button 
                onClick={handleExportQuote}
                disabled={generatingQuote}
                className="w-full h-11 bg-[#2D9F6A] hover:bg-[#25835A] text-white font-bold rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                {generatingQuote ? (
                  <> <Loader2 size={16} className="animate-spin" /> Generando PDF... </>
                ) : (
                  <> <Download size={16} /> Generar Presupuesto con Logo </>
                )}
              </button>
              <button 
                onClick={() => setResellerMode(false)}
                className="w-full text-[11px] font-bold text-gray-500 uppercase hover:underline"
              >
                Volver al Carrito
              </button>
            </div>
          ) : (
            cartItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 text-gray-600 py-16">
                <ShoppingCart size={32} className="mb-3 opacity-20" />
                <p className="text-sm font-medium text-gray-500">El carrito está vacío</p>
              </div>
            ) : (
              cartItems.map((item) => {
                const nextTier = getNextTier(item.product, item.quantity);
                const prevTierMin = (() => {
                  if (!item.product.price_tiers?.length) return 1;
                  const below = item.product.price_tiers.filter((t) => t.min <= item.quantity).sort((a, b) => b.min - a.min);
                  return below[0]?.min ?? 1;
                })();
                const tierProgress = nextTier
                  ? Math.round(((item.quantity - prevTierMin) / (nextTier.min - prevTierMin)) * 100)
                  : 100;
                const unitsToNext = nextTier ? nextTier.min - item.quantity : 0;

                return (
                <div key={item.product.id} className="bg-[#111] border border-[#1f1f1f] rounded-xl p-3 space-y-2">
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-12 bg-[#0a0a0a] rounded-lg flex items-center justify-center shrink-0 border border-[#1a1a1a]">
                      <img src={item.product.image} alt={item.product.name} className="max-h-10 max-w-10 object-contain" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white line-clamp-1 leading-tight">{item.product.name}</p>
                      <p className="text-xs font-bold text-[#2D9F6A] mt-1 tabular-nums">{formatPrice(item.unitPrice)}<span className="ml-1 text-[10px] font-normal text-gray-600">c/u</span></p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <button onClick={() => onRemoveFromCart(item.product)} className="h-7 w-7 bg-[#1c1c1c] hover:bg-[#252525] text-white rounded-lg flex items-center justify-center border border-[#262626]"><Minus size={11} /></button>
                      <span className="w-8 text-center text-white font-bold text-sm tabular-nums">{item.quantity}</span>
                      <button onClick={() => onAddToCart(item.product)} className="h-7 w-7 bg-[#2D9F6A] hover:bg-[#25835A] text-white rounded-lg flex items-center justify-center"><Plus size={11} /></button>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-extrabold text-white tabular-nums">{formatPrice(item.totalWithIVA)}</div>
                    </div>
                  </div>
                  {/* Next tier nudge */}
                  {nextTier && (
                    <div className="rounded-lg border border-amber-500/15 bg-amber-500/5 px-2.5 py-2 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-amber-400/80 font-medium">
                          +{unitsToNext}u → <span className="font-bold text-amber-300">{formatPrice(nextTier.price)}</span>/u
                        </span>
                        <span className="text-amber-500/60">escalón de precio</span>
                      </div>
                      <div className="h-1 w-full rounded-full bg-amber-500/15 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-amber-400/70 transition-all duration-300"
                          style={{ width: `${Math.min(tierProgress, 99)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                );
              })
            )
          )}
        </div>

        {!resellerMode && cartItems.length > 0 && (
          <DrawerFooter className="border-t border-[#1a1a1a] px-4 py-4 bg-[#070707] space-y-2.5 shrink-0">
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

            {/* Tools Area (Argentina B2B Expansion) */}
            <div className="flex flex-col gap-2 pt-2 border-t border-[#1a1a1a]">
              <div className="flex gap-2">
                <button
                  onClick={handleWhatsAppShare}
                  className="flex-1 flex items-center justify-center gap-2 border border-green-500/30 hover:border-green-500/60 text-green-500 hover:bg-green-500/10 rounded-xl py-2 text-xs transition-all"
                >
                  <MessageCircle size={13} />
                  WhatsApp
                </button>
                <button
                  onClick={() => setResellerMode(true)}
                  className="flex-1 flex items-center justify-center gap-2 border border-blue-500/30 hover:border-blue-500/60 text-blue-400 hover:bg-blue-500/10 rounded-xl py-2 text-xs transition-all"
                >
                  <UserCircle size={13} />
                  Mi Cotización
                </button>
              </div>
            </div>

            {/* Cotización Express + Export PDF */}
            <div className="flex gap-2">
              <button
                onClick={onSaveQuote}
                className="flex-1 flex items-center justify-center gap-2 border border-[#2D9F6A]/40 hover:border-[#2D9F6A]/70 text-[#2D9F6A] bg-[#0d1f17] hover:bg-[#102518] rounded-xl py-2.5 text-sm font-semibold transition-all"
                title="Genera la cotización al instante. Sin formulario."
              >
                <Zap size={14} />
                Cotización Express
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
