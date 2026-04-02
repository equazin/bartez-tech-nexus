import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Fetches hidden product IDs for the current client based on catalog_segments.
 * Returns a Set<number> of product IDs that should NOT be shown to this client.
 * Empty set = no restrictions (show everything).
 */
export function useCatalogSegments(clientId: string | undefined) {
  const [hiddenProductIds, setHiddenProductIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!clientId || clientId === "guest") {
      setHiddenProductIds(new Set());
      return;
    }

    let cancelled = false;
    setLoading(true);

    supabase
      .rpc("get_hidden_product_ids_for_client", { p_client_id: clientId })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setHiddenProductIds(new Set());
          return;
        }
        const ids = (data as Array<{ product_id: number }>).map((r) => r.product_id);
        setHiddenProductIds(new Set(ids));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [clientId]);

  return { hiddenProductIds, loading };
}
