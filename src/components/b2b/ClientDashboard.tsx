/**
 * ClientDashboard — Home del portal B2B
 * Muestra saldo, crédito, próximo vencimiento y último pedido en un pantallazo.
 */
import { useMemo, useState } from "react";
import {
  ShoppingCart, FileText, CreditCard, AlertTriangle,
  CheckCircle2, Clock, Package, TrendingUp, ArrowRight,
  CalendarClock, Wallet, ReceiptText, RefreshCw,
} from "lucide-react";
import type { PortalOrder } from "@/hooks/useOrders";
import type { Invoice } from "@/lib/api/invoices";
import type { UserProfile } from "@/lib/supabase";
import { ShoppingBag, Truck, Bell, ChevronRight, Projector, MapPin } from "lucide-react";
import { createShippingLabel, type CarrierId } from "@/lib/api/carriers";
import { formatMoneyAmount, getEffectiveInvoiceAmounts, convertMoneyAmount } from "@/lib/money";
import { useCurrency } from "@/context/CurrencyContext";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  Plus, Download, Sparkles, MessageSquare, Briefcase, Zap, ShieldCheck, 
  ArrowUpRight, Info, AlertCircle, Bookmark, FileStack
} from "lucide-react";

import type { Product } from "@/models/products";
import { SmartSuggestions } from "./SmartSuggestions";
import type { ClientProject } from "@/hooks/useClientProjects";
import type { BusinessAlert } from "@/hooks/useBusinessAlerts";

export interface AssignedSeller {
  id: string;
  name: string;
  phone?: string;
}

interface ClientDashboardProps {
  profile: UserProfile;
  orders: PortalOrder[];
  invoices: Invoice[];
  products: Product[];
  creditLimit: number;
  creditUsed: number;
  isDark: boolean;
  onGoTo: (tab: "catalog" | "orders" | "invoices" | "cuenta") => void;
  onAddToCart: (product: Product, qty: number) => void;
  // New dynamic props (optional for backward compat)
  projects?: ClientProject[];
  onCreateProject?: (name: string, color?: string) => Promise<void>;
  alerts?: BusinessAlert[];
  assignedSeller?: AssignedSeller | null;
}

// ── Helpers ───────────────────────────────────────────────────

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending:          "Pendiente",
  pending_approval: "En revisión",
  approved:         "Aprobado",
  preparing:        "Preparando",
  shipped:          "Enviado",
  dispatched:       "Despachado",
  delivered:        "Entregado",
  rejected:         "Rechazado",
};

const ORDER_STATUS_COLOR: Record<string, string> = {
  pending:          "text-amber-400 bg-amber-500/10 border-amber-500/20",
  pending_approval: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  approved:         "text-[#2D9F6A] bg-[#2D9F6A]/10 border-[#2D9F6A]/20",
  preparing:        "text-blue-400 bg-blue-500/10 border-blue-500/20",
  shipped:          "text-purple-400 bg-purple-500/10 border-purple-500/20",
  dispatched:       "text-purple-400 bg-purple-500/10 border-purple-500/20",
  delivered:        "text-[#2D9F6A] bg-[#2D9F6A]/10 border-[#2D9F6A]/20",
  rejected:         "text-red-400 bg-red-500/10 border-red-500/20",
};

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

// ── Component ─────────────────────────────────────────────────

// ── Partner level helpers ─────────────────────────────────────

type PartnerLevel = "cliente" | "silver" | "gold" | "platinum";

const PARTNER_LEVEL_LABEL: Record<PartnerLevel, string> = {
  cliente:  "Cliente",
  silver:   "Silver",
  gold:     "Gold",
  platinum: "Platinum",
};

const PARTNER_LEVEL_COLOR: Record<PartnerLevel, string> = {
  cliente:  "bg-emerald-500/10 text-emerald-400",
  silver:   "bg-gray-500/10 text-gray-300",
  gold:     "bg-yellow-500/10 text-yellow-400",
  platinum: "bg-purple-500/10 text-purple-400",
};

const ALERT_ICON_MAP: Record<string, typeof AlertCircle> = {
  invoice:   AlertCircle,
  rma:       ShieldCheck,
  promotion: Bookmark,
  info:      Info,
  warning:   AlertCircle,
};

