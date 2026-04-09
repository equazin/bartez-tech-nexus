import { useMemo, useState, useEffect } from "react";
import { Quote, QuoteStatus } from "@/models/quote";
import { useCurrency } from "@/context/CurrencyContext";
import {
  TrendingUp, FileText, Clock, Target, ShoppingBag,
  CheckCircle2, XCircle, AlertTriangle, Send, Eye, Ban,
  ArrowUpRight, ArrowDownRight, Minus as MinusIcon,
  Package, Users, Trash2, Receipt, CreditCard, Zap,
  type LucideIcon,
} from "lucide-react";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell, PieChart, Pie, Legend
} from "recharts";
import { supabase } from "@/lib/supabase";
import { formatMoneyInPreferredCurrency, getEffectiveInvoiceAmounts } from "@/lib/money";
import {
  buildCommercialAlerts,
  buildCommercialStories,
  buildCommercialTasks,
  calculateOrderProfitability,
  type CommercialAlert,
  type CommercialPayment,
  type CommercialProduct,
  type CommercialProfile,
} from "@/lib/commercialOps";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ── Types ──────────────────────────────────────────────────────────────────
interface SupabaseOrder {
  id: string;
  client_id: string;
  order_number?: string;
  products: Array<{ name: string; quantity: number; unit_price?: number; total_price?: number; margin?: number }>;
  total: number;
  status: string;
  created_at: string;
}

interface ClientProfile {
  id: string;
  company_name: string;
  contact_name: string;
}

interface SupportTicketRow {
  id: string;
  client_id: string;
  category?: string;
  status: "open" | "in_analysis" | "waiting_customer" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  subject: string;
  updated_at: string;
}

interface DashboardRmaRow {
  id: number;
  client_id: string;
  status: "draft" | "submitted" | "reviewing" | "approved" | "rejected" | "resolved";
  rma_number: string;
  created_at: string;
}

interface ExtendedCommercialProfile extends CommercialProfile {
  assigned_seller_id?: string | null;
  vendedor_id?: string | null;
}

interface SellerRow {
  id: string;
  company_name?: string;
  contact_name?: string;
}

interface Props {
  orders: SupabaseOrder[];
  clients: ClientProfile[];
  isDark: boolean;
  onRefreshOrders?: () => void;
  onOpenTab?: (tab: string) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────
function getAllQuotes(): Quote[] {
  const all: Quote[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith("b2b_quotes_")) {
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || "[]");
        if (Array.isArray(parsed)) all.push(...parsed);
      } catch { /* skip */ }
    }
  }
  return all.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

/**
 * Estados que representan ingresos confirmados.
 * "pending" y "rejected" se excluyen deliberadamente.
 */
const REVENUE_STATUSES = new Set(["approved", "preparing", "shipped", "dispatched", "delivered"]);
const isRevenueOrder = (o: { status: string }) => REVENUE_STATUSES.has(o.status);

// ── Status configs ───────────────────────────────────────────────────────────
const ORDER_STATUS: Record<string, { label: string; icon: LucideIcon; color: string; bg: string; border: string }> = {
  pending:  { label: "En revisión", icon: Clock,        color: "text-yellow-400", bg: "bg-yellow-500/15", border: "border-yellow-500/30" },
  approved: { label: "Aprobado",    icon: CheckCircle2, color: "text-green-400",  bg: "bg-green-500/15",  border: "border-green-500/30" },
  rejected: { label: "Rechazado",   icon: XCircle,      color: "text-red-400",    bg: "bg-red-500/15",    border: "border-red-500/30" },
};

const QUOTE_STATUS: Record<QuoteStatus, { label: string; icon: LucideIcon; color: string; bar: string }> = {
  draft:    { label: "Borrador",  icon: FileText,      color: "text-[#a3a3a3]",  bar: "bg-[#404040]" },
  sent:     { label: "Enviada",   icon: Send,          color: "text-blue-400",   bar: "bg-blue-500" },
  viewed:   { label: "Vista",     icon: Eye,           color: "text-purple-400", bar: "bg-purple-500" },
  approved: { label: "Aprobada",  icon: CheckCircle2,  color: "text-green-400",  bar: "bg-green-500" },
  rejected: { label: "Rechazada", icon: XCircle,       color: "text-red-400",    bar: "bg-red-500" },
  converted:{ label: "Convertida",icon: CheckCircle2,  color: "text-emerald-400",bar: "bg-emerald-500" },
  expired:  { label: "Expirada",  icon: AlertTriangle, color: "text-amber-400",  bar: "bg-amber-500" },
};

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, icon: Icon, accent, trend, trendPct, isDark,
}: {
  label: string; value: string; sub?: string; icon: LucideIcon; accent: string;
  trend?: "up" | "down" | "flat"; trendPct?: number; isDark: boolean;
}) {
  const TrendIcon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : MinusIcon;
  const trendColor = trend === "up" ? "text-emerald-500" : trend === "down" ? "text-red-500" : "text-muted-foreground";
  return (
    <div className="kpi-soft rounded-[24px] border border-border/80 px-5 py-5 transition hover:-translate-y-0.5">
      <div className="flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-[18px] shadow-sm ${accent}`}>
          <Icon size={17} />
        </div>
        {trend && (
          <span className={`flex items-center gap-0.5 text-[11px] font-semibold ${trendColor}`}>
            <TrendIcon size={13} />
            {trendPct != null && <span>{Math.abs(trendPct).toFixed(0)}%</span>}
          </span>
        )}
      </div>
      <div>
        <div className="text-[30px] font-extrabold tracking-tight text-foreground">{value}</div>
        <div className="mt-0.5 text-xs font-medium text-muted-foreground">{label}</div>
        {sub && <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>}
      </div>
    </div>
  );
}

const DASHBOARD_PANEL =
  "dashboard-panel rounded-[28px] border border-border/80 bg-background/95 shadow-[0_18px_48px_rgba(15,23,42,0.06)]";
const DASHBOARD_PANEL_HEADER = "border-b border-border/70 px-6 py-5";
const DASHBOARD_PANEL_BODY = "px-6 py-5";
const DASHBOARD_TILE =
  "rounded-[22px] border border-border/70 bg-accent/20 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]";
const DASHBOARD_ROW =
  "rounded-[20px] border border-border/70 bg-background/80 px-4 py-3 transition hover:bg-accent/30";

