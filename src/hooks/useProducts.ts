import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { products as mockProducts, Product } from "@/models/products";

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("active", true)
        .order("category")
        .order("name");

      if (!error && data && data.length > 0) {
        setProducts(data as Product[]);
      } else {
        // Fallback a mock si Supabase está vacío o hay error
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
