import { supabase } from "@/lib/supabase";
import type { PriceHistory, PriceHistoryInsert } from "@/models/priceHistory";

const TABLE = "price_history";

export async function recordPriceChange(input: PriceHistoryInsert): Promise<void> {
  await supabase.from(TABLE).insert(input);
  // fire-and-forget — no throw on error to avoid blocking product saves
}

export async function fetchPriceHistory(productId: number, limit = 30): Promise<PriceHistory[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as PriceHistory[];
}

export async function fetchRecentPriceChanges(limit = 50): Promise<PriceHistory[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as PriceHistory[];
}
