import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSharedCartState } from "@/hooks/useSharedCartState";
import { useProducts } from "@/hooks/useProducts";
import { getAvailableStock } from "@/lib/pricing";
import { useToast } from "@/hooks/use-toast";
import type { PortalOrder } from "@/hooks/useOrders";

interface Props {
  order: PortalOrder;
  clientId: string;
  onDone?: () => void;
}

export function RepeatOrderButton({ order, clientId, onDone }: Props) {
  const { setCart } = useSharedCartState(clientId);
  const { products } = useProducts({ pageSize: 200 });
  const { toast } = useToast();

  function handleRepeat() {
    const newCart: Record<number, number> = {};
    const outOfStock: string[] = [];

    for (const item of order.products) {
      const product = products.find((p) => p.id === item.product_id);
      if (!product) continue;
      const available = getAvailableStock(product);
      const qty = Math.min(item.quantity, available);
      if (qty > 0) {
        newCart[item.product_id] = qty;
      } else {
        outOfStock.push(item.name ?? `#${item.product_id}`);
      }
    }

    setCart((prev) => {
      const merged = { ...prev };
      for (const [id, qty] of Object.entries(newCart)) {
        merged[Number(id)] = (merged[Number(id)] ?? 0) + qty;
      }
      return merged;
    });

    if (outOfStock.length > 0) {
      toast({
        title: "Algunos productos sin stock",
        description: `No se agregaron: ${outOfStock.slice(0, 3).join(", ")}${outOfStock.length > 3 ? "…" : ""}`,
        variant: "default",
      });
    } else {
      toast({ title: "Pedido reagregado al carrito" });
    }

    onDone?.();
  }

  return (
    <Button variant="outline" size="sm" className="gap-1.5" onClick={handleRepeat}>
      <RotateCcw className="h-3.5 w-3.5" />
      Reagregar
    </Button>
  );
}
