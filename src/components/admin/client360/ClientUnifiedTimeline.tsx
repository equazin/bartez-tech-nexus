import { Activity, FileText, MessageSquare, Package, RefreshCcw, ShieldAlert } from "lucide-react";

import type { TimelineItem } from "@/components/admin/client360/types";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SurfaceCard } from "@/components/ui/surface-card";

interface ClientUnifiedTimelineProps {
  items: TimelineItem[];
}

const TIMELINE_ICONS = {
  pedido: Package,
  cotizacion: FileText,
  nota: MessageSquare,
  actividad: Activity,
  ticket: ShieldAlert,
  rma: RefreshCcw,
} as const;

export function ClientUnifiedTimeline({ items }: ClientUnifiedTimelineProps) {
  return (
    <SurfaceCard tone="subtle" padding="sm" className="space-y-2 rounded-[18px]">
      <div className="space-y-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Timeline unificado</p>
        <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">Pedidos, cotizaciones, notas e interacciones</h3>
      </div>
      {items.length === 0 ? (
        <EmptyState
          title="Sin actividad consolidada"
          description="Cuando el cliente genere pedidos, notas, tickets o cotizaciones, todo se va a consolidar en esta linea temporal."
        />
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => {
            const Icon = TIMELINE_ICONS[item.kind];
            return (
              <div key={item.id} className="flex gap-2">
                <div className="flex w-7 shrink-0 flex-col items-center">
                  <div className="flex h-7 w-7 items-center justify-center rounded-[14px] bg-secondary text-foreground">
                    <Icon className="h-3 w-3" />
                  </div>
                  {index < items.length - 1 ? <div className="mt-1 h-full w-px bg-border/70" /> : null}
                </div>
                <div className="min-w-0 flex-1 rounded-[14px] border border-border/70 bg-card px-2.5 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge variant={item.tone}>{item.kind}</Badge>
                    <span className="text-[10px] text-muted-foreground">{item.relative}</span>
                  </div>
                  <p className="mt-1.5 text-[12px] font-semibold text-foreground">{item.title}</p>
                  <p className="mt-0.5 text-[12px] leading-5 text-muted-foreground">{item.detail}</p>
                  <p className="mt-1.5 text-[9px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    {new Date(item.at).toLocaleDateString("es-AR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SurfaceCard>
  );
}
