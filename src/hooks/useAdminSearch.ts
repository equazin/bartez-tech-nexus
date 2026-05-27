import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

export type AdminSearchResultType =
  | "product"
  | "client"
  | "order"
  | "shipment"
  | "invoice"
  | "quote"
  | "payment";

export interface AdminSearchResult {
  type: AdminSearchResultType;
  id: string;
  label: string;
  sub: string | null;
  clientId: string | null;
  score: number;
}

interface RpcRow {
  result_type: string;
  result_id: string;
  label: string | null;
  sub: string | null;
  client_id: string | null;
  score: number | null;
}

const VALID_TYPES: ReadonlySet<AdminSearchResultType> = new Set([
  "product",
  "client",
  "order",
  "shipment",
  "invoice",
  "quote",
  "payment",
]);

function isValidType(value: string): value is AdminSearchResultType {
  return VALID_TYPES.has(value as AdminSearchResultType);
}

const DEFAULT_DEBOUNCE_MS = 200;
const MIN_QUERY_LENGTH = 2;
const PER_TYPE = 5;

export function useAdminSearch(query: string, debounceMs = DEFAULT_DEBOUNCE_MS) {
  const [results, setResults] = useState<AdminSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seqRef = useRef(0);

  const runSearch = useCallback(async (q: string, seq: number) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc("admin_global_search", {
        p_query: q,
        p_per_type: PER_TYPE,
      });
      if (seq !== seqRef.current) return;
      if (rpcError) throw new Error(rpcError.message);
      const rows = (data ?? []) as RpcRow[];
      const mapped: AdminSearchResult[] = rows
        .filter((row) => isValidType(row.result_type))
        .map((row) => ({
          type: row.result_type as AdminSearchResultType,
          id: row.result_id,
          label: row.label ?? row.result_id,
          sub: row.sub,
          clientId: row.client_id,
          score: Number(row.score ?? 0),
        }));
      setResults(mapped);
    } catch (err: unknown) {
      if (seq !== seqRef.current) return;
      setError(err instanceof Error ? err.message : "Error en la búsqueda");
      setResults([]);
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    seqRef.current += 1;
    const seq = seqRef.current;

    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    const timer = setTimeout(() => {
      void runSearch(trimmed, seq);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, debounceMs, runSearch]);

  return { results, loading, error };
}
