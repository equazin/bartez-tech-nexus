import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  cartItems: any[];
  cartTotal: number;
  onAddToCart: (product: any) => void;
  onRemoveFromCart: (product: any) => void;
  onConfirmOrder?: () => void;
}

export function CartDrawer({ open, onClose, cartItems, cartTotal, onAddToCart, onRemoveFromCart, onConfirmOrder }: CartDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={open => !open ? onClose() : undefined} direction="right">
      <DrawerContent className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-[#181818] border-l border-[#222] shadow-2xl flex flex-col">
        <DrawerHeader className="flex flex-row items-center justify-between border-b border-[#222] px-6 py-4">
          <DrawerTitle className="text-xl font-extrabold text-[#FF6A00]">Carrito</DrawerTitle>
          <DrawerClose asChild>
            <Button variant="ghost" className="text-white hover:bg-[#FF6A00]/10">✕</Button>
          </DrawerClose>
        </DrawerHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
          {cartItems.length === 0 ? (
            <div className="text-center text-gray-400 mt-12">El carrito está vacío.</div>
          ) : (
            cartItems.map((item) => (
              <div key={item.product.id} className="flex items-center gap-4 bg-[#232323] rounded-lg p-3 border border-[#222]">
                <img src={item.product.image} alt={item.product.name} className="h-14 w-14 object-contain rounded bg-[#181818]" />
                <div className="flex-1">
                  <div className="font-bold text-white text-sm line-clamp-1">{item.product.name}</div>
                  <div className="text-xs text-[#FF6A00] font-semibold">{item.product.category}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-400 line-through">${item.cost.toLocaleString()}</span>
                    <span className="text-base font-black text-[#FF6A00]">${item.unitPrice.toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="text-[#FF6A00] hover:bg-[#FF6A00]/10" onClick={() => onRemoveFromCart(item.product)}>-</Button>
                    <span className="font-bold text-white px-2">{item.quantity}</span>
                    <Button size="icon" variant="ghost" className="text-[#FF6A00] hover:bg-[#FF6A00]/10" onClick={() => onAddToCart(item.product)}>+</Button>
                  </div>
                  <Badge className="bg-[#FF6A00] text-white font-bold px-2 py-1 rounded">${item.totalPrice.toLocaleString()}</Badge>
                </div>
              </div>
            ))
          )}
        </div>
        <DrawerFooter className="border-t border-[#222] px-6 py-4 bg-[#141414]">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-white text-lg">Total</span>
            <span className="font-black text-2xl text-[#FF6A00]">${cartTotal.toLocaleString()}</span>
          </div>
          <Button
            disabled={cartItems.length === 0}
            onClick={onConfirmOrder}
            className="w-full bg-gradient-to-br from-[#FF6A00] to-[#FF8C1A] text-white font-bold rounded-lg shadow-lg hover:brightness-110 focus:ring-2 focus:ring-[#FF6A00]/60 focus:ring-offset-2 transition-all duration-200 ease-in-out hover:shadow-[0_0_24px_4px_#FF6A00] hover:scale-105 mt-2 disabled:opacity-50 disabled:pointer-events-none"
          >
            Confirmar pedido
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
