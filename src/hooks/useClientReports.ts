import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export interface CategoryStat {
  category: string;
  units_sold: number;
  revenue: number;
}

export interface TopProduct {
  product_id: number;
  name: string;
  sku: string;
  units_sold: number;
  revenue: number;
}

export interface MonthlyTrendRow {
  month: string; // ISO date YYYY-MM-DD
  order_count: number;
  revenue: number;
}

export function useClientReports(clientId: string | undefined, months = 12) {
  const [byCategory, setByCategory] = useState<CategoryStat[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrendRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    setLoading(true);

    Promise.all([
      supabase.rpc("get_my_purchases_by_category", { p_months: months }),
      supabase.rpc("get_my_top_products",          { p_months: months, p_limit: 10 }),
      supabase.rpc("get_my_monthly_trend",         { p_months: months }),
    ]).then(([catRes, topRes, trendRes]) => {
      if (cancelled) return;
      setByCategory((catRes.data  ?? []) as CategoryStat[]);
      setTopProducts((topRes.data ?? []) as TopProduct[]);
      setMonthlyTrend((trendRes.data ?? []) as MonthlyTrendRow[]);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [clientId, months]);

  return { byCategory, topProducts, monthlyTrend, loading };
}
