import { Skeleton } from "@/components/ui/skeleton";
import { CatalogGridCard } from "./CatalogGridCard";
import type { Product } from "@/models/products";
import type { PriceResult } from "@/hooks/usePricing";

interface Props {
  products: Product[];
  loading: boolean;
  cart: Record<number, number>;
  onAdd: (product: Product, qty: number) => void;
  getPrice: (product: Product, quantity: number) => PriceResult;
}

export function CatalogGrid({ products, loading, cart, onAdd, getPrice }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {loading && products.length === 0
        ? Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-col rounded-lg border">
              <Skeleton className="aspect-square rounded-t-lg" />
              <div className="flex flex-col gap-2 p-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-7 w-full" />
              </div>
            </div>
          ))
        : products.map((p) => (
            <CatalogGridCard
              key={p.id}
              product={p}
              qty={cart[p.id] ?? 0}
              onAdd={onAdd}
              getPrice={getPrice}
            />
          ))}
    </div>
  );
}
