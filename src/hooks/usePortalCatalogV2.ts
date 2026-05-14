import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useProducts } from "@/hooks/useProducts";
import { useCatalogSegments } from "@/hooks/useCatalogSegments";
import { useCategoryCounts } from "@/hooks/useCategoryCounts";
import { useCategoryTree } from "@/hooks/useCategoryTree";
import type { CatalogFilters, CatalogSortKey, CatalogViewMode, CategoryNode } from "@/components/portal/catalog/types";
import { DEFAULT_FILTERS } from "@/components/portal/catalog/types";

const PAGE_SIZE = 80;

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
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState({ ...DEFAULT_FILTERS });
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
    isAdmin,
    sortBy: sort,
  });

  // ── Apply hidden products filter ───────────────────────────────────────────
  const products = useMemo(() => {
    return rawProducts.filter((p) => !hiddenProductIds.has(p.id));
  }, [rawProducts, hiddenProductIds]);

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
  };
}
