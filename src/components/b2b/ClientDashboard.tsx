/**
 * ClientDashboard — Home del portal B2B
 * Muestra saldo, crédito, próximo vencimiento y último pedido en un pantallazo.
 */
import { useMemo } from "react";
import {
  ShoppingCart, FileText, CreditCard, AlertTriangle,
  CheckCircle2, Clock, Package, TrendingUp, ArrowRight,
  CalendarClock, Wallet, ReceiptText, RefreshCw,
} from "lucide-react";
import type { PortalOrder } from "@/hooks/useOrders";
import type { Invoice } from "@/lib/api/invoices";
import type { UserProfile } from "@/lib/supabase";
import { formatMoneyAmount, getEffectiveInvoiceAmounts, convertMoneyAmount } from "@/lib/money";
import { useCurrency } from "@/context/CurrencyContext";

interface ClientDashboardProps {
  profile: UserProfile;
  orders: PortalOrder[];
  invoices: Invoice[];
  creditLimit: number;
  creditUsed: number;
  isDark: boolean;
  onGoTo: (tab: "catalog" | "orders" | "invoices" | "cuenta") => void;
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

export function ClientDashboard({
  profile,
  orders,
  invoices,
  creditLimit,
  creditUsed,
  isDark,
  onGoTo,
}: ClientDashboardProps) {
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

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Greeting */}
      <div>
        <h2 className={`text-lg font-bold ${dk("text-white", "text-[#171717]")}`}>
          Bienvenido, {profile.company_name || profile.contact_name}
        </h2>
        <p className="text-xs text-[#737373] mt-0.5">
          Resumen de tu cuenta · {new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      {/* Alerta deuda vencida */}
      {overdueInvoices.length > 0 && (
        <button
          onClick={() => onGoTo("invoices")}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/8 text-left hover:bg-red-500/12 transition"
        >
          <AlertTriangle size={16} className="text-red-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-400">
              {overdueInvoices.length} factura{overdueInvoices.length !== 1 ? "s" : ""} vencida{overdueInvoices.length !== 1 ? "s" : ""}
            </p>
            <p className="text-xs text-red-400/70">
              Deuda vencida: {formatMoneyAmount(overdueDebt, currency, 0)} · Contactá a tu ejecutivo de cuenta
            </p>
          </div>
          <ArrowRight size={14} className="text-red-400 flex-shrink-0" />
        </button>
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
            <div>
              <div className="flex items-center gap-2 mb-1">
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
