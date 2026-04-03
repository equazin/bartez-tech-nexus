import { useState, useMemo, useEffect } from "react";
import { Quote, QuoteStatus } from "@/models/quote";
import { useCurrency } from "@/context/CurrencyContext";
import { CLIENT_TYPE_MARGINS, ClientType, supabase } from "@/lib/supabase";
import {
  addClientNote,
  fetchClientProfile, fetchClientInvoices, fetchAccountMovements, fetchClientNotes, updateClientProfile,
  type ClientDetail as ClientDetailData, type AccountMovement, type ClientNote,
} from "@/lib/api/clientDetail";
import type { Invoice } from "@/lib/api/invoices";
import {
  Users, Search, UserPlus, ChevronRight, Mail,
  Percent, ShoppingBag, FileText, CheckCircle2, XCircle, Clock, MessageSquare,
  TrendingUp, Package, Save, X, Send, Eye, AlertTriangle,
  ArrowLeft, Pencil, Activity, LogIn, LogOut, MousePointer,
  ShoppingCart, Hash, CreditCard, BarChart2, Landmark, Settings,
  LayoutGrid, Shield, CalendarDays, UserCheck, UserX, Loader2, type LucideIcon,
  DollarSign, Trash2,
} from "lucide-react";
import { useImpersonate } from "@/context/ImpersonateContext";
import { useAuth } from "@/context/AuthContext";

// -- Types ---------------------------------------------------------------------
export interface ClientProfile {
  id: string;
  company_name: string;
  contact_name: string;
  client_type: ClientType;
  default_margin: number;
  role: string;
  phone?: string;
  active?: boolean;
  email?: string;
}

interface SupabaseOrder {
  id: string;
  client_id: string;
  order_number?: string;
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
  onRefreshClients?: () => void;
}

// -- Helpers -------------------------------------------------------------------
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

type StatusConfig = { label: string; icon: LucideIcon; cls: string };

