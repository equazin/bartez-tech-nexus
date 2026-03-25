import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { generateQuotePDF } from "@/components/QuotePDF";
import { UserProfile } from "@/lib/supabase";

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
  open, onClose, cartItems, cartTotal, globalMargin, profile,
  onAddToCart, onRemoveFromCart, onMarginChange, onConfirmOrder, confirming,
}: CartDrawerProps) {

  const costTotal = cartItems.reduce((s, i) => s + i.cost * i.quantity, 0);

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

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()} direction="right">
      <DrawerContent className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-[#181818] border-l border-[#222] shadow-2xl flex flex-col">

        <DrawerHeader className="flex items-center justify-between border-b border-[#222] px-6 py-4">
          <DrawerTitle className="text-lg font-extrabold text-[#FF6A00]">
            Carrito {cartItems.length > 0 && <span className="text-sm text-gray-400 font-normal">({cartItems.length} items)</span>}
          </DrawerTitle>
          <DrawerClose asChild>
            <button className="text-gray-500 hover:text-white transition text-lg leading-none">✕</button>
          </DrawerClose>
        </DrawerHeader>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
          {cartItems.length === 0 ? (
            <div className="text-center text-gray-500 mt-16 text-sm">El carrito está vacío.</div>
          ) : (
            cartItems.map((item) => (
              <div key={item.product.id} className="bg-[#232323] rounded-xl p-3 border border-[#2a2a2a]">
                <div className="flex items-start gap-3">
                  <img src={item.product.image} alt={item.product.name}
                    className="h-12 w-12 object-contain rounded-lg bg-[#1a1a1a] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white line-clamp-1">{item.product.name}</p>
                    <p className="text-xs text-gray-500">{item.product.category}</p>
                    {/* Margen por producto */}
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="text-[10px] text-gray-500">Margen:</span>
                      <input
                        type="number" min="0" max="100"
                        value={item.margin}
                        onChange={(e) => onMarginChange?.(item.product.id, Number(e.target.value))}
                        className="w-12 bg-[#1a1a1a] border border-[#333] text-[#FF6A00] font-bold text-xs rounded px-1.5 py-0.5 outline-none text-center"
                      />
                      <span className="text-[10px] text-gray-500">%</span>
                      <span className="text-[10px] text-gray-600 ml-1 line-through">${item.cost.toLocaleString()}</span>
                      <span className="text-[10px] text-[#FF6A00] font-semibold">→ ${item.unitPrice.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                {/* Controles qty + subtotal */}
                <div className="flex items-center justify-between mt-2.5">
                  <div className="flex items-center gap-1">
                    <button onClick={() => onRemoveFromCart(item.product)}
                      className="h-7 w-7 bg-[#1a1a1a] hover:bg-[#333] text-white rounded-lg text-sm font-bold transition">−</button>
                    <span className="w-7 text-center text-white font-bold text-sm">{item.quantity}</span>
                    <button onClick={() => onAddToCart(item.product)}
                      className="h-7 w-7 bg-[#FF6A00] hover:bg-[#FF8C1A] text-white rounded-lg text-sm font-bold transition">+</button>
                  </div>
                  <span className="text-base font-extrabold text-[#FF6A00]">
                    ${item.totalPrice.toLocaleString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <DrawerFooter className="border-t border-[#222] px-4 py-4 bg-[#141414] space-y-3">
          {cartItems.length > 0 && (
            <>
              {/* Resumen costos */}
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-400">
                  <span>Costo total</span>
                  <span>${costTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-extrabold text-white text-lg">
                  <span>Total cliente</span>
                  <span className="text-[#FF6A00]">${cartTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs text-green-400">
                  <span>Ganancia estimada</span>
                  <span>+${(cartTotal - costTotal).toLocaleString()}</span>
                </div>
              </div>

              {/* Exportar PDF */}
              <Button
                variant="outline"
                className="w-full border-[#333] text-gray-300 hover:text-white hover:border-[#FF6A00]/50 gap-2 text-sm"
                onClick={handleExportPDF}
              >
                <FileDown size={15} />
                Exportar cotización PDF
              </Button>

              {/* Confirmar */}
              <Button
                disabled={confirming}
                onClick={onConfirmOrder}
                className="w-full bg-gradient-to-br from-[#FF6A00] to-[#FF8C1A] text-white font-bold rounded-lg h-11 disabled:opacity-50 disabled:pointer-events-none gap-2"
              >
                {confirming ? (
                  <><Loader2 size={15} className="animate-spin" /> Confirmando...</>
                ) : (
                  "Confirmar pedido"
                )}
              </Button>
            </>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
