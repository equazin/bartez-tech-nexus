import { useMemo } from "react";
import { ArrowRight, Sparkles, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SurfaceCard } from "@/components/ui/surface-card";
import type { PortalOrder } from "@/hooks/useOrders";
import { getAvailableStock } from "@/lib/pricing";
import type { Product } from "@/models/products";

interface SmartSuggestionsProps {
  orders: PortalOrder[];
  products: Product[];
  onAddToCart: (product: Product, qty: number) => void;
  isDark: boolean;
}

type Suggestion = {
  product: Product;
  reason: string;
  type: "urgent" | "info";
  avgQty: number;
  stock: number;
};

export function SmartSuggestions({ orders = [], products = [], onAddToCart, isDark: _isDark }: SmartSuggestionsProps) {
  const suggestions = useMemo(() => {
    if (orders.length < 2) return [];

    const purchaseMap: Record<number, { dates: number[]; totalQty: number; product: Product | null }> = {};

    orders.forEach((order) => {
      order.products.forEach((item) => {
        if (!purchaseMap[item.product_id]) {
          purchaseMap[item.product_id] = {
            dates: [],
            totalQty: 0,
            product: products.find((product) => product.id === item.product_id) || null,
          };
        }

        purchaseMap[item.product_id].dates.push(new Date(order.created_at).getTime());
        purchaseMap[item.product_id].totalQty += item.quantity;
      });
    });

    const results: Suggestion[] = [];
    const now = Date.now();

    for (const data of Object.values(purchaseMap)) {
      if (!data.product || data.dates.length < 2) continue;

      const sortedDates = [...data.dates].sort((a, b) => b - a);
      const lastPurchase = sortedDates[0];
      const intervals: number[] = [];

      for (let index = 0; index < sortedDates.length - 1; index += 1) {
        intervals.push(sortedDates[index] - sortedDates[index + 1]);
      }

      const avgInterval = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
      const daysSinceLast = (now - lastPurchase) / 86400000;
      const avgDays = avgInterval / 86400000;
      const stock = getAvailableStock(data.product);

      if (daysSinceLast > avgDays * 0.8) {
        results.push({
          product: data.product,
          reason: daysSinceLast > avgDays ? "Consumo estimado superado" : "Reposicion sugerida pronto",
          type: daysSinceLast > avgDays ? "urgent" : "info",
          avgQty: Math.ceil(data.totalQty / data.dates.length),
          stock,
        });
      }
    }

    return results.slice(0, 3);
  }, [orders, products]);

  if (suggestions.length === 0) return null;

  return (
    <SurfaceCard tone="subtle" padding="md" className="relative overflow-hidden border-primary/15 bg-gradient-to-br from-primary/5 via-card to-card">
      <div className="pointer-events-none absolute -right-6 -top-6 text-primary/10">
        <Sparkles size={112} />
      </div>

      <div className="relative z-10 space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <TrendingUp size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Reabastecimiento inteligente</h3>
            <p className="text-[11px] text-muted-foreground">Sugerencias basadas en recurrencia de compra.</p>
          </div>
          <Badge variant="outline" className="ml-auto border-primary/20 bg-primary/10 text-primary">
            Beta IA
          </Badge>
        </div>

        <div className="grid gap-3">
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.product.id}
              className="flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-card/90 p-3 transition-transform duration-200 hover:-translate-y-0.5 hover:border-primary/20"
            >
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={
                      suggestion.type === "urgent"
                        ? "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400"
                        : "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                    }
                  >
                    {suggestion.reason}
                  </Badge>
                  {suggestion.stock < 5 ? (
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">Stock bajo ({suggestion.stock})</span>
                  ) : null}
                </div>
                <h4 className="truncate text-xs font-bold text-foreground">{suggestion.product.name}</h4>
                <p className="mt-0.5 text-[10px] text-muted-foreground">Sugerencia: reponer {suggestion.avgQty} unidades.</p>
              </div>

              <Button size="sm" className="h-8 gap-1 rounded-lg text-[10px] font-bold" onClick={() => onAddToCart(suggestion.product, suggestion.avgQty)}>
                Sumar {suggestion.avgQty}
                <ArrowRight size={12} />
              </Button>
            </div>
          ))}
        </div>

        <p className="text-center text-[10px] italic text-muted-foreground">* Algoritmo basado en tus compras de los ultimos 12 meses.</p>
      </div>
    </SurfaceCard>
  );
}
