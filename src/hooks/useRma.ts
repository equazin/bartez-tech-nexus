import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { backend, hasBackendUrl } from "@/lib/api/backend";

export type RmaStatus = "draft" | "submitted" | "reviewing" | "approved" | "rejected" | "resolved";
export type RmaReason = "defective" | "wrong_item" | "damaged_in_transit" | "not_as_described" | "other";
export type RmaResolution = "refund" | "exchange" | "credit_note" | "repair";

export interface RmaItem {
  product_id: number;
  name: string;
  sku: string;
  quantity: number;
  unit_price: number;
}

export interface RmaRequest {
  id: number;
  rma_number: string;
  client_id: string;
  order_id: string;
  status: RmaStatus;
  reason: RmaReason;
  description?: string;
  items: RmaItem[];
  resolution_type?: RmaResolution;
  resolution_notes?: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
}

type CreateRmaInput = {
  client_id: string;
  order_id: string;
  reason: RmaReason;
  description?: string;
  items: RmaItem[];
};

export function useRma(clientId: string | undefined) {
  const [rmas, setRmas] = useState<RmaRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRmas = useCallback(async () => {
    if (!clientId || clientId === "guest") {
      setRmas([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (hasBackendUrl) {
        // Migrado: el backend filtra por JWT del cliente autenticado
        const { items } = await backend.rma.list();
        setRmas(items as unknown as RmaRequest[]);
      } else {
        // Fallback: Supabase directo
        const { data, error: err } = await supabase
          .from("rma_requests")
          .select("*")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false });

        if (err) {
          setError(err.message);
        } else {
          setRmas((data ?? []) as RmaRequest[]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar RMAs");
    }
    setLoading(false);
  }, [clientId]);

  useEffect(() => { fetchRmas(); }, [fetchRmas]);

  const createRma = useCallback(async (input: CreateRmaInput): Promise<RmaRequest | null> => {
    try {
      const rma = await backend.rma.create(input);
      setRmas((prev) => [rma as unknown as RmaRequest, ...prev]);
      return rma as unknown as RmaRequest;
    } catch (err) {
      setError((err as Error).message ?? "Error al crear RMA");
      return null;
    }
  }, []);

  return { rmas, loading, error, createRma, refetch: fetchRmas };
}
