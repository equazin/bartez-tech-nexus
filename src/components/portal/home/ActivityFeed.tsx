import { Package, FileText, CheckCircle, Truck, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { PortalOrder } from "@/hooks/useOrders";

const STATUS_META: Record<PortalOrder["status"], { label: string; icon: React.ReactNode; tone: string }> = {
  pending_approval: { label: "Esperando aprobación", icon: <Clock className="h-3.5 w-3.5" />,        tone: "text-warning" },
  pending:          { label: "Recibido",              icon: <Package className="h-3.5 w-3.5" />,      tone: "text-info" },
  approved:         { label: "Aprobado",              icon: <CheckCircle className="h-3.5 w-3.5" />,  tone: "text-success" },
  preparing:        { label: "Preparando",            icon: <Package className="h-3.5 w-3.5" />,      tone: "text-brand-500" },
  shipped:          { label: "Enviado",               icon: <Truck className="h-3.5 w-3.5" />,        tone: "text-brand-500" },
  dispatched:       { label: "Despachado",            icon: <Truck className="h-3.5 w-3.5" />,        tone: "text-brand-500" },
  delivered:        { label: "Entregado",             icon: <CheckCircle className="h-3.5 w-3.5" />,  tone: "text-success" },
  rejected:         { label: "Rechazado",             icon: <FileText className="h-3.5 w-3.5" />,     tone: "text-danger" },
};

interface Props {
  orders: PortalOrder[];
  loading: boolean;
  onNavigate: (path: string) => void;
}

export function ActivityFeed({ orders, loading, onNavigate }: Props) {
  const recent = orders
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Actividad reciente</p>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
        </div>
      ) : recent.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Sin actividad reciente.</p>
      ) : (
        <div className="flex flex-col divide-y rounded-lg border">
          {recent.map((order) => {
            const meta = STATUS_META[order.status] ?? STATUS_META.pending;
            const date = new Date(order.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
            return (
              <button
                key={order.id}
                type="button"
                onClick={() => onNavigate("/portal/pedidos")}
                className="flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors first:rounded-t-lg last:rounded-b-lg"
              >
                <span className={cn("shrink-0", meta.tone)}>{meta.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {order.order_number ?? `Pedido #${order.id}`}
                  </p>
                  <p className="text-xs text-muted-foreground">{date}</p>
                </div>
                <Badge variant="outline" className="shrink-0 text-xs">
                  {meta.label}
                </Badge>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
