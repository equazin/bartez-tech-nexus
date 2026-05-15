import { useCallback, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useImpersonate } from "@/context/ImpersonateContext";
import { useSharedCartState } from "@/hooks/useSharedCartState";
import { usePortalCatalogV2 } from "@/hooks/usePortalCatalogV2";
import { usePricing } from "@/hooks/usePricing";
import { Button } from "@/components/ui/button";
import {
  CatalogLayout,
  CategorySidebar,
  CatalogToolbar,
  CatalogTable,
  CatalogGrid,
  EmptyCatalog,
  ProductQuickView,
} from "@/components/portal/catalog";
import type { CatalogFilters } from "@/components/portal/catalog";
import type { Product } from "@/models/products";

export default function CatalogPage() {
  const { profile: authProfile } = useAuth();
  const { activeProfile } = useImpersonate();
  const profile = activeProfile ?? authProfile;
  const clientId = profile?.id;
  const { computePrice } = usePricing(profile);

  const { cart, setCart } = useSharedCartState(clientId ?? "");

  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  const {
    products,
    totalCount,
    loading,
    filters,
    setFilters,
    clearFilters,
    hasActiveFilters,
    sort,
    setSort,
    viewMode,
    setViewMode,
    hasMore,
    loadMore,
    categoryTree,
    counts,
  } = usePortalCatalogV2({ clientId, isAdmin: profile?.role === "admin" });

  const handleAdd = useCallback((product: Product, qty: number) => {
    setCart((prev) => ({
      ...prev,
      [product.id]: (prev[product.id] ?? 0) + qty,
    }));
  }, [setCart]);

  const handleQuickView = useCallback((product: Product) => {
    setQuickViewProduct(product);
  }, []);

  function handleFilterRemove(key: keyof CatalogFilters) {
    setFilters({ [key]: key === "search" ? "" : null } as Partial<CatalogFilters>);
  }

  const totalVisible = counts.size > 0 ? totalCount : totalCount;

  const contentBody = products.length === 0 && !loading
    ? <EmptyCatalog hasActiveFilters={hasActiveFilters} onClearFilters={clearFilters} />
    : viewMode === "table"
      ? <CatalogTable products={products} loading={loading} cart={cart} onAdd={handleAdd} getPrice={computePrice} onQuickView={handleQuickView} />
      : <CatalogGrid products={products} loading={loading} cart={cart} onAdd={handleAdd} getPrice={computePrice} onQuickView={handleQuickView} />;

  const content = (
    <>
      {contentBody}
      {products.length > 0 && (
        <div className="flex flex-col items-center gap-3 border-t border-border/60 px-4 py-5 text-center">
          <p className="text-xs text-muted-foreground">
            Mostrando {products.length.toLocaleString()} de {totalCount.toLocaleString()} productos disponibles
          </p>
          {hasMore ? (
            <Button variant="outline" onClick={() => loadMore()} disabled={loading}>
              {loading ? "Cargando..." : "Cargar más productos"}
            </Button>
          ) : null}
        </div>
      )}
    </>
  );

  return (
    <>
      <CatalogLayout
        sidebar={
          <CategorySidebar
            roots={categoryTree}
            loading={loading}
            selectedId={filters.categoryId}
            totalCount={totalVisible}
            onSelect={(id) => setFilters({ categoryId: id })}
          />
        }
        toolbar={
          <CatalogToolbar
            filters={filters}
            categoryTree={categoryTree}
            sort={sort}
            viewMode={viewMode}
            clientId={clientId}
            onSearchChange={(search) => setFilters({ search })}
            onFilterRemove={handleFilterRemove}
            onClearAll={clearFilters}
            onSortChange={setSort}
            onViewModeChange={setViewMode}
          />
        }
        content={content}
      />

      <ProductQuickView
        product={quickViewProduct}
        open={quickViewProduct !== null}
        onOpenChange={(next) => {
          if (!next) setQuickViewProduct(null);
        }}
        onAdd={handleAdd}
        getPrice={computePrice}
      />
    </>
  );
}
