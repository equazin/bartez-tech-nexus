import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export type DocumentKind = "invoice" | "remito";

export interface ClientDocument {
  id: string;
  kind: DocumentKind;
  number: string;
  created_at: string;
  amount: number;
  currency: "ARS" | "USD";
  status: string;
  pdf_url: string | null;
}

export interface DocumentFilters {
  kind: DocumentKind | null;
  from: string | null;   // ISO date YYYY-MM-DD
  to: string | null;
  status: string | null;
}

export const DEFAULT_DOC_FILTERS: DocumentFilters = {
  kind: null,
  from: null,
  to: null,
  status: null,
};

export function useClientDocuments(clientId: string | undefined) {
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFiltersState] = useState<DocumentFilters>(DEFAULT_DOC_FILTERS);

  const setFilters = useCallback((patch: Partial<DocumentFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...patch }));
  }, []);

  const clearFilters = useCallback(() => setFiltersState({ ...DEFAULT_DOC_FILTERS }), []);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    setLoading(true);

    supabase
      .rpc("get_my_documents", {
        p_kind:   filters.kind   ?? null,
        p_from:   filters.from   ?? null,
        p_to:     filters.to     ?? null,
        p_status: filters.status ?? null,
        p_limit:  200,
        p_offset: 0,
      })
      .then(({ data }) => {
        if (cancelled) return;
        setDocuments((data ?? []) as ClientDocument[]);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [clientId, filters]);

  return { documents, loading, filters, setFilters, clearFilters };
}
