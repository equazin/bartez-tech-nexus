import { useState, useEffect } from "react";
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
}

export function useBusinessAlerts(clientId: string): UseBusinessAlertsResult {
  const [alerts, setAlerts] = useState<BusinessAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) {
      setAlerts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const now = new Date().toISOString();

    supabase
      .from("business_alerts")
      .select("*")
      .eq("client_id", clientId)
      .eq("active", true)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error) {
          setAlerts((data ?? []) as BusinessAlert[]);
        }
        setLoading(false);
      });
  }, [clientId]);

  return { alerts, loading };
}
