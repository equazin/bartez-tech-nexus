import { useMemo, useState, useEffect } from "react";
import { Quote, QuoteStatus } from "@/models/quote";
import { useCurrency } from "@/context/CurrencyContext";
import {
  TrendingUp, FileText, Clock, Target, ShoppingBag,
  CheckCircle2, XCircle, AlertTriangle, Send, Eye, Ban,
  ArrowUpRight, ArrowDownRight, Minus as MinusIcon,
  Package, Users, Trash2, Receipt, CreditCard,
  type LucideIcon,
} from "lucide-react";
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
  const dk = (d: string, l: string) => isDark ? d : l;
  const TrendIcon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : MinusIcon;
  const trendColor = trend === "up" ? "text-green-400" : trend === "down" ? "text-red-400" : "text-gray-500";
  return (
    <div className={`${dk("bg-[#111] border-[#1f1f1f] hover:border-[#2a2a2a]", "bg-white border-[#e5e5e5] hover:border-[#d4d4d4]")} border rounded-2xl px-5 py-5 flex flex-col gap-3 transition`}>
      <div className="flex items-start justify-between">
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${accent}`}>
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
        <div className={`text-2xl font-extrabold tracking-tight ${dk("text-white", "text-[#171717]")}`}>{value}</div>
        <div className="text-xs text-[#737373] mt-0.5 font-medium">{label}</div>
        {sub && <div className="text-[11px] text-[#525252] mt-1">{sub}</div>}
      </div>
    </div>
  );
}

// ── Revenue Sparkline (7-day CSS bars) ───────────────────────────────────────
function RevenueSparkline({ orders, isDark }: { orders: SupabaseOrder[]; isDark: boolean }) {
  const dk = (d: string, l: string) => isDark ? d : l;
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
    <div className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-2xl p-5 flex flex-col gap-4`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>Ventas — últimos 7 días</h3>
          <p className="text-xs text-[#737373] mt-0.5">Solo pedidos aprobados</p>
        </div>
        <div className="text-right">
          <div className="text-lg font-extrabold text-[#2D9F6A] tabular-nums">{formatPrice(totalWeek)}</div>
          <div className="text-[10px] text-[#525252]">esta semana</div>
        </div>
      </div>

      <div className="flex items-end gap-1.5 h-20">
        {days.map((d) => {
          const pct = max > 0 ? (d.revenue / max) * 100 : 0;
          const isToday = d.iso === new Date().toISOString().split("T")[0];
          return (
            <div key={d.iso} className="flex-1 flex flex-col items-center gap-1 group relative">
              {d.revenue > 0 && (
                <div className={`absolute bottom-full mb-1 left-1/2 -translate-x-1/2 ${dk("bg-[#1e1e1e] border-[#2a2a2a] text-white", "bg-white border-[#e5e5e5] text-[#171717]")} border rounded-lg px-2 py-1 text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition z-10 pointer-events-none shadow-lg`}>
                  {formatPrice(d.revenue)}
                </div>
              )}
              <div className="w-full relative" style={{ height: "64px" }}>
                <div
                  className={`absolute bottom-0 w-full rounded-t-md transition-all ${
                    isToday ? "bg-[#2D9F6A]" : dk("bg-[#1f1f1f] group-hover:bg-[#2D9F6A]/50", "bg-[#e0e0e0] group-hover:bg-[#2D9F6A]/40")
                  }`}
                  style={{ height: `${Math.max(pct, d.revenue > 0 ? 4 : 0)}%` }}
                />
              </div>
              <span className={`text-[9px] font-medium ${isToday ? "text-[#2D9F6A]" : "text-[#525252]"}`}>
                {d.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Quote Status Breakdown ───────────────────────────────────────────────────
function QuoteStatusBreakdown({ quotes, isDark }: { quotes: Quote[]; isDark: boolean }) {
  const dk = (d: string, l: string) => isDark ? d : l;
  const total = quotes.length;
  const byStatus = useMemo(() => {
    const counts: Partial<Record<QuoteStatus, number>> = {};
    quotes.forEach((q) => { counts[q.status] = (counts[q.status] || 0) + 1; });
    return counts;
  }, [quotes]);

  const statuses: QuoteStatus[] = ["draft", "sent", "viewed", "approved", "rejected", "expired"];

  return (
    <div className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-2xl p-5 flex flex-col gap-4`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>Estado de cotizaciones</h3>
          <p className="text-xs text-[#737373] mt-0.5">{total} cotización{total !== 1 ? "es" : ""} en total</p>
        </div>
        {total === 0 && <span className="text-[11px] text-[#525252]">Sin datos</span>}
      </div>

      {total === 0 ? (
        <div className="flex items-center justify-center py-8 text-[#525252]">
          <FileText size={24} className="opacity-30" />
        </div>
      ) : (
        <div className="space-y-3">
          {statuses.map((s) => {
            const count = byStatus[s] || 0;
            if (count === 0) return null;
            const pct = total > 0 ? (count / total) * 100 : 0;
            const { label, icon: Icon, color, bar } = QUOTE_STATUS[s];
            return (
              <div key={s}>
                <div className="flex items-center justify-between mb-1">
                  <div className={`flex items-center gap-1.5 text-xs font-medium ${color}`}>
                    <Icon size={11} /> {label}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#525252]">{count}</span>
                    <span className="text-[11px] text-[#737373] tabular-nums w-8 text-right">{pct.toFixed(0)}%</span>
                  </div>
                </div>
                <div className={`h-1.5 ${dk("bg-[#1a1a1a]", "bg-[#e8e8e8]")} rounded-full overflow-hidden`}>
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

// ── Activity Feed ────────────────────────────────────────────────────────────
type FeedItem =
  | { kind: "order"; data: SupabaseOrder; date: Date }
  | { kind: "quote"; data: Quote; date: Date };

function ActivityFeed({
  orders, quotes, clients, isDark,
}: { orders: SupabaseOrder[]; quotes: Quote[]; clients: ClientProfile[]; isDark: boolean }) {
  const dk = (d: string, l: string) => isDark ? d : l;
  const { formatPrice } = useCurrency();

  const clientName = (id: string) => {
    const c = clients.find((cl) => cl.id === id);
    return c?.company_name || c?.contact_name || id.slice(0, 8) + "…";
  };

  const feed: FeedItem[] = useMemo(() => {
    const items: FeedItem[] = [
      ...orders.slice(0, 10).map((o) => ({ kind: "order" as const, data: o, date: new Date(o.created_at) })),
      ...quotes.slice(0, 10).map((q) => ({ kind: "quote" as const, data: q, date: new Date(q.created_at) })),
    ];
    return items.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 10);
  }, [orders, quotes]);

  return (
    <div className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-2xl overflow-hidden`}>
      <div className={`px-5 py-4 border-b ${dk("border-[#1a1a1a]", "border-[#e8e8e8]")}`}>
        <h3 className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>Actividad reciente</h3>
        <p className="text-xs text-[#737373] mt-0.5">Órdenes y cotizaciones combinadas</p>
      </div>

      {feed.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-[#525252] gap-2">
          <Clock size={28} className="opacity-20" />
          <p className="text-sm">Sin actividad registrada</p>
        </div>
      ) : (
        <div className={`divide-y ${dk("divide-[#141414]", "divide-[#f0f0f0]")}`}>
          {feed.map((item, i) => {
            if (item.kind === "order") {
              const o = item.data;
              const cfg = ORDER_STATUS[o.status] ?? ORDER_STATUS.pending;
              const Icon = cfg.icon;
              return (
                <div key={`o-${o.id}-${i}`} className={`flex items-center justify-between px-5 py-3 ${dk("hover:bg-[#141414]", "hover:bg-[#fafafa]")} transition`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${cfg.bg} ${cfg.border} border`}>
                      <ShoppingBag size={13} className={cfg.color} />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-semibold truncate ${dk("text-white", "text-[#171717]")}`}>
                        Pedido #{String(o.id).slice(-6).toUpperCase()}
                      </p>
                      <p className="text-[10px] text-[#525252] truncate">
                        {clientName(o.client_id)} · {item.date.toLocaleDateString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                      <Icon size={9} /> {cfg.label}
                    </span>
                    <span className="text-sm font-bold text-[#2D9F6A] tabular-nums">{formatPrice(o.total)}</span>
                  </div>
                </div>
              );
            } else {
              const q = item.data;
              const cfg = QUOTE_STATUS[q.status] ?? QUOTE_STATUS.draft;
              const Icon = cfg.icon;
              return (
                <div key={`q-${q.id}-${i}`} className={`flex items-center justify-between px-5 py-3 ${dk("hover:bg-[#141414]", "hover:bg-[#fafafa]")} transition`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 bg-blue-500/10 border border-blue-500/20">
                      <FileText size={13} className="text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-semibold truncate ${dk("text-white", "text-[#171717]")}`}>
                        COT-{String(q.id).padStart(4, "0")} · {q.client_name}
                      </p>
                      <p className="text-[10px] text-[#525252] truncate">
                        {q.items.length} producto{q.items.length !== 1 ? "s" : ""} · {item.date.toLocaleDateString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${dk("bg-[#1a1a1a] border-[#2a2a2a]", "bg-[#f0f0f0] border-[#e0e0e0]")} ${cfg.color}`}>
                      <Icon size={9} /> {cfg.label}
                    </span>
                    <span className="text-sm font-bold text-[#2D9F6A] tabular-nums">{formatPrice(q.total)}</span>
                  </div>
                </div>
              );
            }
          })}
        </div>
      )}
    </div>
  );
}

// ── Top Products ─────────────────────────────────────────────────────────────
function TopProducts({ orders, isDark }: { orders: SupabaseOrder[]; isDark: boolean }) {
  const dk = (d: string, l: string) => isDark ? d : l;
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
    <div className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-2xl p-5 flex flex-col gap-4`}>
      <div>
        <h3 className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>Top productos</h3>
        <p className="text-xs text-[#737373] mt-0.5">Por facturación (pedidos aprobados)</p>
      </div>

      {topProducts.length === 0 ? (
        <div className="flex items-center justify-center py-8 text-[#525252]">
          <Package size={24} className="opacity-30" />
        </div>
      ) : (
        <div className="space-y-3">
          {topProducts.map((p, i) => {
            const pct = (p.revenue / maxRevenue) * 100;
            return (
              <div key={p.name}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-bold text-[#525252] w-4 shrink-0">#{i + 1}</span>
                    <span className={`text-xs font-medium truncate ${dk("text-[#a3a3a3]", "text-[#525252]")}`}>{p.name}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-2">
                    <span className="text-[10px] text-[#525252]">×{p.qty}</span>
                    <span className="text-xs font-bold text-[#2D9F6A] tabular-nums">{formatPrice(p.revenue)}</span>
                  </div>
                </div>
                <div className={`h-1 ${dk("bg-[#1a1a1a]", "bg-[#e8e8e8]")} rounded-full overflow-hidden`}>
                  <div className="h-full bg-[#2D9F6A]/60 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Top Clients ──────────────────────────────────────────────────────────────
function TopClients({
  orders, clients, isDark,
}: { orders: SupabaseOrder[]; clients: ClientProfile[]; isDark: boolean }) {
  const dk = (d: string, l: string) => isDark ? d : l;
  const { formatPrice } = useCurrency();

  const topClients = useMemo(() => {
    const map: Record<string, { name: string; revenue: number; orderCount: number }> = {};
    orders
      .filter(isRevenueOrder)
      .forEach((o) => {
        if (!o.client_id) return;
        if (!map[o.client_id]) {
          const c = clients.find((cl) => cl.id === o.client_id);
          const name = c?.company_name || c?.contact_name || o.client_id.slice(0, 8) + "…";
          map[o.client_id] = { name, revenue: 0, orderCount: 0 };
        }
        map[o.client_id].revenue += o.total;
        map[o.client_id].orderCount += 1;
      });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [orders, clients]);

  const maxRevenue = Math.max(...topClients.map((c) => c.revenue), 1);

  return (
    <div className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-2xl p-5 flex flex-col gap-4`}>
      <div>
        <h3 className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>Top clientes</h3>
        <p className="text-xs text-[#737373] mt-0.5">Por facturación (pedidos aprobados)</p>
      </div>

      {topClients.length === 0 ? (
        <div className="flex items-center justify-center py-8 text-[#525252]">
          <Users size={24} className="opacity-30" />
        </div>
      ) : (
        <div className="space-y-3">
          {topClients.map((c, i) => {
            const pct = (c.revenue / maxRevenue) * 100;
            return (
              <div key={c.name}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-bold text-[#525252] w-4 shrink-0">#{i + 1}</span>
                    <span className={`text-xs font-medium truncate ${dk("text-[#a3a3a3]", "text-[#525252]")}`}>{c.name}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-2">
                    <span className="text-[10px] text-[#525252]">{c.orderCount}p</span>
                    <span className="text-xs font-bold text-[#2D9F6A] tabular-nums">{formatPrice(c.revenue)}</span>
                  </div>
                </div>
                <div className={`h-1 ${dk("bg-[#1a1a1a]", "bg-[#e8e8e8]")} rounded-full overflow-hidden`}>
                  <div className="h-full bg-blue-500/60 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Delete History Panel ──────────────────────────────────────────────────────
function DeleteHistoryPanel({ isDark, onRefreshOrders }: { isDark: boolean; onRefreshOrders?: () => void }) {
  const dk = (d: string, l: string) => isDark ? d : l;
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
    { label: "último día",    days: 1 },
    { label: "última semana", days: 7 },
    { label: "último mes",    days: 30 },
  ];

  return (
    <>
      <div className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-2xl px-5 py-4 flex flex-wrap items-center gap-3`}>
        <div className="flex items-center gap-2 shrink-0">
          <div className="h-7 w-7 rounded-lg flex items-center justify-center bg-red-500/10 border border-red-500/20">
            <Trash2 size={13} className="text-red-400" />
          </div>
          <span className={`text-xs font-semibold ${dk("text-[#a3a3a3]", "text-[#525252]")}`}>Limpiar historial</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {periods.map(({ label, days }) => (
            <button
              key={label}
              onClick={() => setPending({ label, days })}
              disabled={deleting !== null}
              className={`text-xs px-3 py-1.5 rounded-lg border transition disabled:opacity-40 ${
                dk(
                  "border-[#2a2a2a] text-[#737373] hover:border-red-500/40 hover:text-red-400 hover:bg-red-500/5",
                  "border-[#e0e0e0] text-[#737373] hover:border-red-400/50 hover:text-red-500 hover:bg-red-50"
                )
              }`}
            >
              {deleting === label ? "Eliminando…" : `Borrar ${label}`}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-[#525252] ml-auto">Elimina pedidos y cotizaciones del período</p>
      </div>

      <AlertDialog open={!!pending} onOpenChange={(open) => { if (!open) setPending(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar historial del {pending?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán pedidos y cotizaciones de los últimos {pending?.days} día{pending?.days !== 1 ? "s" : ""}.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-500 text-white"
            >
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
  const dk = (d: string, l: string) => isDark ? d : l;

  return (
    <div className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-2xl overflow-hidden`}>
      <div className={`px-5 py-4 border-b ${dk("border-[#1a1a1a]", "border-[#e8e8e8]")}`}>
        <h3 className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>Alertas automáticas</h3>
        <p className="text-xs text-[#737373] mt-0.5">Stock, crédito, cobranzas y pedidos demorados.</p>
      </div>
      <div className="px-5 py-4 space-y-3">
        {alerts.length === 0 ? (
          <p className="text-xs text-[#525252]">Sin alertas críticas por ahora.</p>
        ) : (
          alerts.map((alert) => (
            <div key={alert.id} className={`rounded-xl border px-3 py-3 ${alert.severity === "high" ? "border-red-500/20 bg-red-500/10" : "border-amber-500/20 bg-amber-500/10"}`}>
              <div className="flex items-center justify-between gap-3">
                <p className={`text-xs font-semibold ${alert.severity === "high" ? "text-red-400" : "text-amber-400"}`}>{alert.title}</p>
                <span className="text-[10px] uppercase tracking-widest text-[#525252]">{alert.type.replace(/_/g, " ")}</span>
              </div>
              <p className="text-[11px] text-[#737373] mt-1">{alert.detail}</p>
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
  const dk = (d: string, l: string) => isDark ? d : l;

  return (
    <div className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-2xl overflow-hidden`}>
      <div className={`px-5 py-4 border-b ${dk("border-[#1a1a1a]", "border-[#e8e8e8]")}`}>
        <h3 className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>Seguimiento y cobranza</h3>
        <p className="text-xs text-[#737373] mt-0.5">Acciones sugeridas para hoy, sin perder el hilo comercial.</p>
      </div>
      <div className="px-5 py-4 space-y-3">
        {tasks.length === 0 ? (
          <p className="text-xs text-[#525252]">No hay acciones urgentes pendientes.</p>
        ) : (
          tasks.map((task) => (
            <div key={task.id} className={`rounded-xl border px-3 py-3 ${dk("border-[#1a1a1a] bg-[#0d0d0d]", "border-[#ececec] bg-[#fafafa]")}`}>
              <div className="flex items-center justify-between gap-3">
                <p className={`text-xs font-semibold ${dk("text-white", "text-[#171717]")}`}>{task.title}</p>
                <span className="text-[10px] uppercase tracking-widest text-[#2D9F6A]">{task.kind.replace(/_/g, " ")}</span>
              </div>
              <p className="text-[11px] text-[#737373] mt-1">{task.detail}</p>
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
  const dk = (d: string, l: string) => isDark ? d : l;
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
    <div className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-2xl overflow-hidden`}>
      <div className={`px-5 py-4 border-b ${dk("border-[#1a1a1a]", "border-[#e8e8e8]")}`}>
        <h3 className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>Rentabilidad por pedido</h3>
        <p className="text-xs text-[#737373] mt-0.5">Visible solo en admin. El cliente nunca ve este margen real.</p>
      </div>
      <div className="px-5 py-4 space-y-3">
        {profitableOrders.length === 0 ? (
          <p className="text-xs text-[#525252]">Todavía no hay pedidos con costo suficiente para calcular margen real.</p>
        ) : (
          profitableOrders.map(({ order, metrics }) => (
            <div key={order.id} className={`rounded-xl border px-3 py-3 ${dk("border-[#1a1a1a] bg-[#0d0d0d]", "border-[#ececec] bg-[#fafafa]")}`}>
              <div className="flex items-center justify-between gap-3">
                <p className={`text-xs font-semibold ${dk("text-white", "text-[#171717]")}`}>{order.order_number ?? `#${String(order.id).slice(-6).toUpperCase()}`}</p>
                <span className={`text-xs font-bold ${metrics.marginPct >= 20 ? "text-[#2D9F6A]" : metrics.marginPct >= 10 ? "text-amber-400" : "text-red-400"}`}>
                  {metrics.marginPct.toFixed(1)}%
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-2 text-[11px]">
                <div>
                  <p className="text-[#525252] uppercase tracking-widest">Venta</p>
                  <p className={`font-semibold ${dk("text-[#d4d4d4]", "text-[#404040]")}`}>{formatPrice(metrics.revenue)}</p>
                </div>
                <div>
                  <p className="text-[#525252] uppercase tracking-widest">Costo</p>
                  <p className={`font-semibold ${dk("text-[#d4d4d4]", "text-[#404040]")}`}>{formatPrice(metrics.cost)}</p>
                </div>
                <div>
                  <p className="text-[#525252] uppercase tracking-widest">Margen</p>
                  <p className="font-semibold text-[#2D9F6A]">{formatPrice(metrics.grossProfit)}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Async invoice/credit KPIs ─────────────────────────────────────────────────
interface InvoiceKpis {
  pendingAmount: number;
  overdueCount: number;
  overdueAmount: number;
}

// ── Main Component ────────────────────────────────────────────────────────────
export function SalesDashboard({ orders, clients, isDark, onRefreshOrders }: Props) {
  const dk = (d: string, l: string) => isDark ? d : l;
  const { currency, exchangeRate, formatPrice } = useCurrency();
  const quotes = useMemo(() => getAllQuotes(), []);

  // Async: invoices + credit exposure
  const [invoiceKpis, setInvoiceKpis] = useState<InvoiceKpis | null>(null);
  const [creditExposure, setCreditExposure] = useState<number | null>(null);
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
  const [profileRows, setProfileRows] = useState<CommercialProfile[]>([]);
  const [productRows, setProductRows] = useState<CommercialProduct[]>([]);

  useEffect(() => {
    Promise.all([
      supabase
        .from("invoices")
        .select("id, client_id, order_id, invoice_number, subtotal, iva_total, total, currency, exchange_rate, status, created_at, due_date")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("profiles")
        .select("id, company_name, contact_name, credit_limit, credit_used, estado")
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
    ]).then(([invoiceResult, profileResult, productResult, paymentResult]) => {
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
      const profiles = (profileResult.data ?? []) as CommercialProfile[];

      setInvoiceRows(invoices);
      setProfileRows(profiles);
      setProductRows((productResult.data ?? []) as CommercialProduct[]);
      setPaymentRows((paymentResult.data ?? []) as CommercialPayment[]);
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

  return (
    <div className="space-y-6">

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

      {/* ── Secondary metrics ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-xl px-4 py-3`}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#525252] mb-1">Ticket promedio</p>
          <div className="flex items-end gap-2">
            <p className={`text-xl font-extrabold tabular-nums ${dk("text-white", "text-[#171717]")}`}>{formatPrice(avgOrder)}</p>
            {avgTicketPct != null && (
              <span className={`text-[10px] font-semibold mb-0.5 flex items-center gap-0.5 ${avgTicketTrend === "up" ? "text-green-400" : avgTicketTrend === "down" ? "text-red-400" : "text-gray-500"}`}>
                {avgTicketTrend === "up" ? <ArrowUpRight size={11} /> : avgTicketTrend === "down" ? <ArrowDownRight size={11} /> : <MinusIcon size={11} />}
                {Math.abs(avgTicketPct).toFixed(0)}%
              </span>
            )}
          </div>
        </div>
        <div className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-xl px-4 py-3`}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#525252] mb-1">Margen promedio</p>
          <p className={`text-xl font-extrabold tabular-nums ${avgMargin > 0 ? "text-[#2D9F6A]" : dk("text-[#525252]", "text-[#a3a3a3]")}`}>
            {avgMargin > 0 ? `${avgMargin.toFixed(1)}%` : "—"}
          </p>
        </div>
        <div className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-xl px-4 py-3`}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#525252] mb-1">Pedidos rechazados</p>
          <p className="text-xl font-extrabold text-red-400 tabular-nums">
            {orders.filter((o) => o.status === "rejected").length}
          </p>
        </div>
        <div className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-xl px-4 py-3`}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#525252] mb-1">Clientes activos</p>
          <div className="flex items-center gap-2">
            <Users size={14} className="text-[#2D9F6A]" />
            <p className={`text-xl font-extrabold tabular-nums ${dk("text-white", "text-[#171717]")}`}>{clients.length}</p>
          </div>
        </div>
      </div>

      {/* ── Invoice + Credit KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-xl px-4 py-3`}>
          <div className="flex items-center gap-2 mb-1">
            <Receipt size={12} className="text-blue-400" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#525252]">Facturas pendientes</p>
          </div>
          <p className={`text-xl font-extrabold tabular-nums ${invoiceKpis ? "text-blue-400" : dk("text-[#525252]", "text-[#a3a3a3]")}`}>
            {invoiceKpis != null ? formatMoneyInPreferredCurrency(invoiceKpis.pendingAmount, currency, currency, exchangeRate.rate, 0) : "…"}
          </p>
        </div>
        <div className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-xl px-4 py-3`}>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={12} className="text-red-400" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#525252]">Facturas vencidas</p>
          </div>
          <div className="flex items-end gap-2">
            <p className={`text-xl font-extrabold tabular-nums ${invoiceKpis && invoiceKpis.overdueCount > 0 ? "text-red-400" : dk("text-[#525252]", "text-[#a3a3a3]")}`}>
              {invoiceKpis != null ? invoiceKpis.overdueCount : "…"}
            </p>
            {invoiceKpis != null && invoiceKpis.overdueAmount > 0 && (
              <p className="text-[10px] text-red-400/70 mb-0.5 tabular-nums">
                {formatMoneyInPreferredCurrency(invoiceKpis.overdueAmount, currency, currency, exchangeRate.rate, 0)}
              </p>
            )}
          </div>
        </div>
        <div className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-xl px-4 py-3`}>
          <div className="flex items-center gap-2 mb-1">
            <CreditCard size={12} className="text-amber-400" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#525252]">Exposición crédito</p>
          </div>
          <p className={`text-xl font-extrabold tabular-nums ${creditExposure != null && creditExposure > 0 ? "text-amber-400" : dk("text-[#525252]", "text-[#a3a3a3]")}`}>
            {creditExposure != null ? formatMoneyInPreferredCurrency(creditExposure, "ARS", currency, exchangeRate.rate, 0) : "…"}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
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
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <ActivityFeed orders={orders} quotes={quotes} clients={clients} isDark={isDark} />
        </div>
        <TopProducts orders={orders} isDark={isDark} />
        <TopClients orders={orders} clients={clients} isDark={isDark} />
      </div>

    </div>
  );
}
