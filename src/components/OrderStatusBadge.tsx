import type { OrderStatus } from "@/models/order";
import { CheckCircle2, Clock, Package, Truck, XCircle, type LucideIcon } from "lucide-react";

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; className: string; icon: LucideIcon }
> = {
  pending: {
    label: "En revision",
    icon: Clock,
    className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  },
  approved: {
    label: "Aprobado",
    icon: CheckCircle2,
    className: "bg-green-500/15 text-green-400 border-green-500/30",
  },
  preparing: {
    label: "Preparando",
    icon: Package,
    className: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  },
  shipped: {
    label: "Enviado",
    icon: Truck,
    className: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
  },
  delivered: {
    label: "Entregado",
    icon: CheckCircle2,
    className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  },
  rejected: {
    label: "Rechazado",
    icon: XCircle,
    className: "bg-red-500/15 text-red-400 border-red-500/30",
  },
  dispatched: {
    label: "Despachado",
    icon: Truck,
    className: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  },
};

export function OrderStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[(status as OrderStatus) ?? "pending"] ?? STATUS_CONFIG.pending;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${config.className}`}>
      <Icon size={11} />
      {config.label}
    </span>
  );
}
