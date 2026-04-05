import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BriefcaseBusiness,
  ChevronRight,
  ClipboardList,
  Clock3,
  FileText,
  MessageSquarePlus,
  Save,
  ShoppingBag,
  ShoppingCart,
  Target,
  TrendingDown,
  TrendingUp,
  UserRound,
  Users,
} from "lucide-react";

import { CreateOrderModal } from "@/components/admin/CreateOrderModal";
import { CreateQuoteModal } from "@/components/admin/CreateQuoteModal";
import { ClientUnifiedTimeline } from "@/components/admin/client360/ClientUnifiedTimeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SurfaceCard } from "@/components/ui/surface-card";
import { useCurrency } from "@/context/CurrencyContext";
import { addClientNote } from "@/lib/api/clientDetail";
import { supabase, type ClientType } from "@/lib/supabase";
import type { Product } from "@/models/products";
import type { TimelineItem } from "@/components/admin/client360/types";

interface SellerProfile {
  id: string;
  company_name: string;
  contact_name: string;
  role: string;
  email?: string;
  phone?: string;
  active?: boolean;
  monthly_target?: number;
}

interface ClientProfile {
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
  last_contact_at?: string;
  last_contact_type?: "nota" | "llamada" | "reunion" | "seguimiento" | "alerta" | "pedido" | "cotizacion" | "ticket";
}

interface SupabaseOrder {
  id: string;
  client_id: string;
  total: number;
  status: string;
  order_number?: string;
  created_at: string;
}

interface SellerCRMProps {
  sellers: SellerProfile[];
  clients: ClientProfile[];
  orders: SupabaseOrder[];
  products: Product[];
  isDark: boolean;
  view?: "overview" | "portfolio" | "targets" | "activity";
  onRefreshOrders?: () => Promise<void> | void;
  onRefreshClients?: () => Promise<void> | void;
  onOpenClient: (clientId: string) => void;
  onNewSeller?: () => void;
}

interface SellerQuote {
  id: number;
  client_id: string;
  total: number;
  status: string;
  created_at: string;
  updated_at?: string | null;
}

const CLOSED_ORDER_STATUSES = new Set(["approved", "preparing", "shipped", "delivered", "dispatched"]);
const OPEN_QUOTE_STATUSES = new Set(["sent", "viewed"]);

function daysSince(iso?: string | null) {
  if (!iso) return Number.POSITIVE_INFINITY;
  const value = new Date(iso).getTime();
  if (Number.isNaN(value)) return Number.POSITIVE_INFINITY;
  return Math.floor((Date.now() - value) / (1000 * 60 * 60 * 24));
}

function relativeDate(iso?: string | null) {
  if (!iso) return "Sin registro";
  const days = daysSince(iso);
  if (days === Number.POSITIVE_INFINITY) return "Sin registro";
  if (days <= 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 30) return `hace ${days} dias`;
  const months = Math.floor(days / 30);
  return `hace ${months} mes${months === 1 ? "" : "es"}`;
}

function sellerDisplayName(seller: SellerProfile) {
  return seller.contact_name || seller.company_name || "Sin nombre";
}

