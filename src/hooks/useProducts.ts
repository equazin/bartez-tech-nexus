import { logger } from "@/lib/logger";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Product } from "@/models/products";

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
  sortBy?: "name" | "name_asc" | "name_desc" | "featured" | "price_asc" | "price_desc" | "stock_desc";
  /** When false, the hook skips the initial fetch entirely. Default true. */
  enabled?: boolean;
}

type QueryBuilderLike = {
  eq: (column: string, value: unknown) => QueryBuilderLike;
  in: (column: string, values: readonly unknown[]) => QueryBuilderLike;
  gte: (column: string, value: number) => QueryBuilderLike;
  lte: (column: string, value: number) => QueryBuilderLike;
  or: (filters: string) => QueryBuilderLike;
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
    sortBy = "name_asc",
    enabled = true,
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
      const priceColumn = "cost_price";
      const normalizedSearch = search?.trim() ?? "";
      const searchColumns = isAdmin
        ? ["name", "name_original", "name_custom", "sku", "external_id", "brand_name", "category"]
        : ["display_name", "name", "name_original", "name_custom", "sku", "brand_name", "category"];
      const searchTokens = sanitizeSearchTerm(normalizedSearch)
        .split(" ")
        .filter((token) => token.length >= 2)
        .slice(0, 5);

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

        if (minPrice != null && minPrice > 0) query = query.gte(priceColumn, minPrice);
        if (maxPrice != null && maxPrice > 0) query = query.lte(priceColumn, maxPrice);

        return query;
      };

      const applySort = (sourceQuery: QueryBuilderLike): QueryBuilderLike => {
        switch (sortBy) {
          case "featured":
            return sourceQuery
              .order("featured", { ascending: false })
              .order("name", { ascending: true });
          case "name_desc":
            return sourceQuery.order("name", { ascending: false });
          case "price_asc":
            return sourceQuery
              .order(priceColumn, { ascending: true })
              .order("name", { ascending: true });
          case "price_desc":
            return sourceQuery
              .order(priceColumn, { ascending: false })
              .order("name", { ascending: true });
          case "stock_desc":
            return sourceQuery
              .order("stock", { ascending: false })
              .order("name", { ascending: true });
          case "name":
          case "name_asc":
          default:
            return sourceQuery.order("name", { ascending: true });
        }
      };

      const applyDirectSearch = (sourceQuery: QueryBuilderLike): QueryBuilderLike => {
        return searchTokens.reduce((query, token) => {
          const filters = searchColumns
            .map((column) => `${column}.ilike.%${token}%`)
            .join(",");
          return query.or(filters);
        }, sourceQuery);
      };

      // 5. Pagination
      const from = currentPage * pageSize;
      const to = from + pageSize - 1;

      // Primary search: FTS
      let data: Product[] | null = null;
      let count: number | null = null;
      let fetchError: { message: string } | null = null;

      if (normalizedSearch.length > 0) {
        const safeTerm = sanitizeSearchTerm(normalizedSearch);

        if (searchTokens.length > 0) {
          const directQuery = applySort(
            applyDirectSearch(
              applyCommonFilters(
                supabase.from(tableName).select("*", { count: "exact" }) as unknown as QueryBuilderLike,
              ),
            ),
          );

          const directResult = await directQuery.range(from, to);
          if (!directResult.error) {
            data = (directResult.data as Product[] | null) ?? [];
            count = directResult.count;
            fetchError = null;
          } else {
            fetchError = directResult.error;
          }
        }

        const shouldTryFts = !!fetchError || (data?.length ?? 0) === 0;
        if (shouldTryFts) {
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
        }

        const shouldFallback = !!fetchError || (data?.length ?? 0) === 0;
        if (shouldFallback && safeTerm.length > 0) {
          const fallbackQuery = applySort(
            applyCommonFilters(
              supabase
                .from(tableName)
                .select("*", { count: "exact" })
                .or(
                  [
                    `name.ilike.%${safeTerm}%`,
                    `sku.ilike.%${safeTerm}%`,
                    `brand_name.ilike.%${safeTerm}%`,
                    `category.ilike.%${safeTerm}%`,
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
      logger.error("Error fetching products:", err);
      const message = err instanceof Error ? err.message : "Error inesperado al cargar productos.";
      setError(message);
      if (!isNextPage) setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [category, brand, search, minPrice, maxPrice, pageSize, page, isAdmin, isFeatured, sortBy, products.length, sanitizeSearchTerm]);

  // Initial load or filter change
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    fetchProducts(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, brand, search, minPrice, maxPrice, page, isAdmin, isFeatured, sortBy, enabled]);

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
