import { useState, useCallback, useEffect } from "react";
import { syncInvidCatalog, type SyncProgress } from "@/lib/api/invidSync";
import {
  getSupplierSyncSnapshot,
  saveSupplierSyncSnapshot,
  type SupplierSyncSnapshot,
} from "@/lib/api/supplierSyncState";

export function useInvidSync(userId?: string) {
  const [progress, setProgress] = useState<SyncProgress>({
    phase: "idle",
    page: 0,
    fetched: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  });
  const [lastSync, setLastSync] = useState<SupplierSyncSnapshot | null>(null);
  const [running, setRunning] = useState(false);

  const loadSnapshot = useCallback(async () => {
    try {
      const snap = await getSupplierSyncSnapshot("INVID");
      setLastSync(snap);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  const runCatalogSync = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setProgress({
      phase: "checking",
      page: 0,
      fetched: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    });

    try {
      const result = await syncInvidCatalog((p) => setProgress({ ...p }), userId);

      if (result.phase === "done" && result.errors.length === 0) {
        await saveSupplierSyncSnapshot(
          "INVID",
          {
            type: "catalog",
            finishedAt: new Date().toISOString(),
            inserted: result.inserted,
            updated: result.updated,
            errors: result.errors.length,
          },
          userId
        );
      }
    } finally {
      setRunning(false);
      void loadSnapshot();
    }
  }, [running, userId, loadSnapshot]);

  const runSelectedCatalogSync = useCallback(
    async (articles: import("@/lib/api/invidApi").InvidArticle[], options?: { forceCreateExternalIds?: string[] }) => {
      const { syncSelectedInvidProducts } = await import("@/lib/api/invidSync");
      setRunning(true);
      try {
        await syncSelectedInvidProducts(articles, options, userId);
      } finally {
        setRunning(false);
        void loadSnapshot();
      }
    },
    [userId, loadSnapshot]
  );

  return {
    progress,
    lastSync,
    running,
    runCatalogSync,
    runSelectedCatalogSync,
  };
}
