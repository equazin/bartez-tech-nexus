import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";

export interface PurchaseListItem {
  product_id: number;
  quantity: number;
  note?: string | null;
  name?: string;
  sku?: string | null;
}

export interface PurchaseList {
  id: number;
  profile_id: string;
  name: string;
  items: PurchaseListItem[];
  shared_with: string[];
  created_at: string;
  updated_at: string;
  is_shared: boolean;
}

interface PurchaseListRow {
  id: number;
  profile_id?: string | null;
  client_id?: string | null;
  name: string;
  items?: PurchaseListItem[] | null;
  products?: PurchaseListItem[] | null;
  shared_with?: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface UsePurchaseListsOptions {
  userId?: string | null;
}

export interface UsePurchaseListsResult {
  lists: PurchaseList[];
  loading: boolean;
  createList: (name: string, items?: PurchaseListItem[], sharedWith?: string[]) => Promise<PurchaseList | null>;
  updateList: (
    id: number,
    patch: Partial<Pick<PurchaseList, "name" | "items" | "shared_with">>,
  ) => Promise<PurchaseList | null>;
  deleteList: (id: number) => Promise<void>;
  addItemToList: (id: number, item: PurchaseListItem) => Promise<PurchaseList | null>;
  refetch: () => Promise<void>;
}

function normalizeItems(value: PurchaseListItem[] | null | undefined): PurchaseListItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => ({
      product_id: Number(item.product_id),
      quantity: Math.max(1, Number(item.quantity) || 1),
      note: item.note ?? null,
      name: item.name,
      sku: item.sku ?? null,
    }))
    .filter((item) => Number.isFinite(item.product_id) && item.product_id > 0);
}

function normalizeRow(row: PurchaseListRow, userId: string): PurchaseList {
  const profileId = row.profile_id ?? row.client_id ?? userId;

  return {
    id: row.id,
    profile_id: profileId,
    name: row.name,
    items: normalizeItems(row.items ?? row.products),
    shared_with: Array.isArray(row.shared_with) ? row.shared_with.filter(Boolean) : [],
    created_at: row.created_at,
    updated_at: row.updated_at,
    is_shared: profileId !== userId,
  };
}

export function usePurchaseLists({ userId }: UsePurchaseListsOptions): UsePurchaseListsResult {
  const [lists, setLists] = useState<PurchaseList[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLists = useCallback(async () => {
    if (!userId || userId === "guest") {
      setLists([]);
      return;
    }

    setLoading(true);
    try {
      const [profileResult, legacyClientResult, sharedResult] = await Promise.all([
        supabase
          .from("purchase_lists")
          .select("*")
          .eq("profile_id", userId)
          .order("updated_at", { ascending: false }),
        supabase
          .from("purchase_lists")
          .select("*")
          .eq("client_id", userId)
          .order("updated_at", { ascending: false }),
        supabase
          .from("purchase_lists")
          .select("*")
          .contains("shared_with", [userId])
          .order("updated_at", { ascending: false }),
      ]);

      const merged = [
        ...(profileResult.data ?? []),
        ...(legacyClientResult.data ?? []),
        ...(sharedResult.data ?? []),
      ] as PurchaseListRow[];
      const deduped = Array.from(new Map(merged.map((row) => [row.id, row])).values())
        .map((row) => normalizeRow(row, userId))
        .sort((left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime());

      setLists(deduped);
    } catch {
      setLists([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void fetchLists();
  }, [fetchLists]);

  const createList = useCallback(
    async (name: string, items: PurchaseListItem[] = [], sharedWith: string[] = []): Promise<PurchaseList | null> => {
      if (!userId || userId === "guest") return null;

      const cleanName = name.trim();
      if (!cleanName) return null;

      const normalizedItems = normalizeItems(items);
      const payload = {
        profile_id: userId,
        client_id: userId,
        name: cleanName,
        items: normalizedItems,
        products: normalizedItems,
        shared_with: sharedWith,
      };

      const { data, error } = await supabase
        .from("purchase_lists")
        .insert(payload)
        .select("*")
        .single();

      if (error || !data) return null;

      const normalized = normalizeRow(data as PurchaseListRow, userId);
      setLists((prev) => [normalized, ...prev]);
      return normalized;
    },
    [userId],
  );

  const updateList = useCallback(
    async (
      id: number,
      patch: Partial<Pick<PurchaseList, "name" | "items" | "shared_with">>,
    ): Promise<PurchaseList | null> => {
      if (!userId || userId === "guest") return null;

      const payload: Record<string, unknown> = {};
      if (typeof patch.name === "string") payload.name = patch.name.trim();
      if (patch.items) {
        const normalizedItems = normalizeItems(patch.items);
        payload.items = normalizedItems;
        payload.products = normalizedItems;
      }
      if (patch.shared_with) payload.shared_with = patch.shared_with;

      const { data, error } = await supabase
        .from("purchase_lists")
        .update(payload)
        .eq("id", id)
        .select("*")
        .single();

      if (error || !data) return null;

      const normalized = normalizeRow(data as PurchaseListRow, userId);
      setLists((prev) => prev.map((list) => (list.id === id ? normalized : list)));
      return normalized;
    },
    [userId],
  );

  const addItemToList = useCallback(
    async (id: number, item: PurchaseListItem): Promise<PurchaseList | null> => {
      const current = lists.find((list) => list.id === id);
      if (!current) return null;

      const existing = current.items.find((entry) => entry.product_id === item.product_id);
      const items = existing
        ? current.items.map((entry) =>
            entry.product_id === item.product_id
              ? {
                  ...entry,
                  quantity: entry.quantity + Math.max(1, item.quantity),
                  note: item.note ?? entry.note ?? null,
                  name: entry.name ?? item.name,
                  sku: entry.sku ?? item.sku ?? null,
                }
              : entry,
          )
        : [...current.items, { ...item, quantity: Math.max(1, item.quantity) }];

      return updateList(id, { items });
    },
    [lists, updateList],
  );

  const deleteList = useCallback(async (id: number): Promise<void> => {
    await supabase.from("purchase_lists").delete().eq("id", id);
    setLists((prev) => prev.filter((list) => list.id !== id));
  }, []);

  return {
    lists,
    loading,
    createList,
    updateList,
    deleteList,
    addItemToList,
    refetch: fetchLists,
  };
}
