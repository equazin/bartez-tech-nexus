import { useEffect, useState, useCallback } from "react";
import { fetchAccountMovements, type AccountMovement } from "@/lib/api/clientDetail";

interface UseAccountMovementsReturn {
  movements: AccountMovement[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useAccountMovements(clientId: string | undefined, limit = 200): UseAccountMovementsReturn {
  const [movements, setMovements] = useState<AccountMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!clientId) {
      setMovements([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAccountMovements(clientId, limit);
      setMovements(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error cargando movimientos");
    } finally {
      setLoading(false);
    }
  }, [clientId, limit]);

  useEffect(() => { load(); }, [load]);

  return { movements, loading, error, refresh: load };
}
