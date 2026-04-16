import { supabase } from "@/lib/supabase";

export async function subscribeStockNotification(userId: string, productId: number): Promise<void> {
  await supabase
    .from("stock_notifications")
    .upsert({ user_id: userId, product_id: productId }, { onConflict: "user_id,product_id" });
}

export async function unsubscribeStockNotification(userId: string, productId: number): Promise<void> {
  await supabase
    .from("stock_notifications")
    .delete()
    .eq("user_id", userId)
    .eq("product_id", productId);
}

export async function isSubscribedToStockNotification(userId: string, productId: number): Promise<boolean> {
  const { data } = await supabase
    .from("stock_notifications")
    .select("id")
    .eq("user_id", userId)
    .eq("product_id", productId)
    .maybeSingle();
  return data != null;
}
