import { useCallback, useEffect, useState } from "react";
import {
  getElitLastSync,
  saveElitLastSync,
  syncElitCatalog,
  syncElitDelta,
  syncSelectedElitProducts,
  type SupplierLastSyncInfo,
  type SupplierSyncProgress,
} from "@/lib/api/elitSync";
import { getSupplierSyncSnapshot, saveSupplierSyncSnapshot } from "@/lib/api/supplierSyncState";
import type { ElitProduct } from "@/lib/api/elitApi";

const ELIT_SUPPLIER_NAME = "ELIT";

export function useElitSync(userId?: string) {
  const [progress, setProgress] = useState<SupplierSyncProgress>({
    phase: "idle",
    page: 0,
    fetched: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  });
  const [lastSync, setLastSync] = useState<SupplierLastSyncInfo | null>(getElitLastSync);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const remote = await getSupplierSyncSnapshot(ELIT_SUPPLIER_NAME);
        if (!remote || !active) return;

        const info: SupplierLastSyncInfo = {
          type: remote.type === "delta" ? "delta" : "catalog",
          finishedAt: remote.finishedAt,
          inserted: remote.inserted,
          updated: remote.updated,
          errors: remote.errors,
        };
        saveElitLastSync(info);
        setLastSync(info);
      } catch {
        // Fallback a localStorage si no hay acceso remoto.
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const persistSnapshot = useCallback(async (info: SupplierLastSyncInfo) => {
    saveElitLastSync(info);
    setLastSync(info);

    try {
      await saveSupplierSyncSnapshot(
        ELIT_SUPPLIER_NAME,
        {
          type: info.type,
          finishedAt: info.finishedAt,
          inserted: info.inserted,
          updated: info.updated,
          errors: info.errors,
        },
        userId
      );
    } catch {
      // Se conserva en localStorage aunque falle persistencia remota.
    }
  }, [userId]);

  const runCatalogSync = useCallback(async () => {
    if (running) return;
    setRunning(true);
    let result;
    try {
      result = await syncElitCatalog((next) => setProgress({ ...next }), userId);
    } finally {
      setRunning(false);
    }

    if (result?.phase === "done") {
      const info: SupplierLastSyncInfo = {
        type: "catalog",
        finishedAt: result.finishedAt!,
        inserted: result.inserted,
        updated: result.updated,
        errors: result.errors.length,
      };
      await persistSnapshot(info);
    }

    return result;
  }, [persistSnapshot, running, userId]);

  const runDeltaSync = useCallback(async () => {
    if (running) return;
    setRunning(true);
    const since = lastSync?.finishedAt ?? null;
    let result;
    try {
      result = await syncElitDelta(since, (next) => setProgress({ ...next }), userId);
    } finally {
      setRunning(false);
    }

    if (result?.phase === "done") {
      const info: SupplierLastSyncInfo = {
        type: "delta",
        finishedAt: result.finishedAt!,
        inserted: result.inserted,
        updated: result.updated,
        errors: result.errors.length,
      };
      await persistSnapshot(info);
    }

    return result;
  }, [lastSync?.finishedAt, persistSnapshot, running, userId]);

  const runSelectedCatalogSync = useCallback(async (
    products: ElitProduct[],
    options?: { forceCreateExternalIds?: string[] }
  ) => {
    if (running) return;
    setRunning(true);
    let result;
    try {
      result = await syncSelectedElitProducts(products, options, (next) => setProgress({ ...next }), userId);
    } finally {
      setRunning(false);
    }

    if (result?.phase === "done") {
      const info: SupplierLastSyncInfo = {
        type: "catalog",
        finishedAt: result.finishedAt!,
        inserted: result.inserted,
        updated: result.updated,
        errors: result.errors.length,
      };
      await persistSnapshot(info);
    }
    return result;
  }, [persistSnapshot, running, userId]);

  return {
    progress,
    lastSync,
    running,
    runCatalogSync,
    runDeltaSync,
    runSelectedCatalogSync,
  };
}
