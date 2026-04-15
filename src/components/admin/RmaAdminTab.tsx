import { useState, useEffect, useCallback } from "react";
import { backend } from "@/lib/api/backend";
import { CheckCircle2, XCircle, Clock, RefreshCw, ChevronDown, ChevronUp, Package } from "lucide-react";
import type { RmaRequest, RmaStatus, RmaResolution } from "@/hooks/useRma";

interface RmaAdminTabProps {
  isDark?: boolean;
}

const STATUS_LABEL: Record<RmaStatus, string> = {
  draft:     "Borrador",
  submitted: "Enviado",
  reviewing: "En revisión",
  approved:  "Aprobado",
  rejected:  "Rechazado",
  resolved:  "Resuelto",
};

const STATUS_COLOR: Record<RmaStatus, string> = {
  draft:     "text-gray-400 bg-gray-500/10 border-gray-500/20",
  submitted: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  reviewing: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  approved:  "text-green-400 bg-green-500/10 border-green-500/20",
  rejected:  "text-red-400 bg-red-500/10 border-red-500/20",
  resolved:  "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
};

const REASON_LABEL: Record<string, string> = {
  defective:           "Defectuoso",
  wrong_item:          "Producto incorrecto",
  damaged_in_transit:  "Dañado en tránsito",
  not_as_described:    "No es lo descripto",
  other:               "Otro",
};

const RESOLUTION_OPTIONS: { value: RmaResolution; label: string }[] = [
  { value: "refund",      label: "Reembolso" },
  { value: "exchange",    label: "Cambio" },
  { value: "credit_note", label: "Nota de crédito" },
  { value: "repair",      label: "Reparación" },
];

interface RmaWithClient extends RmaRequest {
  client_name?: string;
  order_number?: string;
}

