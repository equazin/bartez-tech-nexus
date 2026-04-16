import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Clock,
  CreditCard,
  FileText,
  LayoutGrid,
  MessageSquare,
  Package,
  Plus,
  ReceiptText,
  ShoppingCart,
  ShieldCheck,
  Truck,
  User,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/ui/metric-card";
import { Skeleton } from "@/components/ui/skeleton";
import { SurfaceCard } from "@/components/ui/surface-card";
import { useCurrency } from "@/context/CurrencyContext";
import type { PriceAgreement } from "@/hooks/usePriceAgreements";
import type { RmaRequest } from "@/hooks/useRma";
import type { PortalOrder } from "@/hooks/useOrders";
import type { BusinessAlert } from "@/hooks/useBusinessAlerts";
import type { Invoice } from "@/lib/api/invoices";
import { generateWhatsAppDirectUrl } from "@/lib/api/whatsapp";
import { convertMoneyAmount, formatMoneyAmount, getEffectiveInvoiceAmounts } from "@/lib/money";
import { supabase } from "@/lib/supabase";
import type { UserProfile } from "@/lib/supabase";
import type { Product } from "@/models/products";
import { WelcomeHero } from "@/components/b2b/WelcomeHero";
import { LoyaltyPanel } from "@/components/b2b/LoyaltyPanel";


export interface AssignedSeller {
  id: string;
  name: string;
  phone?: string;
}

interface SupportTicketSummary {
  id: string;
  subject: string;
  status: "open" | "in_analysis" | "tech_assigned" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "critical";
  updated_at: string;
}

interface ClientDashboardProps {
  profile: UserProfile;
  orders: PortalOrder[];
  invoices: Invoice[];
  products: Product[];
  creditLimit: number;
  creditUsed: number;
  onGoTo: (tab: "catalog" | "orders" | "invoices" | "cuenta" | "projects" | "support" | "rma" | "quotes") => void;
  onAddToCart: (product: Product, qty: number) => void;
  alerts?: BusinessAlert[];
  assignedSeller?: AssignedSeller | null;
  activeAgreement?: PriceAgreement | null;
  projects?: any[];
  onCreateProject?: (name: string) => void;
}

type PartnerLevel = "cliente" | "silver" | "gold" | "platinum";

const PARTNER_LEVEL_LABEL: Record<PartnerLevel, string> = {
  cliente: "Cliente",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
};

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  pending_approval: "En revision",
  approved: "Aprobado",
  preparing: "Preparando",
  shipped: "Enviado",
  dispatched: "Despachado",
  delivered: "Entregado",
  rejected: "Rechazado",
};

const ORDER_STATUS_CLASS: Record<string, string> = {
  pending: "border-amber-500/20 bg-amber-500/10 text-amber-500",
  pending_approval: "border-blue-500/20 bg-blue-500/10 text-blue-500",
  approved: "border-primary/20 bg-primary/10 text-primary",
  preparing: "border-blue-500/20 bg-blue-500/10 text-blue-500",
  shipped: "border-violet-500/20 bg-violet-500/10 text-violet-500",
  dispatched: "border-violet-500/20 bg-violet-500/10 text-violet-500",
  delivered: "border-primary/20 bg-primary/10 text-primary",
  rejected: "border-destructive/20 bg-destructive/10 text-destructive",
};

const ALERT_COLOR_MAP: Record<string, string> = {
  invoice: "text-amber-500",
  rma: "text-primary",
  promotion: "text-blue-500",
  info: "text-sky-500",
  warning: "text-destructive",
};

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

