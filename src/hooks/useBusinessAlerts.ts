import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export interface BusinessAlert {
  id: number;
  client_id: string;
  type: "invoice" | "rma" | "promotion" | "info" | "warning";
  title: string;
  subtitle?: string;
  active: boolean;
  expires_at?: string;
  created_at: string;
}

interface UseBusinessAlertsResult {
  alerts: BusinessAlert[];
  loading: boolean;
  markRead: (alertId: number) => Promise<void>;
  dismiss: (alertId: number) => Promise<void>;
}

export function useBusinessAlerts(clientId: string): UseBusinessAlertsResult {
  const [alerts, setAlerts] = useState<BusinessAlert[]>([]);
  const [readIds, setReadIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) {
      setAlerts([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const now = new Date().toISOString();

    Promise.all([
      supabase
        .from("business_alerts")
        .select("*")
        .eq("client_id", clientId)
        .eq("active", true)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order("created_at", { ascending: false }),
      supabase
        .from("business_alerts_read")
        .select("alert_id")
        .eq("profile_id", clientId),
    ]).then(([alertsRes, readRes]) => {
      if (cancelled) return;
      const allAlerts = (alertsRes.data ?? []) as BusinessAlert[];
      const ids = new Set((readRes.data ?? []).map((r: { alert_id: number }) => r.alert_id));
      // filter out already-read alerts from the unread list
      setAlerts(allAlerts.filter((a) => !ids.has(a.id)));
      setReadIds(ids);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [clientId]);

  const markRead = useCallback(async (alertId: number) => {
    await supabase.rpc("mark_alert_read", { p_alert_id: alertId });
    setReadIds((prev) => new Set([...prev, alertId]));
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
  }, []);

  // dismiss = mark read (UI removes it immediately; no separate deactivation needed)
  const dismiss = markRead;

  return { alerts, loading, markRead, dismiss };
}
