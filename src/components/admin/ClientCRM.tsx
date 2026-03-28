import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Quote, QuoteStatus } from "@/models/quote";
import { useCurrency } from "@/context/CurrencyContext";
import { CLIENT_TYPE_MARGINS, ClientType, supabase } from "@/lib/supabase";
import {
  Users, Search, UserPlus, ChevronRight, Mail,
  Percent, ShoppingBag, FileText, CheckCircle2, XCircle, Clock,
  TrendingUp, Package, Save, X, Send, Eye, AlertTriangle,
  ArrowLeft, Pencil, Activity, LogIn, LogOut, MousePointer,
  ShoppingCart, Hash, ExternalLink,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface ClientProfile {
  id: string;
  company_name: string;
  contact_name: string;
  client_type: ClientType;
  default_margin: number;
  role: string;
  phone?: string;
}

interface SupabaseOrder {
  id: string;
  client_id: string;
  products: Array<{ name: string; quantity: number; total_price?: number }>;
  total: number;
  status: string;
  created_at: string;
}

export interface ClientCRMProps {
  clients: ClientProfile[];
  orders: SupabaseOrder[];
  loading: boolean;
  isDark: boolean;
  onSave: (id: string, changes: { client_type?: ClientType; default_margin?: number }) => Promise<void>;
  onNewClient: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  mayorista: "Mayorista",
  reseller:  "Revendedor",
  empresa:   "Empresa",
};

const CLIENT_TYPE_STYLES: Record<ClientType, string> = {
  mayorista: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  reseller:  "bg-orange-500/15 text-orange-400 border-orange-500/30",
  empresa:   "bg-purple-500/15 text-purple-400 border-purple-500/30",
};

const ORDER_STATUS: Record<string, { label: string; icon: any; cls: string }> = {
  pending:  { label: "En revisión", icon: Clock,        cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  approved: { label: "Aprobado",    icon: CheckCircle2, cls: "bg-green-500/15 text-green-400 border-green-500/30" },
  rejected: { label: "Rechazado",   icon: XCircle,      cls: "bg-red-500/15 text-red-400 border-red-500/30" },
};

const QUOTE_STATUS: Record<QuoteStatus, { label: string; icon: any; cls: string }> = {
  draft:    { label: "Borrador",  icon: FileText,      cls: "bg-[#1f1f1f] text-[#a3a3a3] border-[#2a2a2a]" },
  sent:     { label: "Enviada",   icon: Send,          cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  viewed:   { label: "Vista",     icon: Eye,           cls: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
  approved: { label: "Aprobada",  icon: CheckCircle2,  cls: "bg-green-500/15 text-green-400 border-green-500/30" },
  rejected: { label: "Rechazada", icon: XCircle,       cls: "bg-red-500/15 text-red-400 border-red-500/30" },
  expired:  { label: "Expirada",  icon: AlertTriangle, cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
};

// ── Activity log types ────────────────────────────────────────────────────────
interface ActivityLog {
  id: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

const ACTION_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  login:         { label: "Inicio de sesión",  icon: LogIn,          color: "text-blue-400"    },
  logout:        { label: "Cierre de sesión",  icon: LogOut,         color: "text-gray-400"    },
  view_product:  { label: "Vio producto",      icon: MousePointer,   color: "text-purple-400"  },
  add_to_cart:   { label: "Agregó al carrito", icon: ShoppingCart,   color: "text-yellow-400"  },
  place_order:   { label: "Realizó pedido",    icon: Package,        color: "text-emerald-400" },
  search:        { label: "Búsqueda",          icon: Hash,           color: "text-gray-400"    },
};

function initials(c: ClientProfile) {
  const word = c.company_name || c.contact_name || "?";
  return word.slice(0, 2).toUpperCase();
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status, map }: { status: string; map: Record<string, { label: string; icon: any; cls: string }> }) {
  const cfg = map[status] ?? map.pending ?? Object.values(map)[0];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.cls}`}>
      <Icon size={9} /> {cfg.label}
    </span>
  );
}

// ── Client avatar ─────────────────────────────────────────────────────────────
function Avatar({ client, size = "md" }: { client: ClientProfile; size?: "sm" | "md" | "lg" }) {
  const dims = { sm: "h-7 w-7 text-[10px]", md: "h-9 w-9 text-xs", lg: "h-12 w-12 text-sm" }[size];
  return (
    <div className={`${dims} rounded-xl bg-[#2D9F6A]/15 border border-[#2D9F6A]/20 flex items-center justify-center font-bold text-[#2D9F6A] shrink-0`}>
      {initials(client)}
    </div>
  );
}

// ── List item ─────────────────────────────────────────────────────────────────
function ClientListItem({
  client, isActive, orderCount, quoteCount, onClick, isDark,
}: {
  client: ClientProfile; isActive: boolean; orderCount: number; quoteCount: number; onClick: () => void; isDark: boolean;
}) {
  const dk = (d: string, l: string) => isDark ? d : l;
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition group ${
        isActive
          ? "bg-[#2D9F6A]/10 border border-[#2D9F6A]/20"
          : `border border-transparent ${dk("hover:bg-[#141414] hover:border-[#1f1f1f]", "hover:bg-[#f5f5f5] hover:border-[#e5e5e5]")}`
      }`}
    >
      <Avatar client={client} size="sm" />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold truncate leading-tight ${
          isActive ? dk("text-white", "text-[#171717]") : dk("text-[#d4d4d4] group-hover:text-white", "text-[#404040] group-hover:text-[#171717]")
        }`}>
          {client.company_name || client.contact_name || "—"}
        </p>
        <p className="text-[10px] text-[#525252] truncate mt-0.5">
          {CLIENT_TYPE_LABELS[client.client_type]} · {client.default_margin}% margen
        </p>
      </div>
      <div className="flex flex-col items-end gap-0.5 shrink-0">
        <span className={`text-[9px] font-medium ${isActive ? "text-[#2D9F6A]" : "text-[#525252]"}`}>
          {orderCount}p · {quoteCount}c
        </span>
        <ChevronRight size={11} className={`${isActive ? "text-[#2D9F6A]" : dk("text-[#333] group-hover:text-[#525252]", "text-[#ccc] group-hover:text-[#999]")} transition`} />
      </div>
    </button>
  );
}

// ── Stat mini-card ─────────────────────────────────────────────────────────────
function StatPill({ icon: Icon, label, value, accent, isDark }: { icon: any; label: string; value: string; accent: string; isDark: boolean }) {
  const dk = (d: string, l: string) => isDark ? d : l;
  return (
    <div className={`${dk("bg-[#0d0d0d] border-[#1a1a1a]", "bg-[#f5f5f5] border-[#e5e5e5]")} border rounded-xl px-4 py-3 flex items-center gap-3`}>
      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${accent}`}>
        <Icon size={15} />
      </div>
      <div>
        <p className={`text-base font-extrabold tabular-nums leading-tight ${dk("text-white", "text-[#171717]")}`}>{value}</p>
        <p className="text-[10px] text-[#525252]">{label}</p>
      </div>
    </div>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────
function ClientDetail({
  client, orders, isDark, onSave, onBack,
}: {
  client: ClientProfile;
  orders: SupabaseOrder[];
  isDark: boolean;
  onSave: (id: string, changes: { client_type?: ClientType; default_margin?: number }) => Promise<void>;
  onBack: () => void;
}) {
  const dk = (d: string, l: string) => isDark ? d : l;
  const { formatPrice } = useCurrency();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [editType, setEditType] = useState<ClientType>(client.client_type);
  const [editMargin, setEditMargin] = useState(String(client.default_margin));
  const [saving, setSaving] = useState(false);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  useEffect(() => {
    supabase
      .from("quotes")
      .select("*")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setQuotes(data as Quote[]);
      });

    supabase
      .from("activity_logs")
      .select("id, action, entity_type, entity_id, metadata, created_at")
      .eq("user_id", client.id)
      .order("created_at", { ascending: false })
      .limit(25)
      .then(({ data }) => {
        if (data) setActivityLogs(data as ActivityLog[]);
      });
  }, [client.id]);

  const clientOrders = useMemo(
    () => orders.filter((o) => o.client_id === client.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [orders, client.id]
  );

  const totalSpent = useMemo(
    () => clientOrders.filter((o) => o.status === "approved").reduce((s, o) => s + o.total, 0),
    [clientOrders]
  );
  const approvedQuotes = quotes.filter((q) => q.status === "approved").length;

  async function handleSave() {
    setSaving(true);
    await onSave(client.id, {
      client_type: editType,
      default_margin: Number(editMargin) || 0,
    });
    setSaving(false);
    setEditing(false);
  }

  async function updateQuoteStatus(quoteId: number, status: QuoteStatus) {
    const { error } = await supabase
      .from("quotes")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", quoteId);
    if (!error) {
      setQuotes((prev) => prev.map((q) => q.id === quoteId ? { ...q, status } : q));
    }
  }

  function handleTypeChange(t: ClientType) {
    setEditType(t);
    setEditMargin(String(CLIENT_TYPE_MARGINS[t]));
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-2xl p-5`}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className={`md:hidden transition p-1 ${dk("text-[#737373] hover:text-white", "text-[#737373] hover:text-[#171717]")}`}>
              <ArrowLeft size={16} />
            </button>
            <Avatar client={client} size="lg" />
            <div>
              <h2 className={`text-base font-bold leading-tight ${dk("text-white", "text-[#171717]")}`}>
                {client.company_name || "Sin empresa"}
              </h2>
              <p className="text-xs text-[#737373] mt-0.5">{client.contact_name || "—"}</p>
              {client.phone && (
                <p className="text-xs text-[#525252] mt-0.5 font-mono">{client.phone}</p>
              )}
              <div className="flex items-center gap-2 mt-1.5">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${CLIENT_TYPE_STYLES[client.client_type]}`}>
                  {CLIENT_TYPE_LABELS[client.client_type]}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                  client.role === "admin"
                    ? "bg-[#2D9F6A]/15 text-[#2D9F6A] border-[#2D9F6A]/30"
                    : dk("bg-[#1f1f1f] text-[#525252] border-[#2a2a2a]", "bg-[#f0f0f0] text-[#737373] border-[#e0e0e0]")
                }`}>
                  {client.role === "admin" ? "Admin" : "Cliente"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(`/clientes/${client.id}`)}
              title="Ver Customer 360"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-[#2D9F6A]/40 text-[#2D9F6A] hover:bg-[#2D9F6A]/10 transition"
            >
              <ExternalLink size={11} /> Ver 360°
            </button>
            {!editing && (
              <button
                onClick={() => { setEditing(true); setEditType(client.client_type); setEditMargin(String(client.default_margin)); }}
                className={`flex items-center gap-1.5 text-xs transition px-3 py-1.5 rounded-lg ${
                  dk("text-[#737373] hover:text-white border border-[#1f1f1f] hover:border-[#2a2a2a]",
                     "text-[#737373] hover:text-[#171717] border border-[#e5e5e5] hover:border-[#d4d4d4]")
                }`}
              >
                <Pencil size={11} /> Editar
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-xs text-[#737373]">
          <span className="flex items-center gap-1.5">
            <Mail size={11} className="text-[#525252]" />
            ID: {client.id.slice(0, 12)}…
          </span>
          <span className="flex items-center gap-1.5">
            <Percent size={11} className="text-[#525252]" />
            Margen: <strong className="text-[#2D9F6A]">{client.default_margin}%</strong>
          </span>
        </div>

        {editing && (
          <div className={`mt-4 pt-4 border-t ${dk("border-[#1a1a1a]", "border-[#e8e8e8]")}`}>
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="text-[10px] text-gray-500 mb-1 block font-semibold uppercase tracking-widest">Tipo de cliente</label>
                <div className="flex gap-1.5">
                  {(Object.keys(CLIENT_TYPE_LABELS) as ClientType[]).map((t) => (
                    <button
                      key={t} type="button"
                      onClick={() => handleTypeChange(t)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                        editType === t
                          ? "bg-[#2D9F6A] border-[#2D9F6A] text-white"
                          : dk("bg-[#141414] border-[#262626] text-[#737373] hover:border-[#404040]",
                               "bg-[#f0f0f0] border-[#d4d4d4] text-[#737373] hover:border-[#999]")
                      }`}
                    >
                      {CLIENT_TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] text-gray-500 mb-1 block font-semibold uppercase tracking-widest">Margen %</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number" min="0" max="100"
                    value={editMargin}
                    onChange={(e) => setEditMargin(e.target.value)}
                    className={`w-20 border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#2D9F6A] text-center font-mono transition ${
                      dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-white border-[#d4d4d4] text-[#171717]")
                    }`}
                  />
                  <span className="text-sm text-[#737373]">%</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSave} disabled={saving}
                  className="flex items-center gap-1.5 bg-[#2D9F6A] hover:bg-[#25835A] text-white text-xs font-bold px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                >
                  <Save size={12} /> {saving ? "Guardando…" : "Guardar"}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className={`text-xs transition px-3 py-1.5 rounded-lg ${dk("text-[#737373] hover:text-white hover:bg-[#1a1a1a]", "text-[#737373] hover:text-[#171717] hover:bg-[#f0f0f0]")}`}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatPill icon={ShoppingBag}  label="Pedidos"         value={String(clientOrders.length)}  accent="bg-[#2D9F6A]/15 text-[#2D9F6A]"  isDark={isDark} />
        <StatPill icon={TrendingUp}   label="Total facturado" value={formatPrice(totalSpent)}       accent="bg-green-500/15 text-green-400"   isDark={isDark} />
        <StatPill icon={FileText}     label="Cotizaciones"    value={String(quotes.length)}         accent="bg-blue-500/15 text-blue-400"     isDark={isDark} />
        <StatPill icon={CheckCircle2} label="Cot. aprobadas"  value={String(approvedQuotes)}        accent="bg-purple-500/15 text-purple-400" isDark={isDark} />
      </div>

      {/* Orders history */}
      <div className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-2xl overflow-hidden`}>
        <div className={`flex items-center gap-2 px-5 py-3.5 border-b ${dk("border-[#1a1a1a]", "border-[#e8e8e8]")}`}>
          <ShoppingBag size={13} className="text-[#2D9F6A]" />
          <h3 className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>Historial de pedidos</h3>
          <span className="ml-auto text-xs text-[#525252]">{clientOrders.length} en total</span>
        </div>

        {clientOrders.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-[#525252] gap-2">
            <Package size={24} className="opacity-20" />
            <p className="text-xs">Sin pedidos registrados</p>
          </div>
        ) : (
          <div className={`divide-y ${dk("divide-[#141414]", "divide-[#f0f0f0]")}`}>
            {clientOrders.map((o) => (
              <div key={o.id} className={`flex items-center justify-between px-5 py-3 ${dk("hover:bg-[#141414]", "hover:bg-[#fafafa]")} transition`}>
                <div className="min-w-0">
                  <p className={`text-xs font-semibold ${dk("text-white", "text-[#171717]")}`}>
                    #{String(o.id).slice(-6).toUpperCase()}
                  </p>
                  <p className="text-[10px] text-[#525252] mt-0.5">
                    {fmtDate(o.created_at)} · {o.products?.length ?? 0} producto{(o.products?.length ?? 0) !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <StatusBadge status={o.status} map={ORDER_STATUS} />
                  <span className="text-sm font-bold text-[#2D9F6A] tabular-nums">{formatPrice(o.total)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quotes history */}
      <div className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-2xl overflow-hidden`}>
        <div className={`flex items-center gap-2 px-5 py-3.5 border-b ${dk("border-[#1a1a1a]", "border-[#e8e8e8]")}`}>
          <FileText size={13} className="text-blue-400" />
          <h3 className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>Cotizaciones</h3>
          <span className="ml-auto text-xs text-[#525252]">{quotes.length} en total</span>
        </div>

        {quotes.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-[#525252] gap-2">
            <FileText size={24} className="opacity-20" />
            <p className="text-xs">Sin cotizaciones guardadas</p>
          </div>
        ) : (
          <div className={`divide-y ${dk("divide-[#141414]", "divide-[#f0f0f0]")}`}>
            {quotes.map((q) => (
              <div key={q.id} className={`flex items-center justify-between px-5 py-3 ${dk("hover:bg-[#141414]", "hover:bg-[#fafafa]")} transition`}>
                <div className="min-w-0">
                  <p className={`text-xs font-semibold ${dk("text-white", "text-[#171717]")}`}>
                    COT-{String(q.id).padStart(4, "0")}
                  </p>
                  <p className="text-[10px] text-[#525252] mt-0.5">
                    {fmtDate(q.created_at)} · {(q.items?.length ?? 0)} producto{(q.items?.length ?? 0) !== 1 ? "s" : ""} · {q.currency}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <StatusBadge status={q.status} map={QUOTE_STATUS as any} />
                  <span className="text-sm font-bold text-[#2D9F6A] tabular-nums">{formatPrice(q.total)}</span>
                  {q.status === "draft" && (
                    <button
                      onClick={() => updateQuoteStatus(q.id, "sent")}
                      title="Marcar como enviada"
                      className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition"
                    >
                      <Send size={10} /> Enviar
                    </button>
                  )}
                  {(q.status === "sent" || q.status === "viewed") && (
                    <>
                      <button
                        onClick={() => updateQuoteStatus(q.id, "approved")}
                        title="Aprobar cotización"
                        className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border border-green-500/30 text-green-400 hover:bg-green-500/10 transition"
                      >
                        <CheckCircle2 size={10} /> Aprobar
                      </button>
                      <button
                        onClick={() => updateQuoteStatus(q.id, "rejected")}
                        title="Rechazar cotización"
                        className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border border-red-500/30 text-red-400 hover:bg-red-500/10 transition"
                      >
                        <XCircle size={10} /> Rechazar
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Activity log */}
      <div className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-2xl overflow-hidden`}>
        <div className={`flex items-center gap-2 px-5 py-3.5 border-b ${dk("border-[#1a1a1a]", "border-[#e8e8e8]")}`}>
          <Activity size={13} className="text-amber-400" />
          <h3 className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>Actividad reciente</h3>
          <span className="ml-auto text-xs text-[#525252]">{activityLogs.length} eventos</span>
        </div>

        {activityLogs.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-[#525252] gap-2">
            <Activity size={24} className="opacity-20" />
            <p className="text-xs">Sin actividad registrada</p>
          </div>
        ) : (
          <div className="px-5 py-4 space-y-3">
            {activityLogs.map((log) => {
              const cfg = ACTION_CONFIG[log.action] ?? { label: log.action, icon: Activity, color: "text-gray-400" };
              const Icon = cfg.icon;
              return (
                <div key={log.id} className="flex items-start gap-3">
                  <div className={`mt-0.5 shrink-0 h-6 w-6 rounded-lg flex items-center justify-center ${dk("bg-[#1a1a1a]", "bg-[#f5f5f5]")}`}>
                    <Icon size={12} className={cfg.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium ${dk("text-[#d4d4d4]", "text-[#404040]")}`}>{cfg.label}
                      {log.metadata?.name && (
                        <span className={`ml-1 font-normal ${dk("text-[#737373]", "text-[#737373]")}`}>
                          — {String(log.metadata.name)}
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-[#525252] mt-0.5">{fmtDate(log.created_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function ClientCRM({ clients, orders, loading, isDark, onSave, onNewClient }: ClientCRMProps) {
  const dk = (d: string, l: string) => isDark ? d : l;
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return clients.filter((c) =>
      !q ||
      c.company_name?.toLowerCase().includes(q) ||
      c.contact_name?.toLowerCase().includes(q) ||
      c.client_type?.toLowerCase().includes(q)
    );
  }, [clients, search]);

  const selected = clients.find((c) => c.id === selectedId) ?? null;

  const orderCountMap = useMemo(() => {
    const m: Record<string, number> = {};
    orders.forEach((o) => { m[o.client_id] = (m[o.client_id] || 0) + 1; });
    return m;
  }, [orders]);

  // Quote counts loaded per-client in ClientDetail; sidebar shows 0 as placeholder
  const quoteCountMap = useMemo(() => ({} as Record<string, number>), []);

  if (loading) {
    return (
      <div className="space-y-2 max-w-5xl">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={`h-16 ${dk("bg-[#111] border-[#1a1a1a]", "bg-[#f0f0f0] border-[#e5e5e5]")} rounded-xl animate-pulse border`} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-4 max-w-6xl h-[calc(100vh-130px)]">

      {/* ── LEFT: Client list ── */}
      <div className={`flex flex-col gap-3 ${selected ? "hidden md:flex w-72 shrink-0" : "flex w-full md:w-72 md:shrink-0"}`}>

        <div className="flex items-center justify-between">
          <p className="text-xs text-[#525252] font-semibold">
            {filtered.length} cliente{filtered.length !== 1 ? "s" : ""}
          </p>
          <button
            onClick={onNewClient}
            className="flex items-center gap-1.5 bg-[#2D9F6A] hover:bg-[#25835A] text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
          >
            <UserPlus size={12} /> Nuevo
          </button>
        </div>

        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#525252] pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente…"
            className={`w-full border rounded-xl pl-8 pr-3 py-2 text-sm placeholder:text-[#525252] outline-none focus:border-[#2D9F6A]/40 transition ${
              dk("bg-[#111] border-[#1f1f1f] text-white", "bg-white border-[#e5e5e5] text-[#171717]")
            }`}
          />
          {search && (
            <button onClick={() => setSearch("")} className={`absolute right-2.5 top-1/2 -translate-y-1/2 transition ${dk("text-[#525252] hover:text-white", "text-[#999] hover:text-[#171717]")}`}>
              <X size={11} />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 pr-0.5">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-[#525252] gap-2">
              <Users size={28} className="opacity-20" />
              <p className="text-xs">{search ? "Sin resultados" : "Sin clientes"}</p>
            </div>
          ) : (
            filtered.map((c) => (
              <ClientListItem
                key={c.id}
                client={c}
                isDark={isDark}
                isActive={c.id === selectedId}
                orderCount={orderCountMap[c.id] || 0}
                quoteCount={quoteCountMap[c.id] || 0}
                onClick={() => setSelectedId(c.id === selectedId ? null : c.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── RIGHT: Detail panel ── */}
      <div className={`flex-1 overflow-y-auto ${selected ? "flex flex-col" : "hidden md:flex md:flex-col"}`}>
        {selected ? (
          <ClientDetail
            client={selected}
            orders={orders}
            isDark={isDark}
            onSave={onSave}
            onBack={() => setSelectedId(null)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-[#525252] gap-3">
            <div className={`h-14 w-14 rounded-2xl border flex items-center justify-center ${dk("bg-[#111] border-[#1f1f1f]", "bg-[#f5f5f5] border-[#e5e5e5]")}`}>
              <Users size={22} className="opacity-30" />
            </div>
            <p className={`text-sm font-medium ${dk("text-[#737373]", "text-[#525252]")}`}>Seleccioná un cliente</p>
            <p className="text-xs text-[#525252]">Ver historial de pedidos y cotizaciones</p>
          </div>
        )}
      </div>

    </div>
  );
}
