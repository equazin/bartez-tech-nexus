import { useState, useMemo, useEffect } from "react";
import { Quote, QuoteStatus } from "@/models/quote";
import { useCurrency } from "@/context/CurrencyContext";
import { CLIENT_TYPE_MARGINS, ClientType, supabase } from "@/lib/supabase";
import {
  fetchClientProfile, fetchClientInvoices, fetchAccountMovements, updateClientProfile,
  type ClientDetail as ClientDetailData, type AccountMovement,
} from "@/lib/api/clientDetail";
import type { Invoice } from "@/lib/api/invoices";
import {
  Users, Search, UserPlus, ChevronRight, Mail,
  Percent, ShoppingBag, FileText, CheckCircle2, XCircle, Clock,
  TrendingUp, Package, Save, X, Send, Eye, AlertTriangle,
  ArrowLeft, Pencil, Activity, LogIn, LogOut, MousePointer,
  ShoppingCart, Hash, CreditCard, BarChart2, Landmark, Settings,
  LayoutGrid, Shield, CalendarDays,
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

type DetailTab = "resumen" | "credito" | "movimientos" | "facturas" | "datos";

const DETAIL_TABS: { id: DetailTab; label: string; icon: any }[] = [
  { id: "resumen",     label: "Resumen",     icon: LayoutGrid  },
  { id: "credito",     label: "Crédito",     icon: CreditCard  },
  { id: "movimientos", label: "Cuenta",      icon: BarChart2   },
  { id: "facturas",    label: "Facturas",    icon: Landmark    },
  { id: "datos",       label: "Datos",       icon: Settings    },
];

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
  const [activeTab, setActiveTab] = useState<DetailTab>("resumen");
  const [editing, setEditing] = useState(false);
  const [editType, setEditType] = useState<ClientType>(client.client_type);
  const [editMargin, setEditMargin] = useState(String(client.default_margin));
  const [saving, setSaving] = useState(false);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  // lazy-loaded for extra tabs
  const [extProfile, setExtProfile] = useState<ClientDetailData | null>(null);
  const [movements,  setMovements]  = useState<AccountMovement[]>([]);
  const [invoices,   setInvoices]   = useState<Invoice[]>([]);
  const [tabLoading, setTabLoading] = useState(false);

  // reset tabs when client changes
  useEffect(() => { setActiveTab("resumen"); setExtProfile(null); setMovements([]); setInvoices([]); }, [client.id]);

  useEffect(() => {
    supabase
      .from("quotes")
      .select("*")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setQuotes(data as Quote[]); });

    supabase
      .from("activity_logs")
      .select("id, action, entity_type, entity_id, metadata, created_at")
      .eq("user_id", client.id)
      .order("created_at", { ascending: false })
      .limit(25)
      .then(({ data }) => { if (data) setActivityLogs(data as ActivityLog[]); });
  }, [client.id]);

  async function loadTab(tab: DetailTab) {
    setActiveTab(tab);
    if (tab === "credito" || tab === "datos") {
      if (extProfile) return;
      setTabLoading(true);
      try { setExtProfile(await fetchClientProfile(client.id)); } catch { /* silent */ }
      finally { setTabLoading(false); }
    }
    if (tab === "movimientos") {
      if (movements.length) return;
      setTabLoading(true);
      try { setMovements(await fetchAccountMovements(client.id)); } catch { /* silent */ }
      finally { setTabLoading(false); }
    }
    if (tab === "facturas") {
      if (invoices.length) return;
      setTabLoading(true);
      try { setInvoices(await fetchClientInvoices(client.id)); } catch { /* silent */ }
      finally { setTabLoading(false); }
    }
  }

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
    <div className="flex flex-col gap-4">

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

      {/* Tab nav */}
      <div className={`flex gap-0.5 p-1 rounded-xl border ${dk("bg-[#0d0d0d] border-[#1f1f1f]", "bg-[#f5f5f5] border-[#e5e5e5]")}`}>
        {DETAIL_TABS.map(({ id: tid, label, icon: Icon }) => (
          <button
            key={tid}
            onClick={() => loadTab(tid)}
            className={`flex-1 flex items-center justify-center gap-1.5 text-[11px] py-1.5 rounded-lg transition font-medium ${
              activeTab === tid
                ? "bg-[#2D9F6A] text-white"
                : dk("text-[#737373] hover:text-white hover:bg-[#1a1a1a]", "text-[#737373] hover:text-[#171717] hover:bg-white")
            }`}
          >
            <Icon size={11} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Tab: Resumen */}
      {activeTab === "resumen" && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatPill icon={ShoppingBag}  label="Pedidos"         value={String(clientOrders.length)}  accent="bg-[#2D9F6A]/15 text-[#2D9F6A]"  isDark={isDark} />
            <StatPill icon={TrendingUp}   label="Total facturado" value={formatPrice(totalSpent)}       accent="bg-green-500/15 text-green-400"   isDark={isDark} />
            <StatPill icon={FileText}     label="Cotizaciones"    value={String(quotes.length)}         accent="bg-blue-500/15 text-blue-400"     isDark={isDark} />
            <StatPill icon={CheckCircle2} label="Cot. aprobadas"  value={String(approvedQuotes)}        accent="bg-purple-500/15 text-purple-400" isDark={isDark} />
          </div>

          {/* Orders */}
          <div className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-2xl overflow-hidden`}>
            <div className={`flex items-center gap-2 px-5 py-3.5 border-b ${dk("border-[#1a1a1a]", "border-[#e8e8e8]")}`}>
              <ShoppingBag size={13} className="text-[#2D9F6A]" />
              <h3 className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>Historial de pedidos</h3>
              <span className="ml-auto text-xs text-[#525252]">{clientOrders.length} en total</span>
            </div>
            {clientOrders.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-[#525252] gap-2"><Package size={24} className="opacity-20" /><p className="text-xs">Sin pedidos registrados</p></div>
            ) : (
              <div className={`divide-y ${dk("divide-[#141414]", "divide-[#f0f0f0]")}`}>
                {clientOrders.map((o) => (
                  <div key={o.id} className={`flex items-center justify-between px-5 py-3 ${dk("hover:bg-[#141414]", "hover:bg-[#fafafa]")} transition`}>
                    <div className="min-w-0">
                      <p className={`text-xs font-semibold ${dk("text-white", "text-[#171717]")}`}>#{String(o.id).slice(-6).toUpperCase()}</p>
                      <p className="text-[10px] text-[#525252] mt-0.5">{fmtDate(o.created_at)} · {o.products?.length ?? 0} productos</p>
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

          {/* Quotes */}
          <div className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-2xl overflow-hidden`}>
            <div className={`flex items-center gap-2 px-5 py-3.5 border-b ${dk("border-[#1a1a1a]", "border-[#e8e8e8]")}`}>
              <FileText size={13} className="text-blue-400" />
              <h3 className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>Cotizaciones</h3>
              <span className="ml-auto text-xs text-[#525252]">{quotes.length} en total</span>
            </div>
            {quotes.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-[#525252] gap-2"><FileText size={24} className="opacity-20" /><p className="text-xs">Sin cotizaciones guardadas</p></div>
            ) : (
              <div className={`divide-y ${dk("divide-[#141414]", "divide-[#f0f0f0]")}`}>
                {quotes.map((q) => (
                  <div key={q.id} className={`flex items-center justify-between px-5 py-3 ${dk("hover:bg-[#141414]", "hover:bg-[#fafafa]")} transition`}>
                    <div className="min-w-0">
                      <p className={`text-xs font-semibold ${dk("text-white", "text-[#171717]")}`}>COT-{String(q.id).padStart(4, "0")}</p>
                      <p className="text-[10px] text-[#525252] mt-0.5">{fmtDate(q.created_at)} · {q.items?.length ?? 0} productos · {q.currency}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      <StatusBadge status={q.status} map={QUOTE_STATUS as any} />
                      <span className="text-sm font-bold text-[#2D9F6A] tabular-nums">{formatPrice(q.total)}</span>
                      {q.status === "draft" && (
                        <button onClick={() => updateQuoteStatus(q.id, "sent")} className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition"><Send size={10} /> Enviar</button>
                      )}
                      {(q.status === "sent" || q.status === "viewed") && (
                        <>
                          <button onClick={() => updateQuoteStatus(q.id, "approved")} className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border border-green-500/30 text-green-400 hover:bg-green-500/10 transition"><CheckCircle2 size={10} /> Aprobar</button>
                          <button onClick={() => updateQuoteStatus(q.id, "rejected")} className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border border-red-500/30 text-red-400 hover:bg-red-500/10 transition"><XCircle size={10} /> Rechazar</button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activity */}
          <div className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-2xl overflow-hidden`}>
            <div className={`flex items-center gap-2 px-5 py-3.5 border-b ${dk("border-[#1a1a1a]", "border-[#e8e8e8]")}`}>
              <Activity size={13} className="text-amber-400" />
              <h3 className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>Actividad reciente</h3>
              <span className="ml-auto text-xs text-[#525252]">{activityLogs.length} eventos</span>
            </div>
            {activityLogs.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-[#525252] gap-2"><Activity size={24} className="opacity-20" /><p className="text-xs">Sin actividad registrada</p></div>
            ) : (
              <div className="px-5 py-4 space-y-3">
                {activityLogs.map((log) => {
                  const cfg = ACTION_CONFIG[log.action] ?? { label: log.action, icon: Activity, color: "text-gray-400" };
                  const Icon = cfg.icon;
                  return (
                    <div key={log.id} className="flex items-start gap-3">
                      <div className={`mt-0.5 shrink-0 h-6 w-6 rounded-lg flex items-center justify-center ${dk("bg-[#1a1a1a]", "bg-[#f5f5f5]")}`}><Icon size={12} className={cfg.color} /></div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium ${dk("text-[#d4d4d4]", "text-[#404040]")}`}>{cfg.label}{log.metadata?.name && <span className="ml-1 font-normal text-[#737373]">— {String(log.metadata.name)}</span>}</p>
                        <p className="text-[10px] text-[#525252] mt-0.5">{fmtDate(log.created_at)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Tab: Crédito */}
      {activeTab === "credito" && (
        <div className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-2xl p-5`}>
          {tabLoading ? (
            <div className="py-10 text-center text-xs text-[#525252]">Cargando…</div>
          ) : !extProfile ? (
            <div className="py-10 text-center text-xs text-red-400">No se pudo cargar el perfil extendido.</div>
          ) : (
            <CreditPanel profile={extProfile} isDark={isDark} onRefresh={async () => { setExtProfile(await fetchClientProfile(client.id)); }} />
          )}
        </div>
      )}

      {/* Tab: Movimientos */}
      {activeTab === "movimientos" && (
        <div className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-2xl overflow-hidden`}>
          <div className={`flex items-center gap-2 px-5 py-3.5 border-b ${dk("border-[#1a1a1a]", "border-[#e8e8e8]")}`}>
            <BarChart2 size={13} className="text-purple-400" />
            <h3 className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>Movimientos de cuenta</h3>
            <span className="ml-auto text-xs text-[#525252]">{movements.length} registros</span>
          </div>
          {tabLoading ? (
            <div className="py-10 text-center text-xs text-[#525252]">Cargando…</div>
          ) : movements.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-[#525252] gap-2"><BarChart2 size={24} className="opacity-20" /><p className="text-xs">Sin movimientos registrados</p></div>
          ) : (
            <div className={`divide-y ${dk("divide-[#141414]", "divide-[#f0f0f0]")}`}>
              {movements.map((m) => (
                <div key={m.id} className={`flex items-center justify-between px-5 py-3 ${dk("hover:bg-[#141414]", "hover:bg-[#fafafa]")} transition`}>
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold ${dk("text-white", "text-[#171717]")}`}>{m.descripcion || m.tipo}</p>
                    <p className="text-[10px] text-[#525252] mt-0.5">{fmtDate(m.fecha)} · {m.tipo}</p>
                  </div>
                  <span className={`text-sm font-bold tabular-nums shrink-0 ml-4 ${m.monto >= 0 ? "text-red-400" : "text-emerald-400"}`}>
                    {m.monto >= 0 ? "+" : ""}{formatPrice(m.monto)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Facturas */}
      {activeTab === "facturas" && (
        <div className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-2xl overflow-hidden`}>
          <div className={`flex items-center gap-2 px-5 py-3.5 border-b ${dk("border-[#1a1a1a]", "border-[#e8e8e8]")}`}>
            <Landmark size={13} className="text-amber-400" />
            <h3 className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>Facturas</h3>
            <span className="ml-auto text-xs text-[#525252]">{invoices.length} registros</span>
          </div>
          {tabLoading ? (
            <div className="py-10 text-center text-xs text-[#525252]">Cargando…</div>
          ) : invoices.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-[#525252] gap-2"><Landmark size={24} className="opacity-20" /><p className="text-xs">Sin facturas registradas</p></div>
          ) : (
            <div className={`divide-y ${dk("divide-[#141414]", "divide-[#f0f0f0]")}`}>
              {invoices.map((inv) => (
                <div key={inv.id} className={`flex items-center justify-between px-5 py-3 ${dk("hover:bg-[#141414]", "hover:bg-[#fafafa]")} transition`}>
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold ${dk("text-white", "text-[#171717]")}`}>{inv.invoice_number || `FAC-${String(inv.id).slice(-6).toUpperCase()}`}</p>
                    <p className="text-[10px] text-[#525252] mt-0.5">{fmtDate(inv.created_at)} · {inv.status}</p>
                  </div>
                  <span className="text-sm font-bold text-[#2D9F6A] tabular-nums shrink-0 ml-4">{formatPrice(inv.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Datos */}
      {activeTab === "datos" && (
        <div className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-2xl p-5`}>
          {tabLoading ? (
            <div className="py-10 text-center text-xs text-[#525252]">Cargando…</div>
          ) : !extProfile ? (
            <div className="py-10 text-center text-xs text-red-400">No se pudo cargar el perfil extendido.</div>
          ) : (
            <DatosPanel profile={extProfile} isDark={isDark} onRefresh={async () => { setExtProfile(await fetchClientProfile(client.id)); }} />
          )}
        </div>
      )}

    </div>
  );
}

// ── Credit sub-panel ──────────────────────────────────────────────────────────
const PAYMENT_TERMS_OPTIONS = [0, 15, 30, 45, 60, 90, 120];

function CreditPanel({ profile, isDark, onRefresh }: { profile: ClientDetailData; isDark: boolean; onRefresh: () => Promise<void> }) {
  const dk = (d: string, l: string) => isDark ? d : l;
  const [approved, setApproved] = useState(profile.credit_approved);
  const [limit, setLimit]       = useState(String(profile.credit_limit ?? 0));
  const [terms, setTerms]       = useState(profile.payment_terms ?? 30);
  const [maxOrder, setMaxOrder] = useState(String(profile.max_order_value ?? 0));
  const [reviewDate, setReviewDate] = useState(profile.credit_review_date ?? "");
  const [notas, setNotas]       = useState(profile.notas_credito ?? "");
  const [saving, setSaving]     = useState(false);

  const creditUsed    = profile.credit_used ?? 0;
  const creditLimit   = Number(limit) || 0;
  const usagePct      = creditLimit > 0 ? Math.min((creditUsed / creditLimit) * 100, 100) : 0;
  const barColor      = usagePct >= 80 ? "bg-red-500" : usagePct >= 60 ? "bg-amber-400" : "bg-[#2D9F6A]";

  async function save() {
    setSaving(true);
    await updateClientProfile(profile.id, {
      credit_approved: approved,
      credit_limit: Number(limit) || 0,
      payment_terms: terms,
      max_order_value: Number(maxOrder) || 0,
      credit_review_date: reviewDate || undefined,
      notas_credito: notas || undefined,
    });
    await onRefresh();
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>Crédito</p>
        <button onClick={save} disabled={saving} className="flex items-center gap-1.5 bg-[#2D9F6A] hover:bg-[#25835A] text-white text-xs font-bold px-3 py-1.5 rounded-lg transition disabled:opacity-50">
          <Save size={12} /> {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>

      {/* Approval toggle */}
      <div className={`flex items-center justify-between p-3 rounded-xl border ${dk("border-[#1f1f1f] bg-[#0d0d0d]", "border-[#e5e5e5] bg-[#f9f9f9]")}`}>
        <div className="flex items-center gap-2">
          <Shield size={14} className={approved ? "text-[#2D9F6A]" : "text-[#525252]"} />
          <span className={`text-xs font-semibold ${dk("text-white", "text-[#171717]")}`}>Crédito aprobado</span>
        </div>
        <button onClick={() => setApproved(!approved)} className={`relative h-5 w-9 rounded-full transition-colors ${approved ? "bg-[#2D9F6A]" : dk("bg-[#333]", "bg-[#d4d4d4]")}`}>
          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${approved ? "translate-x-4" : "translate-x-0.5"}`} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-widest text-[#525252] mb-1 block">Límite de crédito</label>
          <input type="number" min="0" value={limit} onChange={(e) => setLimit(e.target.value)} className={`w-full border rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[#2D9F6A]/40 transition ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-white border-[#d4d4d4] text-[#171717]")}`} />
        </div>
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-widest text-[#525252] mb-1 block">Máx. por pedido (0 = sin límite)</label>
          <input type="number" min="0" value={maxOrder} onChange={(e) => setMaxOrder(e.target.value)} className={`w-full border rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[#2D9F6A]/40 transition ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-white border-[#d4d4d4] text-[#171717]")}`} />
        </div>
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-widest text-[#525252] mb-1 block">Días netos</label>
          <select value={terms} onChange={(e) => setTerms(Number(e.target.value))} className={`w-full border rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[#2D9F6A]/40 transition ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-white border-[#d4d4d4] text-[#171717]")}`}>
            {PAYMENT_TERMS_OPTIONS.map((d) => <option key={d} value={d}>{d === 0 ? "Contado" : `Net ${d}`}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-widest text-[#525252] mb-1 block">Fecha de revisión</label>
          <div className="relative">
            <CalendarDays size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#525252]" />
            <input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} className={`w-full border rounded-lg pl-8 pr-3 py-1.5 text-sm outline-none focus:border-[#2D9F6A]/40 transition ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-white border-[#d4d4d4] text-[#171717]")}`} />
          </div>
        </div>
      </div>

      {creditLimit > 0 && (
        <div>
          <div className="flex justify-between text-[10px] text-[#525252] mb-1">
            <span>Uso de crédito</span><span>{usagePct.toFixed(0)}%</span>
          </div>
          <div className={`h-2 rounded-full overflow-hidden ${dk("bg-[#1f1f1f]", "bg-[#e5e5e5]")}`}>
            <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${usagePct}%` }} />
          </div>
        </div>
      )}

      <div>
        <label className="text-[10px] font-semibold uppercase tracking-widest text-[#525252] mb-1 block">Notas de crédito</label>
        <textarea rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Observaciones internas…" className={`w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2D9F6A]/40 resize-none transition ${dk("bg-[#0d0d0d] border-[#262626] text-white placeholder:text-[#404040]", "bg-white border-[#d4d4d4] text-[#171717] placeholder:text-[#a3a3a3]")}`} />
      </div>
    </div>
  );
}

// ── Datos sub-panel ────────────────────────────────────────────────────────────
function DatosPanel({ profile, isDark, onRefresh }: { profile: ClientDetailData; isDark: boolean; onRefresh: () => Promise<void> }) {
  const dk = (d: string, l: string) => isDark ? d : l;
  const [form, setForm] = useState({
    razon_social: profile.razon_social ?? "",
    cuit:         profile.cuit ?? "",
    direccion:    profile.direccion ?? "",
    ciudad:       profile.ciudad ?? "",
    provincia:    profile.provincia ?? "",
    phone:        profile.phone ?? "",
    notas_internas: profile.notas_internas ?? "",
  });
  const [saving, setSaving] = useState(false);

  const field = (k: keyof typeof form) => (
    <input value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })}
      className={`w-full border rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[#2D9F6A]/40 transition ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-white border-[#d4d4d4] text-[#171717]")}`} />
  );

  async function save() {
    setSaving(true);
    await updateClientProfile(profile.id, form);
    await onRefresh();
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>Datos fiscales y contacto</p>
        <button onClick={save} disabled={saving} className="flex items-center gap-1.5 bg-[#2D9F6A] hover:bg-[#25835A] text-white text-xs font-bold px-3 py-1.5 rounded-lg transition disabled:opacity-50">
          <Save size={12} /> {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-[10px] font-semibold uppercase tracking-widest text-[#525252] mb-1 block">Razón social</label>{field("razon_social")}</div>
        <div><label className="text-[10px] font-semibold uppercase tracking-widest text-[#525252] mb-1 block">CUIT</label>{field("cuit")}</div>
        <div><label className="text-[10px] font-semibold uppercase tracking-widest text-[#525252] mb-1 block">Teléfono</label>{field("phone")}</div>
        <div><label className="text-[10px] font-semibold uppercase tracking-widest text-[#525252] mb-1 block">Dirección</label>{field("direccion")}</div>
        <div><label className="text-[10px] font-semibold uppercase tracking-widest text-[#525252] mb-1 block">Ciudad</label>{field("ciudad")}</div>
        <div><label className="text-[10px] font-semibold uppercase tracking-widest text-[#525252] mb-1 block">Provincia</label>{field("provincia")}</div>
      </div>
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-widest text-[#525252] mb-1 block">Notas internas</label>
        <textarea rows={3} value={form.notas_internas} onChange={(e) => setForm({ ...form, notas_internas: e.target.value })} className={`w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2D9F6A]/40 resize-none transition ${dk("bg-[#0d0d0d] border-[#262626] text-white placeholder:text-[#404040]", "bg-white border-[#d4d4d4] text-[#171717]")}`} />
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
