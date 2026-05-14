import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { CategoryCountRow } from "@/components/portal/catalog/types";

export function useCategoryCounts(clientId: string | undefined) {
  const [counts, setCounts] = useState<Map<number, number>>(new Map());
  const [rows, setRows] = useState<CategoryCountRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!clientId) return;

    let cancelled = false;
    setLoading(true);

    supabase
      .rpc("get_category_counts", { p_client_id: clientId })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) { setLoading(false); return; }

        const typedRows = data as CategoryCountRow[];
        const map = new Map<number, number>(
          typedRows.map((r) => [r.category_id, r.count])
        );
        setRows(typedRows);
        setCounts(map);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [clientId]);

  return { counts, rows, loading };
}
