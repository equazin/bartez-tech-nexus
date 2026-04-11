import { supabase } from "@/lib/supabase";
import { adjustStockApi } from "@/lib/api/productsApi";

export type MovementType = "sync" | "reserve" | "unreserve" | "fulfill" | "adjust" | "return";

export interface StockMovement {
  id: string;
  product_id: number;
  supplier_id?: string;
  movement_type: MovementType;
  quantity_delta: number;
  stock_before?: number;
  stock_after?: number;
  reference_id?: string;
  reference_type?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
}

/** Release reserved stock when an order is cancelled/rejected */
export async function unreserveOrderStock(orderId: string): Promise<void> {
  const { error } = await supabase.rpc("unreserve_stock_for_order", {
    p_order_id: orderId,
  });
  if (error) throw new Error(`unreserve failed: ${error.message}`);
}

/** Consume stock when an order is dispatched */
export async function fulfillOrderStock(orderId: string): Promise<void> {
  const { error } = await supabase.rpc("fulfill_stock_for_order", {
    p_order_id: orderId,
  });
  if (error) throw new Error(`fulfill failed: ${error.message}`);
}

/** Manual stock adjustment (admin only) — goes through backend */
export async function adjustStock(
  productId: number,
  delta: number,
  notes?: string,
): Promise<void> {
  await adjustStockApi(productId, delta, notes);
}

/** Fetch stock movement history for a product */
export async function fetchStockMovements(
  productId: number,
  limit = 50
): Promise<StockMovement[]> {
  const { data, error } = await supabase
    .from("stock_movements")
    .select("*")
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data as StockMovement[]) ?? [];
}

/** Fetch all recent movements (for admin dashboard) */
export async function fetchRecentMovements(
  limit = 100,
  movementType?: MovementType
): Promise<StockMovement[]> {
  let query = supabase
    .from("stock_movements")
    .select("*, products(name, sku)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (movementType) query = query.eq("movement_type", movementType);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data as StockMovement[]) ?? [];
}