const ALERT_COLOR_MAP: Record<string, string> = {
  invoice:   "text-amber-400",
  rma:       "text-primary",
  promotion: "text-blue-400",
  info:      "text-sky-400",
  warning:   "text-red-400",
};

export function ClientDashboard({
  profile,
  orders,
  invoices,
  products,
  creditLimit,
  creditUsed,
  isDark,
  onGoTo,
  onAddToCart,
  projects = [],
  onCreateProject,
  alerts = [],
  assignedSeller,
}: ClientDashboardProps) {
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectColor, setNewProjectColor] = useState("blue");
  const [creatingProject, setCreatingProject] = useState(false);
  const dk = (d: string, l: string) => isDark ? d : l;
  const { currency, exchangeRate } = useCurrency();

  // ── Derived data ──────────────────────────────────────────────

  const activeOrders = useMemo(() =>
    orders.filter(o => !["delivered", "rejected"].includes(o.status)),
    [orders]
  );

  const lastOrder = orders[0] ?? null;

  const pendingInvoices = useMemo(() =>
    invoices.filter(i => ["sent", "overdue", "draft"].includes(i.status)),
    [invoices]
  );

  const overdueInvoices = useMemo(() =>
    invoices.filter(i => i.status === "overdue" ||
      (i.status === "sent" && i.due_date && daysUntil(i.due_date) < 0)),
    [invoices]
  );

  const nextDueInvoice = useMemo(() => {
    const upcoming = pendingInvoices
      .filter(i => i.due_date)
      .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime());
    return upcoming[0] ?? null;
  }, [pendingInvoices]);

  const pendingDebt = useMemo(() =>
    pendingInvoices.reduce((sum, inv) => {
      const eff = getEffectiveInvoiceAmounts(inv, exchangeRate.rate);
      return sum + convertMoneyAmount(eff.total, eff.currency, currency, exchangeRate.rate);
    }, 0),
    [pendingInvoices, currency, exchangeRate.rate]
  );

  const overdueDebt = useMemo(() =>
    overdueInvoices.reduce((sum, inv) => {
      const eff = getEffectiveInvoiceAmounts(inv, exchangeRate.rate);
      return sum + convertMoneyAmount(eff.total, eff.currency, currency, exchangeRate.rate);
    }, 0),
    [overdueInvoices, currency, exchangeRate.rate]
  );

  // credit_limit and credit_used are stored in ARS — convert to display currency
  const creditAvailableARS = creditLimit > 0 ? Math.max(0, creditLimit - creditUsed) : null;
  const creditAvailable = creditAvailableARS !== null
    ? convertMoneyAmount(creditAvailableARS, "ARS", currency, exchangeRate.rate)
    : null;
  const creditPct = creditLimit > 0 ? Math.min(100, (creditUsed / creditLimit) * 100) : 0;

  // ── Spending analytics ────────────────────────────────────────

  const spendingStats = useMemo(() => {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1).getTime();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const delivered = orders.filter(o => o.status === "delivered");
    const ytd   = delivered.filter(o => new Date(o.created_at).getTime() >= yearStart);
    const month = delivered.filter(o => new Date(o.created_at).getTime() >= monthStart);

    const ytdTotal   = ytd.reduce((s, o) => s + (o.total ?? 0), 0);
    const monthTotal = month.reduce((s, o) => s + (o.total ?? 0), 0);
    const avgOrder   = ytd.length > 0 ? ytdTotal / ytd.length : 0;

    // Last 6 months buckets for sparkline
    const buckets: number[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1).getTime();
      const start = d.getTime();
      const total = delivered
        .filter(o => {
          const t = new Date(o.created_at).getTime();
          return t >= start && t < end;
        })
        .reduce((s, o) => s + (o.total ?? 0), 0);
      buckets.push(total);
    }

    const maxBucket = Math.max(...buckets, 1);

    return { ytdTotal, monthTotal, avgOrder, buckets, maxBucket, ytdCount: ytd.length };
  }, [orders]);

  // ── KPI Cards ─────────────────────────────────────────────────

  const kpis = [
    {
      label: "Pedidos activos",
      value: String(activeOrders.length),
      sub: activeOrders.length > 0 ? `Último: ${ORDER_STATUS_LABEL[activeOrders[0]?.status] ?? activeOrders[0]?.status}` : "Sin pedidos en curso",
      icon: ShoppingCart,
      accent: "text-[#2D9F6A]",
      iconBg: "bg-[#2D9F6A]/10",
      onClick: () => onGoTo("orders"),
    },
    {
      label: "Deuda pendiente",
      value: formatMoneyAmount(pendingDebt, currency, 0),
      sub: `${pendingInvoices.length} factura${pendingInvoices.length !== 1 ? "s" : ""} por cobrar`,
      icon: ReceiptText,
      accent: pendingDebt > 0 ? "text-amber-400" : "text-[#2D9F6A]",
      iconBg: pendingDebt > 0 ? "bg-amber-500/10" : "bg-[#2D9F6A]/10",
      onClick: () => onGoTo("invoices"),
    },
    {
      label: "Crédito disponible",
      value: creditAvailable !== null ? formatMoneyAmount(creditAvailable, currency, 0) : "Sin límite",
      sub: creditLimit > 0
        ? `Usado: ${formatMoneyAmount(convertMoneyAmount(creditUsed, "ARS", currency, exchangeRate.rate), currency, 0)} de ${formatMoneyAmount(convertMoneyAmount(creditLimit, "ARS", currency, exchangeRate.rate), currency, 0)}`
        : "Cuenta sin límite de crédito asignado",
      icon: Wallet,
      accent: creditAvailable !== null && creditPct > 80 ? "text-red-400" : "text-emerald-400",
      iconBg: creditAvailable !== null && creditPct > 80 ? "bg-red-500/10" : "bg-emerald-500/10",
      onClick: () => onGoTo("cuenta"),
    },
    {
      label: "Próximo vencimiento",
      value: nextDueInvoice?.due_date
        ? new Date(nextDueInvoice.due_date).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })
        : "Sin alertas",
      sub: nextDueInvoice?.due_date
        ? daysUntil(nextDueInvoice.due_date) <= 0
          ? "Vence hoy o ya venció"
          : `En ${daysUntil(nextDueInvoice.due_date)} día${daysUntil(nextDueInvoice.due_date) !== 1 ? "s" : ""}`
        : "Todas las facturas al día",
      icon: CalendarClock,
      accent: nextDueInvoice?.due_date && daysUntil(nextDueInvoice.due_date) <= 3 ? "text-red-400" : "text-blue-400",
      iconBg: nextDueInvoice?.due_date && daysUntil(nextDueInvoice.due_date) <= 3 ? "bg-red-500/10" : "bg-blue-500/10",
      onClick: () => onGoTo("invoices"),
    },
  ];

  const currentTime = new Date().getHours();
  const greeting = currentTime < 12 ? "Buenos días" : currentTime < 20 ? "Buenas tardes" : "Buenas noches";

  return (
    <div className="space-y-8 max-w-6xl animate-in fade-in duration-700">
      {/* Upper Banner: Greeting + Business Context */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
             <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${PARTNER_LEVEL_COLOR[(profile.partner_level as PartnerLevel) ?? "cliente"]}`}>
               Partner Nivel {PARTNER_LEVEL_LABEL[(profile.partner_level as PartnerLevel) ?? "cliente"]}
             </span>
             <span className="w-1 h-1 rounded-full bg-white/20" />
             <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">ID: BTZ-{profile.id.slice(0,6).toUpperCase()}</span>
          </div>
          <h2 className={`text-3xl font-display font-black tracking-tighter ${dk("text-white", "text-[#171717]")}`}>
            {greeting}, {profile.contact_name?.split(' ')[0] || profile.company_name}
          </h2>
          <p className="text-sm text-[#737373] mt-0.5 flex items-center gap-2">
            Tu centro de mando tecnológico · {new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
           <Button onClick={() => onGoTo("catalog")} variant="outline" className={`h-11 rounded-2xl gap-2 font-bold px-5 border-white/5 ${dk("bg-white/5 hover:bg-white/10", "bg-gray-100/50 hover:bg-gray-200/50")}`}>
              <Download size={16} /> Lista de Precios
           </Button>
           <Button onClick={() => onGoTo("catalog")} className="h-11 rounded-2xl gap-2 font-bold px-6 bg-gradient-primary shadow-lg shadow-primary/20">
              <Plus size={18} /> Nueva Compra
           </Button>
        </div>
      </div>

      {/* IA Predictiva + Proyectos + Alertas */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
           <div className="space-y-6">
              {orders.length > 0 && (
                <SmartSuggestions
                  orders={orders}
                  products={products}
                  onAddToCart={onAddToCart}
                  isDark={isDark}
                />
              )}

              {/* Projects Quick Access */}
              <div className={`p-6 rounded-[28px] border overflow-hidden relative group ${dk("bg-[#0d0d0d] border-white/5", "bg-white border-black/5 shadow-sm")}`}>
                 <div className="absolute right-0 top-0 p-8 opacity-5 -rotate-12">
                    <Briefcase size={80} />
                 </div>
                 <div className="flex items-center justify-between mb-5 relative z-10">
                    <div className="flex items-center gap-2">
                       <FileStack size={16} className="text-primary" />
                       <h3 className="text-sm font-bold uppercase tracking-widest">Mis Carpetas de Proyecto</h3>
                    </div>
                    <button onClick={() => onGoTo("projects" as any)} className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1">
                       Administrar Proyectos <ArrowUpRight size={12} />
                    </button>
                 </div>
                 <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar relative z-10">
                    {projects.length === 0 ? (
                      <div className="flex items-center gap-3">
                        <p className="text-xs text-muted-foreground">Sin proyectos</p>
                        {onCreateProject && (
                          <button
                            onClick={() => setShowCreateProject(true)}
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            <Plus size={12} /> Crear proyecto
                          </button>
                        )}
                      </div>
                    ) : (
                      <>
                        {projects.map(p => {
                          const colorMap: Record<string, string> = {
                            blue:   "bg-blue-500/10 border-blue-500/20 text-blue-400",
                            amber:  "bg-amber-500/10 border-amber-500/20 text-amber-400",
                            green:  "bg-primary/10 border-primary/20 text-primary",
                            purple: "bg-purple-500/10 border-purple-500/20 text-purple-400",
                            red:    "bg-red-500/10 border-red-500/20 text-red-400",
                          };
                          const colorCls = colorMap[p.color] ?? colorMap.blue;
                          return (
                            <button key={p.id} className={`flex-shrink-0 px-4 py-3 rounded-2xl border ${colorCls} transition hover:scale-105 active:scale-95`}>
                               <p className="text-xs font-bold whitespace-nowrap">{p.name}</p>
                               <p className="text-[9px] opacity-70 mt-0.5">{p.item_count} ítems agrupados</p>
                            </button>
                          );
                        })}
                        {onCreateProject && (
                          <button
                            onClick={() => setShowCreateProject(true)}
                            className="flex-shrink-0 px-4 py-3 rounded-2xl border border-dashed border-white/10 text-muted-foreground hover:border-primary/30 hover:text-primary transition text-xs"
                          >
                            <Plus size={12} className="mx-auto mb-1" />
                            <span className="whitespace-nowrap">Nuevo</span>
                          </button>
                        )}
                      </>
                    )}
                 </div>
                 {showCreateProject && onCreateProject && (
                   <div className="mt-3 flex gap-2 items-center relative z-10">
                     <input
                       className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs placeholder:text-muted-foreground"
                       placeholder="Nombre del proyecto"
                       value={newProjectName}
                       onChange={e => setNewProjectName(e.target.value)}
                       onKeyDown={async e => {
                         if (e.key === "Enter" && newProjectName.trim()) {
                           setCreatingProject(true);
                           try {
                             await onCreateProject(newProjectName.trim(), newProjectColor);
                             setNewProjectName("");
                             setShowCreateProject(false);
                           } finally {
                             setCreatingProject(false);
                           }
                         }
                       }}
                       autoFocus
                     />
                     <select
                       className="rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 text-xs"
                       value={newProjectColor}
                       onChange={e => setNewProjectColor(e.target.value)}
                     >
                       {["blue","amber","green","purple","red"].map(c => (
                         <option key={c} value={c}>{c}</option>
                       ))}
                     </select>
                     <Button
                       size="sm"
                       disabled={creatingProject || !newProjectName.trim()}
                       onClick={async () => {
                         setCreatingProject(true);
                         try {
                           await onCreateProject(newProjectName.trim(), newProjectColor);
                           setNewProjectName("");
                           setShowCreateProject(false);
                         } finally {
                           setCreatingProject(false);
                         }
                       }}
                       className="rounded-xl text-xs h-8 px-3"
                     >
                       {creatingProject ? "..." : "Crear"}
                     </Button>
                     <button onClick={() => setShowCreateProject(false)} className="text-muted-foreground hover:text-white text-xs">✕</button>
                   </div>
                 )}
              </div>
           </div>

           {/* Sidebar: Smart Alerts Feed */}
           <div className={`rounded-[28px] border p-5 space-y-5 h-fit ${dk("bg-[#0d0d0d] border-white/5", "bg-white border-black/5")}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Alertas de Negocio</h3>
                <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              </div>
              
              <div className="space-y-4">
                 {alerts.length === 0 ? (
                   <p className="text-xs text-muted-foreground py-2">Sin alertas activas</p>
                 ) : (
                   alerts.map(alert => {
                     const AlertIcon = ALERT_ICON_MAP[alert.type] ?? AlertCircle;
                     const alertColor = ALERT_COLOR_MAP[alert.type] ?? "text-muted-foreground";
                     return (
                       <div key={alert.id} className="flex gap-3 group cursor-pointer hover:translate-x-1 transition-transform">
                          <div className={`w-8 h-8 rounded-xl ${dk("bg-white/5", "bg-gray-100")} flex items-center justify-center shrink-0`}>
                             <AlertIcon size={14} className={alertColor} />
                          </div>
                          <div className="min-w-0">
                             <p className="text-[11px] font-bold leading-tight group-hover:text-primary transition-colors">{alert.title}</p>
                             {alert.subtitle && <p className="text-[10px] text-muted-foreground">{alert.subtitle}</p>}
                          </div>
                       </div>
                     );
                   })
                 )}
              </div>
              
              <div className={`mt-6 pt-6 border-t ${dk("border-white/5", "border-black/5")}`}>
                 <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">Soporte Concierge</p>
                 {(() => {
                   const sellerName = assignedSeller?.name ?? "Bartez Soporte";
                   const waNumber = assignedSeller?.phone
                     ? assignedSeller.phone.replace(/\D/g, "")
                     : "5491100000000";
                   const waUrl = `https://wa.me/${waNumber}`;
                   return (
                     <a href={waUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 bg-white/5 p-3 rounded-2xl group hover:bg-white/10 transition cursor-pointer">
                        <img src={`https://i.pravatar.cc/150?u=${sellerName}`} alt={sellerName} className="w-10 h-10 rounded-full border border-primary/30" />
                        <div className="flex-1 min-w-0">
                           <p className="text-xs font-bold truncate">{sellerName}</p>
                           <p className="text-[9px] text-[#2D9F6A] font-bold">
                             {assignedSeller ? "Vendedor asignado · WhatsApp Directo" : "Soporte Bartez · WhatsApp"}
                           </p>
                        </div>
                        <MessageSquare size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
                     </a>
                   );
                 })()}
              </div>
           </div>
        </div>

      {/* Alerta deuda vencida */}
      {overdueInvoices.length > 0 && (
        <button
          onClick={() => onGoTo("invoices")}
          className="w-full flex items-center gap-3 px-5 py-4 rounded-[24px] border border-red-500/30 bg-red-500/8 text-left hover:bg-red-500/12 transition group shadow-lg shadow-red-500/5"
        >
          <div className="w-10 h-10 rounded-2xl bg-red-500/20 flex items-center justify-center shrink-0">
            <AlertCircle size={18} className="text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-red-400">
              Urgente: {overdueInvoices.length} factura{overdueInvoices.length !== 1 ? "s" : ""} fuera de término
            </p>
            <p className="text-xs text-red-500/60 font-medium">
              Tu servicio podría verse interrumpido. Deuda acumulada: {formatMoneyAmount(overdueDebt, currency, 0)}
            </p>
          </div>
          <ArrowRight size={16} className="text-red-400 group-hover:translate-x-1 transition-transform" />
        </button>
      )}

      {/* Spending analytics widget */}
      {spendingStats.ytdCount > 0 && (
        <div className={`rounded-xl border p-4 ${dk("border-[#1f1f1f] bg-[#0d0d0d]", "border-[#e5e5e5] bg-white")}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3 flex-1">
              <p className={`text-[10px] font-bold uppercase tracking-widest ${dk("text-[#525252]", "text-[#a3a3a3]")}`}>
                Resumen de cuenta · {new Date().getFullYear()}
              </p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className={`text-lg font-bold ${dk("text-white", "text-[#171717]")}`}>
                    {formatMoneyAmount(convertMoneyAmount(spendingStats.ytdTotal, "ARS", currency, exchangeRate.rate), currency, 0)}
                  </p>
                  <p className={`text-[10px] mt-0.5 ${dk("text-[#737373]", "text-[#a3a3a3]")}`}>Total comprado este año</p>
                </div>
                <div>
                  <p className={`text-lg font-bold text-[#2D9F6A]`}>
                    {formatMoneyAmount(convertMoneyAmount(spendingStats.monthTotal, "ARS", currency, exchangeRate.rate), currency, 0)}
                  </p>
                  <p className={`text-[10px] mt-0.5 ${dk("text-[#737373]", "text-[#a3a3a3]")}`}>Este mes</p>
                </div>
                <div>
                  <p className={`text-lg font-bold ${dk("text-white", "text-[#171717]")}`}>
                    {formatMoneyAmount(convertMoneyAmount(spendingStats.avgOrder, "ARS", currency, exchangeRate.rate), currency, 0)}
                  </p>
                  <p className={`text-[10px] mt-0.5 ${dk("text-[#737373]", "text-[#a3a3a3]")}`}>Ticket promedio</p>
                </div>
              </div>
            </div>
            {/* Mini sparkline */}
            <div className="flex items-end gap-[3px] h-10 shrink-0 pr-1">
              {spendingStats.buckets.map((v, i) => {
                const pct = spendingStats.maxBucket > 0 ? Math.max(4, (v / spendingStats.maxBucket) * 100) : 4;
                const isLast = i === spendingStats.buckets.length - 1;
                return (
                  <div
                    key={i}
                    title={formatMoneyAmount(v, "ARS", 0)}
                    style={{ height: `${pct}%` }}
                    className={`w-3 rounded-sm transition-all ${isLast ? "bg-[#2D9F6A]" : dk("bg-white/10", "bg-black/10")}`}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map(kpi => {
          const Icon = kpi.icon;
          return (
            <button
              key={kpi.label}
              onClick={kpi.onClick}
              className={`rounded-xl border p-4 text-left group transition hover:border-[#2D9F6A]/30 ${dk("border-[#1f1f1f] bg-[#0d0d0d] hover:bg-[#111]", "border-[#e5e5e5] bg-white hover:bg-[#fafafa]")}`}
            >
              <div className={`inline-flex p-2 rounded-lg mb-3 ${kpi.iconBg}`}>
                <Icon size={14} className={kpi.accent} />
              </div>
              <p className={`text-lg font-bold leading-tight ${kpi.accent}`}>{kpi.value}</p>
              <p className={`text-[10px] font-semibold mt-1 uppercase tracking-wider ${dk("text-[#737373]", "text-[#a3a3a3]")}`}>{kpi.label}</p>
              <p className={`text-[10px] mt-1 ${dk("text-[#525252]", "text-[#a3a3a3]")}`}>{kpi.sub}</p>
            </button>
          );
        })}
      </div>

      {/* Credit bar */}
      {creditLimit > 0 && (
        <div className={`rounded-xl border p-4 ${dk("border-[#1f1f1f] bg-[#0d0d0d]", "border-[#e5e5e5] bg-white")}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <CreditCard size={13} className="text-[#2D9F6A]" />
              <p className={`text-xs font-semibold ${dk("text-white", "text-[#171717]")}`}>Línea de crédito</p>
            </div>
            <p className={`text-xs ${dk("text-[#737373]", "text-[#a3a3a3]")}`}>
              {formatMoneyAmount(convertMoneyAmount(creditUsed, "ARS", currency, exchangeRate.rate), currency, 0)} usado de {formatMoneyAmount(convertMoneyAmount(creditLimit, "ARS", currency, exchangeRate.rate), currency, 0)}
            </p>
          </div>
          <div className={`h-2 rounded-full overflow-hidden ${dk("bg-[#1f1f1f]", "bg-[#f0f0f0]")}`}>
            <div
              className={`h-full rounded-full transition-all ${creditPct > 90 ? "bg-red-500" : creditPct > 70 ? "bg-amber-400" : "bg-[#2D9F6A]"}`}
              style={{ width: `${creditPct}%` }}
            />
          </div>
          <p className={`text-[10px] mt-1 ${dk("text-[#525252]", "text-[#a3a3a3]")}`}>
            {creditPct.toFixed(0)}% utilizado · Disponible: {formatMoneyAmount(convertMoneyAmount(Math.max(0, creditLimit - creditUsed), "ARS", currency, exchangeRate.rate), currency, 0)}
          </p>
        </div>
      )}

      {/* Two columns: último pedido + próximas facturas */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Último pedido */}
        <div className={`rounded-xl border p-4 space-y-3 ${dk("border-[#1f1f1f] bg-[#0d0d0d]", "border-[#e5e5e5] bg-white")}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package size={13} className="text-[#2D9F6A]" />
              <p className={`text-xs font-semibold ${dk("text-white", "text-[#171717]")}`}>Último pedido</p>
            </div>
            <button onClick={() => onGoTo("orders")} className="text-[10px] text-[#2D9F6A] hover:underline flex items-center gap-0.5">
              Ver todos <ArrowRight size={10} />
            </button>
          </div>
          {lastOrder ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className={`font-mono text-xs font-bold ${dk("text-white", "text-[#171717]")}`}>
                  {lastOrder.order_number ?? `#${String(lastOrder.id).slice(-6).toUpperCase()}`}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${ORDER_STATUS_COLOR[lastOrder.status] ?? "text-gray-400 bg-gray-500/10 border-gray-500/20"}`}>
                  {ORDER_STATUS_LABEL[lastOrder.status] ?? lastOrder.status}
                </span>
              </div>
              <p className={`text-xs ${dk("text-[#737373]", "text-[#525252]")}`}>
                {new Date(lastOrder.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
                {" · "}
                {formatMoneyAmount(lastOrder.total, currency, 0)}
              </p>
              
              {/* [LOGÍSTICA] Tracking Dinámico */}
              <div className="pt-2 border-t border-white/5">
                {lastOrder.status === "dispatched" || lastOrder.status === "delivered" ? (
                  <button 
                    onClick={async () => {
                      const numericId = typeof lastOrder.id === "string" ? parseInt(lastOrder.id.replace(/\D/g, "").slice(-8)) : lastOrder.id;
                      const carrierId: CarrierId = numericId % 2 === 0 ? "andreani" : "oca";
                      const tracking = await createShippingLabel(carrierId, String(lastOrder.id));
                      alert(`Tracking ${carrierId.toUpperCase()}: ${tracking}\nSu pedido está en curso.`);
                    }}
                    className="w-full flex items-center justify-between p-2 rounded-lg bg-blue-400/10 border border-blue-400/20 group hover:bg-blue-400/20 transition"
                  >
                    <div className="flex items-center gap-2">
                      <Truck size={14} className="text-blue-400" />
                      <span className="text-[10px] font-bold text-blue-400 uppercase">Seguimiento en tiempo real</span>
                    </div>
                    <ChevronRight size={12} className="text-blue-400 group-hover:translate-x-1 transition-transform" />
                  </button>
                ) : (
                  <div className={`p-2 rounded-lg border flex items-center gap-2 ${dk("bg-white/5 border-white/10", "bg-black/5 border-black/5")}`}>
                    <Clock size={12} className="text-gray-500" />
                    <span className="text-[10px] text-gray-500 font-medium">Estado: {ORDER_STATUS_LABEL[lastOrder.status] || "Procesando..."}</span>
                  </div>
                )}
              </div>

              {lastOrder.products?.length > 0 && (
                <p className={`text-[10px] mt-1 ${dk("text-[#525252]", "text-[#a3a3a3]")}`}>
                  {lastOrder.products.length} producto{lastOrder.products.length !== 1 ? "s" : ""}
                  {lastOrder.products[0]?.name ? ` · ${lastOrder.products[0].name}${lastOrder.products.length > 1 ? ` +${lastOrder.products.length - 1}` : ""}` : ""}
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <ShoppingCart size={20} className={`mx-auto mb-2 ${dk("text-[#404040]", "text-[#c0c0c0]")}`} />
              <p className={`text-xs ${dk("text-[#525252]", "text-[#a3a3a3]")}`}>Sin pedidos aún</p>
              <button onClick={() => onGoTo("catalog")} className="text-xs text-[#2D9F6A] mt-1 hover:underline">
                Ir al catálogo →
              </button>
            </div>
          )}
        </div>

        {/* Próximos vencimientos */}
        <div className={`rounded-xl border p-4 space-y-3 ${dk("border-[#1f1f1f] bg-[#0d0d0d]", "border-[#e5e5e5] bg-white")}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarClock size={13} className="text-blue-400" />
              <p className={`text-xs font-semibold ${dk("text-white", "text-[#171717]")}`}>Próximos vencimientos</p>
            </div>
            <button onClick={() => onGoTo("invoices")} className="text-[10px] text-[#2D9F6A] hover:underline flex items-center gap-0.5">
              Ver facturas <ArrowRight size={10} />
            </button>
          </div>
          {pendingInvoices.filter(i => i.due_date).length === 0 ? (
            <div className="text-center py-4">
              <CheckCircle2 size={20} className="mx-auto mb-2 text-[#2D9F6A]" />
              <p className={`text-xs ${dk("text-[#525252]", "text-[#a3a3a3]")}`}>Sin vencimientos próximos</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pendingInvoices
                .filter(i => i.due_date)
                .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
                .slice(0, 3)
                .map(inv => {
                  const days = daysUntil(inv.due_date!);
                  const isOverdue = days < 0;
                  const isUrgent = days >= 0 && days <= 3;
                  const eff = getEffectiveInvoiceAmounts(inv, exchangeRate.rate);
                  return (
                    <div key={inv.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${dk("bg-[#111]", "bg-[#f8f8f8]")}`}>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold truncate ${dk("text-white", "text-[#171717]")}`}>
                          {inv.invoice_number || `Factura ${inv.id.slice(-6)}`}
                        </p>
                        <p className={`text-[10px] ${isOverdue ? "text-red-400" : isUrgent ? "text-amber-400" : dk("text-[#737373]", "text-[#a3a3a3]")}`}>
                          {isOverdue ? `Vencida hace ${Math.abs(days)} día${Math.abs(days) !== 1 ? "s" : ""}` : days === 0 ? "Vence hoy" : `Vence en ${days} día${days !== 1 ? "s" : ""}`}
                        </p>
                      </div>
                      <p className={`text-xs font-semibold ${isOverdue ? "text-red-400" : dk("text-white", "text-[#171717]")}`}>
                        {formatMoneyAmount(convertMoneyAmount(eff.total, eff.currency, currency, exchangeRate.rate), currency, 0)}
                      </p>
                      {isOverdue && <AlertTriangle size={12} className="text-red-400 flex-shrink-0" />}
                      {isUrgent && !isOverdue && <Clock size={12} className="text-amber-400 flex-shrink-0" />}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className={`rounded-xl border p-4 ${dk("border-[#1f1f1f] bg-[#0d0d0d]", "border-[#e5e5e5] bg-white")}`}>
        <p className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${dk("text-[#525252]", "text-[#a3a3a3]")}`}>Accesos rápidos</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Ver catálogo",    icon: TrendingUp,  tab: "catalog"  as const },
            { label: "Mis pedidos",     icon: ShoppingCart,tab: "orders"   as const },
            { label: "Mis facturas",    icon: FileText,    tab: "invoices" as const },
            { label: "Mi cuenta",       icon: CreditCard,  tab: "cuenta"   as const },
          ].map(({ label, icon: Icon, tab }) => (
            <button
              key={tab}
              onClick={() => onGoTo(tab)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-medium transition ${dk("border-[#262626] text-[#a3a3a3] hover:text-white hover:border-[#2D9F6A]/40 hover:bg-[#111]", "border-[#e5e5e5] text-[#525252] hover:text-[#171717] hover:bg-[#f5f5f5]")}`}
            >
              <Icon size={12} className="text-[#2D9F6A]" />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
