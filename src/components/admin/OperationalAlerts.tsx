import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clock3, FileWarning, PackageSearch } from "lucide-react";

import { SurfaceCard } from "@/components/ui/surface-card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

interface AdminOrderLike {
  status: string;
  created_at: string;
}

interface AdminProductLike {
  active?: boolean | null;
  stock: number;
  stock_min?: number | null;
}

interface OperationalAlertsProps {
  orders: AdminOrderLike[];
  products: AdminProductLike[];
  onNavigate?: (tab: string) => void;
}

const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

async function fetchRmaWithoutResponseCount(): Promise<number> {
  const primary = await supabase
    .from("rma")
    .select("id, status")
    .in("status", ["pending", "submitted"]);

  if (!primary.error) {
    return primary.data?.length ?? 0;
  }

  const fallback = await supabase
    .from("rma_requests")
    .select("id, status")
    .in("status", ["pending", "submitted"]);

  if (!fallback.error) {
    return fallback.data?.length ?? 0;
  }

  const legacyFallback = await supabase
    .from("rma_requests")
    .select("id, status")
    .in("status", ["draft", "submitted"]);

  return legacyFallback.error ? 0 : (legacyFallback.data?.length ?? 0);
}

async function fetchOverdueInvoicesCount(): Promise<number> {
  const { data, error } = await supabase
    .from("invoices")
    .select("id")
    .eq("status", "overdue");

  if (error) return 0;
  return data?.length ?? 0;
}

export function OperationalAlerts({ orders, products, onNavigate }: OperationalAlertsProps) {
  const [rmaWithoutResponseCount, setRmaWithoutResponseCount] = useState(0);
  const [overdueInvoicesCount, setOverdueInvoicesCount] = useState(0);

  useEffect(() => {
    let isActive = true;

    async function loadCounters() {
      const [rmaCount, invoiceCount] = await Promise.all([
        fetchRmaWithoutResponseCount(),
        fetchOverdueInvoicesCount(),
      ]);

      if (!isActive) return;
      setRmaWithoutResponseCount(rmaCount);
      setOverdueInvoicesCount(invoiceCount);
    }

    void loadCounters();
    return () => {
      isActive = false;
    };
  }, []);

  const pendingOrdersOver48Hours = useMemo(
    () =>
      orders.filter((order) => {
        if (order.status !== "pending") return false;
        const createdAt = new Date(order.created_at).getTime();
        return Date.now() - createdAt > FORTY_EIGHT_HOURS_MS;
      }).length,
    [orders],
  );

  const criticalStockCount = useMemo(
    () =>
      products.filter((product) => {
        if (product.active === false) return false;
        const stock = product.stock ?? 0;
        const stockMin = Math.max(3, product.stock_min ?? 0);
        return stock <= stockMin;
      }).length,
    [products],
  );

  const counters = [
    {
      id: "pending-orders",
      label: "Pedidos pendientes +48hs",
      count: pendingOrdersOver48Hours,
      tab: "orders",
      icon: Clock3,
      tone: pendingOrdersOver48Hours > 0 ? "danger" : "neutral",
    },
    {
      id: "rma-pending",
      label: "RMA sin responder",
      count: rmaWithoutResponseCount,
      tab: "rma",
      icon: FileWarning,
      tone: rmaWithoutResponseCount > 0 ? "warning" : "neutral",
    },
    {
      id: "critical-stock",
      label: "Stock critico",
      count: criticalStockCount,
      tab: "stock",
      icon: PackageSearch,
      tone: criticalStockCount > 0 ? "warning" : "neutral",
    },
    {
      id: "overdue-invoices",
      label: "Facturas vencidas",
      count: overdueInvoicesCount,
      tab: "invoices",
      icon: AlertTriangle,
      tone: overdueInvoicesCount > 0 ? "danger" : "neutral",
    },
  ] as const;

  if (!counters.some((counter) => counter.count > 0)) {
    return null;
  }

  return (
    <SurfaceCard tone="elevated" padding="none" className="overflow-hidden">
      <div className="grid gap-2 p-2 md:grid-cols-2 xl:grid-cols-4">
        {counters.map((counter) => {
          const toneClass =
            counter.tone === "danger"
              ? "border-red-500/30 bg-red-500/10 text-red-500"
              : counter.tone === "warning"
                ? "border-amber-500/30 bg-amber-500/10 text-amber-500"
                : "border-border/70 bg-background/80 text-muted-foreground";

          return (
            <Button
              key={counter.id}
              type="button"
              variant="ghost"
              onClick={() => onNavigate?.(counter.tab)}
              className={`h-[72px] justify-start rounded-xl border px-4 py-3 text-left hover:bg-accent/30 ${toneClass}`}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-background/70">
                  <counter.icon size={16} />
                </div>
                <div>
                  <p className="text-2xl font-extrabold leading-none tabular-nums">
                    {counter.count.toLocaleString("es-AR")}
                  </p>
                  <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                    {counter.label}
                  </p>
                </div>
              </div>
            </Button>
          );
        })}
      </div>
    </SurfaceCard>
  );
}
