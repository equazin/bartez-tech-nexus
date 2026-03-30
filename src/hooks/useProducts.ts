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

export function useProducts(category?: string | null) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = useCallback(async (requestedCategory?: string | null) => {
    setLoading(true);
    try {
      const PAGE = 1000;
      const all: Product[] = [];
      let from = 0;
      const rawCategory = String(requestedCategory ?? category ?? "").trim();
      const categoryFilter = normalizeCategoryParam(rawCategory);
      while (true) {
        let query = supabase
          .from("products")
          .select("*")
          .eq("active", true);

        if (categoryFilter) {
          if (categoryFilter === "pos" || categoryFilter === "punto de venta" || categoryFilter === "punto-de-venta") {
            query = query.or("category.ilike.%punto de venta%,category.ilike.%pos%");
          } else {
            query = query.eq("category", rawCategory);
          }
        }

        const { data, error } = await query
          .order("category")
          .order("name")
          .range(from, from + PAGE - 1);
        if (error || !data || data.length === 0) break;
        all.push(...(data as Product[]));
        if (data.length < PAGE) break;
        from += PAGE;
      }
      if (all.length > 0) {
        setProducts(all);
      } else {
        setProducts(mockProducts);
      }
    } catch {
      setProducts(mockProducts);
    }
    setLoading(false);
  }, [category]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return { products, loading, refetch: fetchProducts };
}
