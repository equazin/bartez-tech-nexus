import { supabase } from "@/lib/supabase";
import type { Product } from "@/models/products";

export interface LowStockProduct {
  id: number;
  name: string;
  sku?: string;
  category: string;
  stock: number;
  stock_min?: number;
  stock_reserved: number;
  available: number;
  supplier_name?: string;
}

export interface StaleProduct {
  id: number;
  name: string;
  sku?: string;
  category: string;
  stock: number;
  cost_price: number;
  last_order_date?: string;
  days_stale: number;
}

/** Products where available stock <= stock_min */
export async function fetchLowStockProducts(): Promise<LowStockProduct[]> {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, sku, category, stock, stock_min, stock_reserved")
    .eq("active", true)
    .not("stock_min", "is", null);

  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((p: any) => ({
      ...p,
      stock_reserved: p.stock_reserved ?? 0,
      available: Math.max(0, p.stock - (p.stock_reserved ?? 0)),
    }))
    .filter((p) => p.available <= (p.stock_min ?? 0)) as LowStockProduct[];
}

/** Products with no orders in the last `days` days */
export async function fetchProductsWithoutMovement(
  allProducts: Product[],
  allOrders: { products: any[]; created_at: string }[],
  days = 90
): Promise<StaleProduct[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  // Build a map: product_id → most recent order date
  const lastOrderDate: Record<number, Date> = {};
  for (const order of allOrders) {
    const orderDate = new Date(order.created_at);
    for (const item of order.products ?? []) {
      const pid = item.product_id;
      if (!lastOrderDate[pid] || orderDate > lastOrderDate[pid]) {
        lastOrderDate[pid] = orderDate;
      }
    }
  }

  return allProducts
    .filter((p) => {
      const last = lastOrderDate[p.id];
      return !last || last < cutoff;
    })
    .map((p) => {
      const last = lastOrderDate[p.id];
      const days_stale = last
        ? Math.floor((Date.now() - last.getTime()) / 86_400_000)
        : 9999;
      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        category: p.category,
        stock: p.stock,
        cost_price: p.cost_price,
        last_order_date: last?.toISOString(),
        days_stale,
      };
    })
    .sort((a, b) => b.days_stale - a.days_stale);
}
