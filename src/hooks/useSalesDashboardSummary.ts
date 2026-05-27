import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface SalesDashboardSummary {
  approvedCount: number;
  pendingCount: number;
  totalRevenue: number;
  currentMonthRevenue: number;
  prevMonthRevenue: number;
  currentMonthOrders: number;
  prevMonthOrders: number;
  avgMargin: number;
  momPct: number | null;
  ordersPct: number | null;
  avgTicketPct: number | null;
  refreshedAt: string;
}

interface RawSummary {
  approved_count: number | string;
  pending_count: number | string;
  total_revenue: number | string;
  cur_revenue: number | string;
  prev_revenue: number | string;
  cur_orders: number | string;
  prev_orders: number | string;
  avg_margin: number | string;
  mom_pct: number | string | null;
  orders_pct: number | string | null;
  avg_ticket_pct: number | string | null;
  refreshed_at: string;
}

function parseSummary(raw: RawSummary): SalesDashboardSummary {
  const num = (value: number | string | null): number => {
    if (value === null) return 0;
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const nullableNum = (value: number | string | null): number | null => {
    if (value === null) return null;
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  return {
    approvedCount: num(raw.approved_count),
    pendingCount: num(raw.pending_count),
    totalRevenue: num(raw.total_revenue),
    currentMonthRevenue: num(raw.cur_revenue),
    prevMonthRevenue: num(raw.prev_revenue),
    currentMonthOrders: num(raw.cur_orders),
    prevMonthOrders: num(raw.prev_orders),
    avgMargin: num(raw.avg_margin),
    momPct: nullableNum(raw.mom_pct),
    ordersPct: nullableNum(raw.orders_pct),
    avgTicketPct: nullableNum(raw.avg_ticket_pct),
    refreshedAt: raw.refreshed_at,
  };
}

export function useSalesDashboardSummary() {
  const [summary, setSummary] = useState<SalesDashboardSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc("get_sales_dashboard_summary");
      if (rpcError) throw new Error(rpcError.message);
      if (!data) {
        setSummary(null);
        return;
      }
      setSummary(parseSummary(data as RawSummary));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al cargar el resumen");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const { error: refreshError } = await supabase.rpc("refresh_sales_dashboard_summary");
      if (refreshError) throw new Error(refreshError.message);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al refrescar");
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  useEffect(() => {
    void load();
  }, [load]);

  return { summary, loading, error, refresh, refreshing };
}
