import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { createRmaApi } from "@/lib/api/ordersApi";

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
    setLoading(false);
  }, [clientId]);

  useEffect(() => { fetchRmas(); }, [fetchRmas]);

  const createRma = useCallback(async (input: CreateRmaInput): Promise<RmaRequest | null> => {
    try {
      const rma = await createRmaApi({
        client_id: input.client_id,
        order_id: input.order_id,
        reason: input.reason,
        description: input.description,
        items: input.items.map((item) => ({
          product_id: item.product_id,
          sku: item.sku,
          name: item.name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_total: item.unit_price * item.quantity,
        })),
      });
      const normalized: RmaRequest = {
        id: Number(rma.id),
        rma_number: `RMA-${String(rma.id)}`,
        client_id: rma.client_id ?? input.client_id,
        order_id: rma.order_id,
        status: (rma.status === "pending" ? "submitted" : rma.status) as RmaStatus,
        reason: input.reason,
        description: rma.description ?? input.description,
        items: input.items,
        resolution_type: rma.resolution_type as RmaResolution | undefined,
        resolution_notes: rma.resolution_notes ?? undefined,
        created_at: rma.created_at,
        updated_at: rma.updated_at,
        resolved_at: rma.resolved_at ?? undefined,
      };
      setRmas((prev) => [normalized, ...prev]);
      return normalized;
    } catch (err) {
      setError((err as Error).message ?? "Error al crear RMA");
      return null;
    }
  }, []);

  return { rmas, loading, error, createRma, refetch: fetchRmas };
}
