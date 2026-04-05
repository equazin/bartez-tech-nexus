import type { ReactNode } from "react";
import {
  CreditCard,
  DollarSign,
  Percent,
  ShoppingBag,
  Shield,
  TrendingUp,
} from "lucide-react";

import type { Client360Alert, Client360Metric, ProductInsight } from "@/components/admin/client360/types";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SurfaceCard } from "@/components/ui/surface-card";

interface ClientBusinessPanelProps {
  metrics: Client360Metric[];
  alerts: Client360Alert[];
  reorderSuggestions: ProductInsight[];
  frequentProducts: ProductInsight[];
}

const METRIC_ICONS = {
  "credit-available": Shield,
  "credit-used": CreditCard,
  "last-order": ShoppingBag,
  "monthly-volume": DollarSign,
  "purchase-variation": TrendingUp,
  "avg-ticket": Percent,
} as const;

export function ClientBusinessPanel({
  metrics,
  alerts,
  reorderSuggestions,
  frequentProducts,
}: ClientBusinessPanelProps) {
  return (
    <div className="space-y-2">
      <div className="grid gap-1.5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {metrics.map((metric) => {
          const Icon = METRIC_ICONS[metric.id];
          return <CompactMetricCard key={metric.id} metric={metric} icon={<Icon className="h-4 w-4" />} />;
        })}
      </div>

      <SurfaceCard padding="sm" className="space-y-2 rounded-[18px]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Inteligencia comercial</p>
            <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">Que esta pasando con la cuenta</h3>
          </div>
          <Badge variant="outline">Negocio</Badge>
        </div>
        <div className="grid gap-1.5 md:grid-cols-2">
          {alerts.map((alert) => (
            <div key={alert.title} className="rounded-[14px] border border-border/70 bg-surface px-2.5 py-2.5">
              <div className="mb-1 flex items-center gap-2">
                <Badge variant={alert.tone}>{alert.title}</Badge>
              </div>
              <p className="text-[12px] leading-5 text-muted-foreground">{alert.description}</p>
            </div>
          ))}
        </div>
      </SurfaceCard>

      <div className="grid gap-2 xl:grid-cols-2">
        <InsightList
          title="Reorden sugerido"
          description="Productos que conviene volver a ofrecer o reponer segun frecuencia y ventana sin recompra."
          items={reorderSuggestions}
          emptyTitle="Sin sugerencias de reorden"
          emptyDescription="Todavia no hay suficiente historico para sugerir recompra."
        />
        <InsightList
          title="Productos frecuentes"
          description="Mix historico con mejor traccion para orientar seguimiento comercial y oportunidades."
          items={frequentProducts}
          emptyTitle="Sin productos frecuentes"
          emptyDescription="La cuenta todavia no tiene historial suficiente de compra."
        />
      </div>
    </div>
  );
}

interface InsightListProps {
  title: string;
  description: string;
  items: ProductInsight[];
  emptyTitle: string;
  emptyDescription: string;
}

function InsightList({
  title,
  description,
  items,
  emptyTitle,
  emptyDescription,
}: InsightListProps) {
  return (
    <SurfaceCard tone="subtle" padding="sm" className="space-y-2 rounded-[18px]">
      <div className="space-y-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
        <p className="text-[12px] leading-5 text-muted-foreground">{description}</p>
      </div>
      {items.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} className="min-h-[180px]" />
      ) : (
        <div className="space-y-1.5">
          {items.map((item) => (
            <div key={`${item.name}-${item.detail}`} className="rounded-[14px] border border-border/70 bg-card px-2.5 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-foreground">{item.name}</p>
                  <p className="mt-0.5 text-[12px] leading-5 text-muted-foreground">{item.detail}</p>
                </div>
                <span className="shrink-0 text-[12px] font-semibold text-primary">{item.value}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </SurfaceCard>
  );
}

interface CompactMetricCardProps {
  metric: Client360Metric;
  icon: ReactNode;
}

function CompactMetricCard({ metric, icon }: CompactMetricCardProps) {
  return (
    <SurfaceCard tone="subtle" padding="sm" className="space-y-2 rounded-[16px]">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{metric.label}</p>
          <p className="font-display text-lg font-bold tracking-tight text-foreground">{metric.value}</p>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-[14px] bg-primary/10 text-primary">
          {icon}
        </div>
      </div>
      {metric.detail || metric.trend ? (
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="text-muted-foreground">{metric.detail}</span>
          {metric.trend ? <Badge variant="success">{metric.trend}</Badge> : null}
        </div>
      ) : null}
    </SurfaceCard>
  );
}
