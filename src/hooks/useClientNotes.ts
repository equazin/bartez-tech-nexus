import { useEffect, useState, useCallback } from "react";
import {
  addClientNote,
  fetchClientNotes,
  type ClientNote,
} from "@/lib/api/clientDetail";

interface UseClientNotesReturn {
  notes: ClientNote[];
  loading: boolean;
  error: string | null;
  add: (body: string, tipo?: ClientNote["tipo"]) => Promise<boolean>;
  refresh: () => void;
}

export function useClientNotes(clientId: string | undefined): UseClientNotesReturn {
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!clientId) {
      setNotes([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchClientNotes(clientId);
      setNotes(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error cargando notas");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const add = useCallback(async (body: string, tipo: ClientNote["tipo"] = "nota"): Promise<boolean> => {
    if (!clientId || !body.trim()) return false;
    try {
      await addClientNote(clientId, body.trim(), tipo);
      await load();
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error guardando nota");
      return false;
    }
  }, [clientId, load]);

  return { notes, loading, error, add, refresh: load };
}
