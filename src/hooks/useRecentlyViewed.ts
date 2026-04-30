import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export function useRecentlyViewed(profileId: string | undefined) {
  const [productIds, setProductIds] = useState<number[]>([]);

  useEffect(() => {
    if (!profileId) return;
    let cancelled = false;

    supabase
      .from("product_views_log")
      .select("product_id")
      .eq("profile_id", profileId)
      .order("viewed_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (cancelled) return;
        // deduplicate while preserving order
        const seen = new Set<number>();
        const ids: number[] = [];
        for (const row of (data ?? []) as { product_id: number }[]) {
          if (!seen.has(row.product_id)) {
            seen.add(row.product_id);
            ids.push(row.product_id);
          }
        }
        setProductIds(ids);
      });

    return () => { cancelled = true; };
  }, [profileId]);

  const logView = useCallback(async (productId: number) => {
    if (!profileId) return;
    await supabase.rpc("log_product_view", { p_product_id: productId });
    setProductIds((prev) => {
      const filtered = prev.filter((id) => id !== productId);
      return [productId, ...filtered].slice(0, 20);
    });
  }, [profileId]);

  return { productIds, logView };
}
