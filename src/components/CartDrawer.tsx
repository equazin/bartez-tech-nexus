import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2, ShoppingCart, Minus, Plus, X, BookmarkPlus } from "lucide-react";
import { generateQuotePDF } from "@/components/QuotePDF";
import { UserProfile } from "@/lib/supabase";
import { useCurrency } from "@/context/CurrencyContext";

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  cartItems: any[];
  cartSubtotal: number;
  cartIVATotal: number;
  cartTotal: number;
  globalMargin: number;
  profile?: UserProfile | null;
  onAddToCart: (product: any) => void;
  onRemoveFromCart: (product: any) => void;
  onMarginChange?: (productId: number, margin: number) => void;
  onConfirmOrder?: () => void;
  onSaveQuote?: () => void;
  confirming?: boolean;
}

export function CartDrawer({
  open, onClose, cartItems, cartSubtotal, cartIVATotal, cartTotal, profile,
  onAddToCart, onRemoveFromCart, onConfirmOrder, onSaveQuote, confirming,
}: CartDrawerProps) {
  const { formatPrice, formatUSD, formatARS, currency, exchangeRate, convertPrice } = useCurrency();

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

  const itemCount = cartItems.reduce((s, i) => s + i.quantity, 0);

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
                onClick={handleExportPDF}
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
