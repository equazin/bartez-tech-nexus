import type { ReactNode } from "react";
import { ArrowRight, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { SurfaceCard } from "@/components/ui/surface-card";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string;
  detail?: string;
  trend?: string;
  icon?: ReactNode;
  className?: string;
}

function MetricCard({ label, value, detail, trend, icon, className }: MetricCardProps) {
  return (
    <SurfaceCard tone="subtle" padding="md" className={cn("kpi-soft space-y-3 rounded-[22px] bg-card/95", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
          <p className="font-display text-[25px] font-bold tracking-tight text-foreground">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-accent text-accent-foreground shadow-sm">{icon ?? <ArrowRight className="h-4.5 w-4.5" />}</div>
      </div>
      {detail || trend ? (
        <div className="flex items-center justify-between gap-3 text-[13px]">
          <span className="text-muted-foreground">{detail}</span>
          {trend ? (
            <Badge variant="success" className="gap-1 text-[11px]">
              <TrendingUp className="h-3 w-3" />
              {trend}
            </Badge>
          ) : null}
        </div>
      ) : null}
    </SurfaceCard>
  );
}

export { MetricCard };
