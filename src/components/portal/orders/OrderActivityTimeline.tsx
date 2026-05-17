import { useEffect, useState } from "react";
import { Activity, Clock } from "lucide-react";

import { fetchActivityLogs } from "@/lib/api/activityLog";
import type { ActivityAction, ActivityLog } from "@/models/activityLog";
import { Skeleton } from "@/components/ui/skeleton";

interface OrderActivityTimelineProps {
  orderId: string | number;
  isDark?: boolean;
}

const ACTION_LABELS: Partial<Record<ActivityAction, string>> = {
  place_order: "Pedido creado",
  order_status_change: "Cambio de estado",
  load_quote: "Cotización referida",
  save_quote: "Cotización guardada",
  export_pdf: "PDF exportado",
};

function describeAction(entry: ActivityLog): string {
  const base = ACTION_LABELS[entry.action] ?? entry.action;
  const meta = entry.metadata ?? {};
  const status = typeof meta.status === "string" ? meta.status : undefined;
  const reason = typeof meta.reason === "string" ? meta.reason : undefined;
  const actor = typeof meta.actor_name === "string" ? meta.actor_name : undefined;

  if (entry.action === "order_status_change" && status) {
    const statusLabels: Record<string, string> = {
      pending: "en revisión",
      approved: "aprobado",
      preparing: "en preparación",
      dispatched: "despachado",
      shipped: "en tránsito",
      delivered: "entregado",
      rejected: "rechazado",
    };
    const friendly = statusLabels[status] ?? status;
    const tail = reason ? ` · ${reason}` : "";
    const by = actor ? ` por ${actor}` : "";
    return `Pedido ${friendly}${by}${tail}`;
  }

  return base;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function OrderActivityTimeline({ orderId }: OrderActivityTimelineProps) {
  const [entries, setEntries] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const all = await fetchActivityLogs({ limit: 50 });
        const filtered = all
          .filter((entry) => entry.entity_type === "order" && String(entry.entity_id) === String(orderId))
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        if (!cancelled) setEntries(filtered);
      } catch {
        if (!cancelled) setEntries([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [orderId]);

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-3 w-40 rounded-md" />
        <Skeleton className="h-3 w-56 rounded-md" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground">
        Aún no se registraron eventos en este pedido.
      </p>
    );
  }

  return (
    <ol className="space-y-2.5">
      {entries.map((entry) => (
        <li key={entry.id} className="flex items-start gap-2.5">
          <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
            <Activity size={10} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-tight text-foreground">{describeAction(entry)}</p>
            <p className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock size={9} />
              {formatTime(entry.created_at)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