// ── Focus Bar (Atención inmediata) ────────────────────────────────────────────
function FocusBar({
  items,
  onOpenTab,
}: {
  items: Array<{ id: string; label: string; count: number; severity: "high" | "medium" | "low"; tab?: string }>;
  onOpenTab?: (tab: string) => void;
}) {
  const urgent = items.filter((item) => item.count > 0);
  if (urgent.length === 0) return null;

  const severityStyle = {
    high: "border-red-500/25 bg-red-500/8 text-red-500",
    medium: "border-amber-500/25 bg-amber-500/8 text-amber-500",
    low: "border-border/70 bg-accent/20 text-muted-foreground",
  };
  const dotStyle = {
    high: "bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.7)]",
    medium: "bg-amber-500 shadow-[0_0_5px_rgba(245,158,11,0.7)]",
    low: "bg-muted-foreground/40",
  };

  return (
    <div className="rounded-[24px] border border-border/70 bg-card/80 px-5 py-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
          <Zap size={13} />
        </div>
        <p className="text-xs font-bold text-foreground">Atención inmediata</p>
        <span className="ml-auto text-[10px] text-muted-foreground">{urgent.length} item{urgent.length !== 1 ? "s" : ""} requieren acción</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {urgent.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => item.tab && onOpenTab?.(item.tab)}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${severityStyle[item.severity]} ${item.tab ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
          >
            <div className={`h-1.5 w-1.5 rounded-full ${dotStyle[item.severity]}`} />
            <span className="font-extrabold tabular-nums">{item.count}</span>
            <span className="font-medium opacity-80">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Revenue Sparkline (7-day CSS bars) ───────────────────────────────────────
function RevenueSparkline({ orders, isDark }: { orders: SupabaseOrder[]; isDark: boolean }) {
  const { formatPrice } = useCurrency();

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const iso = d.toISOString().split("T")[0];
      const label = d.toLocaleDateString("es-AR", { weekday: "short" });
      const revenue = orders
        .filter((o) => isRevenueOrder(o) && o.created_at.startsWith(iso))
        .reduce((s, o) => s + o.total, 0);
      return { iso, label, revenue };
    });
  }, [orders]);

  const max = Math.max(...days.map((d) => d.revenue), 1);
  const totalWeek = days.reduce((s, d) => s + d.revenue, 0);

  return (
    <div className={`${DASHBOARD_PANEL} flex flex-col gap-5 p-6`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Ventas - ultimos 7 dias</h3>
          <p className="mt-1 text-xs text-muted-foreground">Solo pedidos aprobados</p>
        </div>
        <div className="text-right">
          <div className="text-xl font-extrabold tabular-nums text-primary">{formatPrice(totalWeek)}</div>
          <div className="text-[11px] text-muted-foreground">esta semana</div>
        </div>
      </div>

      <div className="rounded-[22px] border border-border/70 bg-accent/20 px-3 py-4">
        <div className="flex h-24 items-end gap-2">
          {days.map((d) => {
            const pct = max > 0 ? (d.revenue / max) * 100 : 0;
            const isToday = d.iso === new Date().toISOString().split("T")[0];
            return (
              <div key={d.iso} className="group relative flex flex-1 flex-col items-center gap-1">
                {d.revenue > 0 && (
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-xl border border-border/80 bg-background/95 px-2 py-1 text-[10px] text-foreground opacity-0 shadow-lg transition group-hover:opacity-100">
                    {formatPrice(d.revenue)}
                  </div>
                )}
                <div className="relative w-full" style={{ height: "64px" }}>
                  <div
                    className={`absolute bottom-0 w-full rounded-t-md transition-all ${isToday ? "bg-primary" : "bg-border/80 group-hover:bg-primary/45"}`}
                    style={{ height: `${Math.max(pct, d.revenue > 0 ? 4 : 0)}%` }}
                  />
                </div>
                <span className={`text-[10px] font-medium ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                  {d.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Quote Status Breakdown ───────────────────────────────────────────────────
function QuoteStatusBreakdown({ quotes, isDark }: { quotes: Quote[]; isDark: boolean }) {
  const total = quotes.length;
  const byStatus = useMemo(() => {
    const counts: Partial<Record<QuoteStatus, number>> = {};
    quotes.forEach((q) => {
      counts[q.status] = (counts[q.status] || 0) + 1;
    });
    return counts;
  }, [quotes]);

  const statuses: QuoteStatus[] = ["draft", "sent", "viewed", "approved", "rejected", "expired"];

  return (
    <div className={`${DASHBOARD_PANEL} flex flex-col gap-4 p-6`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Estado de cotizaciones</h3>
          <p className="mt-1 text-xs text-muted-foreground">{total} cotizacion{total !== 1 ? "es" : ""} en total</p>
        </div>
        {total === 0 && <span className="text-[11px] text-muted-foreground">Sin datos</span>}
      </div>

      {total === 0 ? (
        <div className="flex items-center justify-center rounded-[22px] border border-dashed border-border/80 bg-accent/20 py-8 text-muted-foreground">
          <FileText size={24} className="opacity-30" />
        </div>
      ) : (
        <div className="space-y-3 rounded-[22px] border border-border/70 bg-accent/20 p-4">
          {statuses.map((s) => {
            const count = byStatus[s] || 0;
            if (count === 0) return null;
            const pct = total > 0 ? (count / total) * 100 : 0;
            const { label, icon: Icon, color, bar } = QUOTE_STATUS[s];
            return (
              <div key={s}>
                <div className="mb-1 flex items-center justify-between">
                  <div className={`flex items-center gap-1.5 text-xs font-medium ${color}`}>
                    <Icon size={11} /> {label}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">{count}</span>
                    <span className="w-8 text-right text-[11px] tabular-nums text-muted-foreground">{pct.toFixed(0)}%</span>
                  </div>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-border/70">
                  <div className={`h-full rounded-full ${bar} transition-all`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Activity Feed ────────────────────────────────────────────────────────────
type FeedItem =
  | { kind: "order"; data: SupabaseOrder; date: Date }
  | { kind: "quote"; data: Quote; date: Date };

function ActivityFeed({
  orders, quotes, clients, isDark,
}: { orders: SupabaseOrder[]; quotes: Quote[]; clients: ClientProfile[]; isDark: boolean }) {
  const { formatPrice } = useCurrency();

  const clientName = (id: string) => {
    const c = clients.find((cl) => cl.id === id);
    return c?.company_name || c?.contact_name || `${id.slice(0, 8)}...`;
  };

  const feed: FeedItem[] = useMemo(() => {
    const items: FeedItem[] = [
      ...orders.slice(0, 10).map((o) => ({ kind: "order" as const, data: o, date: new Date(o.created_at) })),
      ...quotes.slice(0, 10).map((q) => ({ kind: "quote" as const, data: q, date: new Date(q.created_at) })),
    ];
    return items.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 10);
  }, [orders, quotes]);

  return (
    <div className={`${DASHBOARD_PANEL} overflow-hidden`}>
      <div className={DASHBOARD_PANEL_HEADER}>
        <h3 className="text-sm font-semibold text-foreground">Actividad reciente</h3>
        <p className="mt-1 text-xs text-muted-foreground">Ordenes y cotizaciones combinadas</p>
      </div>

      {feed.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
          <Clock size={28} className="opacity-20" />
          <p className="text-sm">Sin actividad registrada</p>
        </div>
      ) : (
        <div className="divide-y divide-border/60">
          {feed.map((item, i) => {
            if (item.kind === "order") {
              const o = item.data;
              const cfg = ORDER_STATUS[o.status] ?? ORDER_STATUS.pending;
              const Icon = cfg.icon;
              return (
                <div key={`o-${o.id}-${i}`} className="flex items-center justify-between px-6 py-4 transition hover:bg-accent/20">
                  <div className="min-w-0 flex items-center gap-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[16px] border ${cfg.bg} ${cfg.border}`}>
                      <ShoppingBag size={13} className={cfg.color} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        Pedido #{String(o.id).slice(-6).toUpperCase()}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {clientName(o.client_id)} ? {item.date.toLocaleDateString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                  <div className="ml-3 flex shrink-0 items-center gap-3">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                      <Icon size={9} /> {cfg.label}
                    </span>
                    <span className="text-sm font-bold tabular-nums text-primary">{formatPrice(o.total)}</span>
                  </div>
                </div>
              );
            }

            const q = item.data;
            const cfg = QUOTE_STATUS[q.status] ?? QUOTE_STATUS.draft;
            const Icon = cfg.icon;
            return (
              <div key={`q-${q.id}-${i}`} className="flex items-center justify-between px-6 py-4 transition hover:bg-accent/20">
                <div className="min-w-0 flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[16px] border border-blue-500/20 bg-blue-500/10">
                    <FileText size={13} className="text-blue-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      COT-{String(q.id).padStart(4, "0")} ? {q.client_name}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {q.items.length} producto{q.items.length !== 1 ? "s" : ""} ? {item.date.toLocaleDateString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
                <div className="ml-3 flex shrink-0 items-center gap-3">
                  <span className={`inline-flex items-center gap-1 rounded-full border border-border/70 bg-accent/20 px-2.5 py-1 text-[10px] font-semibold ${cfg.color}`}>
                    <Icon size={9} /> {cfg.label}
                  </span>
                  <span className="text-sm font-bold tabular-nums text-primary">{formatPrice(q.total)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Top Products ─────────────────────────────────────────────────────────────
function TopProducts({ orders, isDark }: { orders: SupabaseOrder[]; isDark: boolean }) {
  const { formatPrice } = useCurrency();

  const topProducts = useMemo(() => {
    const map: Record<string, { name: string; qty: number; revenue: number }> = {};
    orders
      .filter(isRevenueOrder)
      .forEach((o) => {
        o.products?.forEach((p) => {
          if (!p.name) return;
          if (!map[p.name]) map[p.name] = { name: p.name, qty: 0, revenue: 0 };
          map[p.name].qty += p.quantity || 0;
          map[p.name].revenue += p.total_price || 0;
        });
      });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [orders]);

  const maxRevenue = Math.max(...topProducts.map((p) => p.revenue), 1);

  return (
    <div className={`${DASHBOARD_PANEL} flex flex-col gap-4 p-6`}>
      <div>
        <h3 className="text-sm font-semibold text-foreground">Top productos</h3>
        <p className="mt-1 text-xs text-muted-foreground">Por facturacion de pedidos aprobados</p>
      </div>

      {topProducts.length === 0 ? (
        <div className="flex items-center justify-center rounded-[22px] border border-dashed border-border/80 bg-accent/20 py-8 text-muted-foreground">
          <Package size={24} className="opacity-30" />
        </div>
      ) : (
        <div className="space-y-3 rounded-[22px] border border-border/70 bg-accent/20 p-4">
          {topProducts.map((p, i) => {
            const pct = (p.revenue / maxRevenue) * 100;
            return (
              <div key={p.name}>
                <div className="mb-1 flex items-center justify-between">
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="w-4 shrink-0 text-[10px] font-bold text-muted-foreground">#{i + 1}</span>
                    <span className="truncate text-xs font-medium text-foreground">{p.name}</span>
                  </div>
                  <div className="ml-2 flex shrink-0 items-center gap-3">
                    <span className="text-[10px] text-muted-foreground">x{p.qty}</span>
                    <span className="text-xs font-bold tabular-nums text-primary">{formatPrice(p.revenue)}</span>
                  </div>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-border/70">
                  <div className="h-full rounded-full bg-primary/70 transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Top Clients ──────────────────────────────────────────────────────────────
function TopClients({
  orders, clients, isDark,
}: { orders: SupabaseOrder[]; clients: ClientProfile[]; isDark: boolean }) {
  const { formatPrice } = useCurrency();

  const topClients = useMemo(() => {
    const map: Record<string, { name: string; revenue: number; orderCount: number }> = {};
    orders
      .filter(isRevenueOrder)
      .forEach((o) => {
        if (!o.client_id) return;
        if (!map[o.client_id]) {
          const c = clients.find((cl) => cl.id === o.client_id);
          const name = c?.company_name || c?.contact_name || `${o.client_id.slice(0, 8)}...`;
          map[o.client_id] = { name, revenue: 0, orderCount: 0 };
        }
        map[o.client_id].revenue += o.total;
        map[o.client_id].orderCount += 1;
      });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [orders, clients]);

  const maxRevenue = Math.max(...topClients.map((c) => c.revenue), 1);

  return (
    <div className={`${DASHBOARD_PANEL} flex flex-col gap-4 p-6`}>
      <div>
        <h3 className="text-sm font-semibold text-foreground">Top clientes</h3>
        <p className="mt-1 text-xs text-muted-foreground">Por facturacion de pedidos aprobados</p>
      </div>

      {topClients.length === 0 ? (
        <div className="flex items-center justify-center rounded-[22px] border border-dashed border-border/80 bg-accent/20 py-8 text-muted-foreground">
          <Users size={24} className="opacity-30" />
        </div>
      ) : (
        <div className="space-y-3 rounded-[22px] border border-border/70 bg-accent/20 p-4">
          {topClients.map((c, i) => {
            const pct = (c.revenue / maxRevenue) * 100;
            return (
              <div key={c.name}>
                <div className="mb-1 flex items-center justify-between">
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="w-4 shrink-0 text-[10px] font-bold text-muted-foreground">#{i + 1}</span>
                    <span className="truncate text-xs font-medium text-foreground">{c.name}</span>
                  </div>
                  <div className="ml-2 flex shrink-0 items-center gap-3">
                    <span className="text-[10px] text-muted-foreground">{c.orderCount}p</span>
                    <span className="text-xs font-bold tabular-nums text-primary">{formatPrice(c.revenue)}</span>
                  </div>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-border/70">
                  <div className="h-full rounded-full bg-blue-500/60 transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Delete History Panel ──────────────────────────────────────────────────────
function DeleteHistoryPanel({ isDark, onRefreshOrders }: { isDark: boolean; onRefreshOrders?: () => void }) {
  const [deleting, setDeleting] = useState<string | null>(null);
  const [pending, setPending] = useState<{ label: string; days: number } | null>(null);

  async function confirmDelete() {
    if (!pending) return;
    const { label, days } = pending;
    setPending(null);
    setDeleting(label);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffISO = cutoff.toISOString();

    await supabase.from("orders").delete().gte("created_at", cutoffISO);
    await supabase.from("quotes").delete().gte("created_at", cutoffISO);

    setDeleting(null);
    onRefreshOrders?.();
  }

  const periods = [
    { label: "ultimo dia", days: 1 },
    { label: "ultima semana", days: 7 },
    { label: "ultimo mes", days: 30 },
  ];

  return (
    <>
      <div className={`${DASHBOARD_PANEL} flex flex-wrap items-center gap-3 p-5`}>
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10">
            <Trash2 size={14} className="text-red-500" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">Limpiar historial</p>
            <p className="text-[11px] text-muted-foreground">Elimina pedidos y cotizaciones del periodo.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {periods.map(({ label, days }) => (
            <button
              key={label}
              onClick={() => setPending({ label, days })}
              disabled={deleting !== null}
              className="dashboard-pill px-3 py-1.5 text-[11px] disabled:opacity-40"
            >
              {deleting === label ? "Eliminando..." : `Borrar ${label}`}
            </button>
          ))}
        </div>
      </div>

      <AlertDialog open={!!pending} onOpenChange={(open) => { if (!open) setPending(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Borrar historial del {pending?.label}</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminaran pedidos y cotizaciones de los ultimos {pending?.days} dia{pending?.days !== 1 ? "s" : ""}.
              Esta accion no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 text-white hover:bg-red-500">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function CommercialAlertsPanel({
  alerts,
  isDark,
}: {
  alerts: CommercialAlert[];
  isDark: boolean;
}) {
  return (
    <div className={`${DASHBOARD_PANEL} overflow-hidden`}>
      <div className={DASHBOARD_PANEL_HEADER}>
        <h3 className="text-sm font-semibold text-foreground">Alertas automaticas</h3>
        <p className="mt-1 text-xs text-muted-foreground">Stock, credito, cobranzas y pedidos demorados.</p>
      </div>
      <div className="space-y-3 px-6 py-5">
        {alerts.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin alertas criticas por ahora.</p>
        ) : (
          alerts.map((alert) => (
            <div key={alert.id} className={`rounded-[20px] border px-4 py-3 ${alert.severity === "high" ? "border-red-500/15 bg-red-500/8" : "border-amber-500/15 bg-amber-500/8"}`}>
              <div className="flex items-center justify-between gap-3">
                <p className={`text-xs font-semibold ${alert.severity === "high" ? "text-red-500" : "text-amber-500"}`}>{alert.title}</p>
                <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{alert.type.replace(/_/g, " ")}</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">{alert.detail}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CommercialTasksPanel({
  tasks,
  isDark,
}: {
  tasks: ReturnType<typeof buildCommercialTasks>;
  isDark: boolean;
}) {
  return (
    <div className={`${DASHBOARD_PANEL} overflow-hidden`}>
      <div className={DASHBOARD_PANEL_HEADER}>
        <h3 className="text-sm font-semibold text-foreground">Seguimiento y cobranza</h3>
        <p className="mt-1 text-xs text-muted-foreground">Acciones sugeridas para hoy, sin perder el hilo comercial.</p>
      </div>
      <div className="space-y-3 px-6 py-5">
        {tasks.length === 0 ? (
          <p className="text-xs text-muted-foreground">No hay acciones urgentes pendientes.</p>
        ) : (
          tasks.map((task) => (
            <div key={task.id} className={DASHBOARD_ROW}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-foreground">{task.title}</p>
                <span className="text-[10px] uppercase tracking-[0.18em] text-primary">{task.kind.replace(/_/g, " ")}</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">{task.detail}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ProfitabilityPanel({
  orders,
  isDark,
}: {
  orders: SupabaseOrder[];
  isDark: boolean;
}) {
  const { formatPrice } = useCurrency();

  const profitableOrders = useMemo(
    () =>
      orders
        .map((order) => ({ order, metrics: calculateOrderProfitability(order) }))
        .filter(({ metrics }) => metrics.revenue > 0 && metrics.cost > 0)
        .sort((a, b) => b.metrics.grossProfit - a.metrics.grossProfit)
        .slice(0, 6),
    [orders]
  );

  return (
    <div className={`${DASHBOARD_PANEL} overflow-hidden`}>
      <div className={DASHBOARD_PANEL_HEADER}>
        <h3 className="text-sm font-semibold text-foreground">Rentabilidad por pedido</h3>
        <p className="mt-1 text-xs text-muted-foreground">Visible solo en admin. El cliente nunca ve este margen real.</p>
      </div>
      <div className="space-y-3 px-6 py-5">
        {profitableOrders.length === 0 ? (
          <p className="text-xs text-muted-foreground">Todavia no hay pedidos con costo suficiente para calcular margen real.</p>
        ) : (
          profitableOrders.map(({ order, metrics }) => (
            <div key={order.id} className={DASHBOARD_ROW}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-foreground">{order.order_number ?? `#${String(order.id).slice(-6).toUpperCase()}`}</p>
                <span className={`text-xs font-bold ${(metrics.marginPct ?? 0) >= 20 ? "text-primary" : (metrics.marginPct ?? 0) >= 10 ? "text-amber-500" : "text-red-500"}`}>
                  {(metrics.marginPct ?? 0).toFixed(1)}%
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3 text-[11px]">
                <div>
                  <p className="uppercase tracking-[0.16em] text-muted-foreground">Venta</p>
                  <p className="font-semibold text-foreground">{formatPrice(metrics.revenue)}</p>
                </div>
                <div>
                  <p className="uppercase tracking-[0.16em] text-muted-foreground">Costo</p>
                  <p className="font-semibold text-foreground/80">{formatPrice(metrics.cost)}</p>
                </div>
                <div>
                  <p className="uppercase tracking-[0.16em] text-muted-foreground">Margen</p>
                  <p className="font-semibold text-primary">{formatPrice(metrics.grossProfit)}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

interface InvoiceKpis {
  pendingAmount: number;
  overdueCount: number;
  overdueAmount: number;
}

function ExceptionHub({
  isDark,
  items,
}: {
  isDark: boolean;
  items: Array<{ id: string; label: string; value: string; detail: string; severity: "high" | "medium" | "low" }>;
}) {
  return (
    <div className={`${DASHBOARD_PANEL} overflow-hidden`}>
      <div className={DASHBOARD_PANEL_HEADER}>
        <h3 className="text-sm font-semibold text-foreground">Centro de excepciones</h3>
        <p className="mt-1 text-xs text-muted-foreground">Lo que requiere intervencion antes de impactar revenue u operacion.</p>
      </div>
      <div className="grid gap-3 p-6 md:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <div
            key={item.id}
            className={`rounded-[22px] border px-4 py-4 ${
              item.severity === "high"
                ? "border-red-500/15 bg-red-500/8"
                : item.severity === "medium"
                  ? "border-amber-500/15 bg-amber-500/8"
                  : "border-border/70 bg-accent/20"
            }`}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">{item.label}</p>
            <p className="mt-3 text-2xl font-extrabold text-foreground">{item.value}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{item.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuotePipelinePanel({
  quotes,
  isDark,
}: {
  quotes: Quote[];
  isDark: boolean;
}) {
  const total = Math.max(quotes.length, 1);
  const steps: QuoteStatus[] = ["draft", "sent", "viewed", "approved", "converted"];

  const counts = steps.map((status) => ({
    status,
    count: quotes.filter((quote) => quote.status === status).length,
  }));

  return (
    <div className={`${DASHBOARD_PANEL} overflow-hidden`}>
      <div className={DASHBOARD_PANEL_HEADER}>
        <h3 className="text-sm font-semibold text-foreground">Pipeline comercial</h3>
        <p className="mt-1 text-xs text-muted-foreground">Embudo de cotizaciones desde borrador hasta conversion.</p>
      </div>
      <div className="space-y-4 p-6">
        {counts.map(({ status, count }) => {
          const cfg = QUOTE_STATUS[status];
          const pct = (count / total) * 100;
          return (
            <div key={status}>
              <div className="mb-1.5 flex items-center justify-between">
                <div className={`flex items-center gap-1.5 text-xs font-semibold ${cfg.color}`}>
                  <cfg.icon size={11} /> {cfg.label}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground">{count}</span>
                  <span className="text-[10px] text-muted-foreground">{pct.toFixed(0)}%</span>
                </div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-border/70">
                <div className={`h-full rounded-full ${cfg.bar}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AtRiskClientsPanel({
  profiles,
  clients,
  isDark,
}: {
  profiles: CommercialProfile[];
  clients: ClientProfile[];
  isDark: boolean;
}) {
  const atRisk = useMemo(
    () =>
      profiles
        .map((profile) => {
          const client = clients.find((item) => item.id === profile.id);
          const limit = profile.credit_limit ?? 0;
          const used = profile.credit_used ?? 0;
          const pct = limit > 0 ? (used / limit) * 100 : 0;
          return {
            id: profile.id,
            name: client?.company_name || client?.contact_name || profile.company_name || profile.contact_name || profile.id,
            estado: profile.estado ?? "activo",
            pct,
            used,
            limit,
          };
        })
        .filter((profile) => profile.pct >= 80 || profile.estado !== "activo")
        .sort((left, right) => right.pct - left.pct)
        .slice(0, 6),
    [clients, profiles],
  );

  return (
    <div className={`${DASHBOARD_PANEL} overflow-hidden`}>
      <div className={DASHBOARD_PANEL_HEADER}>
        <h3 className="text-sm font-semibold text-foreground">Clientes en riesgo</h3>
        <p className="mt-1 text-xs text-muted-foreground">Cuentas con presion crediticia o estado comercial no activo.</p>
      </div>
      <div className="space-y-3 px-6 py-5">
        {atRisk.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin cuentas en riesgo en esta pasada.</p>
        ) : (
          atRisk.map((profile) => (
            <div key={profile.id} className={DASHBOARD_ROW}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-foreground">{profile.name}</p>
                <span className={`text-[10px] font-bold ${profile.estado !== "activo" ? "text-red-500" : profile.pct >= 95 ? "text-red-500" : "text-amber-500"}`}>
                  {profile.estado !== "activo" ? profile.estado : `${profile.pct.toFixed(0)}%`}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {profile.limit > 0 ? `Credito usado ${formatMoneyInPreferredCurrency(profile.used, "ARS", "ARS", 1, 0)} / ${formatMoneyInPreferredCurrency(profile.limit, "ARS", "ARS", 1, 0)}` : "Sin linea asignada"}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CollectionsPulsePanel({
  stories,
  payments,
  currency,
  exchangeRate,
  isDark,
  onOpenTab,
}: {
  stories: ReturnType<typeof buildCommercialStories>;
  payments: CommercialPayment[];
  currency: "USD" | "ARS";
  exchangeRate: { rate: number };
  isDark: boolean;
  onOpenTab?: (tab: string) => void;
}) {
  const summary = useMemo(() => {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 86400000;
    const recentCollected = payments
      .filter((payment) => new Date(payment.fecha).getTime() >= sevenDaysAgo)
      .reduce((sum, payment) => sum + Math.abs(payment.monto ?? 0), 0);

    const outstandingStories = stories
      .filter((story) => story.balance > 0)
      .sort((left, right) => right.balance - left.balance);

    const dueSoon = stories.reduce((sum, story) => {
      const dueSoonInvoices = story.invoices.filter((invoice) => {
        if (!invoice.dueDate || invoice.status === "paid" || invoice.status === "cancelled") return false;
        const dueAt = new Date(invoice.dueDate).getTime();
        return dueAt >= now && dueAt <= now + 7 * 86400000;
      });
      return sum + dueSoonInvoices.reduce((invoiceSum, invoice) => invoiceSum + invoice.total, 0);
    }, 0);

    return {
      recentCollected,
      outstandingTotal: outstandingStories.reduce((sum, story) => sum + story.balance, 0),
      overdueCount: outstandingStories.filter((story) => story.overdue).length,
      dueSoon,
      topBalances: outstandingStories.slice(0, 4),
    };
  }, [payments, stories]);

  return (
    <div className={`${DASHBOARD_PANEL} overflow-hidden`}>
      <div className={DASHBOARD_PANEL_HEADER}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Cobranza en foco</h3>
            <p className="mt-1 text-xs text-muted-foreground">Balance abierto, cobros recientes y cuentas que requieren seguimiento.</p>
          </div>
          {onOpenTab ? (
            <button
              type="button"
              onClick={() => onOpenTab("invoices")}
              className="dashboard-pill px-3 py-1.5 text-[11px] font-semibold text-foreground/80 hover:text-foreground"
            >
              Ver facturas
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 px-6 py-5">
        <div className={DASHBOARD_TILE}>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Cobrado 7d</p>
          <p className="mt-2 text-lg font-extrabold tabular-nums text-primary">
            {formatMoneyInPreferredCurrency(summary.recentCollected, "ARS", currency, exchangeRate.rate, 0)}
          </p>
        </div>
        <div className={DASHBOARD_TILE}>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Balance abierto</p>
          <p className={`mt-2 text-lg font-extrabold tabular-nums ${summary.outstandingTotal > 0 ? "text-amber-500" : "text-foreground"}`}>
            {formatMoneyInPreferredCurrency(summary.outstandingTotal, "ARS", currency, exchangeRate.rate, 0)}
          </p>
        </div>
        <div className={DASHBOARD_TILE}>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Vencidas</p>
          <p className={`mt-2 text-lg font-extrabold tabular-nums ${summary.overdueCount > 0 ? "text-red-500" : "text-foreground"}`}>
            {summary.overdueCount}
          </p>
        </div>
        <div className={DASHBOARD_TILE}>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Vence esta semana</p>
          <p className="mt-2 text-lg font-extrabold tabular-nums text-blue-500">
            {formatMoneyInPreferredCurrency(summary.dueSoon, "ARS", currency, exchangeRate.rate, 0)}
          </p>
        </div>
      </div>

      <div className="border-t border-border/70 px-6 py-5">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Mayores saldos</p>
        {summary.topBalances.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin saldos abiertos.</p>
        ) : (
          <div className="space-y-2">
            {summary.topBalances.map((story) => (
              <div key={story.id} className={DASHBOARD_ROW}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-foreground">{story.clientName}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">{story.nextAction}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-bold tabular-nums text-amber-500">
                      {formatMoneyInPreferredCurrency(story.balance, "ARS", currency, exchangeRate.rate, 0)}
                    </p>
                    <p className={`text-[10px] ${story.overdue ? "text-red-500" : "text-muted-foreground"}`}>
                      {story.overdue ? "Vencido" : story.stage}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OpportunityRadarPanel({
  quotes,
  currency,
  exchangeRate,
  isDark,
  onOpenTab,
}: {
  quotes: Quote[];
  currency: "USD" | "ARS";
  exchangeRate: { rate: number };
  isDark: boolean;
  onOpenTab?: (tab: string) => void;
}) {
  const summary = useMemo(() => {
    const now = Date.now();
    const openQuotes = quotes
      .filter((quote) => ["sent", "viewed", "approved"].includes(quote.status) && quote.order_id == null)
      .map((quote) => ({
        ...quote,
        ageDays: Math.floor((now - new Date(quote.updated_at || quote.created_at).getTime()) / 86400000),
      }))
      .sort((left, right) => {
        const rank = (status: QuoteStatus) => (status === "approved" ? 0 : status === "viewed" ? 1 : 2);
        return rank(left.status) - rank(right.status) || right.total - left.total;
      });

    return {
      openQuotes,
      staleCount: openQuotes.filter((quote) => quote.ageDays >= 3).length,
      potentialRevenue: openQuotes.reduce((sum, quote) => {
        if (quote.currency === currency) return sum + quote.total;
        return sum + (quote.currency === "USD" ? quote.total * exchangeRate.rate : quote.total / exchangeRate.rate);
      }, 0),
      urgent: openQuotes.slice(0, 4),
    };
  }, [currency, exchangeRate.rate, quotes]);

  return (
    <div className={`${DASHBOARD_PANEL} overflow-hidden`}>
      <div className={DASHBOARD_PANEL_HEADER}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Radar de oportunidades</h3>
            <p className="mt-1 text-xs text-muted-foreground">Cotizaciones abiertas con potencial inmediato de conversion.</p>
          </div>
          {onOpenTab ? (
            <button
              type="button"
              onClick={() => onOpenTab("quotes")}
              className="dashboard-pill px-3 py-1.5 text-[11px] font-semibold text-foreground/80 hover:text-foreground"
            >
              Ver cotizaciones
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 px-6 py-5">
        <div className={DASHBOARD_TILE}>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Abiertas</p>
          <p className="mt-2 text-lg font-extrabold tabular-nums text-foreground">{summary.openQuotes.length}</p>
        </div>
        <div className={DASHBOARD_TILE}>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Dormidas</p>
          <p className={`mt-2 text-lg font-extrabold tabular-nums ${summary.staleCount > 0 ? "text-amber-500" : "text-foreground"}`}>{summary.staleCount}</p>
        </div>
        <div className={DASHBOARD_TILE}>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Revenue potencial</p>
          <p className="mt-2 text-lg font-extrabold tabular-nums text-blue-500">
            {formatMoneyInPreferredCurrency(summary.potentialRevenue, "ARS", currency, exchangeRate.rate, 0)}
          </p>
        </div>
      </div>

      <div className="border-t border-border/70 px-6 py-5">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Prioridad comercial</p>
        {summary.urgent.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay oportunidades abiertas en este momento.</p>
        ) : (
          <div className="space-y-2">
            {summary.urgent.map((quote) => {
              const cfg = QUOTE_STATUS[quote.status];
              const Icon = cfg.icon;
              return (
                <div key={quote.id} className={DASHBOARD_ROW}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-foreground">{quote.client_name}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        COT-{String(quote.id).padStart(5, "0")} ? {quote.items.length} item{quote.items.length !== 1 ? "s" : ""} ? {quote.ageDays} dia{quote.ageDays !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-bold tabular-nums text-blue-500">
                        {formatMoneyInPreferredCurrency(quote.total, quote.currency, currency, exchangeRate.rate, 0)}
                      </p>
                      <p className={`mt-1 inline-flex items-center gap-1 text-[10px] ${cfg.color}`}>
                        <Icon size={10} /> {cfg.label}
                      </p>
                    </div>
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

function DailyOpsPanel({
  items,
  isDark,
  onOpenTab,
}: {
  items: Array<{
    id: string;
    label: string;
    value: string;
    detail: string;
    accent: string;
    tab?: string;
  }>;
  isDark: boolean;
  onOpenTab?: (tab: string) => void;
}) {
  return (
    <div className={`${DASHBOARD_PANEL} overflow-hidden`}>
      <div className={DASHBOARD_PANEL_HEADER}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Operacion diaria</h3>
            <p className="mt-1 text-xs text-muted-foreground">Cola rapida para aprobar, preparar, despachar y resolver incidencias.</p>
          </div>
          {onOpenTab ? (
            <button
              type="button"
              onClick={() => onOpenTab("orders")}
              className="dashboard-pill px-3 py-1.5 text-[11px] font-semibold text-foreground/80 hover:text-foreground"
            >
              Ver pedidos
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 px-6 py-5 md:grid-cols-2 xl:grid-cols-5">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => item.tab && onOpenTab?.(item.tab)}
            className={`${DASHBOARD_TILE} text-left ${item.tab ? "cursor-pointer hover:bg-accent/35" : "cursor-default"}`}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">{item.label}</p>
            <p className={`mt-2 text-lg font-extrabold tabular-nums ${item.accent}`}>{item.value}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">{item.detail}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function GrowthAccountsPanel({
  items,
  currency,
  exchangeRate,
  isDark,
}: {
  items: Array<{ id: string; name: string; current: number; previous: number; deltaPct: number; trend: "up" | "down" }>;
  currency: "USD" | "ARS";
  exchangeRate: { rate: number };
  isDark: boolean;
}) {
  return (
    <div className={`${DASHBOARD_PANEL} overflow-hidden`}>
      <div className={DASHBOARD_PANEL_HEADER}>
        <h3 className="text-sm font-semibold text-foreground">Crecimiento y caida por cliente</h3>
        <p className="mt-1 text-xs text-muted-foreground">Comparativa mensual para detectar expansion o deterioro de cartera.</p>
      </div>
      <div className="space-y-2 px-6 py-5">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavia no hay base comparativa suficiente entre meses.</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className={DASHBOARD_ROW}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-foreground">{item.name}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {formatMoneyInPreferredCurrency(item.previous, "ARS", currency, exchangeRate.rate, 0)} ? {formatMoneyInPreferredCurrency(item.current, "ARS", currency, exchangeRate.rate, 0)}
                  </p>
                </div>
                <span className={`shrink-0 text-xs font-bold ${item.trend === "up" ? "text-primary" : "text-red-500"}`}>
                  {item.trend === "up" ? "+" : ""}{item.deltaPct.toFixed(0)}%
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CatalogIntelligencePanel({
  nonMoving,
  marginAlerts,
  isDark,
}: {
  nonMoving: Array<{ id: string | number; name: string; stock: number }>;
  marginAlerts: Array<{ name: string; marginPct: number }>;
  isDark: boolean;
}) {
  return (
    <div className={`${DASHBOARD_PANEL} overflow-hidden`}>
      <div className={DASHBOARD_PANEL_HEADER}>
        <h3 className="text-sm font-semibold text-foreground">Inteligencia de catalogo</h3>
        <p className="mt-1 text-xs text-muted-foreground">Productos sin rotacion y lineas con margen comercial comprimido.</p>
      </div>
      <div className="grid gap-4 px-6 py-5 lg:grid-cols-2">
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Sin rotacion</p>
          {nonMoving.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay stock quieto relevante.</p>
          ) : (
            nonMoving.map((item) => (
              <div key={item.id} className={DASHBOARD_ROW}>
                <p className="truncate text-xs font-semibold text-foreground">{item.name}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">Stock inmovil: {item.stock} u.</p>
              </div>
            ))
          )}
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Margen bajo</p>
          {marginAlerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay productos con margen bajo en esta pasada.</p>
          ) : (
            marginAlerts.map((item) => (
              <div key={item.name} className={DASHBOARD_ROW}>
                <p className="truncate text-xs font-semibold text-foreground">{item.name}</p>
                <p className="mt-1 text-[10px] text-amber-500">Margen promedio {item.marginPct.toFixed(1)}%</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ManagerPortfolioPanel({
  items,
  currency,
  exchangeRate,
  isDark,
}: {
  items: Array<{ id: string; name: string; accounts: number; revenue: number; alerts: number; pipeline: number }>;
  currency: "USD" | "ARS";
  exchangeRate: { rate: number };
  isDark: boolean;
}) {
  return (
    <div className={`${DASHBOARD_PANEL} overflow-hidden`}>
      <div className={DASHBOARD_PANEL_HEADER}>
        <h3 className="text-sm font-semibold text-foreground">Vista por responsable</h3>
        <p className="mt-1 text-xs text-muted-foreground">Cartera, revenue, pipeline y alertas por vendedor/account manager.</p>
      </div>
      <div className="space-y-2 px-6 py-5">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay responsables asignados en los perfiles cargados.</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className={DASHBOARD_ROW}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-foreground">{item.name}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{item.accounts} cuenta{item.accounts !== 1 ? "s" : ""} asignada{item.accounts !== 1 ? "s" : ""}</p>
                </div>
                <span className="text-xs font-bold text-blue-500">
                  {formatMoneyInPreferredCurrency(item.revenue, "ARS", currency, exchangeRate.rate, 0)}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
                <span>Pipeline: {item.pipeline}</span>
                <span>Alertas: {item.alerts}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function AnalyticsCharts({ isDark, stats }: { isDark: boolean; stats: any }) {
  const { formatPrice } = useCurrency();

  const chartColors = ["#2D9F6A", "#3b82f6", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4"];
  const tooltipStyle = {
    backgroundColor: "hsl(var(--background))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "18px",
    fontSize: "12px",
    boxShadow: "0 18px 48px rgba(15,23,42,0.12)",
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className={`${DASHBOARD_PANEL} flex min-h-[350px] flex-col gap-4 p-6`}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Evolucion de ventas</h3>
            <p className="mt-1 text-xs text-muted-foreground">Revenue mensual y crecimiento</p>
          </div>
          {stats?.monthly?.length > 0 && stats.monthly[0].growth_pct != null && (
            <div className="dashboard-pill px-3 py-1.5 text-[11px] font-semibold">
              <span className={stats.monthly[0].growth_pct >= 0 ? "text-primary" : "text-red-500"}>
                {stats.monthly[0].growth_pct >= 0 ? "+" : ""}{Number(stats.monthly[0].growth_pct).toFixed(1)}% MoM
              </span>
            </div>
          )}
        </div>
        <div className="h-[250px] w-full flex-1 rounded-[22px] border border-border/70 bg-accent/20 p-3">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={[...stats.monthly].reverse()}>
              <defs>
                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2D9F6A" stopOpacity={0.26} />
                  <stop offset="95%" stopColor="#2D9F6A" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.18)" />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "#7c8798" }}
                tickFormatter={(str) => new Date(str).toLocaleDateString("es-AR", { month: "short" })}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "#7c8798" }}
                tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={(label) => new Date(label).toLocaleDateString("es-AR", { month: "long", year: "numeric" })}
                formatter={(val: number) => [formatPrice(val), "Revenue"]}
              />
              <Area type="monotone" dataKey="revenue" stroke="#2D9F6A" fillOpacity={1} fill="url(#colorRev)" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={`${DASHBOARD_PANEL} flex min-h-[350px] flex-col gap-4 p-6`}>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Ventas por categoria</h3>
          <p className="mt-1 text-xs text-muted-foreground">Peso relativo de revenue por linea comercial</p>
        </div>
        <div className="relative h-[250px] w-full flex-1 rounded-[22px] border border-border/70 bg-accent/20 p-3">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={stats.categories}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={5}
                dataKey="revenue"
                nameKey="category"
              >
                {stats.categories.map((_: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(val: number) => formatPrice(val)} />
              <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ fontSize: "11px", paddingTop: "20px" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// Main Component ────────────────────────────────────────────────────────────
export function SalesDashboard({ orders, clients, isDark, onRefreshOrders, onOpenTab }: Props) {
  const dk = (d: string, l: string) => isDark ? d : l;
  const { currency, exchangeRate, formatPrice } = useCurrency();
  const quotes = useMemo(() => getAllQuotes(), []);

  // Async: invoices + credit exposure
  const [invoiceKpis, setInvoiceKpis] = useState<InvoiceKpis | null>(null);
  const [creditExposure, setCreditExposure] = useState<number | null>(null);
  const [supportRows, setSupportRows] = useState<SupportTicketRow[]>([]);
  const [rmaRows, setRmaRows] = useState<DashboardRmaRow[]>([]);
  const [invoiceRows, setInvoiceRows] = useState<Array<{
    id: string;
    client_id: string;
    order_id?: number;
    invoice_number: string;
    subtotal: number;
    iva_total: number;
    total: number;
    currency: "ARS" | "USD";
    exchange_rate?: number | null;
    status: string;
    created_at: string;
    due_date?: string;
  }>>([]);
  const [paymentRows, setPaymentRows] = useState<CommercialPayment[]>([]);
  const [profileRows, setProfileRows] = useState<ExtendedCommercialProfile[]>([]);
  const [productRows, setProductRows] = useState<CommercialProduct[]>([]);
  const [sellerRows, setSellerRows] = useState<SellerRow[]>([]);
  const [analyticsData, setAnalyticsData] = useState<{ monthly: any[]; categories: any[]; products: any[] }>({
    monthly: [],
    categories: [],
    products: []
  });

  useEffect(() => {
    Promise.all([
      supabase
        .from("invoices")
        .select("id, client_id, order_id, invoice_number, subtotal, iva_total, total, currency, exchange_rate, status, created_at, due_date")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("profiles")
        .select("id, company_name, contact_name, credit_limit, credit_used, estado, assigned_seller_id, vendedor_id")
        .limit(500),
      supabase
        .from("products")
        .select("id, name, stock, stock_min")
        .eq("active", true)
        .limit(300),
      supabase
        .from("account_movements")
        .select("id, client_id, monto, fecha, tipo, descripcion, reference_id, reference_type")
        .eq("tipo", "pago")
        .order("fecha", { ascending: false })
        .limit(200),
      supabase
        .from("support_tickets")
        .select("id, client_id, category, status, priority, subject, updated_at")
        .order("updated_at", { ascending: false })
        .limit(200),
      supabase
        .from("rma_requests")
        .select("id, client_id, status, rma_number, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("profiles")
        .select("id, company_name, contact_name")
        .eq("role", "vendedor")
        .limit(100),
      supabase.from("analytics_monthly_sales").select("*"),
      supabase.from("analytics_category_stats").select("*"),
      supabase.from("analytics_top_products").select("*"),
    ]).then(([invoiceResult, profileResult, productResult, paymentResult, supportResult, rmaResult, sellerResult, monthlyRes, catRes, prodRes]) => {
      setAnalyticsData({
        monthly: monthlyRes.data ?? [],
        categories: catRes.data ?? [],
        products: prodRes.data ?? []
      });
      const invoices = (invoiceResult.data ?? []) as Array<{
        id: string;
        client_id: string;
        order_id?: number;
        invoice_number: string;
        subtotal: number;
        iva_total: number;
        total: number;
        currency: "ARS" | "USD";
        exchange_rate?: number | null;
        status: string;
        created_at: string;
        due_date?: string;
      }>;
      const profiles = (profileResult.data ?? []) as ExtendedCommercialProfile[];

      setInvoiceRows(invoices);
      setProfileRows(profiles);
      setProductRows((productResult.data ?? []) as CommercialProduct[]);
      setPaymentRows((paymentResult.data ?? []) as CommercialPayment[]);
      setSupportRows((supportResult.data ?? []) as SupportTicketRow[]);
      setRmaRows((rmaResult.data ?? []) as DashboardRmaRow[]);
      setSellerRows((sellerResult.data ?? []) as SellerRow[]);
      const sumInvoiceTotalsInPreferredCurrency = (rows: typeof invoices) =>
        rows.reduce((sum, row) => {
          const effective = getEffectiveInvoiceAmounts(
            {
              id: row.id,
              invoice_number: row.invoice_number,
              client_id: row.client_id,
              order_id: row.order_id,
              items: [],
              subtotal: row.subtotal ?? 0,
              iva_total: row.iva_total ?? 0,
              total: row.total ?? 0,
              currency: row.currency ?? "USD",
              exchange_rate: row.exchange_rate ?? undefined,
              status: row.status as "draft" | "sent" | "paid" | "overdue" | "cancelled",
              due_date: row.due_date,
              created_at: row.created_at,
            },
            exchangeRate.rate
          );

          if (effective.currency === currency) {
            return sum + effective.total;
          }

          return sum + (effective.currency === "USD"
            ? effective.total * exchangeRate.rate
            : effective.total / exchangeRate.rate);
        }, 0);

      setInvoiceKpis({
        pendingAmount: sumInvoiceTotalsInPreferredCurrency(
          invoices.filter((row) => ["sent", "overdue"].includes(row.status))
        ),
        overdueCount: invoices.filter((row) => row.status === "overdue").length,
        overdueAmount: sumInvoiceTotalsInPreferredCurrency(
          invoices.filter((row) => row.status === "overdue")
        ),
      });
      setCreditExposure(profiles.reduce((s, r) => s + (r.credit_used ?? 0), 0));
    });
  }, [currency, exchangeRate.rate]);

  const approvedOrders  = useMemo(() => orders.filter(isRevenueOrder), [orders]);
  const pendingOrders   = useMemo(() => orders.filter((o) => o.status === "pending"),  [orders]);
  const totalRevenue    = useMemo(() => approvedOrders.reduce((s, o) => s + o.total, 0), [approvedOrders]);
  const avgOrder        = approvedOrders.length > 0 ? totalRevenue / approvedOrders.length : 0;

  const approvedQuotes  = useMemo(() => quotes.filter((q) => q.status === "approved"), [quotes]);
  const draftQuotes     = useMemo(() => quotes.filter((q) => q.status === "draft"),    [quotes]);
  const conversionRate  = quotes.length > 0 ? (approvedQuotes.length / quotes.length) * 100 : 0;

  // ── MoM comparison ─────────────────────────────────────────────────────
  const momStats = useMemo(() => {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const prevDate  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

    const cur  = approvedOrders.filter((o) => o.created_at.startsWith(thisMonth));
    const prev = approvedOrders.filter((o) => o.created_at.startsWith(prevMonth));

    const currentMonthRevenue = cur.reduce((s, o) => s + o.total, 0);
    const prevMonthRevenue    = prev.reduce((s, o) => s + o.total, 0);
    const momPct = prevMonthRevenue > 0
      ? ((currentMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100
      : null;

    const curAvg  = cur.length  > 0 ? currentMonthRevenue / cur.length  : 0;
    const prevAvg = prev.length > 0 ? prevMonthRevenue    / prev.length : 0;
    const avgTicketPct = prevAvg > 0 ? ((curAvg - prevAvg) / prevAvg) * 100 : null;

    const ordersPct = prev.length > 0
      ? ((cur.length - prev.length) / prev.length) * 100
      : null;

    return { currentMonthRevenue, prevMonthRevenue, momPct, curOrders: cur.length, prevOrders: prev.length, ordersPct, avgTicketPct };
  }, [approvedOrders]);

  const { currentMonthRevenue, prevMonthRevenue, momPct, curOrders, prevOrders, ordersPct, avgTicketPct } = momStats;

  // ── Avg margin ─────────────────────────────────────────────────────────
  const avgMargin = useMemo(() => {
    let totalWeighted = 0;
    let totalValue = 0;
    approvedOrders.forEach((o) => {
      o.products?.forEach((p) => {
        if (p.margin != null && p.total_price != null) {
          totalWeighted += p.margin * p.total_price;
          totalValue += p.total_price;
        }
      });
    });
    return totalValue > 0 ? totalWeighted / totalValue : 0;
  }, [approvedOrders]);

  const momTrend: "up" | "down" | "flat" = momPct == null ? "flat" : momPct > 0 ? "up" : momPct < 0 ? "down" : "flat";
  const ordersTrend: "up" | "down" | "flat" = ordersPct == null ? "flat" : ordersPct > 0 ? "up" : ordersPct < 0 ? "down" : "flat";
  const avgTicketTrend: "up" | "down" | "flat" = avgTicketPct == null ? "flat" : avgTicketPct > 0 ? "up" : avgTicketPct < 0 ? "down" : "flat";
  const clientMap = useMemo(() => {
    const map: Record<string, string> = {};
    clients.forEach((client) => {
      map[client.id] = client.company_name || client.contact_name || client.id;
    });
    return map;
  }, [clients]);
  const stories = useMemo(
    () =>
      buildCommercialStories({
        orders,
        quotes: quotes.map((quote) => ({
          id: quote.id,
          client_id: quote.client_id,
          total: quote.total,
          status: quote.status,
          created_at: quote.created_at,
          order_id: quote.order_id,
        })),
        invoices: invoiceRows,
        payments: paymentRows,
        clientMap,
      }),
    [orders, quotes, invoiceRows, paymentRows, clientMap]
  );
  const commercialAlerts = useMemo(
    () => buildCommercialAlerts({ orders, invoices: invoiceRows, profiles: profileRows, products: productRows }),
    [orders, invoiceRows, profileRows, productRows]
  );
  const commercialTasks = useMemo(
    () => buildCommercialTasks(stories, profileRows),
    [stories, profileRows]
  );
  const lowStockCount = useMemo(
    () => productRows.filter((product) => (product.stock ?? 0) <= (product.stock_min ?? 0)).length,
    [productRows]
  );
  const highSeverityAlerts = useMemo(
    () => commercialAlerts.filter((alert) => alert.severity === "high").length,
    [commercialAlerts]
  );
  const expiringQuotes = useMemo(() => {
    const now = Date.now();
    const soonWindow = now + 3 * 86400000;

    return quotes.filter((quote) => {
      if (["converted", "rejected", "expired"].includes(quote.status)) return false;
      const expiresAt = quote.expires_at
        ? new Date(quote.expires_at).getTime()
        : quote.valid_days
          ? new Date(quote.created_at).getTime() + quote.valid_days * 86400000
          : null;
      return expiresAt != null && expiresAt >= now && expiresAt <= soonWindow;
    });
  }, [quotes]);
  const openRmas = useMemo(
    () => rmaRows.filter((rma) => !["resolved", "rejected"].includes(rma.status)),
    [rmaRows]
  );
  const dailyOpsItems = useMemo(
    () => [
      {
        id: "approve",
        label: "Para aprobar",
        value: String(orders.filter((order) => ["pending", "pending_approval"].includes(order.status)).length),
        detail: "Pedidos esperando validaci?n comercial.",
        accent: "text-yellow-400",
        tab: "orders",
      },
      {
        id: "prepare",
        label: "Para preparar",
        value: String(orders.filter((order) => order.status === "approved").length),
        detail: "Pedidos aprobados sin preparaci?n iniciada.",
        accent: "text-blue-400",
        tab: "orders",
      },
      {
        id: "dispatch",
        label: "Para despachar",
        value: String(orders.filter((order) => order.status === "preparing").length),
        detail: "Pedidos listos para remito o salida.",
        accent: "text-purple-400",
        tab: "orders",
      },
      {
        id: "tickets",
        label: "Tickets nuevos",
        value: String(supportRows.filter((ticket) => ["open", "in_analysis"].includes(ticket.status)).length),
        detail: "Casos activos en soporte/postventa.",
        accent: "text-red-400",
        tab: "support",
      },
      {
        id: "logistics",
        label: "Incidencias",
        value: String(
          supportRows.filter((ticket) =>
            ticket.category === "LOGISTICA" || (ticket.priority === "urgent" && ticket.category === "RMA")
          ).length
        ),
        detail: "Log?stica, RMA o urgencias abiertas.",
        accent: "text-amber-400",
        tab: "support",
      },
    ],
    [orders, supportRows]
  );
  const exceptionItems = useMemo(
    () => [
      {
        id: "pending-orders",
        label: "Pedidos frenados",
        value: String(pendingOrders.length),
        detail: pendingOrders.length > 0 ? "Requieren validaci?n comercial." : "Sin backlog inmediato.",
        severity: pendingOrders.length > 0 ? "high" as const : "low" as const,
      },
      {
        id: "overdue-invoices",
        label: "Facturas vencidas",
        value: String(invoiceKpis?.overdueCount ?? 0),
        detail: invoiceKpis?.overdueAmount ? formatPrice(invoiceKpis.overdueAmount, currency) : "Sin deuda vencida.",
        severity: (invoiceKpis?.overdueCount ?? 0) > 0 ? "high" as const : "low" as const,
      },
      {
        id: "low-stock",
        label: "Stock critico",
        value: String(lowStockCount),
        detail: lowStockCount > 0 ? "Productos por debajo de m?nimo." : "Inventario bajo control.",
        severity: lowStockCount > 0 ? "medium" as const : "low" as const,
      },
      {
        id: "quotes-expiring",
        label: "Cotizaciones venciendo",
        value: String(expiringQuotes.length),
        detail: expiringQuotes.length > 0 ? "Requieren seguimiento comercial en 72h." : "Sin vencimientos inmediatos.",
        severity: expiringQuotes.length > 0 ? "medium" as const : "low" as const,
      },
      {
        id: "rmas-open",
        label: "RMAs abiertos",
        value: String(openRmas.length),
        detail: openRmas.length > 0 ? "Casos de devoluci?n o postventa activos." : "Sin RMAs en curso.",
        severity: openRmas.length > 0 ? "medium" as const : "low" as const,
      },
      {
        id: "alerts",
        label: "Alertas severas",
        value: String(highSeverityAlerts),
        detail: highSeverityAlerts > 0 ? "Revisar cr?dito, cobranzas y pedidos demorados." : "Sin incidentes cr?ticos.",
        severity: highSeverityAlerts > 0 ? "high" as const : "low" as const,
      },
    ],
    [currency, exchangeRate.rate, expiringQuotes.length, highSeverityAlerts, invoiceKpis?.overdueAmount, invoiceKpis?.overdueCount, lowStockCount, openRmas.length, pendingOrders.length]
  );
  const growthAccounts = useMemo(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const previousDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonth = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, "0")}`;
    const byClient = new Map<string, { current: number; previous: number }>();

    approvedOrders.forEach((order) => {
      const bucket = byClient.get(order.client_id) ?? { current: 0, previous: 0 };
      if (order.created_at.startsWith(currentMonth)) bucket.current += order.total;
      if (order.created_at.startsWith(previousMonth)) bucket.previous += order.total;
      byClient.set(order.client_id, bucket);
    });

    return Array.from(byClient.entries())
      .map(([clientId, value]) => {
        const name = clientMap[clientId] || clientId;
        const trend = value.current >= value.previous ? "up" as const : "down" as const;
        const base = value.previous > 0 ? value.previous : Math.max(value.current, 1);
        const deltaPct = ((value.current - value.previous) / base) * 100;
        return { id: clientId, name, current: value.current, previous: value.previous, trend, deltaPct };
      })
      .filter((item) => item.current > 0 || item.previous > 0)
      .sort((left, right) => Math.abs(right.deltaPct) - Math.abs(left.deltaPct))
      .slice(0, 6);
  }, [approvedOrders, clientMap]);
  const catalogInsights = useMemo(() => {
    const soldProductNames = new Set<string>();
    const marginByProduct = new Map<string, { totalPrice: number; weightedMargin: number }>();

    approvedOrders.forEach((order) => {
      order.products?.forEach((product) => {
        if (product.name) soldProductNames.add(product.name);
        if (product.name && product.total_price != null && product.margin != null) {
          const current = marginByProduct.get(product.name) ?? { totalPrice: 0, weightedMargin: 0 };
          current.totalPrice += product.total_price;
          current.weightedMargin += product.margin * product.total_price;
          marginByProduct.set(product.name, current);
        }
      });
    });

    const nonMoving = productRows
      .filter((product) => !soldProductNames.has(product.name) && (product.stock ?? 0) > 0)
      .sort((left, right) => (right.stock ?? 0) - (left.stock ?? 0))
      .slice(0, 4)
      .map((product) => ({ id: product.id, name: product.name, stock: product.stock ?? 0 }));

    const marginAlerts = Array.from(marginByProduct.entries())
      .map(([name, value]) => ({ name, marginPct: value.totalPrice > 0 ? value.weightedMargin / value.totalPrice : 0 }))
      .filter((item) => item.marginPct > 0 && item.marginPct < 12)
      .sort((left, right) => left.marginPct - right.marginPct)
      .slice(0, 4);

    return { nonMoving, marginAlerts };
  }, [approvedOrders, productRows]);
  const managerPortfolio = useMemo(() => {
    const sellerNameMap = new Map<string, string>();
    sellerRows.forEach((seller) => {
      sellerNameMap.set(seller.id, seller.contact_name || seller.company_name || seller.id);
    });

    const byManager = new Map<string, { name: string; accounts: Set<string>; revenue: number; alerts: number; pipeline: number }>();

    const ensureManager = (managerId: string) => {
      const existing = byManager.get(managerId);
      if (existing) return existing;
      const entry = {
        name: sellerNameMap.get(managerId) || managerId,
        accounts: new Set<string>(),
        revenue: 0,
        alerts: 0,
        pipeline: 0,
      };
      byManager.set(managerId, entry);
      return entry;
    };

    profileRows.forEach((profile) => {
      const managerId = profile.assigned_seller_id || profile.vendedor_id;
      if (!managerId) return;
      const entry = ensureManager(managerId);
      entry.accounts.add(profile.id);
      if ((profile.estado && profile.estado !== "activo") || ((profile.credit_limit ?? 0) > 0 && (profile.credit_used ?? 0) >= (profile.credit_limit ?? 0))) {
        entry.alerts += 1;
      }
    });

    approvedOrders.forEach((order) => {
      const profile = profileRows.find((item) => item.id === order.client_id);
      const managerId = profile?.assigned_seller_id || profile?.vendedor_id;
      if (!managerId) return;
      ensureManager(managerId).revenue += order.total;
    });

    quotes.forEach((quote) => {
      if (!["sent", "viewed", "approved"].includes(quote.status) || quote.order_id != null) return;
      const profile = profileRows.find((item) => item.id === quote.client_id);
      const managerId = profile?.assigned_seller_id || profile?.vendedor_id;
      if (!managerId) return;
      ensureManager(managerId).pipeline += 1;
    });

    return Array.from(byManager.entries())
      .map(([id, value]) => ({ id, name: value.name, accounts: value.accounts.size, revenue: value.revenue, alerts: value.alerts, pipeline: value.pipeline }))
      .sort((left, right) => right.revenue - left.revenue)
      .slice(0, 6);
  }, [approvedOrders, profileRows, quotes, sellerRows]);


  const focusItems = useMemo(() => [
    {
      id: "pending-orders",
      label: "pedidos sin aprobar",
      count: orders.filter((o) => ["pending", "pending_approval"].includes(o.status)).length,
      severity: "high" as const,
      tab: "orders",
    },
    {
      id: "expiring-quotes",
      label: "cotizaciones venciendo",
      count: expiringQuotes.length,
      severity: "medium" as const,
      tab: "quotes_admin",
    },
    {
      id: "low-stock",
      label: "productos en stock crítico",
      count: lowStockCount,
      severity: "medium" as const,
      tab: "products",
    },
    {
      id: "overdue-invoices",
      label: "facturas vencidas",
      count: invoiceKpis?.overdueCount ?? 0,
      severity: "high" as const,
      tab: "invoices",
    },
  ], [orders, expiringQuotes.length, lowStockCount, invoiceKpis?.overdueCount]);

  return (
    <div className="space-y-6">

      {/* ── Atención inmediata ── */}
      <FocusBar items={focusItems} onOpenTab={onOpenTab} />

      {/* ── Delete history ── */}
      <DeleteHistoryPanel isDark={isDark} onRefreshOrders={onRefreshOrders} />

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Ventas este mes" value={formatPrice(currentMonthRevenue)}
          sub={prevMonthRevenue > 0
            ? `Mes anterior: ${formatPrice(prevMonthRevenue)}`
            : `Total acum.: ${formatPrice(totalRevenue)}`}
          icon={TrendingUp} accent="bg-[#2D9F6A]/15 text-[#2D9F6A]"
          trend={momTrend} trendPct={momPct ?? undefined} isDark={isDark} />
        <KpiCard label="Cotizaciones" value={String(quotes.length)}
          sub={`${draftQuotes.length} en borrador`}
          icon={FileText} accent="bg-blue-500/15 text-blue-400"
          trend={quotes.length > 0 ? "up" : "flat"} isDark={isDark} />
        <KpiCard label="Pedidos este mes" value={String(curOrders)}
          sub={prevOrders > 0 ? `Mes anterior: ${prevOrders}` : `Total: ${orders.length}`}
          icon={Clock} accent={curOrders > 0 ? "bg-yellow-500/15 text-yellow-400" : "bg-[#1a1a1a] text-[#525252]"}
          trend={ordersTrend} trendPct={ordersPct ?? undefined} isDark={isDark} />
        <KpiCard label="Conversión" value={`${conversionRate.toFixed(1)}%`}
          sub={`${approvedQuotes.length} cot. aprobada${approvedQuotes.length !== 1 ? "s" : ""}`}
          icon={Target} accent="bg-purple-500/15 text-purple-400"
          trend={conversionRate >= 50 ? "up" : "flat"} isDark={isDark} />
      </div>

      <ExceptionHub isDark={isDark} items={exceptionItems} />

      <DailyOpsPanel items={dailyOpsItems} isDark={isDark} onOpenTab={onOpenTab} />

      <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr_1fr]">
        <GrowthAccountsPanel items={growthAccounts} currency={currency} exchangeRate={exchangeRate} isDark={isDark} />
        <CatalogIntelligencePanel nonMoving={catalogInsights.nonMoving} marginAlerts={catalogInsights.marginAlerts} isDark={isDark} />
        <ManagerPortfolioPanel items={managerPortfolio} currency={currency} exchangeRate={exchangeRate} isDark={isDark} />
      </div>

      {/* -- Charts -- */}
      <AnalyticsCharts isDark={isDark} stats={analyticsData} />

      {/* -- Activity & Secondary -- */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className={DASHBOARD_TILE}>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Ticket promedio</p>
          <div className="flex items-end gap-2">
            <p className="text-xl font-extrabold tabular-nums text-foreground">{formatPrice(avgOrder)}</p>
            {avgTicketPct != null && (
              <span className={`mb-0.5 flex items-center gap-0.5 text-[10px] font-semibold ${avgTicketTrend === "up" ? "text-primary" : avgTicketTrend === "down" ? "text-red-500" : "text-muted-foreground"}`}>
                {avgTicketTrend === "up" ? <ArrowUpRight size={11} /> : avgTicketTrend === "down" ? <ArrowDownRight size={11} /> : <MinusIcon size={11} />}
                {Math.abs(avgTicketPct).toFixed(0)}%
              </span>
            )}
          </div>
        </div>
        <div className={DASHBOARD_TILE}>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Margen promedio</p>
          <p className={`text-xl font-extrabold tabular-nums ${avgMargin > 0 ? "text-primary" : "text-muted-foreground"}`}>
            {avgMargin > 0 ? `${avgMargin.toFixed(1)}%` : "-"}
          </p>
        </div>
        <div className={DASHBOARD_TILE}>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Pedidos rechazados</p>
          <p className="text-xl font-extrabold tabular-nums text-red-500">
            {orders.filter((o) => o.status === "rejected").length}
          </p>
        </div>
        <div className={DASHBOARD_TILE}>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Clientes activos</p>
          <div className="flex items-center gap-2">
            <Users size={14} className="text-primary" />
            <p className="text-xl font-extrabold tabular-nums text-foreground">{clients.length}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <div className={DASHBOARD_TILE}>
          <div className="mb-1 flex items-center gap-2">
            <Receipt size={12} className="text-blue-500" />
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Facturas pendientes</p>
          </div>
          <p className={`text-xl font-extrabold tabular-nums ${invoiceKpis ? "text-blue-500" : "text-muted-foreground"}`}>
            {invoiceKpis != null ? formatMoneyInPreferredCurrency(invoiceKpis.pendingAmount, currency, currency, exchangeRate.rate, 0) : "..."}
          </p>
        </div>
        <div className={DASHBOARD_TILE}>
          <div className="mb-1 flex items-center gap-2">
            <AlertTriangle size={12} className="text-red-500" />
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Facturas vencidas</p>
          </div>
          <div className="flex items-end gap-2">
            <p className={`text-xl font-extrabold tabular-nums ${invoiceKpis && invoiceKpis.overdueCount > 0 ? "text-red-500" : "text-muted-foreground"}`}>
              {invoiceKpis != null ? invoiceKpis.overdueCount : "..."}
            </p>
            {invoiceKpis != null && invoiceKpis.overdueAmount > 0 && (
              <p className="mb-0.5 text-[10px] tabular-nums text-red-500/70">
                {formatMoneyInPreferredCurrency(invoiceKpis.overdueAmount, currency, currency, exchangeRate.rate, 0)}
              </p>
            )}
          </div>
        </div>
        <div className={DASHBOARD_TILE}>
          <div className="mb-1 flex items-center gap-2">
            <CreditCard size={12} className="text-amber-500" />
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Exposicion credito</p>
          </div>
          <p className={`text-xl font-extrabold tabular-nums ${creditExposure != null && creditExposure > 0 ? "text-amber-500" : "text-muted-foreground"}`}>
            {creditExposure != null ? formatMoneyInPreferredCurrency(creditExposure, "ARS", currency, exchangeRate.rate, 0) : "..."}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <QuotePipelinePanel quotes={quotes} isDark={isDark} />
        <AtRiskClientsPanel profiles={profileRows} clients={clients} isDark={isDark} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <CollectionsPulsePanel
          stories={stories}
          payments={paymentRows}
          currency={currency}
          exchangeRate={exchangeRate}
          isDark={isDark}
          onOpenTab={onOpenTab}
        />
        <OpportunityRadarPanel
          quotes={quotes}
          currency={currency}
          exchangeRate={exchangeRate}
          isDark={isDark}
          onOpenTab={onOpenTab}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <CommercialAlertsPanel alerts={commercialAlerts} isDark={isDark} />
        <CommercialTasksPanel tasks={commercialTasks} isDark={isDark} />
        <ProfitabilityPanel orders={approvedOrders} isDark={isDark} />
      </div>

      {/* ── Charts row ── */}
      <div className="grid lg:grid-cols-2 gap-4">
        <RevenueSparkline orders={orders} isDark={isDark} />
        <QuoteStatusBreakdown quotes={quotes} isDark={isDark} />
      </div>

      {/* ── Bottom row ── */}
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.9fr_0.9fr]">
        <div className="xl:col-span-1">
          <ActivityFeed orders={orders} quotes={quotes} clients={clients} isDark={isDark} />
        </div>
        <TopProducts orders={orders} isDark={isDark} />
        <TopClients orders={orders} clients={clients} isDark={isDark} />
      </div>

    </div>
  );
}
