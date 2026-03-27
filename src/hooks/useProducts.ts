import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { products as mockProducts, Product } from "@/models/products";

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const PAGE = 1000;
      const all: Product[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .eq("active", true)
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
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return { products, loading, refetch: fetchProducts };
}
