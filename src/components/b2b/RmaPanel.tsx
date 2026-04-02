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
  draft:      { label: "Borrador",   cls: "bg-[#1f1f1f] text-[#a3a3a3] border-[#2a2a2a]",         icon: Clock },
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
  isDark: boolean;
  dk: (d: string, l: string) => string;
  onSubmit: (data: {
    order_id: string;
    reason: RmaReason;
    description: string;
    items: Array<{ product_id: number; name: string; sku: string; quantity: number; unit_price: number }>;
  }) => Promise<void>;
  onCancel: () => void;
}

function NewRmaForm({ orders, isDark, dk, onSubmit, onCancel }: NewRmaFormProps) {
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
    <form onSubmit={handleSubmit} className={`border rounded-2xl p-5 space-y-4 ${dk("border-[#1f1f1f] bg-[#111]", "border-[#e5e5e5] bg-white")}`}>
      <div className="flex items-center justify-between">
        <h3 className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>Nueva solicitud de devolución</h3>
        <button type="button" onClick={onCancel} className="p-1.5 text-gray-500 hover:text-gray-300 rounded-lg hover:bg-white/5 transition">
          <X size={14} />
        </button>
      </div>

      {/* Order selector */}
      <div>
        <label className={`text-[11px] font-semibold uppercase tracking-wider mb-1.5 block ${dk("text-gray-400", "text-[#737373]")}`}>
          Pedido
        </label>
        {deliveredOrders.length === 0 ? (
          <p className="text-xs text-gray-500">No tenés pedidos entregados todavía.</p>
        ) : (
          <select
            value={orderId}
            onChange={(e) => { setOrderId(e.target.value); setSelectedItems({}); }}
            className={`w-full rounded-xl border px-3 py-2 text-sm outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-white border-[#e5e5e5] text-[#171717]")}`}
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
          <label className={`text-[11px] font-semibold uppercase tracking-wider mb-1.5 block ${dk("text-gray-400", "text-[#737373]")}`}>
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
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl border text-left transition ${
                    isSelected
                      ? dk("border-[#2D9F6A]/50 bg-[#2D9F6A]/10", "border-[#2D9F6A]/40 bg-[#2D9F6A]/5")
                      : dk("border-[#1f1f1f] bg-[#0d0d0d] hover:border-[#2a2a2a]", "border-[#e5e5e5] bg-[#f9f9f9] hover:border-[#d4d4d4]")
                  }`}
                >
                  <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 transition ${isSelected ? "bg-[#2D9F6A] border-[#2D9F6A]" : dk("border-[#3a3a3a]", "border-[#d4d4d4]")}`}>
                    {isSelected && <CheckCircle2 size={10} className="text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium truncate ${dk("text-white", "text-[#171717]")}`}>{p.name}</p>
                    <p className="text-[10px] text-gray-500 font-mono">{p.sku} · x{p.quantity}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Reason */}
      <div>
        <label className={`text-[11px] font-semibold uppercase tracking-wider mb-1.5 block ${dk("text-gray-400", "text-[#737373]")}`}>
          Motivo
        </label>
        <div className="flex flex-wrap gap-2">
          {(Object.entries(REASON_LABELS) as [RmaReason, string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setReason(key)}
              className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition ${
                reason === key
                  ? dk("bg-[#2D9F6A]/20 border-[#2D9F6A]/50 text-[#2D9F6A]", "bg-[#2D9F6A]/10 border-[#2D9F6A]/40 text-[#1a7a50]")
                  : dk("border-[#262626] text-[#737373] hover:text-white hover:border-[#333]", "border-[#e5e5e5] text-[#737373] hover:text-[#171717]")
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div>
        <label className={`text-[11px] font-semibold uppercase tracking-wider mb-1.5 block ${dk("text-gray-400", "text-[#737373]")}`}>
          Descripción (opcional)
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Describí el problema con más detalle..."
          className={`w-full rounded-xl border px-3 py-2 text-sm outline-none resize-none ${dk("bg-[#0d0d0d] border-[#262626] text-white placeholder:text-[#404040]", "bg-white border-[#e5e5e5] text-[#171717] placeholder:text-[#a3a3a3]")}`}
        />
      </div>

      <button
        type="submit"
        disabled={submitting || Object.keys(selectedItems).length === 0 || !orderId}
        className="w-full bg-[#2D9F6A] hover:bg-[#25835A] disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition"
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
  isDark: boolean;
}

export function RmaPanel({ clientId, orders, isDark }: RmaPanelProps) {
  const dk = (d: string, l: string) => (isDark ? d : l);
  const { rmas, loading, createRma, refetch } = useRma(clientId);
  const [showForm, setShowForm] = useState(false);

  async function handleSubmit(data: Parameters<typeof createRma>[0]) {
    const result = await createRma(data);
    if (result) setShowForm(false);
  }

  return (
    <div className="max-w-3xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className={`text-base font-bold ${dk("text-white", "text-[#171717]")}`}>Devoluciones y RMA</h2>
          <p className="text-xs text-gray-500 mt-0.5">Solicitá la devolución, cambio o reparación de productos.</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border transition ${
            showForm
              ? dk("border-[#333] text-[#a3a3a3]", "border-[#e5e5e5] text-[#737373]")
              : "bg-[#2D9F6A] border-[#2D9F6A] text-white hover:bg-[#25835A]"
          }`}
        >
          {showForm ? <><X size={13} /> Cancelar</> : <><Plus size={13} /> Nueva solicitud</>}
        </button>
      </div>

      {/* New RMA form */}
      {showForm && (
        <NewRmaForm
          clientId={clientId}
          orders={orders}
          isDark={isDark}
          dk={dk}
          onSubmit={handleSubmit}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* RMA list */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={`h-20 rounded-xl animate-pulse ${dk("bg-[#111]", "bg-white border border-[#f0f0f0]")}`} />
          ))}
        </div>
      ) : rmas.length === 0 ? (
        <div className={`border rounded-xl py-20 text-center ${dk("border-[#1f1f1f] bg-[#111]", "border-[#e5e5e5] bg-white")}`}>
          <RotateCcw size={32} className="mx-auto mb-3 text-gray-500/30" />
          <p className="text-sm font-medium text-gray-500">No tenés solicitudes de devolución</p>
          <p className="text-xs text-gray-600 mt-1">Si recibiste un producto con problemas, podés iniciar una solicitud arriba.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rmas.map((rma) => (
            <div key={rma.id} className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-xl px-5 py-4`}>
              <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-bold font-mono ${dk("text-white", "text-[#171717]")}`}>
                      {rma.rma_number}
                    </span>
                    <RmaStatusBadge status={rma.status} />
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {REASON_LABELS[rma.reason]}
                    {" · "}
                    {new Date(rma.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                </div>
                {rma.resolution_type && (
                  <span className={`text-[11px] px-2 py-0.5 rounded-full border ${dk("border-[#2a2a2a] text-[#a3a3a3]", "border-[#e5e5e5] text-[#737373]")}`}>
                    {RESOLUTION_LABELS[rma.resolution_type]}
                  </span>
                )}
              </div>

              {/* Items */}
              <div className="space-y-1 mb-3">
                {rma.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <Package size={11} className="text-gray-500 shrink-0" />
                    <span className={dk("text-gray-300", "text-[#525252]")}>{item.name}</span>
                    <span className="text-gray-600">×{item.quantity}</span>
                  </div>
                ))}
              </div>

              {rma.description && (
                <p className={`text-xs ${dk("text-gray-500", "text-[#737373]")} leading-relaxed`}>{rma.description}</p>
              )}

              {rma.resolution_notes && (
                <div className={`mt-3 p-3 rounded-lg text-xs ${dk("bg-[#0d0d0d] border-[#1a1a1a]", "bg-[#f9f9f9] border-[#e5e5e5]")} border`}>
                  <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Respuesta del equipo</p>
                  <p className={dk("text-gray-300", "text-[#525252]")}>{rma.resolution_notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
