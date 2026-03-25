import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2, ShoppingCart, Minus, Plus, X } from "lucide-react";
import { generateQuotePDF } from "@/components/QuotePDF";
import { UserProfile } from "@/lib/supabase";
import { useCurrency } from "@/context/CurrencyContext";

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  cartItems: any[];
  cartTotal: number;
  globalMargin: number;
  profile?: UserProfile | null;
  onAddToCart: (product: any) => void;
  onRemoveFromCart: (product: any) => void;
  onMarginChange?: (productId: number, margin: number) => void;
  onConfirmOrder?: () => void;
  confirming?: boolean;
}

export function CartDrawer({
  open, onClose, cartItems, cartTotal, profile,
  onAddToCart, onRemoveFromCart, onConfirmOrder, confirming,
}: CartDrawerProps) {
  const { formatPrice, formatUSD, formatARS, currency, exchangeRate } = useCurrency();

  function handleExportPDF() {
    generateQuotePDF({
      clientName: profile?.company_name || profile?.contact_name || "Cliente",
      companyName: "Bartez Tecnología",
      products: cartItems.map((item) => ({
        name: item.product.name,
        quantity: item.quantity,
        price: Number(item.unitPrice.toFixed(2)),
        total: Number(item.totalPrice.toFixed(2)),
        margin: item.margin,
        cost: item.cost,
      })),
      total: Number(cartTotal.toFixed(2)),
      date: new Date().toLocaleDateString("es-AR"),
      showCost: false,
    });
  }

  const itemCount = cartItems.reduce((s, i) => s + i.quantity, 0);

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()} direction="right">
      <DrawerContent className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-[#111] border-l border-[#1e1e1e] shadow-2xl flex flex-col">

        {/* Header */}
        <DrawerHeader className="flex items-center justify-between border-b border-[#1e1e1e] px-5 py-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <ShoppingCart size={16} className="text-[#FF6A00]" />
            <DrawerTitle className="text-base font-bold text-white">
              Carrito
            </DrawerTitle>
            {itemCount > 0 && (
              <span className="text-xs text-gray-600 bg-[#1e1e1e] px-2 py-0.5 rounded-full font-medium">
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
                className="bg-[#1a1a1a] border border-[#242424] rounded-xl p-3 hover:border-[#2a2a2a] transition-colors">
                <div className="flex items-start gap-3">
                  {/* Image */}
                  <div className="h-12 w-12 bg-[#111] rounded-lg flex items-center justify-center shrink-0 border border-[#222]">
                    <img src={item.product.image} alt={item.product.name}
                      className="max-h-10 max-w-10 object-contain" />
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white line-clamp-1 leading-tight">{item.product.name}</p>
                    <p className="text-[11px] text-gray-600 mt-0.5">{item.product.category}</p>
                    <p className="text-xs font-bold text-[#FF6A00] mt-1 tabular-nums">
                      {formatPrice(item.unitPrice)} c/u
                    </p>
                    <p className="text-[10px] text-gray-700 font-mono tabular-nums">
                      {currency === "USD" ? formatARS(item.unitPrice) : formatUSD(item.unitPrice)} c/u
                    </p>
                  </div>
                </div>

                {/* Qty + subtotal */}
                <div className="flex items-center justify-between mt-2.5">
                  <div className="flex items-center gap-1">
                    <button onClick={() => onRemoveFromCart(item.product)}
                      className="h-7 w-7 bg-[#252525] hover:bg-[#2e2e2e] active:scale-95 text-white rounded-lg transition-all flex items-center justify-center">
                      <Minus size={11} />
                    </button>
                    <span className="w-8 text-center text-white font-bold text-sm tabular-nums">{item.quantity}</span>
                    <button onClick={() => onAddToCart(item.product)}
                      className="h-7 w-7 bg-[#FF6A00] hover:bg-[#FF8C1A] active:scale-95 text-white rounded-lg transition-all flex items-center justify-center">
                      <Plus size={11} />
                    </button>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-extrabold text-white tabular-nums">
                      {formatPrice(item.totalPrice)}
                    </div>
                    <div className="text-[10px] text-gray-700 font-mono">
                      {currency === "USD" ? formatARS(item.totalPrice) : formatUSD(item.totalPrice)}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {cartItems.length > 0 && (
          <DrawerFooter className="border-t border-[#1e1e1e] px-4 py-4 bg-[#0e0e0e] space-y-2.5 shrink-0">
            {/* Total */}
            <div className="flex justify-between items-start">
              <div>
                <span className="text-sm text-gray-500 font-medium">Total</span>
                <div className="text-[10px] text-gray-700 font-mono mt-0.5">
                  {currency === "USD" ? formatARS(cartTotal) : formatUSD(cartTotal)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-extrabold text-[#FF6A00] tabular-nums">
                  {formatPrice(cartTotal)}
                </div>
                <div className="text-[10px] text-gray-600 mt-0.5">
                  @ {exchangeRate.rate.toLocaleString("es-AR")} ARS/USD
                </div>
              </div>
            </div>

            {/* Export PDF */}
            <button
              onClick={handleExportPDF}
              className="w-full flex items-center justify-center gap-2 border border-[#2a2a2a] hover:border-[#FF6A00]/30 text-gray-400 hover:text-white bg-transparent hover:bg-[#1a1a1a] rounded-xl py-2.5 text-sm transition-all"
            >
              <FileDown size={14} />
              Exportar cotización PDF
            </button>

            {/* Confirm */}
            <button
              disabled={confirming}
              onClick={onConfirmOrder}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#FF6A00] to-[#FF8C1A] hover:brightness-110 active:scale-[0.98] text-white font-bold rounded-xl py-3 text-sm transition-all disabled:opacity-50 disabled:pointer-events-none"
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
