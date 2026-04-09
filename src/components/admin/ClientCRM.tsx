import { useState, useMemo, useEffect, useRef } from "react";
import { CreateOrderModal } from "@/components/admin/CreateOrderModal";
import { CreateQuoteModal } from "@/components/admin/CreateQuoteModal";
import { Quote, QuoteStatus } from "@/models/quote";
import { useCurrency } from "@/context/CurrencyContext";
import { CLIENT_TYPE_MARGINS, ClientType, supabase } from "@/lib/supabase";
import {
  addClientNote,
  fetchClientProfile, fetchClientInvoices, fetchAccountMovements, fetchClientNotes, fetchClientSupportTickets,
  fetchClientRmas, updateClientProfile,
  type ClientDetail as ClientDetailData, type AccountMovement, type ClientNote, type SupportTicket, type ClientRma, type ProfileTaxStatus,
} from "@/lib/api/clientDetail";
import type { Invoice } from "@/lib/api/invoices";
import { Client360Header } from "@/components/admin/client360/Client360Header";
import { ClientActionRail } from "@/components/admin/client360/ClientActionRail";
import { ClientBusinessPanel } from "@/components/admin/client360/ClientBusinessPanel";
import { ClientIdentityRail } from "@/components/admin/client360/ClientIdentityRail";
import { ClientUnifiedTimeline } from "@/components/admin/client360/ClientUnifiedTimeline";
import type {
  Client360Alert,
  Client360Metric,
  Client360Tag,
  ExecutiveOption,
  PriorityAction,
  ProductInsight,
  SupportSummary,
  TimelineItem,
} from "@/components/admin/client360/types";
import { SurfaceCard } from "@/components/ui/surface-card";
import type { Product } from "@/models/products";
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
  partner_level?: "cliente" | "silver" | "gold" | "platinum";
  assigned_seller_id?: string;
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
  products: Product[];
  loading: boolean;
  isDark: boolean;
  selectedClientId?: string | null;
  onSave: (id: string, changes: { client_type?: ClientType; default_margin?: number }) => Promise<void>;
  onNewClient: () => void;
  onNewSeller?: () => void;
  onRefreshClients?: () => void;
  onRefreshOrders?: () => Promise<void> | void;
}

const TAX_STATUS_OPTIONS: Array<{ value: ProfileTaxStatus; label: string }> = [
  { value: "no_especificado", label: "No especificado" },
  { value: "responsable_inscripto", label: "Responsable Inscripto" },
  { value: "monotributista", label: "Monotributista" },
  { value: "exento", label: "Exento" },
  { value: "consumidor_final", label: "Consumidor Final" },
];

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

function fmtRelativeDate(iso?: string | null) {
  if (!iso) return "Sin registro";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "Sin registro";
  const diffMs = Date.now() - then;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  if (diffHours < 1) return "hace menos de 1 hora";
  if (diffHours < 24) return `hace ${diffHours} hora${diffHours === 1 ? "" : "s"}`;
  if (diffDays < 30) return `hace ${diffDays} dia${diffDays === 1 ? "" : "s"}`;
  const diffMonths = Math.floor(diffDays / 30);
  return `hace ${diffMonths} mes${diffMonths === 1 ? "" : "es"}`;
}

