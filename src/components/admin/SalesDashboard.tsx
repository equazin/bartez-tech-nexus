import { useMemo } from "react";
import { Quote, QuoteStatus } from "@/models/quote";
import { useCurrency } from "@/context/CurrencyContext";
import {
  TrendingUp, FileText, Clock, Target, ShoppingBag,
  CheckCircle2, XCircle, AlertTriangle, Send, Eye, Ban,
  ArrowUpRight, ArrowDownRight, Minus as MinusIcon,
  Package, Users,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────
interface SupabaseOrder {
  id: string;
  client_id: string;
  products: Array<{ name: string; quantity: number; unit_price?: number; total_price?: number }>;
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
}

// ── Quote helpers ────────────────────────────────────────────────────────────
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

// ── Status configs ───────────────────────────────────────────────────────────
const ORDER_STATUS: Record<string, { label: string; icon: any; color: string; bg: string; border: string }> = {
  pending:  { label: "En revisión", icon: Clock,        color: "text-yellow-400", bg: "bg-yellow-500/15", border: "border-yellow-500/30" },
  approved: { label: "Aprobado",    icon: CheckCircle2, color: "text-green-400",  bg: "bg-green-500/15",  border: "border-green-500/30" },
  rejected: { label: "Rechazado",   icon: XCircle,      color: "text-red-400",    bg: "bg-red-500/15",    border: "border-red-500/30" },
};

const QUOTE_STATUS: Record<QuoteStatus, { label: string; icon: any; color: string; bar: string }> = {
  draft:    { label: "Borrador",  icon: FileText,     color: "text-[#a3a3a3]",  bar: "bg-[#404040]" },
  sent:     { label: "Enviada",   icon: Send,         color: "text-blue-400",   bar: "bg-blue-500" },
  viewed:   { label: "Vista",     icon: Eye,          color: "text-purple-400", bar: "bg-purple-500" },
  approved: { label: "Aprobada",  icon: CheckCircle2, color: "text-green-400",  bar: "bg-green-500" },
  rejected: { label: "Rechazada", icon: XCircle,      color: "text-red-400",    bar: "bg-red-500" },
  expired:  { label: "Expirada",  icon: AlertTriangle, color: "text-amber-400", bar: "bg-amber-500" },
};

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, icon: Icon, accent, trend,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: any;
  accent: string;
  trend?: "up" | "down" | "flat";
}) {
  const TrendIcon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : MinusIcon;
  const trendColor = trend === "up" ? "text-green-400" : trend === "down" ? "text-red-400" : "text-gray-600";
  return (
    <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl px-5 py-5 flex flex-col gap-3 hover:border-[#2a2a2a] transition">
      <div className="flex items-start justify-between">
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${accent}`}>
          <Icon size={17} />
        </div>
        {trend && (
          <span className={`flex items-center gap-0.5 text-[11px] font-semibold ${trendColor}`}>
            <TrendIcon size={13} />
          </span>
        )}
      </div>
      <div>
        <div className="text-2xl font-extrabold text-white tracking-tight">{value}</div>
        <div className="text-xs text-[#737373] mt-0.5 font-medium">{label}</div>
        {sub && <div className="text-[11px] text-[#525252] mt-1">{sub}</div>}
      </div>
    </div>
  );
}

// ── Revenue Sparkline (7-day CSS bars) ───────────────────────────────────────
function RevenueSparkline({ orders }: { orders: SupabaseOrder[] }) {
  const { formatPrice } = useCurrency();

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const iso = d.toISOString().split("T")[0];
      const label = d.toLocaleDateString("es-AR", { weekday: "short" });
      const revenue = orders
        .filter((o) => o.status === "approved" && o.created_at.startsWith(iso))
        .reduce((s, o) => s + o.total, 0);
      return { iso, label, revenue };
    });
  }, [orders]);

  const max = Math.max(...days.map((d) => d.revenue), 1);
  const totalWeek = days.reduce((s, d) => s + d.revenue, 0);

  return (
    <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">Ventas — últimos 7 días</h3>
          <p className="text-xs text-[#737373] mt-0.5">Solo pedidos aprobados</p>
        </div>
        <div className="text-right">
          <div className="text-lg font-extrabold text-[#2D9F6A] tabular-nums">{formatPrice(totalWeek)}</div>
          <div className="text-[10px] text-[#525252]">esta semana</div>
        </div>
      </div>

      {/* Bars */}
      <div className="flex items-end gap-1.5 h-20">
        {days.map((d) => {
          const pct = max > 0 ? (d.revenue / max) * 100 : 0;
          const isToday = d.iso === new Date().toISOString().split("T")[0];
          return (
            <div key={d.iso} className="flex-1 flex flex-col items-center gap-1 group relative">
              {/* Tooltip */}
              {d.revenue > 0 && (
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-2 py-1 text-[10px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition z-10 pointer-events-none">
                  {formatPrice(d.revenue)}
                </div>
              )}
              <div className="w-full relative" style={{ height: "64px" }}>
                <div
                  className={`absolute bottom-0 w-full rounded-t-md transition-all ${
                    isToday ? "bg-[#2D9F6A]" : "bg-[#1f1f1f] group-hover:bg-[#2D9F6A]/50"
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
function QuoteStatusBreakdown({ quotes }: { quotes: Quote[] }) {
  const total = quotes.length;
  const byStatus = useMemo(() => {
    const counts: Partial<Record<QuoteStatus, number>> = {};
    quotes.forEach((q) => { counts[q.status] = (counts[q.status] || 0) + 1; });
    return counts;
  }, [quotes]);

  const statuses: QuoteStatus[] = ["draft", "sent", "viewed", "approved", "rejected", "expired"];

  return (
    <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">Estado de cotizaciones</h3>
          <p className="text-xs text-[#737373] mt-0.5">{total} cotización{total !== 1 ? "es" : ""} en total</p>
        </div>
        {total === 0 && (
          <span className="text-[11px] text-[#525252]">Sin datos</span>
        )}
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
                <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
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
  orders, quotes, clients,
}: { orders: SupabaseOrder[]; quotes: Quote[]; clients: ClientProfile[] }) {
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
    <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#1a1a1a]">
        <h3 className="text-sm font-bold text-white">Actividad reciente</h3>
        <p className="text-xs text-[#737373] mt-0.5">Órdenes y cotizaciones combinadas</p>
      </div>

      {feed.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-[#525252] gap-2">
          <Clock size={28} className="opacity-20" />
          <p className="text-sm">Sin actividad registrada</p>
        </div>
      ) : (
        <div className="divide-y divide-[#141414]">
          {feed.map((item, i) => {
            if (item.kind === "order") {
              const o = item.data;
              const cfg = ORDER_STATUS[o.status] ?? ORDER_STATUS.pending;
              const Icon = cfg.icon;
              return (
                <div key={`o-${o.id}-${i}`} className="flex items-center justify-between px-5 py-3 hover:bg-[#141414] transition">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${cfg.bg} ${cfg.border} border`}>
                      <ShoppingBag size={13} className={cfg.color} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">
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
                <div key={`q-${q.id}-${i}`} className="flex items-center justify-between px-5 py-3 hover:bg-[#141414] transition">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 bg-blue-500/10 border border-blue-500/20">
                      <FileText size={13} className="text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">
                        COT-{String(q.id).padStart(4, "0")} · {q.client_name}
                      </p>
                      <p className="text-[10px] text-[#525252] truncate">
                        {q.items.length} producto{q.items.length !== 1 ? "s" : ""} · {item.date.toLocaleDateString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-[#1a1a1a] border-[#2a2a2a] ${cfg.color}`}>
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
function TopProducts({ orders }: { orders: SupabaseOrder[] }) {
  const { formatPrice } = useCurrency();

  const topProducts = useMemo(() => {
    const map: Record<string, { name: string; qty: number; revenue: number }> = {};
    orders
      .filter((o) => o.status === "approved")
      .forEach((o) => {
        o.products?.forEach((p) => {
          if (!p.name) return;
          if (!map[p.name]) map[p.name] = { name: p.name, qty: 0, revenue: 0 };
          map[p.name].qty += p.quantity || 0;
          map[p.name].revenue += p.total_price || 0;
        });
      });
    return Object.values(map)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [orders]);

  const maxRevenue = Math.max(...topProducts.map((p) => p.revenue), 1);

  return (
    <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl p-5 flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-bold text-white">Top productos</h3>
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
                    <span className="text-xs font-medium text-[#a3a3a3] truncate">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-2">
                    <span className="text-[10px] text-[#525252]">×{p.qty}</span>
                    <span className="text-xs font-bold text-[#2D9F6A] tabular-nums">{formatPrice(p.revenue)}</span>
                  </div>
                </div>
                <div className="h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
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

// ── Main Component ────────────────────────────────────────────────────────────
export function SalesDashboard({ orders, clients }: Props) {
  const { formatPrice } = useCurrency();
  const quotes = useMemo(() => getAllQuotes(), []);

  // ── Metrics ────────────────────────────────────────────────────────────────
  const approvedOrders  = useMemo(() => orders.filter((o) => o.status === "approved"), [orders]);
  const pendingOrders   = useMemo(() => orders.filter((o) => o.status === "pending"),  [orders]);
  const totalRevenue    = useMemo(() => approvedOrders.reduce((s, o) => s + o.total, 0), [approvedOrders]);
  const avgOrder        = approvedOrders.length > 0 ? totalRevenue / approvedOrders.length : 0;

  const approvedQuotes  = useMemo(() => quotes.filter((q) => q.status === "approved"), [quotes]);
  const draftQuotes     = useMemo(() => quotes.filter((q) => q.status === "draft"),    [quotes]);
  const conversionRate  = quotes.length > 0 ? (approvedQuotes.length / quotes.length) * 100 : 0;

  return (
    <div className="space-y-6">

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Ventas totales"
          value={formatPrice(totalRevenue)}
          sub={`${approvedOrders.length} pedido${approvedOrders.length !== 1 ? "s" : ""} aprobado${approvedOrders.length !== 1 ? "s" : ""}`}
          icon={TrendingUp}
          accent="bg-[#2D9F6A]/15 text-[#2D9F6A]"
          trend={totalRevenue > 0 ? "up" : "flat"}
        />
        <KpiCard
          label="Cotizaciones"
          value={String(quotes.length)}
          sub={`${draftQuotes.length} en borrador`}
          icon={FileText}
          accent="bg-blue-500/15 text-blue-400"
          trend={quotes.length > 0 ? "up" : "flat"}
        />
        <KpiCard
          label="Pedidos pendientes"
          value={String(pendingOrders.length)}
          sub={`de ${orders.length} en total`}
          icon={Clock}
          accent={pendingOrders.length > 0 ? "bg-yellow-500/15 text-yellow-400" : "bg-[#1a1a1a] text-[#525252]"}
          trend={pendingOrders.length > 0 ? "up" : "flat"}
        />
        <KpiCard
          label="Conversión"
          value={`${conversionRate.toFixed(1)}%`}
          sub={`${approvedQuotes.length} cot. aprobada${approvedQuotes.length !== 1 ? "s" : ""}`}
          icon={Target}
          accent="bg-purple-500/15 text-purple-400"
          trend={conversionRate >= 50 ? "up" : conversionRate > 0 ? "flat" : "flat"}
        />
      </div>

      {/* ── Avg order + Clients summary ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#111] border border-[#1f1f1f] rounded-xl px-4 py-3 col-span-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#525252] mb-1">Ticket promedio</p>
          <p className="text-xl font-extrabold text-white tabular-nums">{formatPrice(avgOrder)}</p>
        </div>
        <div className="bg-[#111] border border-[#1f1f1f] rounded-xl px-4 py-3 col-span-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#525252] mb-1">Pedidos rechazados</p>
          <p className="text-xl font-extrabold text-red-400 tabular-nums">
            {orders.filter((o) => o.status === "rejected").length}
          </p>
        </div>
        <div className="bg-[#111] border border-[#1f1f1f] rounded-xl px-4 py-3 col-span-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#525252] mb-1">Clientes activos</p>
          <div className="flex items-center gap-2">
            <Users size={14} className="text-[#2D9F6A]" />
            <p className="text-xl font-extrabold text-white tabular-nums">{clients.length}</p>
          </div>
        </div>
        <div className="bg-[#111] border border-[#1f1f1f] rounded-xl px-4 py-3 col-span-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#525252] mb-1">Cot. aprobadas</p>
          <p className="text-xl font-extrabold text-green-400 tabular-nums">{approvedQuotes.length}</p>
        </div>
      </div>

      {/* ── Charts row ── */}
      <div className="grid lg:grid-cols-2 gap-4">
        <RevenueSparkline orders={orders} />
        <QuoteStatusBreakdown quotes={quotes} />
      </div>

      {/* ── Bottom row ── */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ActivityFeed orders={orders} quotes={quotes} clients={clients} />
        </div>
        <TopProducts orders={orders} />
      </div>

    </div>
  );
}
