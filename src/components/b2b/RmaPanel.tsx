import { useState } from "react";
import {
  ArrowLeftRight, CheckCircle2, Clock, Package, Plus,
  RefreshCw, RotateCcw, ShieldAlert, Truck, X, XCircle,
  type LucideIcon,
} from "lucide-react";
import type { PortalOrder } from "@/hooks/useOrders";
import {
  useRma,
  type RmaReason,
  type RmaRequest,
  type RmaResolution,
  type RmaStatus,
} from "@/hooks/useRma";

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_MAP: Record<RmaStatus, { label: string; cls: string; icon: LucideIcon }> = {
  draft:      { label: "Borrador",   cls: "bg-muted text-muted-foreground border-border/70",        icon: Clock },
  submitted:  { label: "Enviada",    cls: "bg-blue-500/15 text-blue-400 border-blue-500/30",        icon: ArrowLeftRight },
  reviewing:  { label: "En revisión",cls: "bg-amber-500/15 text-amber-400 border-amber-500/30",     icon: RefreshCw },
  approved:   { label: "Aprobada",   cls: "bg-green-500/15 text-green-400 border-green-500/30",     icon: CheckCircle2 },
  rejected:   { label: "Rechazada",  cls: "bg-red-500/15 text-red-400 border-red-500/30",           icon: XCircle },
  resolved:   { label: "Resuelta",   cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: CheckCircle2 },
};

const REASON_LABELS: Record<RmaReason, string> = {
  defective:           "Producto defectuoso",
  wrong_item:          "Producto incorrecto",
  damaged_in_transit:  "Dañado en tránsito",
  not_as_described:    "No es lo descripto",
  other:               "Otro motivo",
};

const RESOLUTION_LABELS: Record<RmaResolution, string> = {
  refund:       "Reembolso",
  exchange:     "Cambio de producto",
  credit_note:  "Nota de crédito",
  repair:       "Reparación",
};