export function RmaAdminTab({ isDark = true }: RmaAdminTabProps) {
  const dk = (d: string, l: string) => (isDark ? d : l);

  const [rmas, setRmas] = useState<RmaWithClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<RmaStatus | "all">("all");
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Resolution form state per RMA
  const [resolutionForm, setResolutionForm] = useState<Record<number, { type: RmaResolution; notes: string }>>({});

  const fetchRmas = useCallback(async () => {
    setLoading(true);
    try {
      const { items } = await backend.rma.list();
      setRmas(
        items.map((r) => ({
          ...r,
          // Backend may include enrichment; fall back to IDs if not
          client_name:  (r.client_name ?? r.client_id) as string,
          order_number: (r.order_number ?? String(r.order_id)) as string,
        })) as unknown as RmaWithClient[],
      );
    } catch {
      // Silencioso — no bloquear si el backend no está disponible todavía
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRmas(); }, [fetchRmas]);

  async function updateStatus(rma: RmaWithClient, newStatus: RmaStatus) {
    setActionLoading(rma.id);
    const form = resolutionForm[rma.id];
    try {
      await backend.rma.update(String(rma.id), {
        status: newStatus,
        ...(form?.type  ? { resolution_type:  form.type  } : {}),
        ...(form?.notes ? { resolution_notes: form.notes } : {}),
      });
      const now = new Date().toISOString();
      setRmas((prev) =>
        prev.map((r) =>
          r.id === rma.id
            ? {
                ...r,
                status:     newStatus,
                updated_at: now,
                ...(form?.type  ? { resolution_type:  form.type  } : {}),
                ...(form?.notes ? { resolution_notes: form.notes } : {}),
                ...(newStatus === "resolved" ? { resolved_at: now } : {}),
              }
            : r,
        ),
      );
    } catch {
      // Error silencioso — el estado visual no se actualiza si falla
    }
    setActionLoading(null);
  }

  const filtered = statusFilter === "all" ? rmas : rmas.filter((r) => r.status === statusFilter);

  const counts: Record<string, number> = {};
  rmas.forEach((r) => { counts[r.status] = (counts[r.status] ?? 0) + 1; });

  return (
    <div className="max-w-5xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`font-bold text-base ${dk("text-white", "text-[#171717]")}`}>Gestión de RMAs</h2>
          <p className="text-xs text-[#737373] mt-0.5">Revisá y gestioná las solicitudes de devolución de tus clientes</p>
        </div>
        <button
          onClick={fetchRmas}
          disabled={loading}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border ${dk("border-[#2a2a2a] text-[#a3a3a3] hover:text-white hover:bg-[#1a1a1a]", "border-[#e5e5e5] text-[#525252] hover:bg-[#f5f5f5]")} transition-colors`}
        >
          <RefreshCw size={11} className={loading ? "animate-spin" : ""} /> Recargar
        </button>
      </div>

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2">
        {(["all", "submitted", "reviewing", "approved", "rejected", "resolved"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              statusFilter === s
                ? "bg-[#2D9F6A] text-white border-[#2D9F6A]"
                : dk("border-[#2a2a2a] text-[#737373] hover:border-[#444]", "border-[#e5e5e5] text-[#525252] hover:bg-[#f5f5f5]")
            }`}
          >
            {s === "all" ? `Todos (${rmas.length})` : `${STATUS_LABEL[s]} (${counts[s] ?? 0})`}
          </button>
        ))}
      </div>

      {/* RMA list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`h-16 rounded-xl ${dk("bg-[#111]", "bg-[#f5f5f5]")} animate-pulse`} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className={`text-center py-12 rounded-xl border ${dk("border-[#1f1f1f] text-[#525252]", "border-[#e5e5e5] text-[#a3a3a3]")}`}>
          <Package size={24} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">No hay RMAs {statusFilter !== "all" ? `en estado "${STATUS_LABEL[statusFilter]}"` : ""}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((rma) => {
            const isExpanded = expandedId === rma.id;
            const form = resolutionForm[rma.id] ?? { type: "exchange" as RmaResolution, notes: "" };

            return (
              <div
                key={rma.id}
                className={`rounded-xl border ${dk("border-[#1f1f1f] bg-[#0d0d0d]", "border-[#e5e5e5] bg-white")}`}
              >
                {/* Row header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : rma.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-mono text-xs font-bold ${dk("text-white", "text-[#171717]")}`}>{rma.rma_number}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${STATUS_COLOR[rma.status]}`}>
                        {STATUS_LABEL[rma.status]}
                      </span>
                    </div>
                    <p className="text-xs text-[#737373] mt-0.5 truncate">
                      {rma.client_name} · Pedido {rma.order_number} · {REASON_LABEL[rma.reason] ?? rma.reason}
                    </p>
                  </div>
                  <span className="text-xs text-[#525252] whitespace-nowrap">
                    {new Date(rma.created_at).toLocaleDateString("es-AR")}
                  </span>
                  {isExpanded ? <ChevronUp size={14} className="text-[#525252]" /> : <ChevronDown size={14} className="text-[#525252]" />}
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className={`px-4 pb-4 pt-0 border-t ${dk("border-[#1a1a1a]", "border-[#f0f0f0]")} space-y-4`}>
                    {/* Items */}
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#525252] mb-2">Productos</p>
                      <div className="space-y-1">
                        {(rma.items ?? []).map((item, i) => (
                          <div key={i} className={`flex justify-between text-xs px-3 py-2 rounded-lg ${dk("bg-[#111]", "bg-[#f9f9f9]")}`}>
                            <span className={dk("text-[#d4d4d4]", "text-[#404040]")}>{item.name} <span className="text-[#525252]">× {item.quantity}</span></span>
                            <span className="text-[#737373] font-mono">{item.sku}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Description */}
                    {rma.description && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#525252] mb-1">Descripción del cliente</p>
                        <p className={`text-xs ${dk("text-[#a3a3a3]", "text-[#525252]")}`}>{rma.description}</p>
                      </div>
                    )}

                    {/* Resolution form — only show if not resolved/rejected */}
                    {!["resolved", "rejected"].includes(rma.status) && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#525252]">Resolución</p>
                        <div className="flex gap-2">
                          <select
                            value={form.type}
                            onChange={(e) => setResolutionForm((prev) => ({ ...prev, [rma.id]: { ...form, type: e.target.value as RmaResolution } }))}
                            className={`flex-1 text-xs px-3 py-1.5 rounded-lg border ${dk("bg-[#111] border-[#2a2a2a] text-white", "bg-white border-[#e5e5e5] text-[#171717]")}`}
                          >
                            {RESOLUTION_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </div>
                        <textarea
                          rows={2}
                          placeholder="Notas internas (opcional)"
                          value={form.notes}
                          onChange={(e) => setResolutionForm((prev) => ({ ...prev, [rma.id]: { ...form, notes: e.target.value } }))}
                          className={`w-full text-xs px-3 py-2 rounded-lg border resize-none ${dk("bg-[#111] border-[#2a2a2a] text-white placeholder-[#525252]", "bg-white border-[#e5e5e5] text-[#171717] placeholder-[#a3a3a3]")}`}
                        />
                      </div>
                    )}

                    {/* Resolution info if already resolved */}
                    {rma.resolution_type && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#525252] mb-1">Resolución aplicada</p>
                        <p className={`text-xs ${dk("text-[#a3a3a3]", "text-[#525252]")}`}>
                          {RESOLUTION_OPTIONS.find((o) => o.value === rma.resolution_type)?.label ?? rma.resolution_type}
                          {rma.resolution_notes && ` — ${rma.resolution_notes}`}
                        </p>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-2 pt-1">
                      {rma.status === "submitted" && (
                        <button
                          onClick={() => updateStatus(rma, "reviewing")}
                          disabled={actionLoading === rma.id}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/30 hover:bg-blue-500/25 transition-colors"
                        >
                          <Clock size={11} /> Tomar revisión
                        </button>
                      )}
                      {["submitted", "reviewing"].includes(rma.status) && (
                        <>
                          <button
                            onClick={() => updateStatus(rma, "approved")}
                            disabled={actionLoading === rma.id}
                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-green-500/15 text-green-400 border border-green-500/30 hover:bg-green-500/25 transition-colors"
                          >
                            <CheckCircle2 size={11} /> Aprobar
                          </button>
                          <button
                            onClick={() => updateStatus(rma, "rejected")}
                            disabled={actionLoading === rma.id}
                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-colors"
                          >
                            <XCircle size={11} /> Rechazar
                          </button>
                        </>
                      )}
                      {rma.status === "approved" && (
                        <button
                          onClick={() => updateStatus(rma, "resolved")}
                          disabled={actionLoading === rma.id}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors"
                        >
                          <CheckCircle2 size={11} /> Marcar resuelto
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
