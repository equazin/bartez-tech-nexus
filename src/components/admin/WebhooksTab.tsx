import { useState } from "react";
import {
  AlertCircle, CheckCircle2, ChevronDown, ChevronUp,
  Clock, Globe, Plus, RotateCcw, Trash2, Zap,
} from "lucide-react";
import {
  WEBHOOK_EVENTS,
  useWebhookDeliveries,
  useWebhooks,
  type WebhookEndpoint,
  type WebhookEvent,
} from "@/hooks/useWebhooks";

const EVENT_LABELS: Record<WebhookEvent, string> = {
  "order.created":        "Pedido creado",
  "order.status_changed": "Pedido — cambio de estado",
  "invoice.created":      "Factura creada",
  "quote.approved":       "Cotización aprobada",
  "rma.created":          "RMA iniciado",
};

const STATUS_CFG = {
  pending:   { label: "Pendiente",  cls: "bg-amber-500/15 text-amber-400 border-amber-500/30",   icon: Clock },
  delivered: { label: "Entregado",  cls: "bg-green-500/15 text-green-400 border-green-500/30",    icon: CheckCircle2 },
  failed:    { label: "Fallido",    cls: "bg-red-500/15 text-red-400 border-red-500/30",           icon: AlertCircle },
  skipped:   { label: "Omitido",    cls: "bg-[#1f1f1f] text-[#a3a3a3] border-[#2a2a2a]",          icon: RotateCcw },
};

interface WebhooksTabProps {
  isDark?: boolean;
}

