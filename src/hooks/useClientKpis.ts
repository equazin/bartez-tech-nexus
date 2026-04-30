import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export interface ClientKpis {
  orders_in_progress: number;
  quotes_pending: number;
  last_invoice_at: string | null;
  credit_used_pct: number;
}

const EMPTY: ClientKpis = {
  orders_in_progress: 0,
  quotes_pending: 0,
  last_invoice_at: null,
  credit_used_pct: 0,
};

export function useClientKpis(clientId: string | undefined) {
  const [kpis, setKpis] = useState<ClientKpis>(EMPTY);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    setLoading(true);

    supabase.rpc("get_my_kpis").then(({ data }) => {
      if (cancelled) return;
      const row = Array.isArray(data) ? data[0] : data;
      setKpis(row ? (row as ClientKpis) : EMPTY);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [clientId]);

  return { kpis, loading };
}
