import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface WatchlistEntry {
  product_id: number;
  target_qty: number;
  created_at: string;
}

export function useWatchlist(profileId: string | undefined) {
  const [items, setItems] = useState<WatchlistEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const watchedIds = new Set(items.map((i) => i.product_id));

  useEffect(() => {
    if (!profileId) return;
    let cancelled = false;
    setLoading(true);

    supabase
      .from("watchlist")
      .select("product_id, target_qty, created_at")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (cancelled) return;
        setItems((data ?? []) as WatchlistEntry[]);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [profileId]);

  const add = useCallback(async (productId: number, targetQty = 1) => {
    await supabase.rpc("upsert_watchlist", { p_product_id: productId, p_target_qty: targetQty });
    setItems((prev) => {
      const filtered = prev.filter((i) => i.product_id !== productId);
      return [{ product_id: productId, target_qty: targetQty, created_at: new Date().toISOString() }, ...filtered];
    });
  }, []);

  const remove = useCallback(async (productId: number) => {
    await supabase.rpc("remove_watchlist", { p_product_id: productId });
    setItems((prev) => prev.filter((i) => i.product_id !== productId));
  }, []);

  const toggle = useCallback(async (productId: number, targetQty = 1) => {
    if (watchedIds.has(productId)) {
      await remove(productId);
    } else {
      await add(productId, targetQty);
    }
  }, [watchedIds, add, remove]);

  return { items, watchedIds, loading, add, remove, toggle };
}