function RmaStatusBadge({ status }: { status: RmaStatus }) {
  const { label, cls, icon: Icon } = STATUS_MAP[status] ?? STATUS_MAP.submitted;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cls}`}>
      <Icon size={10} /> {label}
    </span>
  );
}

// ── New RMA form ─────────────────────────────────────────────────────────────

interface NewRmaFormProps {
  clientId: string;
  orders: PortalOrder[];
  onSubmit: (data: {
    order_id: string;
    reason: RmaReason;
    description: string;
    items: Array<{ product_id: number; name: string; sku: string; quantity: number; unit_price: number }>;
  }) => Promise<void>;
  onCancel: () => void;
}

function NewRmaForm({ orders, onSubmit, onCancel }: NewRmaFormProps) {
  const deliveredOrders = orders.filter((o) => ["delivered", "dispatched"].includes(o.status));
  const [orderId, setOrderId]       = useState<string>(deliveredOrders[0]?.id?.toString() ?? "");
  const [reason, setReason]         = useState<RmaReason>("defective");
  const [description, setDescription] = useState("");
  const [selectedItems, setSelectedItems] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);

  const selectedOrder = deliveredOrders.find((o) => String(o.id) === orderId);

  function toggleItem(productId: number, qty: number) {
    setSelectedItems((prev) => {
      if (prev[productId]) {
        const next = { ...prev };
        delete next[productId];
        return next;
      }
      return { ...prev, [productId]: qty };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orderId || Object.keys(selectedItems).length === 0) return;
    setSubmitting(true);
    const items = Object.entries(selectedItems).map(([pid, qty]) => {
      const orderItem = selectedOrder?.products.find((p) => p.product_id === Number(pid));
      return {
        product_id: Number(pid),
        name: orderItem?.name ?? "—",
        sku: orderItem?.sku ?? "",
        quantity: qty,
        unit_price: orderItem?.unit_price ?? 0,
      };
    });
    await onSubmit({ order_id: orderId, reason, description, items });
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="border border-border/70 bg-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">Nueva solicitud de devolución</h3>
        <button
          type="button"
          onClick={onCancel}
          className="p-1.5 rounded-lg transition text-muted-foreground hover:text-foreground hover:bg-secondary"
        >
          <X size={14} />
        </button>
      </div>

      {/* Order selector */}
      <div>
        <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block text-muted-foreground">
          Pedido
        </label>
        {deliveredOrders.length === 0 ? (
          <p className="text-xs text-muted-foreground">No tenés pedidos entregados todavía.</p>
        ) : (
          <select
            value={orderId}
            onChange={(e) => { setOrderId(e.target.value); setSelectedItems({}); }}
            className="w-full rounded-xl border border-border/70 bg-card px-3 py-2 text-sm text-foreground outline-none"
          >
            {deliveredOrders.map((o) => (
              <option key={o.id} value={String(o.id)}>
                {o.order_number ?? `#${String(o.id).slice(-6).toUpperCase()}`}
                {" — "}{new Date(o.created_at).toLocaleDateString("es-AR")}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Items */}
      {selectedOrder && (
        <div>
          <label className={`text-[11px] font-semibold uppercase tracking-wider mb-1.5 block text-muted-foreground`}>
            Productos a devolver
          </label>
          <div className="space-y-1.5">
            {selectedOrder.products.map((p) => {
              const isSelected = !!selectedItems[p.product_id];
              return (
                <button
                  key={p.product_id}
                  type="button"
                  onClick={() => toggleItem(p.product_id, p.quantity)}
                  className={
                    isSelected
                      ? "w-full flex items-center gap-3 px-3 py-2 rounded-xl border text-left transition border-primary/40 bg-primary/10"
                      : "w-full flex items-center gap-3 px-3 py-2 rounded-xl border text-left transition border-border/70 bg-card hover:border-border/80"
                  }
                >
                  <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 transition ${isSelected ? "bg-primary border-primary text-white" : "border-border/70"}`}>
                    {isSelected && <CheckCircle2 size={10} className="text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate text-foreground">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{p.sku} · x{p.quantity}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Reason */}
      <div>
        <label className={`text-[11px] font-semibold uppercase tracking-wider mb-1.5 block text-muted-foreground`}>
          Motivo
        </label>
        <div className="flex flex-wrap gap-2">
          {(Object.entries(REASON_LABELS) as [RmaReason, string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setReason(key)}
              className={
                reason === key
                  ? "px-3 py-1.5 text-xs rounded-lg border font-medium transition bg-primary/15 border-primary/40 text-primary"
                  : "px-3 py-1.5 text-xs rounded-lg border font-medium transition border-border/70 text-muted-foreground hover:text-foreground"
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div>
        <label className={`text-[11px] font-semibold uppercase tracking-wider mb-1.5 block text-muted-foreground`}>
          Descripción (opcional)
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Describí el problema con más detalle..."
          className={`w-full rounded-xl border px-3 py-2 text-sm outline-none resize-none bg-card border border-border/70 text-foreground placeholder:text-muted-foreground`}
        />
      </div>

      <button
        type="submit"
        disabled={submitting || Object.keys(selectedItems).length === 0 || !orderId}
        className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-bold py-2.5 rounded-xl text-sm transition"
      >
        {submitting ? "Enviando..." : "Enviar solicitud"}
      </button>
    </form>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface RmaPanelProps {
  clientId: string;
  orders: PortalOrder[];
}

export function RmaPanel({ clientId, orders }: RmaPanelProps) {
  const { rmas, loading, createRma, refetch } = useRma(clientId);
  const [showForm, setShowForm] = useState(false);

  async function handleSubmit(data: Omit<Parameters<typeof createRma>[0], "client_id">) {
    const result = await createRma({ ...data, client_id: clientId });
    if (result) setShowForm(false);
  }

  return (
    <div className="max-w-3xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className={`text-base font-bold text-foreground`}>Devoluciones y RMA</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Solicitá la devolución, cambio o reparación de productos.</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className={
            showForm
              ? "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border border-border/70 text-muted-foreground transition"
              : "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border border-primary bg-primary text-primary-foreground transition hover:bg-primary/90"
          }
        >
          {showForm ? <><X size={13} /> Cancelar</> : <><Plus size={13} /> Nueva solicitud</>}
        </button>
      </div>

      {/* New RMA form */}
      {showForm && (
        <NewRmaForm
          clientId={clientId}
          orders={orders}
          onSubmit={handleSubmit}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* RMA list */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={`h-20 rounded-xl animate-pulse bg-card border border-border/70`} />
          ))}
        </div>
      ) : rmas.length === 0 ? (
        <div className="border border-border/70 bg-card rounded-xl py-20 text-center">
          <RotateCcw size={32} className={`mx-auto mb-3 text-muted-foreground`} />
          <p className={`text-sm font-medium text-muted-foreground`}>No tenés solicitudes de devolución</p>
          <p className={`text-xs mt-1 text-muted-foreground`}>Si recibiste un producto con problemas, podés iniciar una solicitud arriba.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rmas.map((rma) => (
            <div key={rma.id} className="bg-card border border-border/70 rounded-xl px-5 py-4">
              <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-bold font-mono text-foreground`}>
                      {rma.rma_number}
                    </span>
                    <RmaStatusBadge status={rma.status} />
                  </div>
                  <p className={`text-[11px] mt-0.5 text-muted-foreground`}>
                    {REASON_LABELS[rma.reason]}
                    {" · "}
                    {new Date(rma.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                </div>
                {rma.resolution_type && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full border border-border/70 text-muted-foreground">
                    {RESOLUTION_LABELS[rma.resolution_type]}
                  </span>
                )}
              </div>

              {/* Items */}
              <div className="space-y-1 mb-3">
                {rma.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <Package size={11} className={`shrink-0 text-muted-foreground`} />
                    <span className="text-muted-foreground">{item.name}</span>
                    <span className="text-muted-foreground">×{item.quantity}</span>
                  </div>
                ))}
              </div>

              {rma.description && (
                <p className={`text-xs text-muted-foreground leading-relaxed`}>{rma.description}</p>
              )}

              {rma.resolution_notes && (
                <div className="mt-3 p-3 rounded-lg text-xs bg-card border border-border/70">
                  <p className={`text-[10px] uppercase font-bold mb-1 text-muted-foreground`}>Respuesta del equipo</p>
                  <p className="text-muted-foreground">{rma.resolution_notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}






