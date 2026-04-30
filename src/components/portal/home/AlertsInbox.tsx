import { X, Info, AlertTriangle, AlertCircle, Tag, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BusinessAlert } from "@/hooks/useBusinessAlerts";

const TYPE_META: Record<BusinessAlert["type"], { icon: React.ReactNode; tone: string; bg: string }> = {
  info:      { icon: <Info className="h-4 w-4" />,          tone: "text-info",    bg: "bg-info/10" },
  warning:   { icon: <AlertTriangle className="h-4 w-4" />, tone: "text-warning", bg: "bg-warning/10" },
  invoice:   { icon: <FileText className="h-4 w-4" />,      tone: "text-brand-500", bg: "bg-brand-50 dark:bg-brand-900/20" },
  rma:       { icon: <AlertCircle className="h-4 w-4" />,   tone: "text-danger",  bg: "bg-danger/10" },
  promotion: { icon: <Tag className="h-4 w-4" />,           tone: "text-success", bg: "bg-success/10" },
};

interface Props {
  alerts: BusinessAlert[];
  loading: boolean;
  onDismiss: (id: number) => void;
}

export function AlertsInbox({ alerts, loading, onDismiss }: Props) {
  if (loading || alerts.length === 0) return null;

  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Avisos ({alerts.length})
      </p>
      <div className="flex flex-col gap-2">
        {alerts.map((alert) => {
          const meta = TYPE_META[alert.type] ?? TYPE_META.info;
          return (
            <div
              key={alert.id}
              className={cn("flex items-start gap-3 rounded-lg px-4 py-3", meta.bg)}
            >
              <span className={cn("mt-0.5 shrink-0", meta.tone)}>{meta.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{alert.title}</p>
                {alert.subtitle && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{alert.subtitle}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 shrink-0 p-0 opacity-60 hover:opacity-100"
                onClick={() => onDismiss(alert.id)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
