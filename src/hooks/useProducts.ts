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
      let query = supabase
        .from(tableName)
        .select("*", { count: "exact" })
        .eq("active", true);

      // 1. Text Search (FTS)
      if (search && search.trim().length > 0) {
        query = query.textSearch("fts", search.trim(), {
          config: "spanish",
          type: "websearch"
        });
      }

      // 2. Category Filter
      if (category && category !== "all") {
        if (Array.isArray(category)) {
          query = query.in("category", category);
        } else {
          query = query.eq("category", category);
        }
      }

      // 3. Brand Filter
      if (brand && brand !== "all") {
        query = query.eq("brand_id", brand);
      }

      // 3.5. Featured Filter
      if (isFeatured) {
        query = query.eq("featured", true);
      }

      // 4. Price range
      if (minPrice != null && minPrice > 0) query = query.gte("cost_price", minPrice);
      if (maxPrice != null && maxPrice > 0) query = query.lte("cost_price", maxPrice);

      // 5. Pagination
      const from = currentPage * pageSize;
      const to = from + pageSize - 1;

      let queryOrdered = query;
      
      if (sortBy === "featured") {
        queryOrdered = queryOrdered
          .order("featured", { ascending: false })
          .order("name", { ascending: true });
      } else {
        queryOrdered = queryOrdered.order("name", { ascending: true });
      }

      const { data, error: fetchError, count } = await queryOrdered.range(from, to);

      if (fetchError) throw fetchError;

      const newProducts = (data as Product[]) || [];
      
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
    } catch (err: any) {
      console.error("Error fetching products:", err);
      setError(err.message);
      if (!isNextPage) setProducts(mockProducts);
    } finally {
      setLoading(false);
    }
  }, [category, brand, search, minPrice, maxPrice, pageSize, page, isAdmin, products.length]);

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
