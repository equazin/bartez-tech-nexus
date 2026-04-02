import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export const WEBHOOK_EVENTS = [
  "order.created",
  "order.status_changed",
  "invoice.created",
  "quote.approved",
  "rma.created",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export interface WebhookEndpoint {
  id: number;
  name: string;
  url: string;
  secret: string | null;
  events: WebhookEvent[];
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WebhookDelivery {
  id: number;
  endpoint_id: number;
  event_type: string;
  payload: Record<string, unknown>;
  status: "pending" | "delivered" | "failed" | "skipped";
  attempt_count: number;
  last_error: string | null;
  scheduled_at: string;
  delivered_at: string | null;
  created_at: string;
}

export function useWebhooks() {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEndpoints = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("webhook_endpoints")
      .select("*")
      .order("created_at", { ascending: false });

    if (err) {
      setError(err.message);
    } else {
      setEndpoints((data ?? []) as WebhookEndpoint[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void fetchEndpoints(); }, [fetchEndpoints]);

  const create = useCallback(async (input: {
    name: string;
    url: string;
    secret?: string;
    events: WebhookEvent[];
  }): Promise<WebhookEndpoint | null> => {
    const { data, error: err } = await supabase
      .from("webhook_endpoints")
      .insert([{ ...input, active: true }])
      .select()
      .single();

    if (err || !data) {
      setError(err?.message ?? "Error al crear webhook");
      return null;
    }
    const endpoint = data as WebhookEndpoint;
    setEndpoints((prev) => [endpoint, ...prev]);
    return endpoint;
  }, []);

  const toggleActive = useCallback(async (id: number, active: boolean): Promise<boolean> => {
    const { error: err } = await supabase
      .from("webhook_endpoints")
      .update({ active })
      .eq("id", id);

    if (err) {
      setError(err.message);
      return false;
    }
    setEndpoints((prev) => prev.map((e) => (e.id === id ? { ...e, active } : e)));
    return true;
  }, []);

  const remove = useCallback(async (id: number): Promise<boolean> => {
    const { error: err } = await supabase
      .from("webhook_endpoints")
      .delete()
      .eq("id", id);

    if (err) {
      setError(err.message);
      return false;
    }
    setEndpoints((prev) => prev.filter((e) => e.id !== id));
    return true;
  }, []);

  return { endpoints, loading, error, create, toggleActive, remove, refetch: fetchEndpoints };
}

export function useWebhookDeliveries(endpointId?: number) {
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!endpointId) { setDeliveries([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("webhook_deliveries")
      .select("*")
      .eq("endpoint_id", endpointId)
      .order("created_at", { ascending: false })
      .limit(50);

    setDeliveries((data ?? []) as WebhookDelivery[]);
    setLoading(false);
  }, [endpointId]);

  useEffect(() => { void fetch(); }, [fetch]);

  return { deliveries, loading, refetch: fetch };
}
