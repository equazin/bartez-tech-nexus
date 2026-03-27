import { useState, useRef } from "react";
import {
  Clock, CheckCircle2, Package, Truck, CheckCheck,
  XCircle, AlertTriangle,
} from "lucide-react";

export type KanbanStatus =
  | "pending"
  | "approved"
  | "preparing"
  | "shipped"
  | "delivered"
  | "rejected"
  | "dispatched";

export interface KanbanOrder {
  id: string;
  order_number?: string;
  client_name?: string;
  total: number;
  cost_total?: number;
  margin_pct?: number;
  created_at: string;
  status: KanbanStatus;
  products: { name: string; quantity: number }[];
}

interface Column {
  key: KanbanStatus;
  label: string;
  icon: any;
  headerClass: string;
  cardAccent: string;
}

const COLUMNS: Column[] = [
  { key: "pending",    label: "En revisión",   icon: Clock,        headerClass: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30", cardAccent: "border-l-yellow-400" },
  { key: "approved",   label: "Aprobado",      icon: CheckCircle2, headerClass: "bg-green-500/20 text-green-300 border-green-500/30",   cardAccent: "border-l-green-400"  },
  { key: "preparing",  label: "Preparando",    icon: Package,      headerClass: "bg-orange-500/20 text-orange-300 border-orange-500/30",cardAccent: "border-l-orange-400" },
  { key: "shipped",    label: "Enviado",       icon: Truck,        headerClass: "bg-blue-500/20 text-blue-300 border-blue-500/30",      cardAccent: "border-l-blue-400"   },
  { key: "dispatched", label: "Despachado",    icon: CheckCheck,   headerClass: "bg-teal-500/20 text-teal-300 border-teal-500/30",     cardAccent: "border-l-teal-400"   },
  { key: "delivered",  label: "Entregado",     icon: CheckCheck,   headerClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30", cardAccent: "border-l-emerald-400" },
  { key: "rejected",   label: "Rechazado",     icon: XCircle,      headerClass: "bg-red-500/20 text-red-300 border-red-500/30",        cardAccent: "border-l-red-400"    },
];

interface Props {
  orders: KanbanOrder[];
  onStatusChange: (orderId: string, newStatus: KanbanStatus) => Promise<void>;
  formatPrice: (n: number) => string;
  isDark?: boolean;
}

export default function OrderKanban({ orders, onStatusChange, formatPrice, isDark = true }: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<KanbanStatus | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const dragStatus = useRef<KanbanStatus | null>(null);

  function byStatus(status: KanbanStatus) {
    return orders.filter((o) => o.status === status);
  }

  function handleDragStart(e: React.DragEvent, order: KanbanOrder) {
    setDraggingId(order.id);
    dragStatus.current = order.status;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("orderId", order.id);
  }

  function handleDragOver(e: React.DragEvent, col: KanbanStatus) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverCol(col);
  }

  function handleDragLeave() {
    setOverCol(null);
  }

  async function handleDrop(e: React.DragEvent, col: KanbanStatus) {
    e.preventDefault();
    const id = e.dataTransfer.getData("orderId");
    setOverCol(null);
    setDraggingId(null);

    if (!id || dragStatus.current === col) return;
    setUpdating(id);
    try {
      await onStatusChange(id, col);
    } finally {
      setUpdating(null);
    }
    dragStatus.current = null;
  }

  function handleDragEnd() {
    setDraggingId(null);
    setOverCol(null);
  }

  const bg = isDark ? "bg-gray-800 border-gray-700" : "bg-gray-100 border-gray-200";
  const cardBg = isDark ? "bg-gray-900 border-gray-700" : "bg-white border-gray-200";
  const textMuted = isDark ? "text-gray-400" : "text-gray-500";
  const textMain = isDark ? "text-white" : "text-gray-900";

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 min-h-[60vh]">
      {COLUMNS.map((col) => {
        const colOrders = byStatus(col.key);
        const isOver = overCol === col.key;
        const Icon = col.icon;

        return (
          <div
            key={col.key}
            className={`flex-shrink-0 w-60 rounded-xl border transition-all duration-150 ${bg} ${isOver ? "ring-2 ring-blue-500 ring-offset-1" : ""}`}
            onDragOver={(e) => handleDragOver(e, col.key)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, col.key)}
          >
            {/* Column header */}
            <div className={`flex items-center justify-between px-3 py-2 rounded-t-xl border-b ${col.headerClass}`}>
              <div className="flex items-center gap-1.5 font-semibold text-xs uppercase tracking-wide">
                <Icon size={13} />
                {col.label}
              </div>
              <span className="text-xs font-bold opacity-70 tabular-nums">
                {colOrders.length}
              </span>
            </div>

            {/* Cards */}
            <div className="p-2 space-y-2 min-h-[120px]">
              {colOrders.length === 0 && (
                <div className={`text-center text-xs py-6 ${textMuted} select-none`}>
                  Vacío
                </div>
              )}
              {colOrders.map((order) => {
                const isBeingDragged = draggingId === order.id;
                const isUpdating = updating === order.id;
                const date = new Date(order.created_at).toLocaleDateString("es-AR", {
                  day: "2-digit",
                  month: "2-digit",
                });

                return (
                  <div
                    key={order.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, order)}
                    onDragEnd={handleDragEnd}
                    className={`
                      rounded-lg border border-l-4 p-2.5 cursor-grab active:cursor-grabbing
                      transition-all duration-150 select-none
                      ${cardBg} ${col.cardAccent}
                      ${isBeingDragged ? "opacity-40 scale-95" : "hover:shadow-md"}
                      ${isUpdating ? "animate-pulse" : ""}
                    `}
                  >
                    {/* Order number + date */}
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-mono text-xs font-bold ${textMain}`}>
                        {order.order_number ?? `#${String(order.id).slice(-6).toUpperCase()}`}
                      </span>
                      <span className={`text-[10px] ${textMuted}`}>{date}</span>
                    </div>

                    {/* Client */}
                    {order.client_name && (
                      <div className={`text-xs font-medium truncate mb-1 ${textMain}`}>
                        {order.client_name}
                      </div>
                    )}

                    {/* Product summary */}
                    <div className={`text-[10px] ${textMuted} mb-2 line-clamp-2`}>
                      {order.products
                        .slice(0, 2)
                        .map((p) => `${p.quantity}× ${p.name}`)
                        .join(", ")}
                      {order.products.length > 2 && ` +${order.products.length - 2} más`}
                    </div>

                    {/* Total + margin */}
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-semibold text-blue-400`}>
                        {formatPrice(order.total)}
                      </span>
                      <div className="flex items-center gap-1">
                        {order.margin_pct !== undefined && !isUpdating && (
                          <span className="text-[10px] font-semibold text-emerald-400">
                            +{order.margin_pct.toFixed(0)}%
                          </span>
                        )}
                        {isUpdating && (
                          <span className={`text-[10px] ${textMuted} animate-pulse`}>
                            Guardando…
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
