import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useProducts } from "@/hooks/useProducts";
import { useCatalogSegments } from "@/hooks/useCatalogSegments";
import { useCategoryCounts } from "@/hooks/useCategoryCounts";
import { useCategoryTree } from "@/hooks/useCategoryTree";
import type { CatalogFilters, CatalogSortKey, CatalogViewMode, CategoryNode } from "@/components/portal/catalog/types";
import { DEFAULT_FILTERS } from "@/components/portal/catalog/types";
import type { Product } from "@/models/products";

const PAGE_SIZE = 80;

function sortProducts(products: Product[], sort: CatalogSortKey): Product[] {
  const copy = [...products];
  switch (sort) {
    case "name_asc":  return copy.sort((a, b) => a.name.localeCompare(b.name));
    case "name_desc": return copy.sort((a, b) => b.name.localeCompare(a.name));
    case "price_asc": return copy.sort((a, b) => (a.unit_price ?? 0) - (b.unit_price ?? 0));
    case "price_desc":return copy.sort((a, b) => (b.unit_price ?? 0) - (a.unit_price ?? 0));
    case "stock_desc":return copy.sort((a, b) => (b.stock ?? 0) - (a.stock ?? 0));
    case "featured":  return copy.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
    default:          return copy;
  }
}

function findNodeById(roots: CategoryNode[], id: number): CategoryNode | null {
  for (const node of roots) {
    if (node.id === id) return node;
    const found = findNodeById(node.children, id);
    if (found) return found;
  }
  return null;
}

function collectDescendantIds(node: CategoryNode): number[] {
  return [node.id, ...node.children.flatMap(collectDescendantIds)];
}

export interface UsePortalCatalogV2Options {
  clientId: string | undefined;
  isAdmin?: boolean;
}

export function usePortalCatalogV2({ clientId, isAdmin = false }: UsePortalCatalogV2Options) {
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Filters (immutable updates) ────────────────────────────────────────────
  const [filters, setFiltersState] = useState<CatalogFilters>(() => ({
    ...DEFAULT_FILTERS,
    categoryId: searchParams.get("categoria") ? Number(searchParams.get("categoria")) : null,
    brandId: searchParams.get("marca") ?? null,
    search: searchParams.get("q") ?? "",
  }));

  const [sort, setSort] = useState<CatalogSortKey>("featured");
  const [viewMode, setViewMode] = useState<CatalogViewMode>("table");
  const [page, setPage] = useState(0);

  // ── Sync filters → URL ─────────────────────────────────────────────────────
  useEffect(() => {
    const params: Record<string, string> = {};
    if (filters.categoryId !== null) params.categoria = String(filters.categoryId);
    if (filters.brandId)             params.marca = filters.brandId;
    if (filters.search)              params.q = filters.search;
    setSearchParams(params, { replace: true });
  }, [filters, setSearchParams]);

  const setFilters = useCallback((updater: Partial<CatalogFilters> | ((prev: CatalogFilters) => CatalogFilters)) => {
    setFiltersState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : { ...prev, ...updater };
      return next;
    });
    setPage(0); // reset pagination on any filter change
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState({ ...DEFAULT_FILTERS });
    setPage(0);
  }, []);

  const hasActiveFilters =
    filters.categoryId !== null ||
    filters.brandId !== null ||
    filters.search !== "" ||
    filters.minPrice !== null ||
    filters.maxPrice !== null;

  // ── Category data ──────────────────────────────────────────────────────────
  const { counts, loading: countsLoading } = useCategoryCounts(clientId);
  const { roots: categoryTree, loading: treeLoading } = useCategoryTree(counts);

  // ── Resolve category slugs for useProducts ────────────────────────────────
  const categoryParam = useMemo((): string | null => {
    if (filters.categoryId === null) return null;
    const node = findNodeById(categoryTree, filters.categoryId);
    if (!node) return null;
    // include all descendant categories
    const ids = collectDescendantIds(node);
    // useProducts filters by category name string; use the node name
    return node.name;
  }, [filters.categoryId, categoryTree]);

  // ── Hidden products ────────────────────────────────────────────────────────
  const { hiddenProductIds, loading: segmentsLoading } = useCatalogSegments(clientId);

  // ── Products fetch ─────────────────────────────────────────────────────────
  const {
    products: rawProducts,
    totalCount,
    loading: productsLoading,
    hasMore,
    loadMore,
    refetch,
  } = useProducts({
    category: categoryParam,
    brand: filters.brandId,
    search: filters.search || null,
    minPrice: filters.minPrice ?? undefined,
    maxPrice: filters.maxPrice ?? undefined,
    pageSize: PAGE_SIZE,
    page,
    isAdmin,
  });

  // ── Apply hidden products filter + sort ────────────────────────────────────
  const products = useMemo(() => {
    const visible = rawProducts.filter((p) => !hiddenProductIds.has(p.id));
    return sortProducts(visible, sort);
  }, [rawProducts, hiddenProductIds, sort]);

  const loading = productsLoading || countsLoading || treeLoading || segmentsLoading;

  return {
    products,
    totalCount,
    loading,
    productsLoading,
    hasMore,
    loadMore,
    refetch,
    // Filters
    filters,
    setFilters,
    clearFilters,
    hasActiveFilters,
    // Sort & view
    sort,
    setSort,
    viewMode,
    setViewMode,
    // Categories
    categoryTree,
    counts,
    // Pagination
    page,
    setPage,
  };
}
