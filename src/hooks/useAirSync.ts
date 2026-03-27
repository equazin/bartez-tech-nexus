import { useState, useCallback } from "react";
import {
  syncAirCatalog,
  syncAirPricesStock,
  saveLastSync,
  getLastSync,
  type SyncProgress,
  type LastSyncInfo,
} from "@/lib/api/airSync";

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

  const runCatalogSync = useCallback(async () => {
    if (running) return;
    setRunning(true);
    const result = await syncAirCatalog((p) => setProgress({ ...p }), userId);
    setRunning(false);
    if (result.phase === "done") {
      const info: LastSyncInfo = {
        type: "catalog",
        finishedAt: result.finishedAt!,
        inserted: result.inserted,
        updated: result.updated,
        errors: result.errors.length,
      };
      saveLastSync(info);
      setLastSync(info);
    }
    return result;
  }, [running, userId]);

  const runSypSync = useCallback(async () => {
    if (running) return;
    setRunning(true);
    const result = await syncAirPricesStock((p) => setProgress({ ...p }), userId);
    setRunning(false);
    if (result.phase === "done") {
      const info: LastSyncInfo = {
        type: "syp",
        finishedAt: result.finishedAt!,
        inserted: 0,
        updated: result.updated,
        errors: result.errors.length,
      };
      saveLastSync(info);
      setLastSync(info);
    }
    return result;
  }, [running, userId]);

  return { progress, lastSync, running, runCatalogSync, runSypSync };
}
