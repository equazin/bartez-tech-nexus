import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export interface PurchaseListItem {
  product_id: number;
  name: string;
  sku?: string;
  quantity: number;
}

export interface PurchaseList {
  id: number;
  client_id: string;
  name: string;
  products: PurchaseListItem[];
  created_at: string;
  updated_at: string;
}

export function usePurchaseLists(userId: string) {
  const [lists, setLists]     = useState<PurchaseList[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLists = useCallback(async () => {
    if (!userId || userId === "guest") return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("purchase_lists")
        .select("*")
        .eq("client_id", userId)
        .order("updated_at", { ascending: false });
      if (data) setLists(data as PurchaseList[]);
    } catch { /* silencioso */ }
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchLists(); }, [fetchLists]);

  const createList = useCallback(
    async (name: string, products: PurchaseListItem[]): Promise<PurchaseList | null> => {
      if (!userId || userId === "guest") return null;
      try {
        const { data, error } = await supabase
          .from("purchase_lists")
          .insert([{ client_id: userId, name, products }])
          .select()
          .single();
        if (error || !data) return null;
        const list = data as PurchaseList;
        setLists((prev) => [list, ...prev]);
        return list;
      } catch { return null; }
    },
    [userId]
  );

  const updateList = useCallback(
    async (id: number, patch: Partial<Pick<PurchaseList, "name" | "products">>): Promise<void> => {
      try {
        const { data } = await supabase
          .from("purchase_lists")
          .update(patch)
          .eq("id", id)
          .select()
          .single();
        if (data) {
          setLists((prev) => prev.map((l) => (l.id === id ? (data as PurchaseList) : l)));
        }
      } catch { /* silencioso */ }
    },
    []
  );

  const deleteList = useCallback(async (id: number): Promise<void> => {
    try {
      await supabase.from("purchase_lists").delete().eq("id", id);
      setLists((prev) => prev.filter((l) => l.id !== id));
    } catch { /* silencioso */ }
  }, []);

  return { lists, loading, createList, updateList, deleteList, refetch: fetchLists };
}
