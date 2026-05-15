import { useCallback, useEffect, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { getFavoriteProducts, toggleFavoriteProduct } from "@/lib/favoriteProducts";
import { CatalogTableRow } from "./CatalogTableRow";
import type { Product } from "@/models/products";
import type { PriceResult } from "@/hooks/usePricing";

interface Props {
  products: Product[];
  loading: boolean;
  cart: Record<number, number>;
  onAdd: (product: Product, qty: number) => void;
  getPrice: (product: Product, quantity: number) => PriceResult;
  /** Client/profile id used to scope favorites */
  profileId?: string;
}

export function CatalogTable({ products, loading, cart, onAdd, getPrice, profileId }: Props) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [favorites, setFavorites] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!profileId) {
      setFavorites(new Set());
      return;
    }
    setFavorites(new Set(getFavoriteProducts(profileId)));
  }, [profileId]);

  const handleToggleExpand = useCallback((product: Product) => {
    setExpandedId((current) => (current === product.id ? null : product.id));
  }, []);

  const handleFavorite = useCallback(
    (product: Product) => {
      if (!profileId) return;
      const next = toggleFavoriteProduct(profileId, product.id);
      setFavorites(new Set(next));
    },
    [profileId],
  );

  return (
    <div className="p-3 md:p-4">
      <div className="w-full overflow-x-auto overflow-y-visible rounded-xl border border-border/60 bg-card shadow-sm shadow-border/20">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 border-b border-border/60 bg-muted/40 backdrop-blur">
            <tr className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              <th className="w-12 py-2.5 pl-3 pr-1" />
              <th className="px-2 py-2.5 text-left">Producto</th>
              <th className="hidden px-2 py-2.5 text-left md:table-cell">Marca</th>
              <th className="px-2 py-2.5 text-left">Stock</th>
              <th className="px-2 py-2.5 text-right">Precio</th>
              <th className="hidden px-2 py-2.5 text-center lg:table-cell">Mín.</th>
              <th className="px-2 py-2.5 pr-3 text-right">Agregar</th>
            </tr>
          </thead>
          <tbody>
            {loading && products.length === 0
              ? Array.from({ length: 12 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="w-12 py-2 pl-3 pr-1">
                      <Skeleton className="h-10 w-10 rounded-lg" />
                    </td>
                    <td className="px-2 py-2">
                      <Skeleton className="mb-1 h-4 w-40" />
                      <Skeleton className="h-3 w-20" />
                    </td>
                    <td className="hidden px-2 py-2 md:table-cell">
                      <Skeleton className="h-4 w-20" />
                    </td>
                    <td className="px-2 py-2"><Skeleton className="h-5 w-16" /></td>
                    <td className="px-2 py-2"><Skeleton className="ml-auto h-5 w-20" /></td>
                    <td className="hidden px-2 py-2 lg:table-cell"><Skeleton className="mx-auto h-4 w-6" /></td>
                    <td className="px-2 py-2 pr-3"><Skeleton className="ml-auto h-7 w-24" /></td>
                  </tr>
                ))
              : products.map((p) => (
                  <CatalogTableRow
                    key={p.id}
                    product={p}
                    qty={cart[p.id] ?? 0}
                    onAdd={onAdd}
                    getPrice={getPrice}
                    expanded={expandedId === p.id}
                    onToggleExpand={handleToggleExpand}
                    onFavorite={profileId ? handleFavorite : undefined}
                    isFavorite={favorites.has(p.id)}
                  />
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
