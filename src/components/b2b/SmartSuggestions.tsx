import { useMemo } from "react";
import { Sparkles, ShoppingCart, ArrowRight, AlertCircle, TrendingUp } from "lucide-react";
import type { PortalOrder } from "@/hooks/useOrders";
import type { Product } from "@/models/products";
import { Button } from "@/components/ui/button";
import { formatMoneyAmount } from "@/lib/money";
import { useCurrency } from "@/context/CurrencyContext";
import { getAvailableStock } from "@/lib/pricing";

interface SmartSuggestionsProps {
  orders: PortalOrder[];
  products: Product[];
  onAddToCart: (product: Product, qty: number) => void;
  isDark: boolean;
}

export function SmartSuggestions({ orders = [], products = [], onAddToCart, isDark }: SmartSuggestionsProps) {
  const { currency } = useCurrency();
  const dk = (d: string, l: string) => isDark ? d : l;

  const suggestions = useMemo(() => {
    if (orders.length < 2) return [];

    // 1. Group by product_id
    const purchaseMap: Record<number, { dates: number[], totalQty: number, product: Product | null }> = {};
    
    orders.forEach(order => {
      order.products.forEach(p => {
        if (!purchaseMap[p.product_id]) {
          const product = products.find(prod => prod.id === p.product_id) || null;
          purchaseMap[p.product_id] = { dates: [], totalQty: 0, product };
        }
        purchaseMap[p.product_id].dates.push(new Date(order.created_at).getTime());
        purchaseMap[p.product_id].totalQty += p.quantity;
      });
    });

    const results = [];
    const now = Date.now();

    for (const [id, data] of Object.entries(purchaseMap)) {
      if (!data.product || data.dates.length < 2) continue;

      // Sort dates
      const sortedDates = [...data.dates].sort((a, b) => b - a);
      const lastPurchase = sortedDates[0];
      
      // Calculate intervals
      const intervals = [];
      for (let i = 0; i < sortedDates.length - 1; i++) {
        intervals.push(sortedDates[i] - sortedDates[i+1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      
      const daysSinceLast = (now - lastPurchase) / 86400000;
      const avgDays = avgInterval / 86400000;
      const stock = getAvailableStock(data.product);

      // Condition: It's "due" soon (80% of interval passed) and stock is low or just a reminder
      if (daysSinceLast > avgDays * 0.8) {
        results.push({
          product: data.product,
          reason: daysSinceLast > avgDays ? "Consumo estimado superado" : "Reposición sugerida pronto",
          type: daysSinceLast > avgDays ? "urgent" : "info",
          avgQty: Math.ceil(data.totalQty / data.dates.length),
          stock
        });
      }
    }

    return results.slice(0, 3); // Max 3
  }, [orders, products]);

  if (suggestions.length === 0) return null;

  return (
    <div className={`rounded-2xl border p-5 relative overflow-hidden ${dk("bg-primary/5 border-primary/20", "bg-primary/5 border-primary/10")}`}>
      <div className="absolute top-0 right-0 p-8 text-primary/10 -rotate-12">
        <Sparkles size={120} />
      </div>

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-primary/20 text-primary">
            <TrendingUp size={16} />
          </div>
          <h3 className={`text-sm font-bold ${dk("text-primary", "text-primary-foreground")}`}>Reabastecimiento Inteligente</h3>
          <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-primary/60">BETA IA</span>
        </div>

        <div className="grid gap-3">
          {suggestions.map((s, i) => (
            <div key={s.product.id} className={`p-3 rounded-xl border flex items-center justify-between gap-4 transition-all hover:scale-[1.01] ${dk("bg-[#0d0d0d] border-white/5", "bg-white border-black/5 shadow-sm")}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${s.type === 'urgent' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
                    {s.reason}
                  </span>
                  {s.stock < 5 && <span className="text-[10px] text-amber-500 font-bold">Stock bajo ({s.stock})</span>}
                </div>
                <h4 className={`text-xs font-bold truncate ${dk("text-white", "text-foreground")}`}>{s.product.name}</h4>
                <p className="text-[10px] text-muted-foreground mt-0.5">Sugerencia: Reponer {s.avgQty} unidades</p>
              </div>
              
              <Button 
                size="sm" 
                onClick={() => onAddToCart(s.product, s.avgQty)}
                className="h-8 rounded-lg bg-primary text-white hover:bg-primary/90 text-[10px] font-bold gap-1"
              >
                Sumar {s.avgQty} <ArrowRight size={12} />
              </Button>
            </div>
          ))}
        </div>
        
        <p className="text-[10px] text-muted-foreground mt-4 italic text-center">
          * Algoritmo basado en tus compras de los últimos 12 meses.
        </p>
      </div>
    </div>
  );
}
