import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useVirtualizer } from "@tanstack/react-virtual";

import { Skeleton } from "@/components/ui/skeleton";
import { ComparisonBar } from "@/components/b2b/ComparisonBar";
import { getFavoriteProducts, toggleFavoriteProduct } from "@/lib/favoriteProducts";
import { useCompareList } from "@/hooks/useCompareList";
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

/**
 * Virtualization kicks in for catalogs over this row count. Below it, we render
 * a plain `<table>` so sticky headers, focus rings, and accessibility stay
 * predictable. Above it the rendered DOM stays roughly constant — scrolling is
 * smooth even with thousands of rows.
 */
const VIRTUAL_THRESHOLD = 200;

export function CatalogTable({ products, loading, cart, onAdd, getPrice, profileId }: Props) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const compare = useCompareList(profileId);
  const compareSet = new Set(compare.ids);
  const navigate = useNavigate();

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

  const handleCompare = useCallback((product: Product) => {
    compare.toggle(product.id);
  }, [compare]);

  const shouldVirtualize = products.length >= VIRTUAL_THRESHOLD;

  return (
    <div className="p-3 md:p-4">
      <div className="w-full overflow-x-auto overflow-y-visible rounded-xl border border-border/60 bg-card shadow-sm shadow-border/20">
        {shouldVirtualize && !loading ? (
          <VirtualCatalogList
            products={products}
            cart={cart}
            onAdd={onAdd}
            getPrice={getPrice}
            expandedId={expandedId}
            onToggleExpand={handleToggleExpand}
            onFavorite={profileId ? handleFavorite : undefined}
            favorites={favorites}
            onCompare={profileId ? handleCompare : undefined}
            compareSet={compareSet}
            compareDisabled={compare.isFull}
          />
        ) : (
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
                      onCompare={profileId ? handleCompare : undefined}
                      isInCompare={compareSet.has(p.id)}
                      compareDisabled={compare.isFull}
                    />
                  ))}
            </tbody>
          </table>
        )}
      </div>
      <ComparisonBar
        compareList={compare.ids}
        products={products}
        onCompare={() => navigate(`/portal/comparar?ids=${compare.ids.join(",")}`)}
        onRemove={(id) => compare.remove(id)}
        onClear={() => compare.clear()}
      />
    </div>
  );
}

interface VirtualCatalogListProps {
  products: Product[];
  cart: Record<number, number>;
  onAdd: (product: Product, qty: number) => void;
  getPrice: (product: Product, quantity: number) => PriceResult;
  expandedId: number | null;
  onToggleExpand: (product: Product) => void;
  onFavorite?: (product: Product) => void;
  favorites: Set<number>;
  onCompare?: (product: Product) => void;
  compareSet: Set<number>;
  compareDisabled: boolean;
}

function VirtualCatalogList({
  products,
  cart,
  onAdd,
  getPrice,
  expandedId,
  onToggleExpand,
  onFavorite,
  favorites,
  onCompare,
  compareSet,
  compareDisabled,
}: VirtualCatalogListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: products.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 8,
    measureElement: (el) => el?.getBoundingClientRect().height ?? 72,
  });

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 grid grid-cols-[48px_1fr_120px_88px_120px_56px_140px] gap-0 border-b border-border/60 bg-muted/40 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground backdrop-blur md:px-4">
        <span />
        <span>Producto</span>
        <span className="hidden md:block">Marca</span>
        <span>Stock</span>
        <span className="text-right">Precio</span>
        <span className="hidden text-center lg:block">Mín.</span>
        <span className="text-right">Agregar</span>
      </div>
      <div
        ref={parentRef}
        className="max-h-[70vh] overflow-y-auto"
        style={{ contain: "strict" }}
      >
        <table className="w-full border-collapse text-sm" style={{ height: virtualizer.getTotalSize() }}>
          <tbody style={{ position: "relative", display: "block", height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((row) => {
              const p = products[row.index];
              return (
                <tr
                  key={p.id}
                  data-index={row.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${row.start}px)`,
                  }}
                >
                  <td colSpan={7} className="block p-0">
                    <table className="w-full border-collapse text-sm">
                      <tbody>
                        <CatalogTableRow
                          product={p}
                          qty={cart[p.id] ?? 0}
                          onAdd={onAdd}
                          getPrice={getPrice}
                          expanded={expandedId === p.id}
                          onToggleExpand={onToggleExpand}
                          onFavorite={onFavorite}
                          isFavorite={favorites.has(p.id)}
                          onCompare={onCompare}
                          isInCompare={compareSet.has(p.id)}
                          compareDisabled={compareDisabled}
                        />
                      </tbody>
                    </table>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