function diffDaysFromNow(iso?: string | null) {
  if (!iso) return Number.POSITIVE_INFINITY;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return Number.POSITIVE_INFINITY;
  return Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
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
      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition group ${
        isActive
          ? "bg-[#2D9F6A]/10 border border-[#2D9F6A]/20"
          : `border border-transparent ${dk("hover:bg-[#141414] hover:border-[#1f1f1f]", "hover:bg-[#f5f5f5] hover:border-[#e5e5e5]")}`
      }`}
    >
      <Avatar client={client} size="sm" />
      <div className="flex-1 min-w-0">
        <p className={`text-[13px] font-semibold truncate leading-tight ${
          isActive ? dk("text-white", "text-[#171717]") : dk("text-[#d4d4d4] group-hover:text-white", "text-[#404040] group-hover:text-[#171717]")
        }`}>
          {client.company_name || client.contact_name || "-"}
        </p>
        <p className="text-[9px] text-[#525252] truncate mt-0.5">
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
  client, orders, products, isDark, onSave, onBack, onRefreshOrders,
}: {
  client: ClientProfile;
  orders: SupabaseOrder[];
  products: Product[];
  isDark: boolean;
  onSave: (id: string, changes: { client_type?: ClientType; default_margin?: number }) => Promise<void>;
  onBack: () => void;
  onRefreshOrders?: () => Promise<void> | void;
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
  const [sellers, setSellers] = useState<ExecutiveOption[]>([]);
  const [savingExecutive, setSavingExecutive] = useState(false);
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [showCreateQuote, setShowCreateQuote] = useState(false);
  const noteTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, contact_name, role, email, active")
      .in("role", ["sales", "vendedor"])
      .eq("active", true)
      .order("contact_name")
      .then(({ data }) => {
        if (data) {
          setSellers(
            (data as Array<{ id: string; contact_name: string; role?: string; email?: string | null }>).map((seller) => ({
              id: seller.id,
              name: seller.contact_name || "Sin nombre",
              role: "Sales",
              email: seller.email ?? null,
            })),
          );
        }
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
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [rmaRequests, setRmaRequests] = useState<ClientRma[]>([]);
  const [noteBody,   setNoteBody]   = useState("");
  const [noteType,   setNoteType]   = useState<ClientNote["tipo"]>("nota");
  const [savingNote, setSavingNote] = useState(false);
  const [tabLoading, setTabLoading] = useState(false);

  async function loadQuotes() {
    const { data } = await supabase
      .from("quotes")
      .select("*")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false });
    if (data) setQuotes(data as Quote[]);
  }

  // reset tabs when client changes
  useEffect(() => {
    setActiveTab("vista360");
    setExtProfile(null);
    setMovements([]);
    setInvoices([]);
    setNotes([]);
    setSupportTickets([]);
    setRmaRequests([]);
    setNoteBody("");
    setNoteType("nota");
    setEditPartnerLevel(client.partner_level ?? "cliente");
    setEditAssignedSeller(client.assigned_seller_id ?? "");
    setEditing(false);
  }, [client.id]);

  useEffect(() => {
    void loadQuotes();

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
    const shouldFetchSupport = force || supportTickets.length === 0;
    const shouldFetchRmas = force || rmaRequests.length === 0;

    if (!shouldFetchProfile && !shouldFetchMovements && !shouldFetchInvoices && !shouldFetchNotes && !shouldFetchSupport && !shouldFetchRmas) return;

    setTabLoading(true);
    try {
      const [profileData, movementData, invoiceData, noteData, supportData, rmaData] = await Promise.all([
        shouldFetchProfile ? fetchClientProfile(client.id).catch(() => null) : Promise.resolve(extProfile),
        shouldFetchMovements ? fetchAccountMovements(client.id).catch(() => []) : Promise.resolve(movements),
        shouldFetchInvoices ? fetchClientInvoices(client.id).catch(() => []) : Promise.resolve(invoices),
        shouldFetchNotes ? fetchClientNotes(client.id).catch(() => []) : Promise.resolve(notes),
        shouldFetchSupport ? fetchClientSupportTickets(client.id).catch(() => []) : Promise.resolve(supportTickets),
        shouldFetchRmas ? fetchClientRmas(client.id).catch(() => []) : Promise.resolve(rmaRequests),
      ]);

      if (profileData) setExtProfile(profileData);
      if (profileData) {
        setEditPartnerLevel(profileData.partner_level ?? "cliente");
        setEditAssignedSeller(profileData.assigned_seller_id ?? "");
      }
      setMovements(movementData);
      setInvoices(invoiceData);
      setNotes(noteData);
      setSupportTickets(supportData);
      setRmaRequests(rmaData);
    } finally {
      setTabLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function preloadOverview() {
      setTabLoading(true);
      try {
        const [profileData, movementData, invoiceData, noteData, supportData, rmaData] = await Promise.all([
          fetchClientProfile(client.id).catch(() => null),
          fetchAccountMovements(client.id).catch(() => []),
          fetchClientInvoices(client.id).catch(() => []),
          fetchClientNotes(client.id).catch(() => []),
          fetchClientSupportTickets(client.id).catch(() => []),
          fetchClientRmas(client.id).catch(() => []),
        ]);

        if (cancelled) return;
        if (profileData) {
          setExtProfile(profileData);
          setEditPartnerLevel(profileData.partner_level ?? "cliente");
          setEditAssignedSeller(profileData.assigned_seller_id ?? "");
        }
        setMovements(movementData);
        setInvoices(invoiceData);
        setNotes(noteData);
        setSupportTickets(supportData);
        setRmaRequests(rmaData);
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
    setExtProfile((prev) => (
      prev
        ? { ...prev, partner_level: editPartnerLevel, assigned_seller_id: editAssignedSeller || undefined }
        : prev
    ));
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
      try {
        setExtProfile(await fetchClientProfile(client.id));
      } catch {
        // ignore profile refresh error
      }
      setNoteBody("");
      setNoteType("nota");
    } finally {
      setSavingNote(false);
    }
  }

  async function handleSaveExecutive() {
    setSavingExecutive(true);
    try {
      await supabase
        .from("profiles")
        .update({ assigned_seller_id: editAssignedSeller || null })
        .eq("id", client.id);
      setExtProfile((prev) => (prev ? { ...prev, assigned_seller_id: editAssignedSeller || undefined } : prev));
    } finally {
      setSavingExecutive(false);
    }
  }

  function focusNoteComposer(nextType?: ClientNote["tipo"]) {
    setActiveTab("vista360");
    if (nextType) setNoteType(nextType);
    requestAnimationFrame(() => {
      noteTextareaRef.current?.focus();
    });
  }

  function handleQuickCreateOrder() {
    setShowCreateOrder(true);
  }

  function handleQuickCreateQuote() {
    setShowCreateQuote(true);
  }

  const approvedOrders = useMemo(
    () => clientOrders.filter((order) => order.status === "approved"),
    [clientOrders],
  );

  const latestOrder = approvedOrders[0] ?? clientOrders[0] ?? null;
  const firstOrder = approvedOrders[approvedOrders.length - 1] ?? clientOrders[clientOrders.length - 1] ?? null;

  const monthlyVolume = useMemo(() => {
    const limit = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return approvedOrders
      .filter((order) => new Date(order.created_at).getTime() >= limit)
      .reduce((sum, order) => sum + order.total, 0);
  }, [approvedOrders]);

  const previousMonthlyVolume = useMemo(() => {
    const now = Date.now();
    const start = now - 60 * 24 * 60 * 60 * 1000;
    const end = now - 30 * 24 * 60 * 60 * 1000;
    return approvedOrders
      .filter((order) => {
        const createdAt = new Date(order.created_at).getTime();
        return createdAt >= start && createdAt < end;
      })
      .reduce((sum, order) => sum + order.total, 0);
  }, [approvedOrders]);

  const purchaseVariation = previousMonthlyVolume > 0
    ? ((monthlyVolume - previousMonthlyVolume) / previousMonthlyVolume) * 100
    : monthlyVolume > 0 ? 100 : 0;
  const averageTicket = approvedOrders.length > 0 ? totalSpent / approvedOrders.length : 0;
  const creditUsagePct = extProfile?.credit_limit ? ((extProfile.credit_used ?? 0) / extProfile.credit_limit) * 100 : 0;
  const daysSinceLastOrder = diffDaysFromNow(latestOrder?.created_at);

  const productInsights = useMemo(() => {
    const productMap = new Map<string, { quantity: number; revenue: number; lastOrderedAt: string; orders: number }>();
    approvedOrders.forEach((order) => {
      order.products?.forEach((product) => {
        const key = product.name?.trim();
        if (!key) return;
        const current = productMap.get(key);
        const revenue = product.total_price ?? 0;
        if (!current) {
          productMap.set(key, {
            quantity: product.quantity,
            revenue,
            lastOrderedAt: order.created_at,
            orders: 1,
          });
          return;
        }
        productMap.set(key, {
          quantity: current.quantity + product.quantity,
          revenue: current.revenue + revenue,
          lastOrderedAt: new Date(order.created_at) > new Date(current.lastOrderedAt) ? order.created_at : current.lastOrderedAt,
          orders: current.orders + 1,
        });
      });
    });
    return Array.from(productMap.entries()).map(([name, value]) => ({
      name,
      ...value,
    }));
  }, [approvedOrders]);

  const frequentProducts: ProductInsight[] = productInsights
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5)
    .map((product) => ({
      name: product.name,
      detail: `${product.quantity} unidades en ${product.orders} pedidos · ultima compra ${fmtRelativeDate(product.lastOrderedAt)}`,
      value: formatPrice(product.revenue),
    }));

  const reorderSuggestions: ProductInsight[] = productInsights
    .filter((product) => diffDaysFromNow(product.lastOrderedAt) >= 45)
    .sort((a, b) => diffDaysFromNow(b.lastOrderedAt) - diffDaysFromNow(a.lastOrderedAt))
    .slice(0, 4)
    .map((product) => ({
      name: product.name,
      detail: `No compra hace ${diffDaysFromNow(product.lastOrderedAt)} dias · ${product.quantity} unidades historicas`,
      value: formatPrice(product.revenue),
    }));

  const openQuotes = quotes.filter((quote) => ["draft", "sent", "viewed"].includes(quote.status));
  const activeTickets = supportTickets.filter((ticket) => ["open", "in_analysis", "waiting_customer"].includes(ticket.status));
  const activeRmas = rmaRequests.filter((rma) => ["submitted", "reviewing", "approved"].includes(rma.status));

  const lastContactAt = extProfile?.last_contact_at;
  const daysSinceLastContact = diffDaysFromNow(lastContactAt);
  const currentExecutiveId = extProfile?.assigned_seller_id ?? client.assigned_seller_id ?? "";
  const selectedExecutive = sellers.find((seller) => seller.id === (editAssignedSeller || currentExecutiveId)) ?? null;
  const executiveName = selectedExecutive?.name ?? "Sin ejecutivo asignado";
  const executiveDirty = (editAssignedSeller || "") !== (currentExecutiveId || "");
  const currentPartnerLevel = extProfile?.partner_level ?? client.partner_level;

  const commercialScore = useMemo(() => {
    let score = 50;

    if (client.client_type === "mayorista") score += 8;
    if (client.client_type === "reseller") score += 5;
    if (client.client_type === "empresa") score += 3;

    if (currentPartnerLevel === "silver") score += 4;
    if (currentPartnerLevel === "gold") score += 8;
    if (currentPartnerLevel === "platinum") score += 12;

    const segmentMarginTargets: Record<ClientType, { min: number; max: number }> = {
      mayorista: { min: 7, max: 14 },
      reseller: { min: 12, max: 24 },
      empresa: { min: 10, max: 20 },
    };
    const target = segmentMarginTargets[client.client_type];
    if (client.default_margin < target.min) score -= 8;
    else if (client.default_margin > target.max) score -= 5;
    else score += 6;

    if (approvedOrders.length >= 3) score += 8;
    if (monthlyVolume > 0) score += 6;
    if (purchaseVariation >= 20) score += 8;
    if (purchaseVariation <= -20) score -= 14;
    if (daysSinceLastOrder >= 60) score -= 16;
    if (daysSinceLastOrder >= 90) score -= 8;

    if (overdueInvoices.length > 0) score -= Math.min(28, overdueInvoices.length * 10);
    if (creditUsagePct >= 90) score -= 18;
    else if (creditUsagePct >= 75) score -= 10;
    else if (creditUsagePct <= 45) score += 5;

    if (openDebt > 0 && overdueInvoices.length === 0) score -= 4;
    if (activeTickets.length > 0) score -= Math.min(10, activeTickets.length * 3);
    if (activeRmas.length > 0) score -= Math.min(8, activeRmas.length * 3);
    if (daysSinceLastContact >= 21) score -= 10;
    else if (daysSinceLastContact <= 7) score += 5;

    return Math.max(0, Math.min(100, Math.round(score)));
  }, [
    activeRmas.length,
    activeTickets.length,
    approvedOrders.length,
    client.client_type,
    client.default_margin,
    creditUsagePct,
    currentPartnerLevel,
    daysSinceLastContact,
    daysSinceLastOrder,
    monthlyVolume,
    openDebt,
    overdueInvoices.length,
    purchaseVariation,
  ]);

  const commercialScoreBand = commercialScore >= 80
    ? { label: "Score alto", tone: "success" as const }
    : commercialScore >= 60
      ? { label: "Score estable", tone: "outline" as const }
      : commercialScore >= 40
        ? { label: "Score en observacion", tone: "warning" as const }
        : { label: "Score critico", tone: "destructive" as const };

  const commercialStatus = useMemo(() => {
    if (commercialScore < 40 || overdueInvoices.length > 0 || creditUsagePct >= 85 || daysSinceLastOrder >= 75 || purchaseVariation <= -35) {
      return { label: "Riesgo", tone: "destructive" as const };
    }
    if (commercialScore >= 75 || openQuotes.length > 0 || purchaseVariation >= 20 || (approvedOrders.length === 0 && quotes.length > 0)) {
      return { label: "Oportunidad", tone: "warning" as const };
    }
    return { label: "Activo", tone: "success" as const };
  }, [approvedOrders.length, commercialScore, creditUsagePct, daysSinceLastOrder, openQuotes.length, overdueInvoices.length, purchaseVariation, quotes.length]);

  const clientTags: Client360Tag[] = [
    ...(currentPartnerLevel && currentPartnerLevel !== "cliente"
      ? [{ label: currentPartnerLevel.toUpperCase(), tone: "outline" as const }]
      : []),
    ...(commercialStatus.label === "Riesgo" ? [{ label: "Riesgo", tone: "destructive" as const }] : []),
    ...(commercialStatus.label === "Oportunidad" ? [{ label: "Oportunidad", tone: "warning" as const }] : []),
    [{ label: `${commercialScore}/100`, tone: commercialScoreBand.tone }],
    ...(firstOrder && diffDaysFromNow(firstOrder.created_at) <= 45 ? [{ label: "Nuevo", tone: "success" as const }] : []),
    ...(!currentExecutiveId ? [{ label: "Sin responsable", tone: "muted" as const }] : []),
  ].flat();

  const businessMetrics: Client360Metric[] = [
    {
      id: "credit-available",
      label: "Credito disponible",
      value: formatPrice(availableCredit),
      detail: extProfile ? `${Math.max(0, 100 - creditUsagePct).toFixed(0)}% del limite libre` : "Cargando perfil financiero",
    },
    {
      id: "credit-used",
      label: "Credito usado",
      value: formatPrice(extProfile?.credit_used ?? 0),
      detail: extProfile ? `${creditUsagePct.toFixed(0)}% utilizado` : "Sin datos de credito",
    },
    {
      id: "last-order",
      label: "Ultimo pedido",
      value: latestOrder ? formatPrice(latestOrder.total) : "Sin pedidos",
      detail: latestOrder ? `${fmtRelativeDate(latestOrder.created_at)} · ${latestOrder.status}` : "La cuenta aun no compra",
    },
    {
      id: "monthly-volume",
      label: "Volumen 30 dias",
      value: formatPrice(monthlyVolume),
      detail: previousMonthlyVolume > 0 ? `Periodo previo ${formatPrice(previousMonthlyVolume)}` : "Sin base comparativa",
    },
    {
      id: "purchase-variation",
      label: "Variacion compra",
      value: `${purchaseVariation >= 0 ? "+" : ""}${purchaseVariation.toFixed(0)}%`,
      detail: daysSinceLastOrder < Number.POSITIVE_INFINITY ? `Ultima compra hace ${daysSinceLastOrder} dias` : "Sin compras registradas",
    },
    {
      id: "avg-ticket",
      label: "Ticket promedio",
      value: averageTicket > 0 ? formatPrice(averageTicket) : "Sin ticket",
      detail: approvedOrders.length > 0 ? `${approvedOrders.length} pedidos aprobados` : "Sin pedidos aprobados",
    },
  ];

  const businessAlerts: Client360Alert[] = [
    {
      title: commercialStatus.label,
      description:
        commercialStatus.label === "Riesgo"
          ? "La cuenta necesita accion comercial inmediata por caida de compra, deuda vencida o uso alto de credito."
          : commercialStatus.label === "Oportunidad"
            ? "Hay señales para empujar cierre o crecimiento: cotizaciones abiertas, actividad reciente o mejora de consumo."
            : "La cuenta compra con ritmo estable y no muestra alertas criticas inmediatas.",
      tone: commercialStatus.tone,
    },
    {
      title: overdueInvoices.length > 0 ? "Alerta de cobranza" : "Estado financiero",
      description:
        overdueInvoices.length > 0
          ? `${overdueInvoices.length} factura(s) vencida(s). Proximo vencimiento ${nextDueDate ? fmtDate(nextDueDate) : "sin fecha"}.`
          : `Limite ${formatPrice(extProfile?.credit_limit ?? 0)} · usado ${formatPrice(extProfile?.credit_used ?? 0)} · disponible ${formatPrice(availableCredit)}.`,
      tone: overdueInvoices.length > 0 ? "destructive" : "outline",
    },
    {
      title: purchaseVariation <= -20 ? "Caida de compras" : purchaseVariation >= 20 ? "Cliente en crecimiento" : "Compra estable",
      description:
        purchaseVariation <= -20
          ? `El volumen de los ultimos 30 dias cae ${Math.abs(purchaseVariation).toFixed(0)}% respecto al periodo anterior.`
          : purchaseVariation >= 20
            ? `La cuenta crece ${purchaseVariation.toFixed(0)}% y conviene trabajar expansion de mix o recompra.`
            : "La variacion de compra se mantiene en rango normal para la cuenta.",
      tone: purchaseVariation <= -20 ? "warning" : purchaseVariation >= 20 ? "success" : "muted",
    },
    {
      title: activeTickets.length > 0 || activeRmas.length > 0 ? "Soporte abierto" : "Sin friccion operativa",
      description:
        activeTickets.length > 0 || activeRmas.length > 0
          ? `${activeTickets.length} ticket(s) activos y ${activeRmas.length} RMA(s) en curso pueden impactar la renovacion o recompra.`
          : "No hay tickets ni RMAs abiertos que comprometan el vinculo comercial.",
      tone: activeTickets.length > 0 || activeRmas.length > 0 ? "warning" : "success",
    },
  ];

  const priorityActions: PriorityAction[] = [
    ...(!currentExecutiveId ? [{
      title: "Asignar ejecutivo",
      description: "La cuenta no tiene responsable visible. Definilo para ordenar seguimiento y ownership comercial.",
      tone: "warning" as const,
    }] : []),
    ...(overdueInvoices.length > 0 ? [{
      title: "Resolver deuda vencida",
      description: `${overdueInvoices.length} factura(s) vencida(s) pueden bloquear compra y erosionar margen de negociacion.`,
      tone: "destructive" as const,
    }] : []),
    ...(creditUsagePct >= 85 ? [{
      title: "Revisar limite de credito",
      description: `El cliente consumio ${creditUsagePct.toFixed(0)}% del limite disponible.`,
      tone: "warning" as const,
    }] : []),
    ...(openQuotes.length > 0 ? [{
      title: "Empujar cotizacion abierta",
      description: `${openQuotes.length} cotizacion(es) en curso necesitan follow-up para cierre.`,
      tone: "success" as const,
    }] : []),
    ...(daysSinceLastContact >= 14 ? [{
      title: "Registrar contacto comercial",
      description: `No hay interaccion visible hace ${daysSinceLastContact} dias. Conviene retomar contacto.`,
      tone: "warning" as const,
    }] : []),
    ...(reorderSuggestions.length > 0 ? [{
      title: "Ofrecer recompra sugerida",
      description: `${reorderSuggestions.length} SKU(s) muestran ventana de recompra o reposicion comercial.`,
      tone: "outline" as const,
    }] : []),
  ].slice(0, 5);

  const supportSummary: SupportSummary = useMemo(() => {
    const priorityRank = { urgent: 0, high: 1, medium: 2, low: 3 } as const;
    const slaTargets = { urgent: 4, high: 8, medium: 24, low: 48 } as const;
    const sortedActive = [...activeTickets].sort((a, b) => {
      const rankDiff = priorityRank[a.priority] - priorityRank[b.priority];
      if (rankDiff !== 0) return rankDiff;
      return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
    });
    const critical = sortedActive[0];
    if (!critical) {
      return {
        openTickets: 0,
        activeRmas: activeRmas.length,
        slaLabel: "Sin casos abiertos",
        slaTone: "success",
      };
    }
    const elapsedHours = (Date.now() - new Date(critical.updated_at).getTime()) / (1000 * 60 * 60);
    const target = slaTargets[critical.priority];
    const healthy = elapsedHours <= target;
    return {
      openTickets: activeTickets.length,
      activeRmas: activeRmas.length,
      slaLabel: healthy ? `En SLA · ${critical.priority}` : `Comprometido · ${critical.priority}`,
      slaTone: healthy ? "success" : elapsedHours <= target * 1.5 ? "warning" : "destructive",
      latestSubject: critical.subject,
      latestUpdatedLabel: `Actualizado ${fmtRelativeDate(critical.updated_at)}`,
    };
  }, [activeRmas.length, activeTickets]);

  const timelineItems: TimelineItem[] = useMemo(() => {
    const items: TimelineItem[] = [
      ...clientOrders.map((order) => ({
        id: `order-${order.id}`,
        kind: "pedido" as const,
        title: `${order.status === "approved" ? "Pedido aprobado" : "Pedido registrado"} ${order.order_number || `#${String(order.id).slice(-6).toUpperCase()}`}`,
        detail: `${order.products?.length ?? 0} producto(s) · ${formatPrice(order.total)}`,
        at: order.created_at,
        relative: fmtRelativeDate(order.created_at),
        tone: (order.status === "approved" ? "success" : "outline") as TimelineItem["tone"],
      })),
      ...quotes.map((quote) => ({
        id: `quote-${quote.id}`,
        kind: "cotizacion" as const,
        title: `Cotizacion ${quote.status} COT-${String(quote.id).padStart(4, "0")}`,
        detail: `${quote.currency} · ${formatPrice(quote.total)}`,
        at: quote.updated_at ?? quote.created_at,
        relative: fmtRelativeDate(quote.updated_at ?? quote.created_at),
        tone: (
          quote.status === "approved" || quote.status === "converted"
            ? "success"
            : quote.status === "rejected" || quote.status === "expired"
              ? "destructive"
              : "warning"
        ) as TimelineItem["tone"],
      })),
      ...notes.map((note) => ({
        id: `note-${note.id}`,
        kind: "nota" as const,
        title: `${note.tipo.charAt(0).toUpperCase()}${note.tipo.slice(1)} registrada`,
        detail: note.body,
        at: note.created_at,
        relative: fmtRelativeDate(note.created_at),
        tone: (note.tipo === "alerta" ? "warning" : "outline") as TimelineItem["tone"],
      })),
      ...activityLogs.map((log) => ({
        id: `activity-${log.id}`,
        kind: "actividad" as const,
        title: (ACTION_CONFIG[log.action]?.label ?? log.action).replace(/^\w/, (char) => char.toUpperCase()),
        detail: typeof log.metadata?.name === "string" ? log.metadata.name : "Interaccion registrada en la cuenta",
        at: log.created_at,
        relative: fmtRelativeDate(log.created_at),
        tone: "muted" as const,
      })),
      ...supportTickets.map((ticket) => ({
        id: `ticket-${ticket.id}`,
        kind: "ticket" as const,
        title: `Ticket ${ticket.status}: ${ticket.subject}`,
        detail: `${ticket.priority} · ${ticket.category}`,
        at: ticket.updated_at,
        relative: fmtRelativeDate(ticket.updated_at),
        tone: (ticket.status === "resolved" || ticket.status === "closed" ? "success" : "warning") as TimelineItem["tone"],
      })),
      ...rmaRequests.map((rma) => ({
        id: `rma-${rma.id}`,
        kind: "rma" as const,
        title: `RMA ${rma.status}: ${rma.rma_number}`,
        detail: rma.description || "Solicitud de postventa",
        at: rma.updated_at,
        relative: fmtRelativeDate(rma.updated_at),
        tone: (rma.status === "resolved" ? "success" : rma.status === "rejected" ? "destructive" : "warning") as TimelineItem["tone"],
      })),
    ];
    return items
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 12);
  }, [activityLogs, clientOrders, formatPrice, notes, quotes, rmaRequests, supportTickets]);

  const identityFields = [
    { label: "Empresa", value: client.company_name || "Sin empresa" },
    { label: "Contacto principal", value: client.contact_name || "Sin contacto" },
    { label: "Estado de cuenta", value: extProfile?.estado || (client.active === false ? "inactivo" : "activo") },
    { label: "Razon social", value: extProfile?.razon_social || "No registrada" },
    { label: "CUIT", value: extProfile?.cuit || "No registrado" },
    { label: "Condiciones comerciales", value: extProfile ? `${extProfile.precio_lista || "standard"} · ${extProfile.payment_terms || 0} dias` : `${CLIENT_TYPE_LABELS[client.client_type]} · ${client.default_margin}%` },
  ];

  const locationLabel = [extProfile?.direccion, extProfile?.ciudad, extProfile?.provincia].filter(Boolean).join(" · ") || undefined;

  return (
    <div className="flex min-w-0 flex-col gap-2 pb-2">

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className={`md:hidden transition p-1 ${dk("text-[#737373] hover:text-white", "text-[#737373] hover:text-[#171717]")}`}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Cliente seleccionado</p>
            <p className={`text-[13px] font-medium ${dk("text-white", "text-[#171717]")}`}>{client.company_name || client.contact_name || "Sin empresa"}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {(isAdmin || isSeller) && (
            <button
              onClick={() => isCurrentImpersonated ? stopImpersonation() : startImpersonation(client.id)}
              className={`flex items-center gap-1.5 text-[11px] font-bold transition px-2.5 py-1.5 rounded-lg border ${
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
              className={`flex items-center gap-1.5 text-[11px] transition px-2.5 py-1.5 rounded-lg ${
                dk("text-[#737373] hover:text-white border border-[#1f1f1f] hover:border-[#2a2a2a]",
                   "text-[#737373] hover:text-[#171717] border border-[#e5e5e5] hover:border-[#d4d4d4]")
              }`}
            >
              <Pencil size={11} /> Editar datos
            </button>
          )}
        </div>
      </div>

      <Client360Header
        accountName={client.company_name || "Sin empresa"}
        contactName={client.contact_name || "Sin contacto principal"}
        segmentLabel={CLIENT_TYPE_LABELS[client.client_type]}
        marginLabel={`${client.default_margin}%`}
        scoreLabel={`${commercialScore}/100`}
        scoreTone={commercialScoreBand.tone}
        lastContactLabel={fmtRelativeDate(lastContactAt)}
        commercialStatusLabel={commercialStatus.label}
        commercialStatusTone={commercialStatus.tone}
        tags={clientTags}
        executiveOptions={sellers}
        selectedExecutiveId={editAssignedSeller}
        onExecutiveChange={setEditAssignedSeller}
        onSaveExecutive={() => void handleSaveExecutive()}
        executiveDirty={executiveDirty}
        savingExecutive={savingExecutive}
        onQuickCreateOrder={handleQuickCreateOrder}
        onQuickCreateQuote={handleQuickCreateQuote}
        onQuickAddNote={() => focusNoteComposer("nota")}
        onQuickRegisterContact={() => focusNoteComposer("llamada")}
      />

      {editing && (
        <SurfaceCard tone="subtle" padding="lg" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Ajustes comerciales</p>
              <h3 className="font-display text-2xl font-semibold tracking-tight text-foreground">Datos editables de la cuenta</h3>
            </div>
          </div>
          <div className="grid gap-3 xl:grid-cols-4">
            <div className="space-y-2 xl:col-span-2">
              <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Tipo de cliente</label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(CLIENT_TYPE_LABELS) as ClientType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
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
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Margen %</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={editMargin}
                  onChange={(e) => setEditMargin(e.target.value)}
                  className={`w-24 border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#2D9F6A] text-center font-mono transition ${
                    dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-white border-[#d4d4d4] text-[#171717]")
                  }`}
                />
                <span className="text-sm text-[#737373]">%</span>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Nivel partner</label>
              <select
                value={editPartnerLevel}
                onChange={(e) => setEditPartnerLevel(e.target.value as PartnerLevel)}
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
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 bg-[#2D9F6A] hover:bg-[#25835A] text-white text-xs font-bold px-3 py-1.5 rounded-lg transition disabled:opacity-50"
            >
              <Save size={12} /> {saving ? "Guardando..." : "Guardar cambios"}
            </button>
            <button
              onClick={() => setEditing(false)}
              className={`text-xs transition px-3 py-1.5 rounded-lg ${dk("text-[#737373] hover:text-white hover:bg-[#1a1a1a]", "text-[#737373] hover:text-[#171717] hover:bg-[#f0f0f0]")}`}
            >
              Cancelar
            </button>
          </div>
        </SurfaceCard>
      )}

      {/* Tab nav */}
      <div className={`flex gap-0.5 p-0.5 rounded-xl border ${dk("bg-[#0d0d0d] border-[#1f1f1f]", "bg-[#f5f5f5] border-[#e5e5e5]")}`}>
        {DETAIL_TABS.map(({ id: tid, label, icon: Icon }) => (
          <button
            key={tid}
            onClick={() => loadTab(tid)}
            className={`flex-1 flex items-center justify-center gap-1.5 text-[10px] py-1.5 rounded-lg transition font-medium ${
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
        <div className="space-y-2">
          {/* Metrics strip */}
          <ClientBusinessPanel
            metrics={businessMetrics}
            alerts={businessAlerts}
            reorderSuggestions={reorderSuggestions}
            frequentProducts={frequentProducts}
          />

          {/* 3-zone layout: identity | timeline | actions */}
          <div className="grid gap-2 xl:grid-cols-[240px_minmax(0,1fr)_308px] 2xl:grid-cols-[256px_minmax(0,1fr)_324px]">
            {/* Zone 1 — Identity */}
            <ClientIdentityRail
              accountName={client.company_name || "Sin empresa"}
              contactName={client.contact_name || "Sin contacto"}
              executiveName={executiveName}
              tags={clientTags}
              email={client.email || extProfile?.email}
              phone={client.phone || extProfile?.phone}
              location={locationLabel}
              fields={identityFields}
            />

            {/* Zone 2 — Unified Timeline (center) */}
            <ClientUnifiedTimeline items={timelineItems} />

            {/* Zone 3 — Actions & CRM (right) */}
            <ClientActionRail
              executiveName={executiveName}
              priorities={priorityActions}
              supportSummary={supportSummary}
              tickets={activeTickets.slice(0, 3).map((ticket) => ({
                id: ticket.id,
                subject: ticket.subject,
                status: ticket.status,
                priority: ticket.priority,
                updated_at: fmtRelativeDate(ticket.updated_at),
              }))}
              rmas={activeRmas.slice(0, 3)}
              noteType={noteType}
              noteBody={noteBody}
              onNoteTypeChange={setNoteType}
              onNoteBodyChange={setNoteBody}
              onAddNote={() => void handleAddNote()}
              savingNote={savingNote}
              notes={notes}
              timelineItems={timelineItems}
              noteTextareaRef={noteTextareaRef}
              hideTimeline
            />
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
                    {m.monto >= 0 ? "+" : ""}{formatPrice(m.monto, "ARS")}
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

      {showCreateOrder && (
        <CreateOrderModal
          clients={[client]}
          products={products}
          initialClientId={client.id}
          isDark={isDark}
          onClose={() => setShowCreateOrder(false)}
          onCreated={async () => {
            await onRefreshOrders?.();
            await loadOverviewData(true);
          }}
        />
      )}

      {showCreateQuote && (
        <CreateQuoteModal
          clients={[client]}
          products={products}
          initialClientId={client.id}
          isDark={isDark}
          onClose={() => setShowCreateQuote(false)}
          onCreated={async () => {
            await loadQuotes();
            await loadOverviewData(true);
          }}
        />
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
  const { formatPrice } = useCurrency();
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
              {formatPrice(creditUsed, "ARS")} / {formatPrice(creditLimit, "ARS")} - {usagePct.toFixed(0)}%
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
    tax_status:   profile.tax_status ?? "no_especificado",
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
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-widest text-[#525252] mb-1 block">Condicion fiscal</label>
          <select
            value={form.tax_status}
            onChange={(e) => setForm((prev) => ({ ...prev, tax_status: e.target.value as ProfileTaxStatus }))}
            className={`w-full border rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[#2D9F6A]/40 transition ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-white border-[#d4d4d4] text-[#171717]")}`}
          >
            {TAX_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
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
export function ClientCRM({ clients, orders, products, loading, isDark, selectedClientId, onSave, onNewClient, onNewSeller, onRefreshClients, onRefreshOrders }: ClientCRMProps) {
  const dk = (d: string, l: string) => isDark ? d : l;
  const [search, setSearch]       = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("active");
  const [activating, setActivating] = useState<string | null>(null);

  const inactiveCount = useMemo(() => clients.filter((c) => c.active === false).length, [clients]);

  useEffect(() => {
    if (selectedClientId && clients.some((client) => client.id === selectedClientId)) {
      setSelectedId(selectedClientId);
    }
  }, [clients, selectedClientId]);

  useEffect(() => {
    if (selectedId && !clients.some((client) => client.id === selectedId)) {
      setSelectedId(null);
    }
  }, [clients, selectedId]);

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
      <div className="w-full space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={`h-16 ${dk("bg-[#111] border-[#1a1a1a]", "bg-[#f0f0f0] border-[#e5e5e5]")} rounded-xl animate-pulse border`} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-104px)] w-full gap-2 overflow-hidden px-3 pb-3 xl:px-4">

      {/* -- LEFT: Client list -- */}
      <div className={`flex h-full flex-col gap-2 ${selected ? "hidden md:flex w-[272px] shrink-0" : "flex w-full md:w-[272px] md:shrink-0"}`}>

        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-[#525252] font-semibold">
            {filtered.length} cliente{filtered.length !== 1 ? "s" : ""}
          </p>
          <div className="flex items-center gap-1.5">
            {onNewSeller ? (
              <button
                onClick={onNewSeller}
                className={`flex items-center gap-1.5 border px-2.5 py-1.5 text-[11px] font-semibold rounded-lg transition ${
                  dk("border-[#1f1f1f] bg-[#111] text-[#d4d4d4] hover:bg-[#161616]", "border-[#e5e5e5] bg-white text-[#404040] hover:bg-[#fafafa]")
                }`}
              >
                <UserPlus size={11} /> Vendedor
              </button>
            ) : null}
            <button
              onClick={onNewClient}
              className="flex items-center gap-1.5 bg-[#2D9F6A] hover:bg-[#25835A] text-white text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition"
            >
              <UserPlus size={11} /> Cliente
            </button>
          </div>
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
            className={`w-full border rounded-xl pl-8 pr-3 py-2 text-[13px] placeholder:text-[#525252] outline-none focus:border-[#2D9F6A]/40 transition ${
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
              {!search && statusFilter === "active" && clients.length === 0 ? (
                <p className="max-w-[220px] text-center text-[11px] leading-relaxed text-[#737373]">
                  Todavia no hay perfiles de cliente creados. Las altas B2B pendientes se gestionan desde "Altas B2B".
                </p>
              ) : null}
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
      <div className={`min-w-0 flex-1 overflow-y-auto pr-1 ${selected ? "flex h-full flex-col" : "hidden md:flex md:h-full md:flex-col"}`}>
        {selected ? (
          <ClientDetail
            client={selected}
            orders={orders}
            products={products}
            isDark={isDark}
            onSave={onSave}
            onBack={() => setSelectedId(null)}
            onRefreshOrders={onRefreshOrders}
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

