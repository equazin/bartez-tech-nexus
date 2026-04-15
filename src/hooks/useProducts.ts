import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { products as mockProducts, Product } from "@/models/products";

function normalizeCategoryParam(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export interface UseProductsOptions {
  category?: string | string[] | null;
  brand?: string | null;
  search?: string | null;
  minPrice?: number;
  maxPrice?: number;
  pageSize?: number;
  page?: number;
  isAdmin?: boolean;
  isFeatured?: boolean;
  sortBy?: "name" | "featured"; // Nueva opción (Phase 5.4)
}

type QueryBuilderLike = {
  eq: (column: string, value: unknown) => QueryBuilderLike;
  in: (column: string, values: readonly unknown[]) => QueryBuilderLike;
  gte: (column: string, value: number) => QueryBuilderLike;
  lte: (column: string, value: number) => QueryBuilderLike;
  order: (column: string, options?: { ascending?: boolean }) => QueryBuilderLike;
  range: (
    from: number,
    to: number,
  ) => Promise<{ data: unknown[] | null; count: number | null; error: { message: string } | null }>;
};

export function useProducts(options: UseProductsOptions = {}) {
  const {
    category = "all",
    brand = "all",
    search = "",
    minPrice,
    maxPrice,
    pageSize = 80,
    page,
    isAdmin = false,
    isFeatured = false,
    sortBy = "name",
  } = options;

  const [products, setProducts] = useState<Product[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const sanitizeSearchTerm = useCallback((value: string) => {
    return value
      .replace(/[%_*,.;:|()[\]{}"']/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }, []);

  const fetchProducts = useCallback(async (isNextPage = false) => {
    setLoading(true);
    
    try {
      let currentPage = 0;
      if (page !== undefined) {
        currentPage = page;
      } else {
        const currentLength = isNextPage ? products.length : 0;
        currentPage = Math.floor(currentLength / pageSize);
      }
      
      const tableName = isAdmin ? "products" : "portal_products";
      const normalizedSearch = search?.trim() ?? "";

      const applyCommonFilters = (sourceQuery: QueryBuilderLike): QueryBuilderLike => {
        let query = sourceQuery.eq("active", true);

        if (category && category !== "all") {
          if (Array.isArray(category)) {
            query = query.in("category", category);
          } else {
            query = query.eq("category", category);
          }
        }

        if (brand && brand !== "all") {
          query = query.eq("brand_id", brand);
        }

        if (isFeatured) {
          query = query.eq("featured", true);
        }

        if (minPrice != null && minPrice > 0) query = query.gte("cost_price", minPrice);
        if (maxPrice != null && maxPrice > 0) query = query.lte("cost_price", maxPrice);

        return query;
      };

      const applySort = (sourceQuery: QueryBuilderLike): QueryBuilderLike => {
        if (sortBy === "featured") {
          return sourceQuery
            .order("featured", { ascending: false })
            .order("name", { ascending: true });
        }
        return sourceQuery.order("name", { ascending: true });
      };

      // 5. Pagination
      const from = currentPage * pageSize;
      const to = from + pageSize - 1;

      // Primary search: FTS
      let data: Product[] | null = null;
      let count: number | null = null;
      let fetchError: { message: string } | null = null;

      if (normalizedSearch.length > 0) {
        const ftsQuery = applySort(
          applyCommonFilters(
            supabase
              .from(tableName)
              .select("*", { count: "exact" })
              .textSearch("fts", normalizedSearch, {
                config: "spanish",
                type: "websearch",
              }) as unknown as QueryBuilderLike,
          ),
        );

        const ftsResult = await ftsQuery.range(from, to);
        data = (ftsResult.data as Product[] | null) ?? [];
        count = ftsResult.count;
        fetchError = ftsResult.error;

        // Fallback search: SKU / external_id / description / name
        const shouldFallback = !!fetchError || (data?.length ?? 0) === 0;
        if (shouldFallback) {
          const safeTerm = sanitizeSearchTerm(normalizedSearch);
          if (safeTerm.length > 0) {
            const fallbackQuery = applySort(
              applyCommonFilters(
                supabase
                  .from(tableName)
                  .select("*", { count: "exact" })
                  .or(
                    [
                      `name.ilike.%${safeTerm}%`,
                      `sku.ilike.%${safeTerm}%`,
                      `external_id.ilike.%${safeTerm}%`,
                      `description.ilike.%${safeTerm}%`,
                    ].join(","),
                  ) as unknown as QueryBuilderLike,
              ),
            );

            const fallbackResult = await fallbackQuery.range(from, to);
            if (!fallbackResult.error) {
              data = (fallbackResult.data as Product[] | null) ?? [];
              count = fallbackResult.count;
              fetchError = null;
            }
          }
        }
      } else {
        const defaultQuery = applySort(
          applyCommonFilters(
            supabase.from(tableName).select("*", { count: "exact" }) as unknown as QueryBuilderLike,
          ),
        );

        const defaultResult = await defaultQuery.range(from, to);
        data = (defaultResult.data as Product[] | null) ?? [];
        count = defaultResult.count;
        fetchError = defaultResult.error;
      }

      if (fetchError) throw fetchError;

      const newProducts = data ?? [];
      
      setProducts(prev => {
        if (!isNextPage && page === undefined) return newProducts;
        if (page !== undefined) return newProducts; // If page specified, we replace
        
        const existingIds = new Set(prev.map(p => p.id));
        const uniqueNew = newProducts.filter(p => !existingIds.has(p.id));
        return [...prev, ...uniqueNew];
      });
      
      if (count !== null) setTotalCount(count);
      // Si recibimos menos de lo pedido, no hay más
      setHasMore(newProducts.length === pageSize);
      setError(null);
    } catch (err: unknown) {
      console.error("Error fetching products:", err);
      const message = err instanceof Error ? err.message : "Error inesperado al cargar productos.";
      setError(message);
      if (!isNextPage) setProducts(mockProducts);
    } finally {
      setLoading(false);
    }
  }, [category, brand, search, minPrice, maxPrice, pageSize, page, isAdmin, isFeatured, sortBy, products.length, sanitizeSearchTerm]);

  // Initial load or filter change
  useEffect(() => {
    fetchProducts(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, brand, search, minPrice, maxPrice, page, isAdmin]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      fetchProducts(true);
    }
  }, [loading, hasMore, fetchProducts]);

  return { 
    products, 
    totalCount, 
    loading, 
    hasMore, 
    error,
    loadMore, 
    refetch: () => fetchProducts(false) 
  };
}