const ORDER_STATUS: Record<string, StatusConfig> = {
  pending:  { label: "En revision", icon: Clock,        cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  approved: { label: "Aprobado",    icon: CheckCircle2, cls: "bg-green-500/15 text-green-400 border-green-500/30" },
  rejected: { label: "Rechazado",   icon: XCircle,      cls: "bg-red-500/15 text-red-400 border-red-500/30" },
};

const QUOTE_STATUS: Record<QuoteStatus, StatusConfig> = {
  draft:    { label: "Borrador",  icon: FileText,      cls: "bg-[#1f1f1f] text-[#a3a3a3] border-[#2a2a2a]" },
  sent:     { label: "Enviada",   icon: Send,          cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  viewed:   { label: "Vista",     icon: Eye,           cls: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
  approved: { label: "Aprobada",  icon: CheckCircle2,  cls: "bg-green-500/15 text-green-400 border-green-500/30" },
  rejected: { label: "Rechazada", icon: XCircle,       cls: "bg-red-500/15 text-red-400 border-red-500/30" },
  converted:{ label: "Convertida",icon: CheckCircle2,  cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  expired:  { label: "Expirada",  icon: AlertTriangle, cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
};

// -- Activity log types --------------------------------------------------------
interface ActivityLog {
  id: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

const ACTION_CONFIG: Record<string, { label: string; icon: LucideIcon; color: string }> = {
  login:         { label: "Inicio de sesion",  icon: LogIn,          color: "text-blue-400"    },
  logout:        { label: "Cierre de sesion",  icon: LogOut,         color: "text-gray-400"    },
  view_product:  { label: "Vio producto",      icon: MousePointer,   color: "text-purple-400"  },
  add_to_cart:   { label: "Agrego al carrito", icon: ShoppingCart,   color: "text-yellow-400"  },
  place_order:   { label: "Realizo pedido",    icon: Package,        color: "text-emerald-400" },
  search:        { label: "Busqueda",          icon: Hash,           color: "text-gray-400"    },
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

// -- Status badge --------------------------------------------------------------
function StatusBadge<T extends string>({ status, map }: { status: T; map: Record<T, StatusConfig> | Record<string, StatusConfig> }) {
  const statusMap = map as Record<string, StatusConfig>;
  const cfg = statusMap[status] ?? statusMap.pending ?? Object.values(statusMap)[0];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.cls}`}>
      <Icon size={9} /> {cfg.label}
    </span>
  );
}

// -- Client avatar -------------------------------------------------------------
function Avatar({ client, size = "md" }: { client: ClientProfile; size?: "sm" | "md" | "lg" }) {
  const dims = { sm: "h-7 w-7 text-[10px]", md: "h-9 w-9 text-xs", lg: "h-12 w-12 text-sm" }[size];
  return (
    <div className={`${dims} rounded-xl bg-[#2D9F6A]/15 border border-[#2D9F6A]/20 flex items-center justify-center font-bold text-[#2D9F6A] shrink-0`}>
      {initials(client)}
    </div>
  );
}

// -- List item -----------------------------------------------------------------
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
          {client.company_name || client.contact_name || "-"}
        </p>
        <p className="text-[10px] text-[#525252] truncate mt-0.5">
          {CLIENT_TYPE_LABELS[client.client_type]}  -  {client.default_margin}% margen
        </p>
      </div>
      <div className="flex flex-col items-end gap-0.5 shrink-0">
        <span className={`text-[9px] font-medium ${isActive ? "text-[#2D9F6A]" : "text-[#525252]"}`}>
          {orderCount}p  -  {quoteCount}c
        </span>
        <ChevronRight size={11} className={`${isActive ? "text-[#2D9F6A]" : dk("text-[#333] group-hover:text-[#525252]", "text-[#ccc] group-hover:text-[#999]")} transition`} />
      </div>
    </button>
  );
}

// -- Stat mini-card -------------------------------------------------------------
function StatPill({ icon: Icon, label, value, accent, isDark }: { icon: LucideIcon; label: string; value: string; accent: string; isDark: boolean }) {
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

type DetailTab = "vista360" | "resumen" | "credito" | "movimientos" | "facturas" | "datos" | "precios";

const DETAIL_TABS: Array<{ id: DetailTab; label: string; icon: LucideIcon }> = [
  { id: "vista360",    label: "Vista 360",   icon: Users       },
  { id: "resumen",     label: "Resumen",     icon: LayoutGrid  },
  { id: "credito",     label: "Credito",     icon: CreditCard  },
  { id: "movimientos", label: "Cuenta",      icon: BarChart2   },
  { id: "facturas",    label: "Facturas",    icon: Landmark    },
  { id: "precios",     label: "Precios",     icon: DollarSign  },
  { id: "datos",       label: "Datos",       icon: Settings    },
];

// -- Detail panel --------------------------------------------------------------
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
  const [activeTab, setActiveTab] = useState<DetailTab>("vista360");
  const [editing, setEditing] = useState(false);
  const [editType, setEditType] = useState<ClientType>(client.client_type);
  const [editMargin, setEditMargin] = useState(String(client.default_margin));
  type PartnerLevel = "cliente" | "silver" | "gold" | "platinum";
  const [editPartnerLevel, setEditPartnerLevel] = useState<PartnerLevel>(
    ((client as unknown as Record<string, unknown>).partner_level as PartnerLevel) ?? "cliente"
  );
  const [editAssignedSeller, setEditAssignedSeller] = useState<string>(
    ((client as unknown as Record<string, unknown>).assigned_seller_id as string) ?? ""
  );
  const [sellers, setSellers] = useState<Array<{ id: string; contact_name: string }>>([]);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, contact_name")
      .in("role", ["admin", "vendedor"])
      .order("contact_name")
      .then(({ data }) => {
        if (data) setSellers(data as Array<{ id: string; contact_name: string }>);
      });
  }, []);
  const { isAdmin, isSeller } = useAuth();
  const { startImpersonation, stopImpersonation, isImpersonating, impersonatedProfile } = useImpersonate();
  const isCurrentImpersonated = isImpersonating && impersonatedProfile?.id === client.id;
  const [saving, setSaving] = useState(false);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  // lazy-loaded for extra tabs
  const [extProfile, setExtProfile] = useState<ClientDetailData | null>(null);
  const [movements,  setMovements]  = useState<AccountMovement[]>([]);
  const [invoices,   setInvoices]   = useState<Invoice[]>([]);
  const [notes,      setNotes]      = useState<ClientNote[]>([]);
  const [noteBody,   setNoteBody]   = useState("");
  const [noteType,   setNoteType]   = useState<ClientNote["tipo"]>("nota");
  const [savingNote, setSavingNote] = useState(false);
  const [tabLoading, setTabLoading] = useState(false);

  // reset tabs when client changes
  useEffect(() => {
    setActiveTab("vista360");
    setExtProfile(null);
    setMovements([]);
    setInvoices([]);
    setNotes([]);
    setNoteBody("");
    setNoteType("nota");
  }, [client.id]);

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

  async function loadOverviewData(force = false) {
    const shouldFetchProfile = force || !extProfile;
    const shouldFetchMovements = force || movements.length === 0;
    const shouldFetchInvoices = force || invoices.length === 0;
    const shouldFetchNotes = force || notes.length === 0;

    if (!shouldFetchProfile && !shouldFetchMovements && !shouldFetchInvoices && !shouldFetchNotes) return;

    setTabLoading(true);
    try {
      const [profileData, movementData, invoiceData, noteData] = await Promise.all([
        shouldFetchProfile ? fetchClientProfile(client.id).catch(() => null) : Promise.resolve(extProfile),
        shouldFetchMovements ? fetchAccountMovements(client.id).catch(() => []) : Promise.resolve(movements),
        shouldFetchInvoices ? fetchClientInvoices(client.id).catch(() => []) : Promise.resolve(invoices),
        shouldFetchNotes ? fetchClientNotes(client.id).catch(() => []) : Promise.resolve(notes),
      ]);

      if (profileData) setExtProfile(profileData);
      setMovements(movementData);
      setInvoices(invoiceData);
      setNotes(noteData);
    } finally {
      setTabLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function preloadOverview() {
      setTabLoading(true);
      try {
        const [profileData, movementData, invoiceData, noteData] = await Promise.all([
          fetchClientProfile(client.id).catch(() => null),
          fetchAccountMovements(client.id).catch(() => []),
          fetchClientInvoices(client.id).catch(() => []),
          fetchClientNotes(client.id).catch(() => []),
        ]);

        if (cancelled) return;
        if (profileData) setExtProfile(profileData);
        setMovements(movementData);
        setInvoices(invoiceData);
        setNotes(noteData);
      } finally {
        if (!cancelled) setTabLoading(false);
      }
    }

    void preloadOverview();
    return () => {
      cancelled = true;
    };
  }, [client.id]);

  async function loadTab(tab: DetailTab) {
    setActiveTab(tab);
    if (tab === "vista360") {
      await loadOverviewData();
      return;
    }
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
  const openDebt = useMemo(
    () => movements.reduce((sum, movement) => sum + (movement.monto > 0 ? movement.monto : 0), 0),
    [movements]
  );
  const overdueInvoices = useMemo(
    () => invoices.filter((invoice) => invoice.status === "overdue"),
    [invoices]
  );
  const availableCredit = extProfile ? Math.max((extProfile.credit_limit ?? 0) - (extProfile.credit_used ?? 0), 0) : 0;
  const nextDueDate = invoices.find((invoice) => invoice.status !== "paid" && invoice.due_date)?.due_date;
  const recentDocuments = useMemo(() => {
    const orderDocs = clientOrders.slice(0, 3).map((order) => ({
      id: `order-${order.id}`,
      type: "Pedido",
      code: order.order_number || `#${String(order.id).slice(-6).toUpperCase()}`,
      status: order.status,
      amount: order.total,
      date: order.created_at,
    }));
    const quoteDocs = quotes.slice(0, 3).map((quote) => ({
      id: `quote-${quote.id}`,
      type: "Cotizacion",
      code: `COT-${String(quote.id).padStart(4, "0")}`,
      status: quote.status,
      amount: quote.total,
      date: quote.created_at,
    }));
    const invoiceDocs = invoices.slice(0, 3).map((invoice) => ({
      id: `invoice-${invoice.id}`,
      type: "Factura",
      code: invoice.invoice_number || `FAC-${String(invoice.id).slice(-6).toUpperCase()}`,
      status: invoice.status,
      amount: invoice.total,
      date: invoice.created_at,
    }));

    return [...orderDocs, ...quoteDocs, ...invoiceDocs]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 8);
  }, [clientOrders, quotes, invoices]);

  async function handleSave() {
    setSaving(true);
    await onSave(client.id, {
      client_type: editType,
      default_margin: Number(editMargin) || 0,
    });
    // Save partner_level and assigned_seller_id directly
    await supabase
      .from("profiles")
      .update({
        partner_level: editPartnerLevel,
        assigned_seller_id: editAssignedSeller || null,
      })
      .eq("id", client.id);
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

  async function handleAddNote() {
    const trimmed = noteBody.trim();
    if (!trimmed) return;
    setSavingNote(true);
    try {
      await addClientNote(client.id, trimmed, noteType);
      setNotes(await fetchClientNotes(client.id));
      setNoteBody("");
      setNoteType("nota");
    } finally {
      setSavingNote(false);
    }
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
              <p className="text-xs text-[#737373] mt-0.5">{client.contact_name || "-"}</p>
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
              {(isAdmin || isSeller) && (
                <button
                  onClick={() => isCurrentImpersonated ? stopImpersonation() : startImpersonation(client.id)}
                  className={`flex items-center gap-1.5 text-xs font-bold transition px-3 py-1.5 rounded-lg border ${
                    isCurrentImpersonated
                      ? "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20"
                      : "bg-[#2D9F6A]/10 border-[#2D9F6A]/20 text-[#2D9F6A] hover:bg-[#2D9F6A]/20"
                  }`}
                >
                  {isCurrentImpersonated ? <LogOut size={11} /> : <LogIn size={11} />}
                  {isCurrentImpersonated ? "Detener soporte" : "Acceder como cliente"}
                </button>
              )}
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
            ID: {client.id.slice(0, 12)}...
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
              <div>
                <label className="text-[10px] text-gray-500 mb-1 block font-semibold uppercase tracking-widest">Nivel Partner</label>
                <select
                  value={editPartnerLevel}
                  onChange={e => setEditPartnerLevel(e.target.value as PartnerLevel)}
                  className={`border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#2D9F6A] transition ${
                    dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-white border-[#d4d4d4] text-[#171717]")
                  }`}
                >
                  <option value="cliente">Cliente</option>
                  <option value="silver">Silver</option>
                  <option value="gold">Gold</option>
                  <option value="platinum">Platinum</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-500 mb-1 block font-semibold uppercase tracking-widest">Vendedor asignado</label>
                <select
                  value={editAssignedSeller}
                  onChange={e => setEditAssignedSeller(e.target.value)}
                  className={`border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#2D9F6A] transition ${
                    dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-white border-[#d4d4d4] text-[#171717]")
                  }`}
                >
                  <option value="">Sin asignar</option>
                  {sellers.map(s => (
                    <option key={s.id} value={s.id}>{s.contact_name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSave} disabled={saving}
                  className="flex items-center gap-1.5 bg-[#2D9F6A] hover:bg-[#25835A] text-white text-xs font-bold px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                >
                  <Save size={12} /> {saving ? "Guardando..." : "Guardar"}
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

      {activeTab === "vista360" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <StatPill icon={ShoppingBag} label="Compras" value={formatPrice(totalSpent)} accent="bg-[#2D9F6A]/15 text-[#2D9F6A]" isDark={isDark} />
            <StatPill icon={CreditCard} label="Deuda abierta" value={formatPrice(openDebt)} accent="bg-red-500/15 text-red-400" isDark={isDark} />
            <StatPill icon={Shield} label="Credito disponible" value={formatPrice(availableCredit)} accent="bg-blue-500/15 text-blue-400" isDark={isDark} />
            <StatPill icon={AlertTriangle} label="Facturas vencidas" value={String(overdueInvoices.length)} accent="bg-amber-500/15 text-amber-400" isDark={isDark} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              <div className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-2xl p-5`}>
                <div className="flex items-center gap-2 mb-4">
                  <Shield size={14} className="text-[#2D9F6A]" />
                  <h3 className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>Estado comercial</h3>
                </div>
                {tabLoading && !extProfile ? (
                  <div className="py-8 text-center text-xs text-[#525252]">Cargando...</div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {[
                      ["Estado", extProfile?.estado ?? "activo"],
                      ["Dias netos", extProfile ? `${extProfile.payment_terms || 0} dias` : "-"],
                      ["Limite de credito", extProfile ? formatPrice(extProfile.credit_limit || 0) : "-"],
                      ["Credito usado", extProfile ? formatPrice(extProfile.credit_used || 0) : "-"],
                      ["Max. por pedido", extProfile ? formatPrice(extProfile.max_order_value || 0) : "-"],
                      ["Revision", extProfile?.credit_review_date ? fmtDate(extProfile.credit_review_date) : "Sin fecha"],
                    ].map(([label, value]) => (
                      <div key={label} className={`rounded-xl border px-4 py-3 ${dk("border-[#1a1a1a] bg-[#0d0d0d]", "border-[#ececec] bg-[#fafafa]")}`}>
                        <p className="text-[10px] uppercase tracking-widest text-[#525252] font-semibold">{label}</p>
                        <p className={`text-sm font-semibold mt-1 ${dk("text-white", "text-[#171717]")}`}>{value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-2xl p-5`}>
                <div className="flex items-center gap-2 mb-4">
                  <Users size={14} className="text-blue-400" />
                  <h3 className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>Contactos y datos</h3>
                </div>
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  {[
                    ["Empresa", client.company_name || "Sin empresa"],
                    ["Contacto", client.contact_name || "Sin nombre"],
                    ["Email", client.email || extProfile?.email || "Sin email"],
                    ["Telefono", client.phone || extProfile?.phone || "Sin telefono"],
                    ["Razon social", extProfile?.razon_social || "No registrada"],
                    ["CUIT", extProfile?.cuit || "No registrado"],
                    ["Direccion", [extProfile?.direccion, extProfile?.ciudad, extProfile?.provincia].filter(Boolean).join(", ") || "Sin direccion"],
                    ["Condiciones", extProfile ? `${extProfile.precio_lista || "standard"}  -  ${extProfile.payment_terms || 0} dias` : `${client.client_type}  -  ${client.default_margin}%`],
                  ].map(([label, value]) => (
                    <div key={label} className={`rounded-xl border px-4 py-3 ${dk("border-[#1a1a1a] bg-[#0d0d0d]", "border-[#ececec] bg-[#fafafa]")}`}>
                      <p className="text-[10px] uppercase tracking-widest text-[#525252] font-semibold">{label}</p>
                      <p className={`text-sm mt-1 ${dk("text-[#d4d4d4]", "text-[#404040]")}`}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-2xl overflow-hidden`}>
                <div className={`flex items-center gap-2 px-5 py-3.5 border-b ${dk("border-[#1a1a1a]", "border-[#e8e8e8]")}`}>
                  <FileText size={13} className="text-amber-400" />
                  <h3 className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>Documentos vinculados</h3>
                  <span className="ml-auto text-xs text-[#525252]">{recentDocuments.length} recientes</span>
                </div>
                {recentDocuments.length === 0 ? (
                  <div className="py-10 text-center text-xs text-[#525252]">Todavia no hay documentos.</div>
                ) : (
                  <div className={`divide-y ${dk("divide-[#141414]", "divide-[#f0f0f0]")}`}>
                    {recentDocuments.map((doc) => (
                      <div key={doc.id} className="px-5 py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className={`text-xs font-semibold ${dk("text-white", "text-[#171717]")}`}>{doc.code}</p>
                          <p className="text-[10px] text-[#525252] mt-0.5">{doc.type}  -  {fmtDate(doc.date)}  -  {doc.status}</p>
                        </div>
                        <span className="text-sm font-bold text-[#2D9F6A] shrink-0">{formatPrice(doc.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-2xl overflow-hidden`}>
                <div className={`flex items-center gap-2 px-5 py-3.5 border-b ${dk("border-[#1a1a1a]", "border-[#e8e8e8]")}`}>
                  <BarChart2 size={13} className="text-purple-400" />
                  <h3 className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>Deuda y cuenta</h3>
                </div>
                <div className="px-5 py-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className={`rounded-xl border px-4 py-3 ${dk("border-[#1a1a1a] bg-[#0d0d0d]", "border-[#ececec] bg-[#fafafa]")}`}>
                      <p className="text-[10px] uppercase tracking-widest text-[#525252] font-semibold">Saldo abierto</p>
                      <p className="text-sm font-bold text-red-400 mt-1">{formatPrice(openDebt)}</p>
                    </div>
                    <div className={`rounded-xl border px-4 py-3 ${dk("border-[#1a1a1a] bg-[#0d0d0d]", "border-[#ececec] bg-[#fafafa]")}`}>
                      <p className="text-[10px] uppercase tracking-widest text-[#525252] font-semibold">Proximo pago</p>
                      <p className={`text-sm font-semibold mt-1 ${dk("text-white", "text-[#171717]")}`}>{nextDueDate ? fmtDate(nextDueDate) : "Sin vencimientos"}</p>
                    </div>
                  </div>
                  {movements.length === 0 ? (
                    <p className="text-xs text-[#525252]">Sin movimientos registrados.</p>
                  ) : (
                    movements.slice(0, 5).map((movement) => (
                      <div key={movement.id} className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className={`text-xs font-medium ${dk("text-[#d4d4d4]", "text-[#404040]")}`}>{movement.descripcion || movement.tipo}</p>
                          <p className="text-[10px] text-[#525252] mt-0.5">{fmtDate(movement.fecha)}  -  {movement.tipo}</p>
                        </div>
                        <span className={`text-xs font-bold shrink-0 ${movement.monto >= 0 ? "text-red-400" : "text-emerald-400"}`}>
                          {movement.monto >= 0 ? "+" : ""}{formatPrice(movement.monto)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-2xl overflow-hidden`}>
                <div className={`flex items-center gap-2 px-5 py-3.5 border-b ${dk("border-[#1a1a1a]", "border-[#e8e8e8]")}`}>
                  <MessageSquare size={13} className="text-[#2D9F6A]" />
                  <h3 className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>Notas CRM</h3>
                </div>
                <div className="px-5 py-4 space-y-3">
                  <div className="flex gap-2">
                    <select
                      value={noteType}
                      onChange={(event) => setNoteType(event.target.value as ClientNote["tipo"])}
                      className={`rounded-lg border px-3 py-2 text-sm outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-[#fafafa] border-[#ececec] text-[#171717]")}`}
                    >
                      <option value="nota">Nota</option>
                      <option value="llamada">Llamada</option>
                      <option value="reunion">Reunion</option>
                      <option value="alerta">Alerta</option>
                      <option value="seguimiento">Seguimiento</option>
                    </select>
                    <button
                      onClick={() => void handleAddNote()}
                      disabled={savingNote || !noteBody.trim()}
                      className="shrink-0 bg-[#2D9F6A] hover:bg-[#25835A] text-white text-xs font-bold px-3 py-2 rounded-lg transition disabled:opacity-50"
                    >
                      {savingNote ? "Guardando..." : "Agregar nota"}
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    value={noteBody}
                    onChange={(event) => setNoteBody(event.target.value)}
                    placeholder="Seguimiento comercial, acuerdos, riesgo, devoluciones..."
                    className={`w-full rounded-lg border px-3 py-2 text-sm outline-none resize-none ${dk("bg-[#0d0d0d] border-[#262626] text-white placeholder:text-[#404040]", "bg-[#fafafa] border-[#ececec] text-[#171717] placeholder:text-[#a3a3a3]")}`}
                  />
                  <div className="space-y-2">
                    {notes.length === 0 ? (
                      <p className="text-xs text-[#525252]">Sin notas todavia.</p>
                    ) : (
                      notes.slice(0, 6).map((note) => (
                        <div key={note.id} className={`rounded-xl border px-3 py-3 ${dk("border-[#1a1a1a] bg-[#0d0d0d]", "border-[#ececec] bg-[#fafafa]")}`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] uppercase tracking-widest text-[#2D9F6A] font-semibold">{note.tipo}</span>
                            <span className="text-[10px] text-[#525252]">{fmtDate(note.created_at)}</span>
                          </div>
                          <p className={`text-sm mt-2 ${dk("text-[#d4d4d4]", "text-[#404040]")}`}>{note.body}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-2xl overflow-hidden`}>
                <div className={`flex items-center gap-2 px-5 py-3.5 border-b ${dk("border-[#1a1a1a]", "border-[#e8e8e8]")}`}>
                  <Activity size={13} className="text-amber-400" />
                  <h3 className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>Actividad reciente</h3>
                </div>
                <div className="px-5 py-4 space-y-3">
                  {activityLogs.length === 0 ? (
                    <p className="text-xs text-[#525252]">Sin actividad registrada.</p>
                  ) : (
                    activityLogs.slice(0, 6).map((log) => {
                      const cfg = ACTION_CONFIG[log.action] ?? { label: log.action, icon: Activity, color: "text-gray-400" };
                      const Icon = cfg.icon;
                      return (
                        <div key={log.id} className="flex items-start gap-3">
                          <div className={`mt-0.5 shrink-0 h-6 w-6 rounded-lg flex items-center justify-center ${dk("bg-[#1a1a1a]", "bg-[#f5f5f5]")}`}>
                            <Icon size={12} className={cfg.color} />
                          </div>
                          <div className="min-w-0">
                            <p className={`text-xs font-medium ${dk("text-[#d4d4d4]", "text-[#404040]")}`}>{cfg.label}</p>
                            <p className="text-[10px] text-[#525252] mt-0.5">{fmtDate(log.created_at)}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
                      <p className="text-[10px] text-[#525252] mt-0.5">{fmtDate(o.created_at)}  -  {o.products?.length ?? 0} productos</p>
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
                      <p className="text-[10px] text-[#525252] mt-0.5">{fmtDate(q.created_at)}  -  {q.items?.length ?? 0} productos  -  {q.currency}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      <StatusBadge status={q.status} map={QUOTE_STATUS} />
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
                        <p className={`text-xs font-medium ${dk("text-[#d4d4d4]", "text-[#404040]")}`}>{cfg.label}{log.metadata?.name && <span className="ml-1 font-normal text-[#737373]"> -  {String(log.metadata.name)}</span>}</p>
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

      {/* Tab: Credito */}
      {activeTab === "credito" && (
        <div className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-2xl p-5`}>
          {tabLoading ? (
            <div className="py-10 text-center text-xs text-[#525252]">Cargando...</div>
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
            <div className="py-10 text-center text-xs text-[#525252]">Cargando...</div>
          ) : movements.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-[#525252] gap-2"><BarChart2 size={24} className="opacity-20" /><p className="text-xs">Sin movimientos registrados</p></div>
          ) : (
            <div className={`divide-y ${dk("divide-[#141414]", "divide-[#f0f0f0]")}`}>
              {movements.map((m) => (
                <div key={m.id} className={`flex items-center justify-between px-5 py-3 ${dk("hover:bg-[#141414]", "hover:bg-[#fafafa]")} transition`}>
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold ${dk("text-white", "text-[#171717]")}`}>{m.descripcion || m.tipo}</p>
                    <p className="text-[10px] text-[#525252] mt-0.5">{fmtDate(m.fecha)} - {m.tipo}</p>
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
            <div className="py-10 text-center text-xs text-[#525252]">Cargando...</div>
          ) : invoices.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-[#525252] gap-2"><Landmark size={24} className="opacity-20" /><p className="text-xs">Sin facturas registradas</p></div>
          ) : (
            <div className={`divide-y ${dk("divide-[#141414]", "divide-[#f0f0f0]")}`}>
              {invoices.map((inv) => (
                <div key={inv.id} className={`flex items-center justify-between px-5 py-3 ${dk("hover:bg-[#141414]", "hover:bg-[#fafafa]")} transition`}>
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold ${dk("text-white", "text-[#171717]")}`}>{inv.invoice_number || `FAC-${String(inv.id).slice(-6).toUpperCase()}`}</p>
                    <p className="text-[10px] text-[#525252] mt-0.5">{fmtDate(inv.created_at)} - {inv.status}</p>
                  </div>
                  <span className="text-sm font-bold text-[#2D9F6A] tabular-nums shrink-0 ml-4">{formatPrice(inv.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Precios Pactados */}
      {activeTab === "precios" && (
        <CustomPricesPanel clientId={client.id} isDark={isDark} />
      )}

      {/* Tab: Datos */}
      {activeTab === "datos" && (
        <div className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-2xl p-5`}>
          {tabLoading ? (
            <div className="py-10 text-center text-xs text-[#525252]">Cargando...</div>
          ) : !extProfile ? (
            <div className="py-10 text-center text-xs text-red-400">No se pudo cargar el perfil extendido.</div>
          ) : (
            <DatosPanel profile={extProfile} isDark={isDark} clientEmail={client.email} onRefresh={async () => { setExtProfile(await fetchClientProfile(client.id)); }} />
          )}
        </div>
      )}

    </div>
  );
}

// -- Custom Prices Panel -------------------------------------------------------
interface CustomPriceRow {
  id: string;
  product_id: number;
  product_name: string;
  product_sku: string | null;
  custom_price: number;
  currency: string;
}

function CustomPricesPanel({ clientId, isDark }: { clientId: string; isDark: boolean }) {
  const dk = (d: string, l: string) => isDark ? d : l;
  const [rows, setRows]       = useState<CustomPriceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [prodSearch, setProdSearch] = useState("");
  const [prodResults, setProdResults] = useState<{ id: number; name: string; sku: string | null }[]>([]);
  const [selectedProd, setSelectedProd] = useState<{ id: number; name: string; sku: string | null } | null>(null);
  const [price, setPrice]     = useState("");
  const [currency, setCurrency] = useState("USD");
  const [saving, setSaving]   = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("client_custom_prices")
      .select("id, product_id, custom_price, currency, products(name, sku)")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    setRows(((data ?? []) as any[]).map(r => ({
      id: r.id, product_id: r.product_id,
      product_name: r.products?.name ?? "—", product_sku: r.products?.sku ?? null,
      custom_price: r.custom_price, currency: r.currency,
    })));
    setLoading(false);
  };

  useEffect(() => { void load(); }, [clientId]);

  async function searchProducts(q: string) {
    if (q.length < 2) { setProdResults([]); return; }
    const { data } = await supabase.from("products").select("id, name, sku").or(`name.ilike.%${q}%,sku.ilike.%${q}%`).eq("active", true).limit(8);
    setProdResults((data ?? []) as { id: number; name: string; sku: string | null }[]);
  }

  async function handleSave() {
    if (!selectedProd || !price) return;
    setSaving(true);
    await supabase.from("client_custom_prices").upsert({
      client_id: clientId, product_id: selectedProd.id,
      custom_price: Number(price), currency,
    }, { onConflict: "client_id,product_id" });
    setShowForm(false); setSelectedProd(null); setProdSearch(""); setPrice(""); setProdResults([]);
    setSaving(false);
    void load();
  }

  async function handleDelete(id: string) {
    await supabase.from("client_custom_prices").delete().eq("id", id);
    setRows(prev => prev.filter(r => r.id !== id));
  }

  const inp = `w-full text-xs px-3 py-2 rounded-lg border outline-none ${dk("bg-[#0d0d0d] border-[#2a2a2a] text-white", "bg-white border-[#e5e5e5] text-[#171717]")}`;

  return (
    <div className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-2xl p-5 space-y-4`}>
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>Precios Pactados</p>
          <p className="text-xs text-[#737373] mt-0.5">Precios netos por SKU que ignoran los márgenes globales.</p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#2D9F6A]/15 text-[#2D9F6A] border border-[#2D9F6A]/30 hover:bg-[#2D9F6A]/25 transition">
          + Agregar precio
        </button>
      </div>

      {showForm && (
        <div className={`rounded-xl border p-3 space-y-3 ${dk("border-[#2a2a2a] bg-[#0a0a0a]", "border-[#e5e5e5] bg-[#fafafa]")}`}>
          <div className="relative">
            <input value={prodSearch} onChange={e => { setProdSearch(e.target.value); setSelectedProd(null); void searchProducts(e.target.value); }}
              placeholder="Buscar producto por nombre o SKU..." className={inp} />
            {prodResults.length > 0 && !selectedProd && (
              <div className={`absolute z-10 w-full mt-1 rounded-lg border shadow-lg overflow-hidden ${dk("bg-[#111] border-[#2a2a2a]", "bg-white border-[#e5e5e5]")}`}>
                {prodResults.map(p => (
                  <button key={p.id} onClick={() => { setSelectedProd(p); setProdSearch(p.name); setProdResults([]); }}
                    className={`w-full text-left px-3 py-2 text-xs border-b last:border-b-0 ${dk("border-[#1a1a1a] hover:bg-[#1a1a1a] text-[#d4d4d4]", "border-[#f0f0f0] hover:bg-[#f5f5f5] text-[#171717]")}`}>
                    <span className="font-semibold">{p.name}</span>
                    {p.sku && <span className="text-[#737373] ml-2">{p.sku}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="Precio neto" className={inp} />
            <select value={currency} onChange={e => setCurrency(e.target.value)} className={inp}>
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving || !selectedProd || !price}
              className="text-xs px-4 py-1.5 rounded-lg bg-[#2D9F6A] text-white hover:bg-[#25885a] disabled:opacity-50 transition">
              {saving ? "Guardando..." : "Guardar"}
            </button>
            <button onClick={() => setShowForm(false)}
              className={`text-xs px-3 py-1.5 rounded-lg border ${dk("border-[#2a2a2a] text-[#737373]", "border-[#e5e5e5] text-[#525252]")}`}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{[0,1,2].map(i => <div key={i} className={`h-10 rounded-xl animate-pulse ${dk("bg-[#1a1a1a]", "bg-[#f0f0f0]")}`} />)}</div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-center py-6 text-[#525252]">Sin precios pactados. Agregá uno para que tenga prioridad sobre el margen global.</p>
      ) : (
        <div className={`rounded-xl border overflow-hidden ${dk("border-[#1f1f1f]", "border-[#e5e5e5]")}`}>
          <div className={`grid grid-cols-[1fr_100px_80px_40px] gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-wider ${dk("bg-[#0d0d0d] text-[#525252]", "bg-[#f5f5f5] text-[#a3a3a3]")}`}>
            <span>Producto</span><span className="text-right">Precio neto</span><span className="text-right">Moneda</span><span />
          </div>
          {rows.map(r => (
            <div key={r.id} className={`grid grid-cols-[1fr_100px_80px_40px] gap-2 px-4 py-2.5 border-t text-xs items-center ${dk("border-[#1a1a1a] bg-[#111]", "border-[#f0f0f0] bg-white")}`}>
              <div>
                <p className={`font-semibold truncate ${dk("text-white", "text-[#171717]")}`}>{r.product_name}</p>
                {r.product_sku && <p className="text-[10px] text-[#525252]">{r.product_sku}</p>}
              </div>
              <span className={`text-right font-bold ${dk("text-[#2D9F6A]", "text-[#2D9F6A]")}`}>{r.custom_price.toLocaleString("es-AR")}</span>
              <span className={`text-right text-[10px] ${dk("text-[#a3a3a3]", "text-[#525252]")}`}>{r.currency}</span>
              <button onClick={() => handleDelete(r.id)} className="text-red-400 hover:text-red-300 transition flex justify-center">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// -- Money input (formats on blur, strips non-digits on change) ----------------
function MoneyInput({
  value, onChange, isDark, placeholder = "0",
}: {
  value: string;
  onChange: (v: string) => void;
  isDark: boolean;
  placeholder?: string;
}) {
  const dk = (d: string, l: string) => isDark ? d : l;
  const [focused, setFocused] = useState(false);
  const numVal = Number(value) || 0;
  const displayVal = focused
    ? value
    : (numVal === 0 ? "" : numVal.toLocaleString("es-AR"));

  return (
    <div className="relative">
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[#525252] font-semibold pointer-events-none select-none">$</span>
      <input
        type="text"
        inputMode="numeric"
        placeholder={focused ? placeholder : ""}
        value={displayVal}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); }}
        className={`w-full border rounded-lg pl-6 pr-3 py-1.5 text-sm outline-none focus:border-[#2D9F6A]/40 transition tabular-nums ${
          dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-white border-[#d4d4d4] text-[#171717]")
        }`}
      />
    </div>
  );
}

// -- Credit sub-panel ----------------------------------------------------------
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
        <p className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>Credito</p>
        <button onClick={save} disabled={saving} className="flex items-center gap-1.5 bg-[#2D9F6A] hover:bg-[#25835A] text-white text-xs font-bold px-3 py-1.5 rounded-lg transition disabled:opacity-50">
          <Save size={12} /> {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>

      {/* Approval toggle */}
      <div className={`flex items-center justify-between p-3 rounded-xl border ${dk("border-[#1f1f1f] bg-[#0d0d0d]", "border-[#e5e5e5] bg-[#f9f9f9]")}`}>
        <div className="flex items-center gap-2">
          <Shield size={14} className={approved ? "text-[#2D9F6A]" : "text-[#525252]"} />
          <span className={`text-xs font-semibold ${dk("text-white", "text-[#171717]")}`}>Credito aprobado</span>
        </div>
        <button onClick={() => setApproved(!approved)} className={`relative h-5 w-9 rounded-full transition-colors ${approved ? "bg-[#2D9F6A]" : dk("bg-[#333]", "bg-[#d4d4d4]")}`}>
          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${approved ? "translate-x-4" : "translate-x-0.5"}`} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-widest text-[#525252] mb-1 flex items-center gap-1.5">
            Limite de credito <span className="text-[9px] bg-[#2D9F6A]/10 text-[#2D9F6A] border border-[#2D9F6A]/20 px-1 py-0.5 rounded font-bold">ARS</span>
          </label>
          <MoneyInput value={limit} onChange={setLimit} isDark={isDark} />
        </div>
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-widest text-[#525252] mb-1 flex items-center gap-1.5">
            Max. por pedido <span className="text-[9px] bg-[#2D9F6A]/10 text-[#2D9F6A] border border-[#2D9F6A]/20 px-1 py-0.5 rounded font-bold">ARS</span>
            <span className="text-[#444] normal-case font-normal tracking-normal">(0 = sin limite)</span>
          </label>
          <MoneyInput value={maxOrder} onChange={setMaxOrder} isDark={isDark} />
        </div>
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-widest text-[#525252] mb-1 block">Dias netos</label>
          <select value={terms} onChange={(e) => setTerms(Number(e.target.value))} className={`w-full border rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[#2D9F6A]/40 transition ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-white border-[#d4d4d4] text-[#171717]")}`}>
            {PAYMENT_TERMS_OPTIONS.map((d) => <option key={d} value={d}>{d === 0 ? "Contado" : `Net ${d}`}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-widest text-[#525252] mb-1 block">Fecha de revision</label>
          <div className="relative">
            <CalendarDays size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#525252]" />
            <input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} className={`w-full border rounded-lg pl-8 pr-3 py-1.5 text-sm outline-none focus:border-[#2D9F6A]/40 transition ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-white border-[#d4d4d4] text-[#171717]")}`} />
          </div>
        </div>
      </div>

      {creditLimit > 0 && (
        <div>
          <div className="flex justify-between text-[10px] text-[#525252] mb-1">
            <span>Uso de credito</span>
            <span className="tabular-nums">
              ${creditUsed.toLocaleString("es-AR")} / ${creditLimit.toLocaleString("es-AR")} ARS - {usagePct.toFixed(0)}%
            </span>
          </div>
          <div className={`h-2 rounded-full overflow-hidden ${dk("bg-[#1f1f1f]", "bg-[#e5e5e5]")}`}>
            <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${usagePct}%` }} />
          </div>
        </div>
      )}

      <div>
        <label className="text-[10px] font-semibold uppercase tracking-widest text-[#525252] mb-1 block">Notas de credito</label>
        <textarea rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Observaciones internas..." className={`w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2D9F6A]/40 resize-none transition ${dk("bg-[#0d0d0d] border-[#262626] text-white placeholder:text-[#404040]", "bg-white border-[#d4d4d4] text-[#171717] placeholder:text-[#a3a3a3]")}`} />
      </div>
    </div>
  );
}

// -- Datos sub-panel ------------------------------------------------------------
function DatosPanel({
  profile, isDark, clientEmail, onRefresh,
}: {
  profile: ClientDetailData;
  isDark: boolean;
  clientEmail?: string;
  onRefresh: () => Promise<void>;
}) {
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
  const [resetState, setResetState] = useState<"idle" | "sending" | "sent" | "error">("idle");

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

  async function sendPasswordReset() {
    if (!clientEmail) return;
    setResetState("sending");
    const { error } = await supabase.auth.resetPasswordForEmail(clientEmail, {
      redirectTo: `${window.location.origin}/login`,
    });
    setResetState(error ? "error" : "sent");
    if (!error) setTimeout(() => setResetState("idle"), 4000);
  }

  const email = clientEmail || profile.email;

  return (
    <div className="space-y-4">
      {/* Email + password reset */}
      <div className={`${dk("bg-[#0d0d0d] border-[#1a1a1a]", "bg-[#f9f9f9] border-[#e5e5e5]")} border rounded-xl p-4 space-y-3`}>
        <p className={`text-xs font-bold ${dk("text-white", "text-[#171717]")}`}>Acceso al portal</p>
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-widest text-[#525252] mb-1 block">Email de acceso</label>
          <div className={`flex items-center gap-2 border rounded-lg px-3 py-1.5 ${dk("bg-[#0d0d0d] border-[#262626]", "bg-white border-[#d4d4d4]")}`}>
            <Mail size={13} className="text-[#525252] shrink-0" />
            <span className={`text-sm flex-1 ${email ? dk("text-white", "text-[#171717]") : "text-[#525252] italic"}`}>
              {email || "Sin email registrado"}
            </span>
          </div>
        </div>
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-widest text-[#525252] mb-1 block">Contrasena</label>
          <div className={`flex items-center justify-between gap-3 border rounded-lg px-3 py-1.5 ${dk("bg-[#0d0d0d] border-[#262626]", "bg-white border-[#d4d4d4]")}`}>
            <span className="text-sm text-[#525252] italic tracking-widest select-none">************</span>
            <button
              onClick={sendPasswordReset}
              disabled={!email || resetState === "sending" || resetState === "sent"}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-lg transition shrink-0 ${
                resetState === "sent"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : resetState === "error"
                  ? "bg-red-500/20 text-red-400"
                  : "bg-[#2D9F6A]/15 text-[#2D9F6A] hover:bg-[#2D9F6A]/25 disabled:opacity-40"
              }`}
            >
              {resetState === "sending" && <><Loader2 size={11} className="animate-spin" /> Enviando...</>}
              {resetState === "sent"    && <><CheckCircle2 size={11} /> Email enviado</>}
              {resetState === "error"   && <><AlertTriangle size={11} /> Error al enviar</>}
              {resetState === "idle"    && <><Send size={11} /> Enviar recuperacion</>}
            </button>
          </div>
          {!email && (
            <p className="text-[10px] text-amber-500 mt-1">Sin email registrado - no se puede enviar recuperacion.</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>Datos fiscales y contacto</p>
        <button onClick={save} disabled={saving} className="flex items-center gap-1.5 bg-[#2D9F6A] hover:bg-[#25835A] text-white text-xs font-bold px-3 py-1.5 rounded-lg transition disabled:opacity-50">
          <Save size={12} /> {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-[10px] font-semibold uppercase tracking-widest text-[#525252] mb-1 block">Razon social</label>{field("razon_social")}</div>
        <div><label className="text-[10px] font-semibold uppercase tracking-widest text-[#525252] mb-1 block">CUIT</label>{field("cuit")}</div>
        <div><label className="text-[10px] font-semibold uppercase tracking-widest text-[#525252] mb-1 block">Telefono</label>{field("phone")}</div>
        <div><label className="text-[10px] font-semibold uppercase tracking-widest text-[#525252] mb-1 block">Direccion</label>{field("direccion")}</div>
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

// -- Main component ------------------------------------------------------------
export function ClientCRM({ clients, orders, loading, isDark, onSave, onNewClient, onRefreshClients }: ClientCRMProps) {
  const dk = (d: string, l: string) => isDark ? d : l;
  const [search, setSearch]       = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("active");
  const [activating, setActivating] = useState<string | null>(null);

  const inactiveCount = useMemo(() => clients.filter((c) => c.active === false).length, [clients]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return clients.filter((c) => {
      const isActive = c.active !== false; // default true for existing rows
      if (statusFilter === "active"   && !isActive) return false;
      if (statusFilter === "inactive" && isActive)  return false;
      return (
        !q ||
        c.company_name?.toLowerCase().includes(q) ||
        c.contact_name?.toLowerCase().includes(q) ||
        c.client_type?.toLowerCase().includes(q)
      );
    });
  }, [clients, search, statusFilter]);

  async function toggleActive(client: ClientProfile) {
    setActivating(client.id);
    const newVal = client.active === false;
    await supabase.from("profiles").update({ active: newVal }).eq("id", client.id);
    setActivating(null);
    onRefreshClients?.();
  }

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

      {/* -- LEFT: Client list -- */}
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

        {/* Status filter */}
        <div className={`flex rounded-lg p-0.5 gap-0.5 ${dk("bg-[#0d0d0d]", "bg-[#f0f0f0]")}`}>
          {(["active", "inactive", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[10px] font-semibold transition ${
                statusFilter === f
                  ? f === "inactive"
                    ? "bg-amber-500/20 text-amber-400"
                    : dk("bg-[#1a1a1a] text-white", "bg-white text-[#171717] shadow-sm")
                  : "text-[#525252] hover:text-[#737373]"
              }`}
            >
              {f === "active"   && <><UserCheck size={10} /> Activos</>}
              {f === "inactive" && <><UserX size={10} /> Pendientes {inactiveCount > 0 && <span className="bg-amber-500/30 text-amber-400 px-1 rounded">{inactiveCount}</span>}</>}
              {f === "all"      && <>Todos</>}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#525252] pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente..."
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
              <p className="text-xs">{search ? "Sin resultados" : statusFilter === "inactive" ? "Sin clientes pendientes" : "Sin clientes"}</p>
            </div>
          ) : (
            filtered.map((c) => (
              <div key={c.id} className="relative group/row">
                <ClientListItem
                  client={c}
                  isDark={isDark}
                  isActive={c.id === selectedId}
                  orderCount={orderCountMap[c.id] || 0}
                  quoteCount={quoteCountMap[c.id] || 0}
                  onClick={() => setSelectedId(c.id === selectedId ? null : c.id)}
                />
                {/* Activate / deactivate quick action */}
                <button
                  onClick={(e) => { e.stopPropagation(); toggleActive(c); }}
                  disabled={activating === c.id}
                  title={c.active === false ? "Activar cliente" : "Desactivar cliente"}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/row:opacity-100 transition p-1 rounded-lg text-[10px] font-semibold ${
                    c.active === false
                      ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                      : "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                  } ${activating === c.id ? "opacity-50 pointer-events-none" : ""}`}
                >
                  {c.active === false ? <UserCheck size={12} /> : <UserX size={12} />}
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* -- RIGHT: Detail panel -- */}
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
            <p className={`text-sm font-medium ${dk("text-[#737373]", "text-[#525252]")}`}>Selecciona un cliente</p>
            <p className="text-xs text-[#525252]">Ver historial de pedidos y cotizaciones</p>
          </div>
        )}
      </div>

    </div>
  );
}

