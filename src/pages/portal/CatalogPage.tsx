import { useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useImpersonate } from "@/context/ImpersonateContext";
import { useSharedCartState } from "@/hooks/useSharedCartState";
import { usePortalCatalogV2 } from "@/hooks/usePortalCatalogV2";
import {
  CatalogLayout,
  CategorySidebar,
  CatalogToolbar,
  CatalogTable,
  CatalogGrid,
  EmptyCatalog,
} from "@/components/portal/catalog";
import type { CatalogFilters } from "@/components/portal/catalog";
import type { Product } from "@/models/products";

export default function CatalogPage() {
  const { profile: authProfile } = useAuth();
  const { activeProfile } = useImpersonate();
  const profile = activeProfile ?? authProfile;
  const clientId = profile?.id;

  const { cart, setCart } = useSharedCartState(clientId ?? "");

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
    categoryTree,
    counts,
  } = usePortalCatalogV2({ clientId, isAdmin: profile?.role === "admin" });

  const handleAdd = useCallback((product: Product, qty: number) => {
    setCart((prev) => ({
      ...prev,
      [product.id]: (prev[product.id] ?? 0) + qty,
    }));
  }, [setCart]);

  function handleFilterRemove(key: keyof CatalogFilters) {
    setFilters({ [key]: key === "search" ? "" : null } as Partial<CatalogFilters>);
  }

  const totalVisible = counts.size > 0 ? totalCount : totalCount;

  const content = products.length === 0 && !loading
    ? <EmptyCatalog hasActiveFilters={hasActiveFilters} onClearFilters={clearFilters} />
    : viewMode === "table"
      ? <CatalogTable products={products} loading={loading} cart={cart} onAdd={handleAdd} />
      : <CatalogGrid products={products} loading={loading} cart={cart} onAdd={handleAdd} />;

  return (
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
  );
}
