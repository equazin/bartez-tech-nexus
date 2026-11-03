import { Ban, CheckCircle2, Clock, CreditCard, Package, PackageCheck, RotateCcw, Truck, XCircle, type LucideIcon } from "lucide-react";

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
  | "cancelled"
  | "pendiente_pago"
  | "pagado"
  | "preparando"
  | "enviado"
  | "entregado"
  | "cancelado"
  | "reintegrado"
  | "vencido";

const STATUS_CONFIG: Record<UnifiedOrderStatus, { label: string; className: string; icon: LucideIcon }> = {
  // Tienda
  pendiente_pago: { label: "Pendiente de pago", icon: Clock, className: "border-border bg-secondary text-foreground" },
  pagado: { label: "Pagado", icon: CreditCard, className: "border-success/40 bg-success/15 text-success" },
  preparando: { label: "Preparando", icon: Package, className: "border-border bg-secondary text-foreground" },
  enviado: { label: "Enviado", icon: Truck, className: "border-border bg-secondary text-foreground" },
  entregado: { label: "Entregado", icon: CheckCircle2, className: "border-success/40 bg-success/15 text-success" },
  cancelado: { label: "Cancelado", icon: Ban, className: "border-border bg-muted text-muted-foreground" },
  reintegrado: { label: "Reintegrado", icon: RotateCcw, className: "border-danger/40 bg-danger/15 text-danger" },
  vencido: { label: "Vencido", icon: Clock, className: "border-border bg-muted text-muted-foreground" },
  // Mayorista heredado
  pending: { label: "En revisión", icon: Clock, className: "border-border bg-secondary text-foreground" },
  confirmed: { label: "Confirmado", icon: CheckCircle2, className: "border-border bg-secondary text-foreground" },
  approved: { label: "Aprobado", icon: CheckCircle2, className: "border-border bg-secondary text-foreground" },
  preparing: { label: "Preparando", icon: Package, className: "border-border bg-secondary text-foreground" },
  shipped: { label: "Enviado", icon: Truck, className: "border-border bg-secondary text-foreground" },
  dispatched: { label: "Despachado", icon: Truck, className: "border-border bg-secondary text-foreground" },
  picked: { label: "Pickeado", icon: PackageCheck, className: "border-border bg-secondary text-foreground" },
  delivered: { label: "Entregado", icon: CheckCircle2, className: "border-success/40 bg-success/15 text-success" },
  rejected: { label: "Rechazado", icon: XCircle, className: "border-danger/40 bg-danger/15 text-danger" },
  cancelled: { label: "Cancelado", icon: Ban, className: "border-border bg-muted text-muted-foreground" },
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
