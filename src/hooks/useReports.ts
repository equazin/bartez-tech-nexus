import { useState, useCallback } from "react";
import { fetchLowStockProducts, fetchProductsWithoutMovement } from "@/lib/api/reports";
import type { LowStockProduct, StaleProduct } from "@/lib/api/reports";
import type { Product } from "@/models/products";

export function useReports(
  products: Product[],
  orders: { products: any[]; created_at: string }[]
) {
  const [lowStock, setLowStock] = useState<LowStockProduct[]>([]);
  const [stale, setStale] = useState<StaleProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ls, st] = await Promise.all([
        fetchLowStockProducts(),
        fetchProductsWithoutMovement(products, orders),
      ]);
      setLowStock(ls);
      setStale(st);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar reportes");
    } finally {
      setLoading(false);
    }
  }, [products, orders]);

  return { lowStock, stale, loading, error, refresh };
}
