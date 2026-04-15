import { Ban, CheckCircle2, Clock, Package, PackageCheck, Truck, XCircle, type LucideIcon } from "lucide-react";

type UnifiedOrderStatus =
  | "pending"
  | "confirmed"
  | "approved"
  | "preparing"
  | "shipped"
  | "dispatched"
  | "picked"
  | "delivered"
  | "rejected"
  | "cancelled";

const STATUS_CONFIG: Record<
  UnifiedOrderStatus,
  { label: string; className: string; icon: LucideIcon }
> = {
  pending: {
    label: "En revision",
    icon: Clock,
    className: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  },
  confirmed: {
    label: "Confirmado",
    icon: CheckCircle2,
    className: "border-primary/30 bg-primary/10 text-primary",
  },
  approved: {
    label: "Aprobado",
    icon: CheckCircle2,
    className: "border-primary/30 bg-primary/10 text-primary",
  },
  preparing: {
    label: "Preparando",
    icon: Package,
    className: "border-blue-500/30 bg-blue-500/10 text-blue-500",
  },
  shipped: {
    label: "Enviado",
    icon: Truck,
    className: "border-indigo-500/30 bg-indigo-500/10 text-indigo-500",
  },
  dispatched: {
    label: "Despachado",
    icon: Truck,
    className: "border-blue-500/30 bg-blue-500/10 text-blue-500",
  },
  picked: {
    label: "Pickeado",
    icon: PackageCheck,
    className: "border-violet-500/30 bg-violet-500/10 text-violet-500",
  },
  delivered: {
    label: "Entregado",
    icon: CheckCircle2,
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
  },
  rejected: {
    label: "Rechazado",
    icon: XCircle,
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  cancelled: {
    label: "Cancelado",
    icon: Ban,
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
};

const STATUS_ALIASES: Record<string, UnifiedOrderStatus> = {
  pending_approval: "pending",
};

export function OrderStatusBadge({ status }: { status: string }) {
  const normalizedStatus = (STATUS_ALIASES[status] ?? status) as UnifiedOrderStatus;
  const config = STATUS_CONFIG[normalizedStatus] ?? STATUS_CONFIG.pending;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${config.className}`}>
      <Icon size={11} />
      {config.label}
    </span>
  );
}