export function WebhooksTab({ isDark = true }: WebhooksTabProps) {
  const dk = (d: string, l: string) => (isDark ? d : l);
  const { endpoints, loading, error, create, toggleActive, remove } = useWebhooks();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formSecret, setFormSecret] = useState("");
  const [formEvents, setFormEvents] = useState<Set<WebhookEvent>>(new Set(["order.created"]));
  const [saving, setSaving] = useState(false);

  function toggleFormEvent(event: WebhookEvent) {
    setFormEvents((prev) => {
      const next = new Set(prev);
      if (next.has(event)) { next.delete(event); } else { next.add(event); }
      return next;
    });
  }

  async function handleCreate() {
    if (!formName.trim() || !formUrl.trim() || formEvents.size === 0) return;
    setSaving(true);
    const result = await create({
      name:   formName.trim(),
      url:    formUrl.trim(),
      secret: formSecret.trim() || undefined,
      events: Array.from(formEvents),
    });
    if (result) {
      setFormName(""); setFormUrl(""); setFormSecret("");
      setFormEvents(new Set(["order.created"]));
      setShowForm(false);
    }
    setSaving(false);
  }

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className={`text-base font-bold ${dk("text-white", "text-[#171717]")}`}>
            Webhooks salientes
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Integraciones ERP / SAP — eventos enviados a sistemas externos.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-[#2D9F6A] border border-[#2D9F6A] text-white hover:bg-[#25835A] transition"
        >
          <Plus size={13} /> Nuevo endpoint
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className={`border rounded-2xl p-5 space-y-4 ${dk("border-[#1f1f1f] bg-[#111]", "border-[#e5e5e5] bg-white")}`}>
          <h3 className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>Registrar endpoint</h3>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={`text-[11px] font-semibold uppercase tracking-wider mb-1.5 block ${dk("text-gray-400", "text-[#737373]")}`}>Nombre</label>
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Mi ERP"
                className={`w-full rounded-xl border px-3 py-2 text-sm outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white placeholder:text-[#404040]", "bg-white border-[#e5e5e5] text-[#171717]")}`}
              />
            </div>
            <div>
              <label className={`text-[11px] font-semibold uppercase tracking-wider mb-1.5 block ${dk("text-gray-400", "text-[#737373]")}`}>URL</label>
              <input
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                placeholder="https://erp.empresa.com/webhooks/bartez"
                type="url"
                className={`w-full rounded-xl border px-3 py-2 text-sm outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white placeholder:text-[#404040]", "bg-white border-[#e5e5e5] text-[#171717]")}`}
              />
            </div>
          </div>

          <div>
            <label className={`text-[11px] font-semibold uppercase tracking-wider mb-1.5 block ${dk("text-gray-400", "text-[#737373]")}`}>
              Secreto HMAC (opcional)
            </label>
            <input
              value={formSecret}
              onChange={(e) => setFormSecret(e.target.value)}
              placeholder="Firma HMAC-SHA256 para validar origen"
              className={`w-full rounded-xl border px-3 py-2 text-sm outline-none font-mono ${dk("bg-[#0d0d0d] border-[#262626] text-white placeholder:text-[#404040] placeholder:font-sans", "bg-white border-[#e5e5e5] text-[#171717]")}`}
            />
          </div>

          <div>
            <label className={`text-[11px] font-semibold uppercase tracking-wider mb-2 block ${dk("text-gray-400", "text-[#737373]")}`}>Eventos a recibir</label>
            <div className="flex flex-wrap gap-2">
              {WEBHOOK_EVENTS.map((event) => (
                <button
                  key={event}
                  type="button"
                  onClick={() => toggleFormEvent(event)}
                  className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition ${
                    formEvents.has(event)
                      ? dk("bg-[#2D9F6A]/20 border-[#2D9F6A]/50 text-[#2D9F6A]", "bg-[#2D9F6A]/10 border-[#2D9F6A]/40 text-[#1a7a50]")
                      : dk("border-[#262626] text-[#737373] hover:text-white hover:border-[#333]", "border-[#e5e5e5] text-[#737373] hover:text-[#171717]")
                  }`}
                >
                  {EVENT_LABELS[event]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => void handleCreate()}
              disabled={saving || !formName.trim() || !formUrl.trim() || formEvents.size === 0}
              className="bg-[#2D9F6A] hover:bg-[#25835A] disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl text-sm transition"
            >
              {saving ? "Guardando..." : "Registrar"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition ${dk("border-[#333] text-[#a3a3a3] hover:text-white", "border-[#e5e5e5] text-[#737373] hover:text-[#171717]")}`}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Endpoint list */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className={`h-16 rounded-xl animate-pulse ${dk("bg-[#111]", "bg-white border border-[#f0f0f0]")}`} />
          ))}
        </div>
      ) : endpoints.length === 0 ? (
        <div className={`border rounded-xl py-16 text-center ${dk("border-[#1f1f1f] bg-[#111]", "border-[#e5e5e5] bg-white")}`}>
          <Globe size={28} className="mx-auto mb-3 text-gray-500/30" />
          <p className="text-sm font-medium text-gray-500">No hay endpoints registrados</p>
          <p className="text-xs text-gray-600 mt-1">Registrá el primer endpoint para recibir eventos en tu ERP.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {endpoints.map((ep) => (
            <EndpointCard
              key={ep.id}
              endpoint={ep}
              isDark={isDark}
              dk={dk}
              expanded={expandedId === ep.id}
              onToggle={() => setExpandedId(expandedId === ep.id ? null : ep.id)}
              onToggleActive={(active) => void toggleActive(ep.id, active)}
              onDelete={() => void remove(ep.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface EndpointCardProps {
  endpoint: WebhookEndpoint;
  isDark: boolean;
  dk: (d: string, l: string) => string;
  expanded: boolean;
  onToggle: () => void;
  onToggleActive: (active: boolean) => void;
  onDelete: () => void;
}

function EndpointCard({ endpoint, isDark: _isDark, dk, expanded, onToggle, onToggleActive, onDelete }: EndpointCardProps) {
  const { deliveries, loading: deliveriesLoading } = useWebhookDeliveries(expanded ? endpoint.id : undefined);

  return (
    <div className={`border rounded-xl overflow-hidden ${dk("border-[#1f1f1f]", "border-[#e5e5e5]")}`}>
      <div className={`px-5 py-3.5 flex items-center gap-3 ${dk("bg-[#111]", "bg-white")}`}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Zap size={14} className={endpoint.active ? "text-[#2D9F6A]" : "text-gray-600"} />
          <div className="min-w-0">
            <p className={`text-sm font-bold truncate ${dk("text-white", "text-[#171717]")}`}>{endpoint.name}</p>
            <p className="text-[11px] text-gray-500 truncate font-mono">{endpoint.url}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${endpoint.active ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-gray-500 bg-[#1f1f1f] border-[#2a2a2a]"}`}>
            {endpoint.active ? "Activo" : "Inactivo"}
          </span>
          <button
            onClick={() => onToggleActive(!endpoint.active)}
            title={endpoint.active ? "Desactivar" : "Activar"}
            className={`p-1.5 rounded-lg text-xs font-medium border transition ${dk("border-[#262626] text-gray-400 hover:text-white hover:bg-[#1a1a1a]", "border-[#e5e5e5] text-[#737373] hover:text-[#171717] hover:bg-[#f5f5f5]")}`}
          >
            {endpoint.active ? "Pausar" : "Reanudar"}
          </button>
          <button
            onClick={onDelete}
            title="Eliminar"
            className="p-1.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition"
          >
            <Trash2 size={12} />
          </button>
          <button
            onClick={onToggle}
            className={`p-1.5 rounded-lg border transition ${dk("border-[#262626] text-gray-400 hover:text-white", "border-[#e5e5e5] text-[#737373]")}`}
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className={`border-t px-5 py-4 ${dk("border-[#1a1a1a] bg-[#0d0d0d]", "border-[#f0f0f0] bg-[#fafafa]")}`}>
          {/* Subscribed events */}
          <div className="mb-3">
            <p className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${dk("text-gray-500", "text-[#a3a3a3]")}`}>Eventos suscritos</p>
            <div className="flex flex-wrap gap-1.5">
              {endpoint.events.map((ev) => (
                <span key={ev} className={`text-[11px] px-2 py-0.5 rounded-full border ${dk("border-[#2D9F6A]/30 text-[#2D9F6A] bg-[#2D9F6A]/10", "border-[#2D9F6A]/30 text-[#1a7a50] bg-[#2D9F6A]/5")}`}>
                  {EVENT_LABELS[ev as WebhookEvent] ?? ev}
                </span>
              ))}
            </div>
          </div>

          {/* Recent deliveries */}
          <div>
            <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${dk("text-gray-500", "text-[#a3a3a3]")}`}>
              Últimas entregas
            </p>
            {deliveriesLoading ? (
              <p className="text-xs text-gray-500">Cargando...</p>
            ) : deliveries.length === 0 ? (
              <p className="text-xs text-gray-500">No hay entregas registradas todavía.</p>
            ) : (
              <div className="space-y-1.5">
                {deliveries.slice(0, 10).map((d) => {
                  const cfg = STATUS_CFG[d.status];
                  const Icon = cfg.icon;
                  return (
                    <div key={d.id} className={`flex items-center gap-3 text-xs rounded-lg border px-3 py-2 ${dk("border-[#1f1f1f] bg-[#111]", "border-[#e5e5e5] bg-white")}`}>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${cfg.cls}`}>
                        <Icon size={9} /> {cfg.label}
                      </span>
                      <span className={`font-mono text-[11px] ${dk("text-gray-400", "text-[#525252]")}`}>{d.event_type}</span>
                      <span className="text-gray-600 ml-auto text-[10px]">
                        {new Date(d.created_at).toLocaleString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {d.attempt_count > 0 && (
                        <span className="text-[10px] text-gray-600">{d.attempt_count} int.</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
