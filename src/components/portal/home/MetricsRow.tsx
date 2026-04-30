import { ShoppingCart, FileText, Receipt, CreditCard } from "lucide-react";
import { MetricCard } from "@/components/ui/metric-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ClientKpis } from "@/hooks/useClientKpis";

interface Props {
  kpis: ClientKpis;
  loading: boolean;
  creditLimit?: number;
  onNavigate: (path: string) => void;
}

function formatDate(iso: string | null): string {
  if (!iso) return "Sin facturas";
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

export function MetricsRow({ kpis, loading, creditLimit, onNavigate }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-[22px]" />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <button type="button" onClick={() => onNavigate("/portal/pedidos")} className="text-left">
        <MetricCard
          label="Pedidos activos"
          value={String(kpis.orders_in_progress)}
          detail="en proceso"
          icon={<ShoppingCart className="h-4 w-4" />}
        />
      </button>

      <button type="button" onClick={() => onNavigate("/portal/cotizaciones")} className="text-left">
        <MetricCard
          label="Cotizaciones"
          value={String(kpis.quotes_pending)}
          detail="pendientes"
          icon={<FileText className="h-4 w-4" />}
        />
      </button>

      <button type="button" onClick={() => onNavigate("/portal/cuenta/documentos")} className="text-left">
        <MetricCard
          label="Última factura"
          value={formatDate(kpis.last_invoice_at)}
          icon={<Receipt className="h-4 w-4" />}
        />
      </button>

      <button type="button" onClick={() => onNavigate("/portal/cuenta/credito")} className="text-left">
        <MetricCard
          label="Crédito usado"
          value={`${kpis.credit_used_pct}%`}
          detail={creditLimit ? `Límite $${creditLimit.toLocaleString("es-AR")}` : undefined}
          trend={kpis.credit_used_pct > 80 ? "⚠ Alto" : undefined}
          icon={<CreditCard className="h-4 w-4" />}
        />
      </button>
    </div>
  );
}
