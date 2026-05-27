import { useCallback, useEffect, useState } from "react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import {
  drainQueue,
  listActions,
  onQueueChange,
  type SyncAction,
} from "@/lib/syncQueue";

export function useSyncQueue() {
  const online = useOnlineStatus();
  const [actions, setActions] = useState<SyncAction[]>([]);
  const [draining, setDraining] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await listActions();
      setActions(next);
    } catch (err: unknown) {
      setLastError(err instanceof Error ? err.message : "Error al leer la cola");
    }
  }, []);

  const drain = useCallback(async () => {
    if (draining) return;
    setDraining(true);
    setLastError(null);
    try {
      await drainQueue();
    } catch (err: unknown) {
      setLastError(err instanceof Error ? err.message : "Error al sincronizar");
    } finally {
      setDraining(false);
      await refresh();
    }
  }, [draining, refresh]);

  useEffect(() => {
    void refresh();
    return onQueueChange(() => {
      void refresh();
    });
  }, [refresh]);

  // Drain automatically when connection returns and there are pending actions.
  useEffect(() => {
    if (online && actions.length > 0 && !draining) {
      void drain();
    }
  }, [online, actions.length, draining, drain]);

  return {
    actions,
    count: actions.length,
    draining,
    lastError,
    drain,
  };
}