export function SellerCRM({
  sellers,
  clients,
  orders,
  products,
  isDark,
  view = "overview",
  onRefreshOrders,
  onRefreshClients,
  onOpenClient,
  onNewSeller,
}: SellerCRMProps) {
  const dk = (dark: string, light: string) => (isDark ? dark : light);
  const { formatPrice } = useCurrency();
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(sellers[0]?.id ?? null);
  const [quotes, setQuotes] = useState<SellerQuote[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedActionClientId, setSelectedActionClientId] = useState<string>("");
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [showCreateQuote, setShowCreateQuote] = useState(false);
  const [followupBody, setFollowupBody] = useState("");
  const [followupType, setFollowupType] = useState<"nota" | "llamada" | "reunion" | "alerta" | "seguimiento">("seguimiento");
  const [savingFollowup, setSavingFollowup] = useState(false);
  const [goalInput, setGoalInput] = useState("0");
  const [savingGoal, setSavingGoal] = useState(false);

  useEffect(() => {
    if (!selectedSellerId && sellers[0]?.id) setSelectedSellerId(sellers[0].id);
    if (selectedSellerId && !sellers.some((seller) => seller.id === selectedSellerId)) {
      setSelectedSellerId(sellers[0]?.id ?? null);
    }
  }, [selectedSellerId, sellers]);

  const filteredSellers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return sellers;
    return sellers.filter((seller) =>
      [seller.contact_name, seller.company_name, seller.email ?? ""].join(" ").toLowerCase().includes(term),
    );
  }, [search, sellers]);

  const selectedSeller = sellers.find((seller) => seller.id === selectedSellerId) ?? null;

  const assignedClients = useMemo(() => {
    if (!selectedSeller) return [];
    return clients.filter((client) => client.assigned_seller_id === selectedSeller.id);
  }, [clients, selectedSeller]);

  const assignedClientIds = useMemo(() => assignedClients.map((client) => client.id), [assignedClients]);

  useEffect(() => {
    const fallbackClientId = assignedClients[0]?.id ?? "";
    if (!assignedClients.some((client) => client.id === selectedActionClientId)) {
      setSelectedActionClientId(fallbackClientId);
    }
  }, [assignedClients, selectedActionClientId]);

  useEffect(() => {
    setGoalInput(String(selectedSeller?.monthly_target ?? 0));
  }, [selectedSeller?.id, selectedSeller?.monthly_target]);

  useEffect(() => {
    let cancelled = false;

    async function loadQuotes() {
      if (!assignedClientIds.length) {
        setLoadingQuotes(false);
        setQuotes([]);
        return;
      }

      setLoadingQuotes(true);
      const { data } = await supabase
        .from("quotes")
        .select("id, client_id, total, status, created_at, updated_at")
        .in("client_id", assignedClientIds)
        .order("created_at", { ascending: false });

      if (!cancelled) {
        setQuotes((data ?? []) as SellerQuote[]);
        setLoadingQuotes(false);
      }
    }

    void loadQuotes();
    return () => {
      cancelled = true;
    };
  }, [assignedClientIds]);

  async function reloadQuotes() {
    if (!assignedClientIds.length) {
      setQuotes([]);
      return;
    }
    const { data } = await supabase
      .from("quotes")
      .select("id, client_id, total, status, created_at, updated_at")
      .in("client_id", assignedClientIds)
      .order("created_at", { ascending: false });
    setQuotes((data ?? []) as SellerQuote[]);
  }

  const assignedOrders = useMemo(() => {
    if (!assignedClientIds.length) return [];
    return orders.filter((order) => assignedClientIds.includes(order.client_id));
  }, [assignedClientIds, orders]);

  const closedOrders = useMemo(
    () => assignedOrders.filter((order) => CLOSED_ORDER_STATUSES.has(order.status)),
    [assignedOrders],
  );

  const monthlySales = useMemo(() => {
    const threshold = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return closedOrders
      .filter((order) => new Date(order.created_at).getTime() >= threshold)
      .reduce((sum, order) => sum + order.total, 0);
  }, [closedOrders]);

  const previousMonthlySales = useMemo(() => {
    const now = Date.now();
    const from = now - 60 * 24 * 60 * 60 * 1000;
    const to = now - 30 * 24 * 60 * 60 * 1000;
    return closedOrders
      .filter((order) => {
        const createdAt = new Date(order.created_at).getTime();
        return createdAt >= from && createdAt < to;
      })
      .reduce((sum, order) => sum + order.total, 0);
  }, [closedOrders]);

  const totalSales = useMemo(
    () => closedOrders.reduce((sum, order) => sum + order.total, 0),
    [closedOrders],
  );

  const averageTicket = closedOrders.length ? totalSales / closedOrders.length : 0;
  const quoteWindow = useMemo(() => {
    const threshold = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return quotes.filter((quote) => new Date(quote.created_at).getTime() >= threshold);
  }, [quotes]);
  const sentQuotes = quoteWindow.filter((quote) => ["sent", "viewed", "approved", "converted"].includes(quote.status));
  const convertedQuotes = quoteWindow.filter((quote) => ["approved", "converted"].includes(quote.status));
  const conversionRate = sentQuotes.length ? (convertedQuotes.length / sentQuotes.length) * 100 : 0;
  const monthlyVariation = previousMonthlySales > 0
    ? ((monthlySales - previousMonthlySales) / previousMonthlySales) * 100
    : monthlySales > 0 ? 100 : 0;

  const monthlyGoal = Number(selectedSeller?.monthly_target ?? 0);

  const monthlyGoalPct = monthlyGoal > 0 ? (monthlySales / monthlyGoal) * 100 : 0;
  const dormantClients = assignedClients.filter((client) => {
    const lastOrder = closedOrders.filter((order) => order.client_id === client.id)[0];
    return daysSince(lastOrder?.created_at) >= 45;
  });
  const staleQuotes = quotes.filter((quote) => OPEN_QUOTE_STATUSES.has(quote.status) && daysSince(quote.updated_at ?? quote.created_at) >= 7);
  const pendingOrders = assignedOrders.filter((order) => ["pending", "preparing"].includes(order.status));
  const actionClient = assignedClients.find((client) => client.id === selectedActionClientId) ?? null;

  const sellerScore = useMemo(() => {
    if (!selectedSeller) return 0;
    let score = 55;

    if (monthlyGoal > 0) {
      if (monthlyGoalPct >= 100) score += 18;
      else if (monthlyGoalPct >= 75) score += 10;
      else if (monthlyGoalPct < 50) score -= 14;
    }

    if (conversionRate >= 40) score += 12;
    else if (conversionRate < 20 && sentQuotes.length > 0) score -= 10;

    const dormantRatio = assignedClients.length ? dormantClients.length / assignedClients.length : 0;
    if (dormantRatio >= 0.4) score -= 18;
    else if (dormantRatio <= 0.15) score += 6;

    if (staleQuotes.length >= 5) score -= 10;
    else if (staleQuotes.length === 0 && sentQuotes.length > 0) score += 4;

    if (pendingOrders.length >= 6) score -= 8;
    else if (pendingOrders.length === 0 && closedOrders.length > 0) score += 4;

    if (monthlyVariation >= 20) score += 8;
    if (monthlyVariation <= -20) score -= 12;

    return Math.max(0, Math.min(100, Math.round(score)));
  }, [
    assignedClients.length,
    closedOrders.length,
    conversionRate,
    dormantClients.length,
    monthlyGoal,
    monthlyGoalPct,
    monthlyVariation,
    pendingOrders.length,
    selectedSeller,
    sentQuotes.length,
    staleQuotes.length,
  ]);

  const sellerScoreTone = sellerScore >= 80
    ? "success"
    : sellerScore >= 60
      ? "warning"
      : "destructive";

  const portfolioRows = useMemo(() => {
    return assignedClients.map((client) => {
      const clientOrders = closedOrders.filter((order) => order.client_id === client.id);
      const clientLastOrder = clientOrders[0];
      const last30 = clientOrders
        .filter((order) => new Date(order.created_at).getTime() >= Date.now() - 30 * 24 * 60 * 60 * 1000)
        .reduce((sum, order) => sum + order.total, 0);
      const prev30 = clientOrders
        .filter((order) => {
          const createdAt = new Date(order.created_at).getTime();
          return createdAt >= Date.now() - 60 * 24 * 60 * 60 * 1000 && createdAt < Date.now() - 30 * 24 * 60 * 60 * 1000;
        })
        .reduce((sum, order) => sum + order.total, 0);
      const variation = prev30 > 0 ? ((last30 - prev30) / prev30) * 100 : last30 > 0 ? 100 : 0;

      let tone: "success" | "warning" | "destructive" | "outline" = "outline";
      let label = "Activo";
      if (daysSince(clientLastOrder?.created_at) >= 60 || variation <= -25) {
        tone = "destructive";
        label = "Riesgo";
      } else if (variation >= 20) {
        tone = "success";
        label = "Crecimiento";
      } else if (quotes.some((quote) => quote.client_id === client.id && OPEN_QUOTE_STATUSES.has(quote.status))) {
        tone = "warning";
        label = "Oportunidad";
      }

      return {
        client,
        label,
        tone,
        lastOrderAt: clientLastOrder?.created_at,
        lastOrderTotal: clientLastOrder?.total ?? 0,
        volume: last30,
      };
    }).sort((a, b) => b.volume - a.volume);
  }, [assignedClients, closedOrders, quotes]);

  const timelineItems: TimelineItem[] = useMemo(() => {
    const contactItems: TimelineItem[] = assignedClients
      .filter((client) => client.last_contact_at)
      .map((client) => ({
        id: `contact-${client.id}-${client.last_contact_at}`,
        kind: "nota",
        title: `${client.company_name || client.contact_name}: ${client.last_contact_type || "seguimiento"} registrado`,
        detail: `Ultimo contacto ${relativeDate(client.last_contact_at)}`,
        at: client.last_contact_at as string,
        relative: relativeDate(client.last_contact_at),
        tone: "outline",
      }));

    const quoteItems: TimelineItem[] = quotes.map((quote) => {
      const client = assignedClients.find((item) => item.id === quote.client_id);
      return {
        id: `quote-${quote.id}`,
        kind: "cotizacion",
        title: `${client?.company_name || client?.contact_name || "Cliente"} · Cotizacion ${quote.status}`,
        detail: formatPrice(quote.total),
        at: quote.updated_at ?? quote.created_at,
        relative: relativeDate(quote.updated_at ?? quote.created_at),
        tone: ["approved", "converted"].includes(quote.status) ? "success" : OPEN_QUOTE_STATUSES.has(quote.status) ? "warning" : "outline",
      } as TimelineItem;
    });

    const orderItems: TimelineItem[] = assignedOrders.map((order) => {
      const client = assignedClients.find((item) => item.id === order.client_id);
      return {
        id: `order-${order.id}`,
        kind: "pedido",
        title: `${client?.company_name || client?.contact_name || "Cliente"} · Pedido ${order.order_number || order.id}`,
        detail: `${formatPrice(order.total)} · ${order.status}`,
        at: order.created_at,
        relative: relativeDate(order.created_at),
        tone: CLOSED_ORDER_STATUSES.has(order.status) ? "success" : "warning",
      } as TimelineItem;
    });

    return [...orderItems, ...quoteItems, ...contactItems]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 10);
  }, [assignedClients, assignedOrders, formatPrice, quotes]);

  async function handleSaveGoal() {
    if (!selectedSeller) return;
    setSavingGoal(true);
    try {
      await supabase
        .from("profiles")
        .update({ monthly_target: Number(goalInput) || 0 })
        .eq("id", selectedSeller.id);
      await onRefreshClients?.();
    } finally {
      setSavingGoal(false);
    }
  }

  async function handleRegisterFollowup() {
    if (!actionClient || !followupBody.trim()) return;
    setSavingFollowup(true);
    try {
      await addClientNote(actionClient.id, followupBody.trim(), followupType);
      setFollowupBody("");
      setFollowupType("seguimiento");
      await onRefreshClients?.();
    } finally {
      setSavingFollowup(false);
    }
  }

  const summaryHeader = selectedSeller ? (
    <SurfaceCard tone="elevated" padding="sm" className="space-y-3 rounded-[20px] shadow-md shadow-black/5">
      <div className="flex min-w-0 flex-col gap-3 2xl:flex-row 2xl:items-start 2xl:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Vendedor 360</p>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-[1.35rem] font-bold tracking-tight text-foreground">{sellerDisplayName(selectedSeller)}</h2>
            <Badge variant={sellerScoreTone}>{sellerScore}/100</Badge>
          </div>
          <p className="text-[12px] text-muted-foreground">{selectedSeller.email || "Sin email"} · sales</p>
        </div>
        <div className="grid min-w-0 gap-1.5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          <SellerHeaderStat label="Clientes" value={String(assignedClients.length)} icon={Users} />
          <SellerHeaderStat label="Ventas totales" value={formatPrice(totalSales)} icon={ShoppingBag} />
          <SellerHeaderStat label="Objetivo mensual" value={monthlyGoal > 0 ? formatPrice(monthlyGoal) : "Sin base"} icon={BriefcaseBusiness} />
          <SellerHeaderStat
            label="% cumplimiento"
            value={`${monthlyGoalPct.toFixed(0)}%`}
            icon={TrendingUp}
            tone={monthlyGoalPct >= 100 ? "success" : monthlyGoalPct >= 70 ? "warning" : "destructive"}
          />
          <SellerHeaderStat label="Score comercial" value={`${sellerScore}/100`} icon={Target} tone={sellerScoreTone} />
        </div>
      </div>
    </SurfaceCard>
  ) : null;

  const goalsPanel = (
    <SurfaceCard padding="sm" className="space-y-2 rounded-[18px]">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Objetivos</p>
          <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">Objetivo y performance</h3>
        </div>
        <Badge variant={monthlyGoalPct >= 100 ? "success" : monthlyGoalPct >= 70 ? "warning" : "destructive"}>
          {monthlyGoalPct.toFixed(0)}%
        </Badge>
      </div>
      <div className="grid gap-2 2xl:grid-cols-[220px_minmax(0,1fr)]">
        <div className="rounded-[16px] border border-border/70 bg-surface px-3 py-2.5">
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Objetivo mensual persistido</p>
          <div className="flex items-center gap-2">
            <input
              value={goalInput}
              onChange={(event) => setGoalInput(event.target.value.replace(/[^\d.]/g, ""))}
              className="h-9 w-full rounded-lg border border-input/80 bg-card px-3 text-[12px] outline-none"
              placeholder="0"
            />
            <Button size="sm" variant="toolbar" onClick={handleSaveGoal} disabled={savingGoal}>
              <Save className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="grid gap-1.5 md:grid-cols-2 2xl:grid-cols-4">
          <SellerMetricCard label="Ventas del mes" value={formatPrice(monthlySales)} detail={previousMonthlySales > 0 ? `Mes previo ${formatPrice(previousMonthlySales)}` : "Sin base comparativa"} />
          <SellerMetricCard label="Ticket promedio" value={averageTicket > 0 ? formatPrice(averageTicket) : "Sin ticket"} detail={`${closedOrders.length} pedidos cerrados`} />
          <SellerMetricCard label="Cotizaciones enviadas" value={String(sentQuotes.length)} detail={loadingQuotes ? "Cargando..." : "ultimos 30 dias"} />
          <SellerMetricCard label="Conversion" value={`${conversionRate.toFixed(0)}%`} detail={`${convertedQuotes.length}/${Math.max(sentQuotes.length, 1)} convertidas`} />
        </div>
      </div>
    </SurfaceCard>
  );

  const actionsPanel = (
    <SurfaceCard padding="sm" className="space-y-2 rounded-[18px]">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Acciones</p>
        <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">Seguimiento directo</h3>
      </div>
      <div className="space-y-2">
        <select
          value={selectedActionClientId}
          onChange={(event) => setSelectedActionClientId(event.target.value)}
          className="h-9 min-w-0 rounded-lg border border-input/80 bg-card px-3 text-[12px] outline-none"
        >
          <option value="">Seleccionar cliente</option>
          {assignedClients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.company_name || client.contact_name}
            </option>
          ))}
        </select>
        <div className="grid gap-2">
          <Button size="sm" className="w-full justify-start" onClick={() => setShowCreateOrder(true)} disabled={!actionClient}>
            <ShoppingCart className="h-3.5 w-3.5" />
            Crear pedido
          </Button>
          <Button size="sm" className="w-full justify-start" variant="soft" onClick={() => setShowCreateQuote(true)} disabled={!actionClient}>
            <ClipboardList className="h-3.5 w-3.5" />
            Crear cotizacion
          </Button>
          <Button size="sm" className="w-full justify-start" variant="toolbar" onClick={handleRegisterFollowup} disabled={!actionClient || !followupBody.trim() || savingFollowup}>
            <MessageSquarePlus className="h-3.5 w-3.5" />
            {savingFollowup ? "Guardando..." : "Registrar"}
          </Button>
          <Button size="sm" className="w-full justify-start" variant="toolbar" onClick={() => actionClient && onOpenClient(actionClient.id)} disabled={!actionClient}>
            Abrir cliente
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="grid gap-2">
        <select
          value={followupType}
          onChange={(event) => setFollowupType(event.target.value as typeof followupType)}
          className="h-9 min-w-0 rounded-lg border border-input/80 bg-card px-3 text-[12px] outline-none"
        >
          <option value="seguimiento">Seguimiento</option>
          <option value="llamada">Llamada</option>
          <option value="reunion">Reunion</option>
          <option value="nota">Nota</option>
          <option value="alerta">Alerta</option>
        </select>
        <input
          value={followupBody}
          onChange={(event) => setFollowupBody(event.target.value)}
          className="h-9 min-w-0 rounded-lg border border-input/80 bg-card px-3 text-[12px] outline-none"
          placeholder={actionClient ? `Registrar seguimiento para ${actionClient.company_name || actionClient.contact_name}` : "Selecciona un cliente para registrar seguimiento"}
        />
      </div>
    </SurfaceCard>
  );

  const portfolioPanel = (
    <SurfaceCard padding="sm" className="space-y-2 rounded-[18px]">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Cartera de clientes</p>
          <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">Clientes asignados</h3>
        </div>
        <Badge variant="outline">{assignedClients.length} cuentas</Badge>
      </div>

      {portfolioRows.length === 0 ? (
        <EmptyState title="Sin cartera asignada" description="Asigna clientes a este vendedor para ver su performance y cartera." />
      ) : (
        <div className="space-y-1.5">
          {portfolioRows.map((row) => (
            <div key={row.client.id} className="rounded-[14px] border border-border/70 bg-card px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[12px] font-semibold text-foreground">{row.client.company_name || row.client.contact_name}</p>
                    <Badge variant={row.tone}>{row.label}</Badge>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Ultima compra: {relativeDate(row.lastOrderAt)} · Volumen 30d: {formatPrice(row.volume)}
                  </p>
                </div>
                <Button variant="toolbar" size="sm" onClick={() => onOpenClient(row.client.id)}>
                  Abrir cliente
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </SurfaceCard>
  );

  const alertsPanel = (
    <SurfaceCard tone="subtle" padding="sm" className="space-y-2 rounded-[18px]">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Alertas</p>
        <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">Que requiere accion</h3>
      </div>
      <SellerAlert
        title="Clientes sin compra"
        value={String(dormantClients.length)}
        description={dormantClients.length ? "Cuentas sin orden cerrada en 45+ dias." : "Sin clientes dormidos."}
        tone={dormantClients.length ? "warning" : "success"}
        icon={TrendingDown}
      />
      <SellerAlert
        title="Cotizaciones sin respuesta"
        value={String(staleQuotes.length)}
        description={staleQuotes.length ? "Quotes abiertas sin movimiento hace 7+ dias." : "Sin cotizaciones dormidas."}
        tone={staleQuotes.length ? "warning" : "success"}
        icon={FileText}
      />
      <SellerAlert
        title="Pedidos pendientes"
        value={String(pendingOrders.length)}
        description={pendingOrders.length ? "Pedidos que todavia no cerraron circuito." : "Sin pedidos pendientes."}
        tone={pendingOrders.length ? "destructive" : "success"}
        icon={Clock3}
      />
    </SurfaceCard>
  );

  const intelligencePanel = (
    <SurfaceCard tone="subtle" padding="sm" className="space-y-2 rounded-[18px]">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Lectura comercial</p>
        <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">Inteligencia de cartera</h3>
      </div>
      <div className="space-y-1.5">
        <InsightChip
          label="Clientes en riesgo"
          value={String(portfolioRows.filter((row) => row.label === "Riesgo").length)}
          tone="destructive"
        />
        <InsightChip
          label="Clientes en crecimiento"
          value={String(portfolioRows.filter((row) => row.label === "Crecimiento").length)}
          tone="success"
        />
        <InsightChip
          label="Oportunidades abiertas"
          value={String(portfolioRows.filter((row) => row.label === "Oportunidad").length)}
          tone="warning"
        />
      </div>
    </SurfaceCard>
  );

  const timelinePanel = <ClientUnifiedTimeline items={timelineItems} />;

  const overviewContent = (
    <div className="space-y-2 pb-2">
      {summaryHeader}
      <div className="grid gap-2 2xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-2">
          {goalsPanel}
          {portfolioPanel}
        </div>
        <div className="space-y-2">
          {actionsPanel}
          {alertsPanel}
          {intelligencePanel}
          {timelinePanel}
        </div>
      </div>
    </div>
  );

  const portfolioContent = (
    <div className="space-y-2 pb-2">
      {summaryHeader}
      <div className="grid gap-2 2xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-2">
          <div className="grid gap-1.5 md:grid-cols-2 2xl:grid-cols-4">
            <SellerMetricCard label="Clientes asignados" value={String(assignedClients.length)} detail={`${dormantClients.length} sin compra`} />
            <SellerMetricCard label="Volumen 30d" value={formatPrice(monthlySales)} detail="cartera activa del mes" />
            <SellerMetricCard label="Oportunidades" value={String(portfolioRows.filter((row) => row.label === "Oportunidad").length)} detail="clientes con quotes abiertas" />
            <SellerMetricCard label="Crecimiento" value={String(portfolioRows.filter((row) => row.label === "Crecimiento").length)} detail="cuentas con traccion positiva" tone="success" />
          </div>
          {portfolioPanel}
        </div>
        <div className="space-y-2">
          {alertsPanel}
          {intelligencePanel}
        </div>
      </div>
    </div>
  );

  const targetsContent = (
    <div className="space-y-2 pb-2">
      {summaryHeader}
      {goalsPanel}
      <div className="grid gap-2 2xl:grid-cols-[minmax(0,1fr)_300px]">
        <SurfaceCard padding="sm" className="space-y-2 rounded-[18px]">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Cumplimiento</p>
            <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">Objetivo vs realidad</h3>
          </div>
          <div className="grid gap-1.5 md:grid-cols-2 2xl:grid-cols-4">
            <SellerMetricCard label="Objetivo" value={monthlyGoal > 0 ? formatPrice(monthlyGoal) : "Sin objetivo"} detail="base vigente" />
            <SellerMetricCard label="Ventas 30d" value={formatPrice(monthlySales)} detail="periodo actual" />
            <SellerMetricCard label="Brecha" value={monthlyGoal > 0 ? formatPrice(Math.max(monthlyGoal - monthlySales, 0)) : "Sin base"} detail="faltante para llegar" tone={monthlyGoal > 0 && monthlySales >= monthlyGoal ? "success" : "destructive"} />
            <SellerMetricCard label="Variacion" value={`${monthlyVariation >= 0 ? "+" : ""}${monthlyVariation.toFixed(0)}%`} detail="vs periodo anterior" tone={monthlyVariation >= 0 ? "success" : "destructive"} />
          </div>
        </SurfaceCard>
        <div className="space-y-2">
          {alertsPanel}
          {intelligencePanel}
        </div>
      </div>
    </div>
  );

  const activityContent = (
    <div className="space-y-2 pb-2">
      {summaryHeader}
      <div className="grid gap-2 2xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-2">
          {actionsPanel}
          {timelinePanel}
        </div>
        <div className="space-y-2">
          {alertsPanel}
          <SurfaceCard padding="sm" className="space-y-2 rounded-[18px]">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Pendientes</p>
              <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">Seguimientos priorizados</h3>
            </div>
            <div className="space-y-1.5">
              {dormantClients.slice(0, 4).map((client) => (
                <div key={client.id} className="flex items-center justify-between rounded-[14px] border border-border/70 bg-card px-2.5 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-semibold text-foreground">{client.company_name || client.contact_name}</p>
                    <p className="text-[11px] text-muted-foreground">Sin compra reciente · {relativeDate(client.last_contact_at)}</p>
                  </div>
                  <Button size="sm" variant="toolbar" onClick={() => onOpenClient(client.id)}>
                    Ver
                  </Button>
                </div>
              ))}
              {dormantClients.length === 0 ? (
                <EmptyState title="Sin seguimientos criticos" description="No hay clientes dormidos para gestionar en este momento." />
              ) : null}
            </div>
          </SurfaceCard>
        </div>
      </div>
    </div>
  );

  const selectedViewContent = view === "portfolio"
    ? portfolioContent
    : view === "targets"
      ? targetsContent
      : view === "activity"
        ? activityContent
        : overviewContent;

  if (!filteredSellers.length) {
    return (
      <EmptyState
        title="Sin vendedores registrados"
        description="Crea un vendedor desde la ventana de alta para activar el módulo comercial."
        className="min-h-[420px]"
      />
    );
  }

  return (
    <div className="flex h-[calc(100vh-104px)] w-full gap-2 overflow-hidden px-1 pb-3 md:px-2">
      <div className={`flex h-full flex-col gap-2 ${selectedSeller ? "hidden md:flex w-[260px] shrink-0" : "flex w-full md:w-[260px] md:shrink-0"}`}>
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold text-muted-foreground">
            {filteredSellers.length} vendedor{filteredSellers.length === 1 ? "" : "es"}
          </p>
          <div className="flex items-center gap-1.5">
            {onNewSeller ? (
              <Button size="sm" variant="toolbar" onClick={onNewSeller}>
                <UserRound className="h-3.5 w-3.5" />
                Gestionar
              </Button>
            ) : null}
            <Badge variant="outline">Comercial</Badge>
          </div>
        </div>

        <div className="relative">
          <Users className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar vendedor"
            className={`w-full rounded-xl border pl-8 pr-3 py-2 text-[13px] outline-none transition ${dk("bg-[#111] border-[#1f1f1f] text-white", "bg-white border-[#e5e5e5] text-[#171717]")}`}
          />
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto pr-0.5">
          {filteredSellers.map((seller) => {
            const sellerClients = clients.filter((client) => client.assigned_seller_id === seller.id);
            const sellerOrders = orders
              .filter((order) => sellerClients.some((client) => client.id === order.client_id) && CLOSED_ORDER_STATUSES.has(order.status));
            const sellerSales = sellerOrders
              .reduce((sum, order) => sum + order.total, 0);
            const sellerMonthlySales = sellerOrders
              .filter((order) => new Date(order.created_at).getTime() >= Date.now() - 30 * 24 * 60 * 60 * 1000)
              .reduce((sum, order) => sum + order.total, 0);
            const dormantShare = sellerClients.length
              ? sellerClients.filter((client) => {
                  const lastOrder = sellerOrders.find((order) => order.client_id === client.id);
                  return daysSince(lastOrder?.created_at) >= 45;
                }).length / sellerClients.length
              : 0;
            const generalStatus = dormantShare >= 0.4
              ? { label: "Riesgo", tone: "destructive" as const }
              : sellerMonthlySales > 0
                ? { label: "Activo", tone: "success" as const }
                : { label: "Sin traccion", tone: "warning" as const };

            return (
              <button
                key={seller.id}
                onClick={() => setSelectedSellerId(seller.id)}
                className={`flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition ${
                  seller.id === selectedSellerId
                    ? "border-primary/30 bg-primary/10"
                    : dk("border-transparent hover:border-[#1f1f1f] hover:bg-[#141414]", "border-transparent hover:border-[#e5e5e5] hover:bg-[#fafafa]")
                }`}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-[12px] font-bold text-primary">
                  {sellerDisplayName(seller).slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-[13px] font-semibold ${dk("text-white", "text-[#171717]")}`}>{sellerDisplayName(seller)}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span>{sellerClients.length} clientes</span>
                    <span>·</span>
                    <span>{formatPrice(sellerMonthlySales)}</span>
                    <Badge variant={generalStatus.tone}>{generalStatus.label}</Badge>
                  </div>
                  <p className="mt-0.5 text-[9px] text-muted-foreground">
                    Total historico {formatPrice(sellerSales)}
                  </p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            );
          })}
        </div>
      </div>

      <div className={`min-w-0 flex-1 overflow-x-hidden overflow-y-auto pr-1 ${selectedSeller ? "flex h-full flex-col" : "hidden md:flex md:h-full md:flex-col"}`}>
        {selectedSeller ? (
          selectedViewContent
        ) : (
          <EmptyState title="Selecciona un vendedor" description="Elige un ejecutivo para ver su performance, alertas y cartera." className="min-h-[420px]" />
        )}


        {showCreateOrder && actionClient ? (
          <CreateOrderModal
            clients={[actionClient]}
            products={products}
            initialClientId={actionClient.id}
            isDark={isDark}
            onClose={() => setShowCreateOrder(false)}
            onCreated={async () => {
              await onRefreshOrders?.();
              await onRefreshClients?.();
            }}
          />
        ) : null}

        {showCreateQuote && actionClient ? (
          <CreateQuoteModal
            clients={[actionClient]}
            products={products}
            initialClientId={actionClient.id}
            isDark={isDark}
            onClose={() => setShowCreateQuote(false)}
            onCreated={async () => {
              await reloadQuotes();
              await onRefreshClients?.();
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

function SellerHeaderStat({
  label,
  value,
  icon: Icon,
  tone = "outline",
}: {
  label: string;
  value: string;
  icon: typeof UserRound;
  tone?: "outline" | "success" | "warning" | "destructive";
}) {
  const toneClass = tone === "success"
    ? "text-emerald-600 dark:text-emerald-400"
    : tone === "warning"
      ? "text-amber-600 dark:text-amber-400"
      : tone === "destructive"
        ? "text-red-600 dark:text-red-400"
        : "text-foreground";

  return (
    <div className="rounded-[16px] border border-border/70 bg-surface px-2.5 py-2">
      <div className="mb-1 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className={`text-[12px] font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function SellerMetricCard({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "success" | "destructive";
}) {
  const toneClass = tone === "success" ? "text-emerald-500" : tone === "destructive" ? "text-red-500" : "text-foreground";
  return (
    <SurfaceCard tone="subtle" padding="sm" className="space-y-1.5 rounded-[16px]">
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className={`font-display text-lg font-bold tracking-tight ${toneClass}`}>{value}</p>
      <p className="text-[11px] text-muted-foreground">{detail}</p>
    </SurfaceCard>
  );
}

function SellerAlert({
  title,
  value,
  description,
  tone,
  icon: Icon,
}: {
  title: string;
  value: string;
  description: string;
  tone: "success" | "warning" | "destructive";
  icon: typeof AlertTriangle;
}) {
  return (
    <div className="rounded-[14px] border border-border/70 bg-card px-2.5 py-2.5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-foreground">
          <Icon className="h-3.5 w-3.5" />
          {title}
        </div>
        <Badge variant={tone}>{value}</Badge>
      </div>
      <p className="text-[11px] leading-5 text-muted-foreground">{description}</p>
    </div>
  );
}

function InsightChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "success" | "warning" | "destructive";
}) {
  return (
    <div className="flex items-center justify-between rounded-[14px] border border-border/70 bg-card px-2.5 py-2">
      <p className="text-[12px] text-foreground">{label}</p>
      <Badge variant={tone}>{value}</Badge>
    </div>
  );
}