export function ClientDashboard({
  profile,
  orders,
  invoices,
  products,
  creditLimit,
  creditUsed,
  onGoTo,
  onAddToCart,
  alerts = [],
  assignedSeller,
  activeAgreement,
  projects = [],
  onCreateProject,
}: ClientDashboardProps) {
  const [supportTickets, setSupportTickets] = useState<SupportTicketSummary[]>([]);
  const [rmaRequests, setRmaRequests] = useState<RmaRequest[]>([]);
  const { currency, exchangeRate } = useCurrency();

  useEffect(() => {
    let cancelled = false;

    async function loadServiceSignals() {
      if (!profile.id) return;

      const [ticketsResult, rmaResult] = await Promise.all([
        supabase
          .from("support_tickets")
          .select("id, subject, status, priority, updated_at")
          .eq("client_id", profile.id)
          .order("updated_at", { ascending: false })
          .limit(4),
        supabase
          .from("rma_requests")
          .select("*")
          .eq("client_id", profile.id)
          .order("created_at", { ascending: false })
          .limit(4),
      ]);

      if (cancelled) return;
      setSupportTickets((ticketsResult.data ?? []) as SupportTicketSummary[]);
      setRmaRequests((rmaResult.data ?? []) as RmaRequest[]);
    }

    void loadServiceSignals();
    return () => {
      cancelled = true;
    };
  }, [profile.id]);

  const partnerLevel = (profile.partner_level as PartnerLevel) || "cliente";
  const safePartnerLevel = PARTNER_LEVEL_LABEL[partnerLevel] ? partnerLevel : "cliente";
  const greetingName = profile.contact_name?.split(" ")[0] || profile.company_name || "equipo";
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? "Buenos días" : currentHour < 20 ? "Buenas tardes" : "Buenas noches";

  const activeOrders = useMemo(() => orders.filter((o) => !["delivered", "rejected"].includes(o.status)), [orders]);
  const lastOrder = orders[0] ?? null;
  const pendingInvoices = useMemo(() => invoices.filter((i) => ["sent", "overdue", "draft"].includes(i.status)), [invoices]);
  const overdueInvoices = useMemo(
    () => invoices.filter((i) => i.status === "overdue" || (i.status === "sent" && i.due_date && daysUntil(i.due_date) < 0)),
    [invoices],
  );
  const dueInvoices = useMemo(
    () =>
      pendingInvoices
        .filter((i) => i.due_date)
        .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime()),
    [pendingInvoices],
  );
  const pendingDebt = useMemo(
    () =>
      pendingInvoices.reduce((sum, i) => {
        const effective = getEffectiveInvoiceAmounts(i, exchangeRate.rate);
        return sum + convertMoneyAmount(effective.total, effective.currency, currency, exchangeRate.rate);
      }, 0),
    [currency, exchangeRate.rate, pendingInvoices],
  );

  const overdueDebt = useMemo(
    () =>
      overdueInvoices.reduce((sum, i) => {
        const effective = getEffectiveInvoiceAmounts(i, exchangeRate.rate);
        return sum + convertMoneyAmount(effective.total, effective.currency, currency, exchangeRate.rate);
      }, 0),
    [currency, exchangeRate.rate, overdueInvoices],
  );

  const creditPct = creditLimit > 0 ? Math.min(100, (creditUsed / creditLimit) * 100) : 0;
  const sellerName = assignedSeller?.name ?? "Bartez Soporte";
  const sellerUrl = generateWhatsAppDirectUrl(assignedSeller?.phone);

  const spendingStats = useMemo(() => {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1).getTime();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const delivered = orders.filter((o) => o.status === "delivered");
    const ytd = delivered.filter((o) => new Date(o.created_at).getTime() >= yearStart);
    const month = delivered.filter((o) => new Date(o.created_at).getTime() >= monthStart);

    const ytdTotal = ytd.reduce((s, o) => s + (o.total ?? 0), 0);
    const monthTotal = month.reduce((s, o) => s + (o.total ?? 0), 0);
    const avgOrder = ytd.length > 0 ? ytdTotal / ytd.length : 0;

    const buckets: number[] = [];
    for (let i = 5; i >= 0; i -= 1) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1).getTime();
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1).getTime();
      const total = delivered
        .filter((o) => {
          const t = new Date(o.created_at).getTime();
          return t >= start && t < end;
        })
        .reduce((s, o) => s + (o.total ?? 0), 0);
      buckets.push(total);
    }

    return {
      ytdTotal,
      monthTotal,
      avgOrder,
      buckets,
      maxBucket: Math.max(...buckets, 1),
      ytdCount: ytd.length,
    };
  }, [orders]);

  const serviceInsights = useMemo(() => {
    const activeTickets = supportTickets.filter((t) => !["resolved", "closed"].includes(t.status));
    const activeRmas = rmaRequests.filter((r) => !["resolved", "rejected"].includes(r.status));
    const maxPriority = activeTickets.reduce<SupportTicketSummary["priority"] | null>((cur, t) => {
      const rank: Record<SupportTicketSummary["priority"], number> = { low: 0, medium: 1, high: 2, critical: 3 };
      if (!cur) return t.priority;
      return rank[t.priority] > rank[cur] ? t.priority : cur;
    }, null);
    const slaHours = maxPriority === "critical" ? 2 : maxPriority === "high" ? 4 : maxPriority === "medium" ? 8 : 24;

    return {
      activeTickets,
      activeRmas,
      recentTickets: supportTickets.slice(0, 3),
      slaLabel: `${slaHours}h hábiles`,
    };
  }, [rmaRequests, supportTickets]);

  // ── Max 3 action items, sorted by urgency ──────────────────────────────
  const actionItems = useMemo(
    () =>
      [
        creditPct >= 80
          ? {
              id: "credit",
              label: "Revisar crédito disponible",
              description: `La línea está al ${creditPct.toFixed(0)}% de uso.`,
              tone: "warning" as const,
              action: () => onGoTo("cuenta"),
              cta: "Ver cuenta",
            }
          : null,
        activeOrders.length > 0
          ? {
              id: "orders",
              label: "Pedidos en curso",
              description: `${activeOrders.length} pedido${activeOrders.length !== 1 ? "s" : ""} en operación.`,
              tone: "info" as const,
              action: () => onGoTo("orders"),
              cta: "Ver pedidos",
            }
          : null,
      ]
        .filter(Boolean) as Array<{
        id: string;
        label: string;
        description: string;
        tone: "danger" | "info" | "warning" | "success";
        action: () => void;
        cta: string;
      }>,
    [activeOrders.length, creditPct, onGoTo],
  );

  const reorderCandidates = useMemo(() => {
    const purchaseMap = new Map<number, { count: number; qty: number; product: Product }>();
    orders.forEach((o) => {
      o.products.forEach((item) => {
        const product = products.find((p) => p.id === item.product_id);
        if (!product) return;
        const cur = purchaseMap.get(product.id) ?? { count: 0, qty: 0, product };
        cur.count += 1;
        cur.qty += item.quantity;
        purchaseMap.set(product.id, cur);
      });
    });
    return Array.from(purchaseMap.values())
      .filter(({ product }) => (product.stock ?? 0) > 0)
      .sort((a, b) => b.count - a.count || b.qty - a.qty)
      .slice(0, 4)
      .map(({ product, count, qty }) => ({
        product,
        count,
        suggestedQty: Math.max(product.min_order_qty ?? 1, Math.ceil(qty / Math.max(count, 1))),
      }));
  }, [orders, products]);

  const financialHealth = useMemo(() => {
    if (profile.estado === "bloqueado") {
      return { label: "Cuenta bloqueada", tone: "danger" as const, description: "Requiere intervención del equipo de cobranzas." };
    }
    if (overdueInvoices.length > 0 || creditPct >= 95) {
      return {
        label: "Riesgo alto",
        tone: "warning" as const,
        description: overdueInvoices.length > 0 ? `${overdueInvoices.length} factura${overdueInvoices.length !== 1 ? "s" : ""} vencida${overdueInvoices.length !== 1 ? "s" : ""}.` : "Línea de crédito casi agotada.",
      };
    }
    if (creditPct >= 80 || pendingInvoices.length > 0) {
      return { label: "Seguimiento activo", tone: "info" as const, description: "Monitorear crédito y vencimientos próximos." };
    }
    return { label: "Cuenta operativa", tone: "success" as const, description: "Sin alertas críticas." };
  }, [creditPct, overdueInvoices.length, pendingInvoices.length, profile.estado]);

  const promoAlerts = useMemo(() => alerts.filter((a) => a.type === "promotion").slice(0, 2), [alerts]);
  const offerProducts = useMemo(
    () => products.filter((p) => (p.offer_percent ?? 0) > 0 || p.special_price != null).slice(0, 3),
    [products],
  );
  const hasPromoContent = promoAlerts.length > 0 || offerProducts.length > 0 || !!activeAgreement;

  const creditAvailable = creditLimit > 0 ? Math.max(0, creditLimit - creditUsed) : null;
  const thisMonthOrders = useMemo(() => {
    const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
    return orders.filter((o) => new Date(o.created_at).getTime() >= start && o.status === "delivered");
  }, [orders]);

  const kpis = [
    {
      label: "Pedidos activos",
      value: String(activeOrders.length),
      detail: activeOrders.length > 0 ? `${ORDER_STATUS_LABEL[activeOrders[0]?.status] ?? activeOrders[0]?.status}` : "Sin pedidos en curso",
      icon: <ShoppingCart className="h-5 w-5" />,
      onClick: () => onGoTo("orders"),
    },
    {
      label: "Deuda pendiente",
      value: formatMoneyAmount(pendingDebt, currency, 0),
      detail: `${pendingInvoices.length} factura${pendingInvoices.length !== 1 ? "s" : ""} por cobrar`,
      icon: <ReceiptText className="h-5 w-5" />,
      onClick: () => onGoTo("invoices"),
    },
    ...(creditAvailable != null
      ? [{
          label: "Crédito disponible",
          value: formatMoneyAmount(convertMoneyAmount(creditAvailable, "ARS", currency, exchangeRate.rate), currency, 0),
          detail: creditPct >= 80 ? `⚠ ${creditPct.toFixed(0)}% utilizado` : `${creditPct.toFixed(0)}% utilizado`,
          icon: <CreditCard className="h-5 w-5" />,
          onClick: () => onGoTo("cuenta"),
        }]
      : []),
    {
      label: "Entregados (mes)",
      value: String(thisMonthOrders.length),
      detail: thisMonthOrders.length > 0
        ? formatMoneyAmount(thisMonthOrders.reduce((s, o) => s + o.total, 0), currency, 0)
        : "Sin entregas este mes",
      icon: <Truck className="h-5 w-5" />,
      onClick: () => onGoTo("orders"),
    },
  ];

  // ── Tone helpers ────────────────────────────────────────────────────────
  const actionToneClass = {
    danger: "border-destructive/20 bg-destructive/5",
    warning: "border-amber-500/20 bg-amber-500/5",
    info: "border-blue-500/20 bg-blue-500/5",
    success: "border-primary/20 bg-primary/5",
  } as const;

  // ── New client detection ──────────────────────────────────────────
  const isInitialLoading = products.length === 0 && orders.length === 0;

  if (isInitialLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 animate-in fade-in duration-500">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <SurfaceCard key={`metric-skeleton-${index}`} tone="subtle" padding="md" className="rounded-[22px] bg-card/95">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-24 animate-pulse rounded-md" />
                    <Skeleton className="h-7 w-20 animate-pulse rounded-md" />
                  </div>
                  <Skeleton className="h-10 w-10 animate-pulse rounded-[16px]" />
                </div>
                <Skeleton className="h-3 w-32 animate-pulse rounded-md" />
              </div>
            </SurfaceCard>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <SurfaceCard key={`list-skeleton-${index}`} tone="default" padding="lg" className="space-y-3 rounded-[24px]">
              <Skeleton className="h-4 w-40 animate-pulse rounded-md" />
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((__, rowIndex) => (
                  <Skeleton key={`list-skeleton-${index}-${rowIndex}`} className="h-12 w-full animate-pulse rounded-xl" />
                ))}
              </div>
            </SurfaceCard>
          ))}
        </div>
      </div>
    );
  }

  const isNewClient = orders.length === 0 && invoices.length === 0;

  if (isNewClient) {
    const creditDisplayStr = creditLimit > 0
      ? formatMoneyAmount(convertMoneyAmount(Math.max(0, creditLimit - creditUsed), "ARS", currency, exchangeRate.rate), currency, 0)
      : undefined;
    return (
      <WelcomeHero
        clientName={profile.contact_name ?? ""}
        companyName={profile.company_name ?? undefined}
        creditDisplay={creditDisplayStr}
        activeAgreementName={activeAgreement?.name}
        sellerName={assignedSeller?.name}
        sellerUrl={sellerUrl}
        onGoToCatalog={() => onGoTo("catalog")}
        onGoToQuotes={() => onGoTo("quotes")}
        onGoToAccount={() => onGoTo("cuenta")}
      />
    );
  }

  // ── Quick access links ────────────────────────────────────────────
  const quickAccess = [
    { icon: Package, label: "Catálogo", hint: "Buscar productos", tab: "catalog" as const, color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
    { icon: ShoppingCart, label: "Checkout", hint: "Ir al carrito", tab: "orders" as const, color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
    { icon: FileText, label: "Cotizaciones", hint: "Ver propuestas", tab: "quotes" as const, color: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
    { icon: User, label: "Mi cuenta", hint: "Datos y crédito", tab: "cuenta" as const, color: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-in fade-in duration-500">

      {/* ── HEADER ROW ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {PARTNER_LEVEL_LABEL[safePartnerLevel]} · {new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            {greeting}, {greetingName}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {sellerUrl ? (
            <Button asChild variant="outline" className="h-auto gap-2.5 rounded-2xl px-3 py-2 text-left">
              <a href={sellerUrl} target="_blank" rel="noopener noreferrer">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {sellerName.charAt(0).toUpperCase()}
                </div>
                <span className="hidden sm:block">
                  <span className="block text-xs font-semibold text-foreground leading-tight">{sellerName}</span>
                  <span className="block text-[10px] text-primary leading-tight">WhatsApp</span>
                </span>
                <MessageSquare size={13} className="text-muted-foreground" />
              </a>
            </Button>
          ) : (
            <Button type="button" variant="outline" disabled className="h-auto gap-2.5 rounded-2xl px-3 py-2 text-left">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {sellerName.charAt(0).toUpperCase()}
              </div>
              <span className="hidden sm:block">
                <span className="block text-xs font-semibold text-foreground leading-tight">{sellerName}</span>
                <span className="block text-[10px] text-muted-foreground leading-tight">Celular pendiente</span>
              </span>
              <MessageSquare size={13} className="text-muted-foreground" />
            </Button>
          )}
          <Button
            type="button"
            className="gap-2 rounded-2xl bg-gradient-primary shadow-lg shadow-primary/20"
            onClick={() => onGoTo("catalog")}
          >
            <Plus size={16} /> Nueva compra
          </Button>
        </div>
      </div>

      {/* ── OVERDUE ALERT (conditional) ───────────────────────────────── */}
      {overdueInvoices.length > 0 && (
        <button
          type="button"
          onClick={() => onGoTo("invoices")}
          className="flex w-full items-center gap-3 rounded-[24px] border border-destructive/20 bg-destructive/10 px-5 py-4 text-left transition hover:bg-destructive/15"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
            <AlertCircle size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-destructive">
              Urgente: {overdueInvoices.length} factura{overdueInvoices.length !== 1 ? "s" : ""} fuera de término
            </p>
            <p className="text-xs text-destructive/80">Deuda acumulada: {formatMoneyAmount(overdueDebt, currency, 0)}</p>
          </div>
          <ArrowRight size={16} className="text-destructive" />
        </button>
      )}

      {/* ── KPI strip ─────────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <button key={kpi.label} type="button" className="text-left" onClick={kpi.onClick}>
            <MetricCard
              label={kpi.label}
              value={kpi.value}
              detail={kpi.detail}
              icon={kpi.icon}
              className="h-full transition hover:border-primary/20 hover:shadow-lg hover:shadow-primary/10"
            />
          </button>
        ))}
      </div>

      {/* ── QUICK REORDER (only if history) ──────────────────────────── */}
      {reorderCandidates.length > 0 && (
        <SurfaceCard tone="default" padding="lg" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Recompra rápida</h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Basado en tus {orders.length} pedidos anteriores</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5 rounded-xl border-primary/30 text-primary hover:bg-primary/10"
                onClick={() => reorderCandidates.forEach(({ product, suggestedQty }) => onAddToCart(product, suggestedQty))}
              >
                <Truck size={13} /> Reordenar todo
              </Button>
              <Button type="button" variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={() => onGoTo("catalog")}>
                Ver más <ArrowRight size={13} />
              </Button>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {reorderCandidates.map(({ product, count, suggestedQty }) => (
              <div
                key={product.id}
                className="group flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/80 p-3 transition-all hover:border-primary/20 hover:shadow-md"
              >
                <div className="flex items-start gap-2.5">
                  {product.image ? (
                    <img
                      src={product.image}
                      alt={product.name}
                      className="h-12 w-12 shrink-0 rounded-xl object-contain bg-muted/30 p-1"
                    />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted/50">
                      <Package size={18} className="text-muted-foreground/50" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-xs font-semibold leading-snug text-foreground">{product.name}</p>
                    {product.brand_name && (
                      <p className="mt-0.5 text-[10px] text-muted-foreground">{product.brand_name}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <ShoppingCart size={9} />
                    {count} {count !== 1 ? "compras" : "compra"}
                  </span>
                  <span className={`font-medium ${(product.stock ?? 0) > 0 ? "text-primary" : "text-destructive"}`}>
                    Stock: {product.stock ?? 0}
                  </span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="w-full gap-1.5 rounded-xl"
                  disabled={(product.stock ?? 0) === 0}
                  onClick={() => onAddToCart(product, suggestedQty)}
                >
                  <Plus size={12} /> {suggestedQty} u. al carrito
                </Button>
              </div>
            ))}
          </div>
        </SurfaceCard>
      )}

      {/* ── ACTIONS ───────────────────────────────────────────────────── */}
      {actionItems.length > 0 && (
        <SurfaceCard tone="default" padding="lg" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-foreground">Qué resolver hoy</h2>
            <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
              {actionItems.length} acción{actionItems.length !== 1 ? "es" : ""}
            </Badge>
          </div>
          <div className="space-y-2">
            {actionItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={item.action}
                className={`flex w-full items-center gap-4 rounded-2xl border px-4 py-3 text-left transition hover:-translate-y-0.5 ${actionToneClass[item.tone]}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{item.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
                </div>
                <span className="shrink-0 text-[11px] font-semibold text-primary">{item.cta}</span>
                <ArrowRight size={13} className="shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        </SurfaceCard>
      )}

      {/* ── QUICK ACCESS GRID ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {quickAccess.map(({ icon: Icon, label, hint, tab, color }) => (
          <button
            key={tab}
            type="button"
            onClick={() => onGoTo(tab)}
            className="group flex items-center gap-3 rounded-2xl border border-border/70 bg-card/80 p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-md active:scale-[0.98]"
          >
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${color} transition-transform group-hover:scale-110`}>
              <Icon size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground">{label}</p>
              <p className="text-[10px] text-muted-foreground">{hint}</p>
            </div>
          </button>
        ))}
      </div>

      {/* ── SPENDING SUMMARY (only if history) ───────────────────────── */}
      {spendingStats.ytdCount > 0 && (
        <div>
          <SurfaceCard tone="default" padding="lg">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Resumen anual</p>
                  <h2 className="mt-0.5 text-base font-semibold text-foreground">Cuenta {new Date().getFullYear()}</h2>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xl font-semibold text-foreground">
                      {formatMoneyAmount(convertMoneyAmount(spendingStats.ytdTotal, "ARS", currency, exchangeRate.rate), currency, 0)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Total comprado</p>
                  </div>
                  <div>
                    <p className="text-xl font-semibold text-primary">
                      {formatMoneyAmount(convertMoneyAmount(spendingStats.monthTotal, "ARS", currency, exchangeRate.rate), currency, 0)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Este mes</p>
                  </div>
                  <div>
                    <p className="text-xl font-semibold text-foreground">
                      {formatMoneyAmount(convertMoneyAmount(spendingStats.avgOrder, "ARS", currency, exchangeRate.rate), currency, 0)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Ticket promedio</p>
                  </div>
                </div>
              </div>
              <div className="flex h-12 items-end gap-[4px] pt-2">
                {spendingStats.buckets.map((value, idx) => {
                  const pct = spendingStats.maxBucket > 0 ? Math.max(8, (value / spendingStats.maxBucket) * 100) : 8;
                  const isLast = idx === spendingStats.buckets.length - 1;
                  return (
                    <div
                      key={idx}
                      style={{ height: `${pct}%` }}
                      className={`w-3 rounded-full ${isLast ? "bg-primary" : "bg-muted-foreground/20"}`}
                    />
                  );
                })}
              </div>
            </div>
          </SurfaceCard>

        </div>
      )}

      {/* ── CREDIT PANEL (always visible when creditLimit > 0) ────────── */}
      {creditLimit > 0 && (
        <SurfaceCard tone="subtle" padding="lg" className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <CreditCard size={17} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Línea de crédito</p>
              <p className="text-sm font-semibold text-foreground">{creditPct.toFixed(0)}% utilizado</p>
            </div>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${creditPct > 90 ? "bg-destructive" : creditPct > 70 ? "bg-amber-500" : "bg-primary"}`}
              style={{ width: `${creditPct}%` }}
            />
          </div>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>
              Usado: {formatMoneyAmount(convertMoneyAmount(creditUsed, "ARS", currency, exchangeRate.rate), currency, 0)} de{" "}
              {formatMoneyAmount(convertMoneyAmount(creditLimit, "ARS", currency, exchangeRate.rate), currency, 0)}
            </p>
            <p>
              Disponible: {formatMoneyAmount(convertMoneyAmount(Math.max(0, creditLimit - creditUsed), "ARS", currency, exchangeRate.rate), currency, 0)}
            </p>
          </div>
        </SurfaceCard>
      )}

      {/* ── LAST ORDER + DUE INVOICES ─────────────────────────────────── */}
      {(lastOrder || dueInvoices.length > 0) && (
      <div className="grid gap-4 lg:grid-cols-2">
        {lastOrder && (
        <SurfaceCard tone="default" padding="lg" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Package size={17} />
              </div>
              <h2 className="text-sm font-semibold text-foreground">Último pedido</h2>
            </div>
            <Button type="button" variant="ghost" size="sm" className="gap-1 text-primary" onClick={() => onGoTo("orders")}>
              Ver todos <ArrowRight size={13} />
            </Button>
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-semibold text-foreground">
                {lastOrder.order_number ?? `#${String(lastOrder.id).slice(-6).toUpperCase()}`}
              </span>
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${ORDER_STATUS_CLASS[lastOrder.status] ?? "border-border bg-muted text-muted-foreground"}`}>
                {ORDER_STATUS_LABEL[lastOrder.status] ?? lastOrder.status}
              </span>
              {lastOrder.internal_reference && (
                <Badge variant="outline" className="border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400 text-[10px]">
                  PO: {lastOrder.internal_reference}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {new Date(lastOrder.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })} —{" "}
              {formatMoneyAmount(lastOrder.total, currency, 0)}
            </p>
            <div className="border-t border-border/70 pt-4">
              {lastOrder.status === "dispatched" || lastOrder.status === "delivered" ? (
                <div className="flex items-center gap-2 rounded-2xl border border-blue-500/20 bg-blue-500/10 px-3 py-3 text-sm text-blue-500">
                  <Truck size={14} /> Pedido despachado — seguimiento disponible próximamente
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
                  <Clock size={14} /> Estado: {ORDER_STATUS_LABEL[lastOrder.status] || "Procesando"}
                </div>
              )}
            </div>
            {lastOrder.products?.length ? (
              <p className="text-xs text-muted-foreground">
                {lastOrder.products.length} producto{lastOrder.products.length !== 1 ? "s" : ""}
                {lastOrder.products[0]?.name ? ` — ${lastOrder.products[0].name}${lastOrder.products.length > 1 ? ` +${lastOrder.products.length - 1}` : ""}` : ""}
              </p>
            ) : null}
          </div>
        </SurfaceCard>
        )}

        {dueInvoices.length > 0 && (
        <SurfaceCard tone="default" padding="lg" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-500">
                <CalendarClock size={17} />
              </div>
              <h2 className="text-sm font-semibold text-foreground">Próximos vencimientos</h2>
            </div>
            <Button type="button" variant="ghost" size="sm" className="gap-1 text-primary" onClick={() => onGoTo("invoices")}>
              Ver facturas <ArrowRight size={13} />
            </Button>
          </div>

          <div className="space-y-2">
            {dueInvoices.slice(0, 3).map((invoice) => {
              const days = daysUntil(invoice.due_date!);
              const isOverdue = days < 0;
              const isUrgent = days >= 0 && days <= 3;
              const effective = getEffectiveInvoiceAmounts(invoice, exchangeRate.rate);
              return (
                <div key={invoice.id} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-muted/30 px-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {invoice.invoice_number || `Factura ${invoice.id.slice(-6)}`}
                    </p>
                    <p className={`mt-0.5 text-xs ${isOverdue ? "text-destructive" : isUrgent ? "text-amber-500" : "text-muted-foreground"}`}>
                      {isOverdue
                        ? `Vencida hace ${Math.abs(days)} día${Math.abs(days) !== 1 ? "s" : ""}`
                        : days === 0
                          ? "Vence hoy"
                          : `Vence en ${days} día${days !== 1 ? "s" : ""}`}
                    </p>
                  </div>
                  <p className={`text-sm font-semibold ${isOverdue ? "text-destructive" : "text-foreground"}`}>
                    {formatMoneyAmount(convertMoneyAmount(effective.total, effective.currency, currency, exchangeRate.rate), currency, 0)}
                  </p>
                  {isOverdue ? <AlertTriangle size={14} className="text-destructive" /> : null}
                  {isUrgent && !isOverdue ? <Clock size={14} className="text-amber-500" /> : null}
                </div>
              );
            })}
          </div>
        </SurfaceCard>
        )}
      </div>
      )}

      {/* ── PROMOTIONS (only if there's actual content) ───────────────── */}
      {hasPromoContent && (
        <SurfaceCard tone="default" padding="lg" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-foreground">Promociones y condiciones activas</h2>
            {activeAgreement && (
              <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                Acuerdo activo
              </Badge>
            )}
          </div>

          {activeAgreement && (
            <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4">
              <p className="text-sm font-semibold text-primary">{activeAgreement.name}</p>
              <p className="mt-1 text-xs text-primary/80">
                {activeAgreement.discount_pct > 0 ? `Descuento adicional ${activeAgreement.discount_pct}%` : "Condición comercial preferencial activa"}
                {activeAgreement.valid_until ? ` · vigente hasta ${new Date(activeAgreement.valid_until).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}` : ""}
              </p>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {promoAlerts.map((alert) => (
              <div key={alert.id} className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
                <p className="text-sm font-semibold text-blue-500">{alert.title}</p>
                {alert.subtitle ? <p className="mt-1 text-xs text-blue-500/80">{alert.subtitle}</p> : null}
              </div>
            ))}
            {offerProducts.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => onGoTo("catalog")}
                className="rounded-2xl border border-border/70 bg-card/80 p-4 text-left transition hover:border-primary/20"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{product.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{product.category || "General"}</p>
                  </div>
                  <Badge variant="outline" className="border-amber-500/20 bg-amber-500/10 text-amber-500">
                    {(product.offer_percent ?? 0) > 0 ? `-${product.offer_percent}%` : "Precio especial"}
                  </Badge>
                </div>
              </button>
            ))}
          </div>
        </SurfaceCard>
      )}

      {/* ── LOYALTY PANEL ────────────────────────────────────────────── */}
      <LoyaltyPanel
        partnerLevel={profile.partner_level}
        ordersCount={orders.length}
        onGoToAccount={() => onGoTo("cuenta")}
      />

      {/* ── ALERTS (conditional) ─────────────────────────────────────── */}
      {alerts.length > 0 && (
        <SurfaceCard tone="subtle" padding="lg" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Alertas de negocio</h2>
            <span className="flex h-2 w-2 animate-pulse rounded-full bg-destructive" />
          </div>
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div key={alert.id} className="flex gap-3 rounded-2xl border border-border/70 bg-card/70 p-3 transition hover:border-primary/15 hover:bg-card">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-muted">
                  <ShieldCheck size={14} className={ALERT_COLOR_MAP[alert.type] ?? "text-muted-foreground"} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{alert.title}</p>
                  {alert.subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{alert.subtitle}</p> : null}
                </div>
              </div>
            ))}
          </div>
        </SurfaceCard>
      )}

      {/* ── ACTIVE TICKETS (conditional) ─────────────────────────────── */}
      {serviceInsights.activeTickets.length > 0 && (
        <button
          type="button"
          onClick={() => onGoTo("support")}
          className="flex w-full items-center gap-3 rounded-[24px] border border-border/70 bg-muted/30 px-5 py-4 text-left transition hover:border-primary/20 hover:bg-muted/50"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">
              {serviceInsights.activeTickets.length} ticket{serviceInsights.activeTickets.length !== 1 ? "s" : ""} de soporte activo{serviceInsights.activeTickets.length !== 1 ? "s" : ""}
            </p>
            <p className="text-xs text-muted-foreground">SLA: {serviceInsights.slaLabel}</p>
          </div>
          <ArrowRight size={14} className="shrink-0 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}
