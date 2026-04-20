import { useCallback, useEffect, useState } from "react";
import {
  getLastSync,
  saveLastSync,
  syncAirCatalog,
  syncAirIncomingCatalog,
  syncAirPricesStock,
  syncSelectedAirProducts,
  type LastSyncInfo,
  type SyncProgress,
} from "@/lib/api/airSync";
import { getSupplierSyncSnapshot, saveSupplierSyncSnapshot } from "@/lib/api/supplierSyncState";
import type { AirProduct } from "@/lib/api/airApi";

const AIR_SUPPLIER_NAME = "AIR";

export function useAirSync(userId?: string) {
  const [progress, setProgress] = useState<SyncProgress>({
    phase: "idle",
    page: 0,
    fetched: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  });
  const [lastSync, setLastSync] = useState<LastSyncInfo | null>(getLastSync);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const remote = await getSupplierSyncSnapshot(AIR_SUPPLIER_NAME);
        if (!remote || !active) return;

        const info: LastSyncInfo = {
          type: remote.type === "syp" ? "syp" : remote.type === "incoming" ? "incoming" : "catalog",
          finishedAt: remote.finishedAt,
          inserted: remote.inserted,
          updated: remote.updated,
          errors: remote.errors,
        };
        saveLastSync(info);
        setLastSync(info);
      } catch {
        // Fallback local.
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const persistSnapshot = useCallback(async (info: LastSyncInfo) => {
    saveLastSync(info);
    setLastSync(info);

    try {
      await saveSupplierSyncSnapshot(
        AIR_SUPPLIER_NAME,
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
      // Fallback local.
    }
  }, [userId]);

  const runCatalogSync = useCallback(async () => {
    if (running) return;
    setRunning(true);
    let result;
    try {
      result = await syncAirCatalog((p) => setProgress({ ...p }), userId);
    } finally {
      setRunning(false);
    }

    if (result?.phase === "done") {
      const info: LastSyncInfo = {
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

  const runSypSync = useCallback(async () => {
    if (running) return;
    setRunning(true);
    let result;
    try {
      result = await syncAirPricesStock((p) => setProgress({ ...p }), userId);
    } finally {
      setRunning(false);
    }

    if (result?.phase === "done") {
      const info: LastSyncInfo = {
        type: "syp",
        finishedAt: result.finishedAt!,
        inserted: 0,
        updated: result.updated,
        errors: result.errors.length,
      };
      await persistSnapshot(info);
    }

    return result;
  }, [persistSnapshot, running, userId]);

  const runIncomingSync = useCallback(async () => {
    if (running) return;
    setRunning(true);
    let result;
    try {
      result = await syncAirIncomingCatalog((p) => setProgress({ ...p }), userId);
    } finally {
      setRunning(false);
    }

    if (result?.phase === "done") {
      const info: LastSyncInfo = {
        type: "incoming",
        finishedAt: result.finishedAt!,
        inserted: result.inserted,
        updated: result.updated,
        errors: result.errors.length,
      };
      await persistSnapshot(info);
    }

    return result;
  }, [persistSnapshot, running, userId]);

  const runSelectedCatalogSync = useCallback(async (
    products: AirProduct[],
    options?: { forceCreateExternalIds?: string[] }
  ) => {
    if (running) return;
    setRunning(true);
    let result;
    try {
      result = await syncSelectedAirProducts(products, options, (p) => setProgress({ ...p }), userId);
    } finally {
      setRunning(false);
    }

    if (result?.phase === "done") {
      const info: LastSyncInfo = {
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

  return { progress, lastSync, running, runCatalogSync, runSypSync, runIncomingSync, runSelectedCatalogSync };
}
