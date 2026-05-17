import { useCallback, useEffect, useState } from "react";

import {
  MAX_COMPARE_PRODUCTS,
  clearCompareProducts,
  getCompareProducts,
  toggleCompareProduct,
} from "@/lib/compareProducts";

const STORAGE_EVENT = "storage";

/**
 * Tracks a per-client "comparison list" (max 4 products) backed by localStorage.
 * Multiple components stay in sync via the standard `storage` event.
 */
export function useCompareList(clientId: string | undefined) {
  const safeId = clientId ?? "guest";
  const [ids, setIds] = useState<number[]>(() => getCompareProducts(safeId));

  useEffect(() => {
    setIds(getCompareProducts(safeId));
  }, [safeId]);

  useEffect(() => {
    function handler(event: StorageEvent) {
      if (event.key && event.key.startsWith("bartez_compare_")) {
        setIds(getCompareProducts(safeId));
      }
    }
    window.addEventListener(STORAGE_EVENT, handler);
    return () => window.removeEventListener(STORAGE_EVENT, handler);
  }, [safeId]);

  const toggle = useCallback((productId: number) => {
    const next = toggleCompareProduct(safeId, productId);
    setIds(next);
    return next;
  }, [safeId]);

  const remove = useCallback((productId: number) => {
    const next = getCompareProducts(safeId).filter((id) => id !== productId);
    try {
      window.localStorage.setItem(`bartez_compare_${safeId}`, JSON.stringify(next));
    } catch {
      // ignore quota
    }
    setIds(next);
  }, [safeId]);

  const clear = useCallback(() => {
    clearCompareProducts(safeId);
    setIds([]);
  }, [safeId]);

  return {
    ids,
    toggle,
    remove,
    clear,
    max: MAX_COMPARE_PRODUCTS,
    isFull: ids.length >= MAX_COMPARE_PRODUCTS,
  };
}
