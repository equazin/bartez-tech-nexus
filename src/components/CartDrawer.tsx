import { useState } from "react";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose,
} from "@/components/ui/drawer";
import {
  FileDown, Loader2, ShoppingCart, Minus, Plus, X, BookmarkPlus,
  Save, FolderOpen, Trash2, TrendingUp, AlertCircle,
} from "lucide-react";
import { generateQuotePDF } from "@/components/QuotePDF";
import { UserProfile } from "@/lib/supabase";
import { useCurrency } from "@/context/CurrencyContext";
import type { SavedCart } from "@/lib/savedCarts";

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  cartItems: any[];
  cartSubtotal: number;
  cartIVATotal: number;
  cartTotal: number;
  globalMargin: number;
  profile?: UserProfile | null;
  savedCarts: SavedCart[];
  creditUsed: number;
  onAddToCart: (product: any) => void;
  onRemoveFromCart: (product: any) => void;
  onMarginChange?: (productId: number, margin: number) => void;
  onConfirmOrder?: () => void;
  onSaveQuote?: () => void;
  onSaveNamedCart?: (name: string) => void;
  onLoadSavedCart?: (cart: SavedCart) => void;
  onDeleteSavedCart?: (cartId: string) => void;
  confirming?: boolean;
}

export function CartDrawer({
  open, onClose, cartItems, cartSubtotal, cartIVATotal, cartTotal,
  profile, savedCarts, creditUsed,
  onAddToCart, onRemoveFromCart, onConfirmOrder, onSaveQuote,
  onSaveNamedCart, onLoadSavedCart, onDeleteSavedCart, confirming,
}: CartDrawerProps) {
  const { formatPrice, formatUSD, formatARS, currency, exchangeRate, convertPrice } = useCurrency();
  const [saveCartName, setSaveCartName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [showSavedCarts, setShowSavedCarts] = useState(false);

  function handleExportPDF() {
    generateQuotePDF({
      clientName: profile?.company_name || profile?.contact_name || "Cliente",
      companyName: "Bartez Tecnología",
      currency,
      products: cartItems.map((item) => ({
        name: item.product.name,
        quantity: item.quantity,
        price: Number(convertPrice(item.unitPrice).toFixed(2)),
        total: Number(convertPrice(item.totalPrice).toFixed(2)),
        ivaRate: item.ivaRate,
        ivaAmount: Number(convertPrice(item.ivaAmount).toFixed(2)),
        totalWithIVA: Number(convertPrice(item.totalWithIVA).toFixed(2)),
        margin: item.margin,
        cost: item.cost,
      })),
      total: Number(convertPrice(cartTotal).toFixed(2)),
      subtotal: Number(convertPrice(cartSubtotal).toFixed(2)),
      ivaTotal: Number(convertPrice(cartIVATotal).toFixed(2)),
      date: new Date().toLocaleDateString("es-AR"),
      showCost: false,
      iva: true,
    });
  }

  function handleSaveCart() {
    if (!onSaveNamedCart) return;
    onSaveNamedCart(saveCartName);
    setSaveCartName("");
    setShowSaveInput(false);
  }

  const itemCount = cartItems.reduce((s, i) => s + i.quantity, 0);

  // Profit calculations
  const cartProfit = cartItems.reduce((s, i) => s + (i.unitPrice - i.cost) * i.quantity, 0);
  const cartMarginPct = cartSubtotal > 0 ? (cartProfit / (cartSubtotal - cartProfit)) * 100 : 0;

  // Credit limit
  const creditLimit = profile?.credit_limit ?? 0;
  const creditAvailable = creditLimit > 0 ? Math.max(0, creditLimit - creditUsed) : Infinity;
  const overCredit = creditLimit > 0 && cartTotal > creditAvailable;

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()} direction="right">
      <DrawerContent className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-[#0d0d0d] border-l border-[#1a1a1a] shadow-2xl shadow-black/60 flex flex-col">

        {/* Header */}
        <DrawerHeader className="flex items-center justify-between border-b border-[#1a1a1a] px-5 py-3.5 shrink-0">
          <div className="flex items-center gap-2.5">
            <ShoppingCart size={16} className="text-[#2D9F6A]" />
            <DrawerTitle className="text-base font-bold text-white">Carrito</DrawerTitle>
            {itemCount > 0 && (
              <span className="text-xs text-[#525252] bg-[#171717] border border-[#222] px-2 py-0.5 rounded-full font-medium">
                {itemCount} {itemCount === 1 ? "item" : "items"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {/* Saved carts toggle */}
            {savedCarts.length > 0 && (
              <button
                onClick={() => { setShowSavedCarts((p) => !p); setShowSaveInput(false); }}
                title="Carritos guardados"
                className={`p-1.5 rounded-lg transition text-xs flex items-center gap-1 font-medium ${showSavedCarts ? "bg-[#2D9F6A]/20 text-[#2D9F6A]" : "text-[#525252] hover:text-white hover:bg-[#1e1e1e]"}`}
              >
                <FolderOpen size={13} />
                <span className="text-[10px]">{savedCarts.length}</span>
              </button>
            )}
            <DrawerClose asChild>
              <button className="text-gray-600 hover:text-white transition p-1.5 rounded-lg hover:bg-[#1e1e1e]">
                <X size={15} />
              </button>
            </DrawerClose>
          </div>
        </DrawerHeader>

        {/* Saved Carts panel */}
        {showSavedCarts && savedCarts.length > 0 && (
          <div className="border-b border-[#1a1a1a] px-4 py-3 bg-[#080808] space-y-1.5 shrink-0 max-h-48 overflow-y-auto">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#525252] mb-2">Carritos guardados</p>
            {savedCarts.map((sc) => (
              <div key={sc.id} className="flex items-center gap-2 bg-[#111] border border-[#1a1a1a] rounded-lg px-2.5 py-1.5">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-300 truncate">{sc.name}</p>
                  <p className="text-[10px] text-gray-600">
                    {new Date(sc.savedAt).toLocaleDateString("es-AR")} ·{" "}
                    {Object.keys(sc.items).length} producto{Object.keys(sc.items).length !== 1 ? "s" : ""}
                  </p>
                </div>
                <button
                  onClick={() => { onLoadSavedCart?.(sc); setShowSavedCarts(false); }}
                  className="text-[#2D9F6A] hover:text-white text-xs font-bold px-2 py-0.5 rounded bg-[#2D9F6A]/10 hover:bg-[#2D9F6A]/20 transition"
                >
                  Cargar
                </button>
                <button
                  onClick={() => onDeleteSavedCart?.(sc.id)}
                  className="text-gray-600 hover:text-red-400 transition p-0.5"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
          {cartItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 text-gray-600 py-16">
              <ShoppingCart size={32} className="mb-3 opacity-20" />
              <p className="text-sm font-medium text-gray-500">El carrito está vacío</p>
              <p className="text-xs text-gray-700 mt-1">Agregá productos del catálogo</p>
              {savedCarts.length > 0 && (
                <button
                  onClick={() => setShowSavedCarts(true)}
                  className="mt-3 text-xs text-[#2D9F6A] hover:underline flex items-center gap-1"
                >
                  <FolderOpen size={12} /> Ver carritos guardados
                </button>
              )}
            </div>
          ) : (
            cartItems.map((item) => {
              const itemProfit = (item.unitPrice - item.cost) * item.quantity;
              const minQty = item.product.min_order_qty ?? 1;
              const belowMin = item.quantity < minQty;
              return (
                <div key={item.product.id}
                  className={`bg-[#111] border rounded-xl p-3 transition-colors ${belowMin ? "border-amber-500/30" : "border-[#1f1f1f] hover:border-[#252525] hover:bg-[#141414]"}`}>
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-12 bg-[#0a0a0a] rounded-lg flex items-center justify-center shrink-0 border border-[#1a1a1a]">
                      <img src={item.product.image} alt={item.product.name}
                        className="max-h-10 max-w-10 object-contain" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <p className="text-sm font-semibold text-white line-clamp-1 leading-tight">{item.product.name}</p>
                        {/* Ganancia por ítem */}
                        <span className="text-[10px] font-bold text-green-400 shrink-0 tabular-nums">
                          +{formatPrice(itemProfit)}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-600 mt-0.5">{item.product.category}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs font-bold text-[#2D9F6A] tabular-nums">
                          {formatPrice(item.unitPrice)} <span className="font-normal text-[#525252]">s/IVA</span>
                        </p>
                        <span className="text-[10px] text-[#525252]">+{item.ivaRate}% IVA</span>
                        <span className="text-[10px] text-green-500/70 font-medium">{item.margin}% margen</span>
                      </div>
                      {belowMin && (
                        <p className="text-[10px] text-amber-400 mt-0.5 flex items-center gap-1">
                          <AlertCircle size={9} /> Mín. {minQty}u requeridas
                        </p>
                      )}
                    </div>
                  </div>
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
                      <div className="text-xs text-[#525252] tabular-nums">s/IVA {formatPrice(item.totalPrice)}</div>
                      <div className="text-sm font-extrabold text-white tabular-nums">{formatPrice(item.totalWithIVA)}</div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {cartItems.length > 0 && (
          <DrawerFooter className="border-t border-[#1a1a1a] px-4 py-4 bg-[#070707] space-y-2 shrink-0">

            {/* Credit warning */}
            {overCredit && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/25 rounded-lg px-3 py-2">
                <AlertCircle size={13} className="text-red-400 shrink-0" />
                <div className="text-xs text-red-300">
                  <span className="font-bold">Límite de crédito superado.</span>{" "}
                  Disponible: {formatPrice(creditAvailable)}
                </div>
              </div>
            )}

            {/* Profit summary */}
            <div className="flex items-center justify-between bg-green-500/8 border border-green-500/15 rounded-lg px-3 py-2">
              <div className="flex items-center gap-1.5 text-xs text-green-400">
                <TrendingUp size={12} />
                <span>Tu ganancia</span>
                <span className="text-green-600 font-medium">({cartMarginPct.toFixed(1)}% margen)</span>
              </div>
              <span className="text-sm font-extrabold text-green-400 tabular-nums">
                {formatPrice(cartProfit)}
              </span>
            </div>

            {/* Totals */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600">Subtotal s/IVA</span>
                <span className="text-xs font-semibold text-gray-400 tabular-nums">{formatPrice(cartSubtotal)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600">IVA</span>
                <span className="text-xs font-semibold text-gray-400 tabular-nums">+ {formatPrice(cartIVATotal)}</span>
              </div>
              <div className="flex justify-between items-center pt-1.5 border-t border-[#1a1a1a]">
                <div>
                  <span className="text-sm text-gray-400 font-medium">Total c/IVA</span>
                  <div className="text-[10px] text-gray-600 font-mono mt-0.5">
                    @ {exchangeRate.rate.toLocaleString("es-AR")} ARS/USD
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-extrabold text-[#2D9F6A] tabular-nums">{formatPrice(cartTotal)}</div>
                  <div className="text-[10px] text-gray-600 font-mono">
                    {currency === "USD" ? formatARS(cartTotal) : formatUSD(cartTotal)}
                  </div>
                </div>
              </div>
            </div>

            {/* Save cart input */}
            {showSaveInput ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nombre del carrito"
                  value={saveCartName}
                  autoFocus
                  onChange={(e) => setSaveCartName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSaveCart(); if (e.key === "Escape") setShowSaveInput(false); }}
                  className="flex-1 bg-[#111] border border-[#262626] text-white text-xs rounded-lg px-3 py-2 outline-none focus:border-[#2D9F6A]/50"
                />
                <button onClick={handleSaveCart}
                  className="bg-[#2D9F6A] hover:bg-[#25835A] text-white text-xs font-bold px-3 rounded-lg transition">
                  OK
                </button>
                <button onClick={() => setShowSaveInput(false)}
                  className="text-gray-500 hover:text-white transition px-1">
                  <X size={14} />
                </button>
              </div>
            ) : null}

            {/* Action buttons row */}
            <div className="flex gap-1.5">
              <button
                onClick={onSaveQuote}
                title="Guardar cotización"
                className="flex-1 flex items-center justify-center gap-1.5 border border-[#1f1f1f] hover:border-[#2D9F6A]/40 text-[#737373] hover:text-[#2D9F6A] bg-transparent hover:bg-[#0d1f17] rounded-xl py-2 text-xs transition-all"
              >
                <BookmarkPlus size={12} /> Cotización
              </button>
              <button
                onClick={() => { setShowSaveInput(true); setShowSavedCarts(false); }}
                title="Guardar carrito para reusar"
                className="flex-1 flex items-center justify-center gap-1.5 border border-[#1f1f1f] hover:border-[#2e2e2e] text-[#737373] hover:text-white bg-transparent hover:bg-[#171717] rounded-xl py-2 text-xs transition-all"
              >
                <Save size={12} /> Guardar
              </button>
              <button
                onClick={handleExportPDF}
                title="Exportar PDF"
                className="flex items-center justify-center gap-1.5 border border-[#1f1f1f] hover:border-[#2e2e2e] text-[#737373] hover:text-white bg-transparent hover:bg-[#171717] rounded-xl py-2 px-3 text-xs transition-all"
              >
                <FileDown size={12} />
              </button>
            </div>

            {/* Confirm */}
            <button
              disabled={confirming || overCredit}
              onClick={onConfirmOrder}
              className="w-full flex items-center justify-center gap-2 bg-[#2D9F6A] hover:bg-[#25835A] active:scale-[0.98] text-white font-bold rounded-xl py-3 text-sm transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              {confirming ? (
                <><Loader2 size={14} className="animate-spin" /> Confirmando...</>
              ) : overCredit ? (
                "Crédito insuficiente"
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
