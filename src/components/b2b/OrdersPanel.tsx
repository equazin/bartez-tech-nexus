import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ClipboardList, Clock, MapPin, Package, Search, Truck, ExternalLink, Copy } from "lucide-react";

import { EmptyOrdersState } from "@/components/b2b/empty-states/EmptyOrdersState";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { OrderPaymentProof } from "@/components/OrderPaymentProof";
import { OrderStatusTimeline } from "@/components/OrderStatusTimeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import type { PortalOrder } from "@/hooks/useOrders";
import type { Invoice } from "@/lib/api/invoices";

interface OrdersPanelProps {
  orders: PortalOrder[];
  invoices?: Invoice[];
  formatPrice: (value: number) => string;
  formatUSD: (value: number) => string;
  formatARS: (value: number) => string;
  currency: "USD" | "ARS";
  onRepeatOrder: (order: PortalOrder) => void;
  onGoToCatalog: () => void;
  onGoToInvoices: () => void;
  onUpdateOrderProofs: (orderId: string | number, proofs: unknown[]) => Promise<void> | void;
}

const DATE_RANGE_OPTIONS = [
  { value: "all", label: "Todo el tiempo" },
  { value: "30", label: "Últimos 30 días" },
  { value: "90", label: "Últimos 90 días" },
  { value: "365", label: "Último año" },
] as const;

const ORDER_STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "En revision" },
  { value: "approved", label: "Aprobados" },
  { value: "preparing", label: "Preparando" },
  { value: "dispatched", label: "Despachados" },
  { value: "shipped", label: "Enviados" },
  { value: "delivered", label: "Entregados" },
  { value: "rejected", label: "Rechazados" },
] as const;

function getPendingUrgency(createdAt: string): { label: string; className: string } | null {
  const ageH = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  if (ageH < 48) return null;
  const days = Math.floor(ageH / 24);
  if (ageH >= 120) {
    return { label: `hace ${days}d`, className: "border-red-500/30 bg-red-500/10 text-red-500" };
  }
  return { label: `hace ${days}d`, className: "border-amber-500/30 bg-amber-500/10 text-amber-500" };
}

const ORDER_STATUS_COPY: Record<string, string> = {
  pending: "Estamos revisando stock y condiciones comerciales.",
  approved: "Pedido confirmado. Proximo paso: preparacion o despacho.",
  preparing: "Tu pedido esta en preparacion interna.",
  dispatched: "El pedido ya salio de deposito con remito emitido.",
  shipped: "El transporte esta en curso.",
  delivered: "El pedido figura como entregado.",
  rejected: "El pedido quedo rechazado. Podes repetirlo ajustando condiciones.",
};

export function OrdersPanel({
  orders,
  invoices = [],
  formatPrice,
  formatUSD,
  formatARS,
  currency,
  onRepeatOrder,
  onGoToCatalog,
  onGoToInvoices,
  onUpdateOrderProofs,
}: OrdersPanelProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof ORDER_STATUS_OPTIONS)[number]["value"]>("all");
  const [dateRange, setDateRange] = useState<(typeof DATE_RANGE_OPTIONS)[number]["value"]>("all");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const filteredOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const cutoff = dateRange !== "all" ? Date.now() - Number(dateRange) * 86_400_000 : null;
    return orders.filter((order) => {
      if (statusFilter !== "all" && order.status !== statusFilter) return false;
      if (cutoff !== null && new Date(order.created_at).getTime() < cutoff) return false;
      if (!normalizedQuery) return true;
      const haystack = [
        order.order_number,
        String(order.id),
        order.numero_remito,
        order.internal_reference,
        order.notes,
        order.shipping_type,
        order.shipping_address,
        order.shipping_transport,
        ...order.products.map((product) => `${product.name} ${product.sku}`),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [orders, query, statusFilter]);

  const kpis = useMemo(() => {
    const activeOrders = orders.filter((order) => !["rejected", "delivered"].includes(order.status));
    const deliveredOrders = orders.filter((order) => order.status === "delivered");
    return [
      { label: "Pedidos activos", value: String(activeOrders.length), accent: "text-primary" },
      { label: "Despachados", value: String(orders.filter((order) => order.status === "dispatched").length), accent: "text-blue-600 dark:text-blue-400" },
      { label: "Entregados", value: String(deliveredOrders.length), accent: "text-emerald-600 dark:text-emerald-400" },
      { label: "Monto en curso", value: formatPrice(activeOrders.reduce((sum, order) => sum + order.total, 0)), accent: "text-amber-600 dark:text-amber-400" },
    ];
  }, [orders, formatPrice]);

  if (orders.length === 0) {
    return <EmptyOrdersState onGoToCatalog={onGoToCatalog} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Mis pedidos</h2>
          <p className="text-sm text-muted-foreground">Seguimiento comercial, logistico y comprobantes.</p>
        </div>
        <Button type="button" variant="toolbar" onClick={onGoToCatalog}>Ir al catalogo</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <SurfaceCard key={kpi.label} tone="default" padding="md" className="rounded-[22px] border border-border/70 bg-card shadow-sm">
            <p className="mb-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{kpi.label}</p>
            <p className={`text-xl font-bold ${kpi.accent}`}>{kpi.value}</p>
          </SurfaceCard>
        ))}
      </div>

      <SurfaceCard tone="default" padding="md" className="rounded-[24px] border border-border/70 bg-card shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
          <label className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por pedido, remito, SKU o direccion" className="h-10 rounded-xl border-border/70 bg-background pl-9" />
          </label>
          <select value={dateRange} onChange={(event) => setDateRange(event.target.value as (typeof DATE_RANGE_OPTIONS)[number]["value"])} className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground outline-none">
            {DATE_RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as (typeof ORDER_STATUS_OPTIONS)[number]["value"])} className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground outline-none">
            {ORDER_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </SurfaceCard>

      {filteredOrders.length === 0 ? (
        <EmptyState title="No encontramos pedidos con esos filtros" icon={<Search size={18} />} className="rounded-[24px] border border-border/70 bg-card py-16" />
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const orderId = String(order.id);
            const isExpanded = expandedOrderId === orderId;
            const otherCurrencyValue = currency === "USD" ? formatARS(order.total) : formatUSD(order.total);
            const relatedInvoices = invoices.filter((invoice) => String(invoice.order_id) === orderId);
            const pendingUrgency = order.status === "pending" ? getPendingUrgency(order.created_at) : null;
            const shippingLabel = order.shipping_type
              ? {
                  retiro: "Retiro en sucursal",
                  envio: "Envio coordinado",
                  transporte: "Transporte / expreso",
                }[order.shipping_type] ?? order.shipping_type
              : "Sin modalidad definida";

            return (
              <SurfaceCard key={orderId} tone="default" padding="none" className="overflow-hidden rounded-[24px] border border-border/70 bg-card shadow-sm">
                <button type="button" onClick={() => setExpandedOrderId(isExpanded ? null : orderId)} className="w-full px-5 py-4 text-left transition hover:bg-secondary/30">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">{order.order_number ?? `#${orderId.slice(-6).toUpperCase()}`}</span>
                        <OrderStatusBadge status={order.status} />
                        {pendingUrgency && (
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${pendingUrgency.className}`}>
                            <Clock size={9} />
                            {pendingUrgency.label}
                          </span>
                        )}
                        {order.internal_reference ? <Badge variant="outline" className="border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400 text-[10px]">PO: {order.internal_reference}</Badge> : null}
                        {order.numero_remito ? <Badge variant="outline" className="text-[10px]">Remito {order.numero_remito}</Badge> : null}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        {" · "}
                        {order.products.length} producto{order.products.length === 1 ? "" : "s"}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-lg font-bold tabular-nums text-primary">{formatPrice(order.total)}</p>
                      <p className="text-[11px] text-muted-foreground">{otherCurrencyValue}</p>
                    </div>
                  </div>
                </button>

                {isExpanded ? (
                  <div className="space-y-4 border-t border-border/70 px-5 py-4">
                    <div className="grid gap-3 lg:grid-cols-3">
                      <SurfaceCard tone="subtle" padding="md" className="rounded-[20px] border border-border/70 bg-background/70">
                        <div className="mb-2 flex items-center gap-2">
                          <Package size={13} className="text-primary" />
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Estado</p>
                        </div>
                        <p className="text-sm text-foreground">{ORDER_STATUS_COPY[order.status] ?? "Estamos actualizando el estado del pedido."}</p>
                        <div className="mt-3"><OrderStatusTimeline status={order.status} /></div>
                      </SurfaceCard>

                      <SurfaceCard tone="subtle" padding="md" className="rounded-[20px] border border-border/70 bg-background/70">
                        <div className="mb-2 flex items-center gap-2">
                          <Truck size={13} className="text-blue-600 dark:text-blue-400" />
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Logistica</p>
                        </div>
                        <p className="text-sm font-medium text-foreground">{shippingLabel}</p>
                        {order.shipping_transport ? <p className="mt-1 text-[11px] text-muted-foreground">Transporte: {order.shipping_transport}</p> : null}
                        {typeof order.shipping_cost === "number" && order.shipping_cost > 0 ? <p className="mt-1 text-[11px] text-muted-foreground">Costo: {formatPrice(order.shipping_cost)}</p> : null}
                        {order.tracking_number ? (
                          <div className="mt-3 rounded-xl border border-border/70 bg-card px-3 py-3">
                            <div className="mb-2 flex items-center justify-between">
                              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Seguimiento</span>
                              <span className="text-[10px] font-bold uppercase text-primary">{order.shipping_provider || "transporte"}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-mono font-bold text-foreground">{order.tracking_number}</p>
                              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={(event) => { event.stopPropagation(); navigator.clipboard.writeText(order.tracking_number ?? ""); toast.success("Numero copiado"); }}>
                                <Copy size={10} />
                              </Button>
                            </div>
                            {order.shipping_provider && ["andreani", "oca"].includes(order.shipping_provider) ? (
                              <a
                                href={order.shipping_provider === "andreani" ? `https://seguimiento.andreani.com/envio/${order.tracking_number}` : `https://www4.oca.com.ar/ocaonline/seguimiento/buscar_envio.asp?p_search=${order.tracking_number}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[11px] font-semibold text-primary-foreground transition hover:bg-primary/90"
                              >
                                <ExternalLink size={10} /> Ver seguimiento
                              </a>
                            ) : null}
                          </div>
                        ) : null}
                      </SurfaceCard>

                      <SurfaceCard tone="subtle" padding="md" className="rounded-[20px] border border-border/70 bg-background/70">
                        <div className="mb-2 flex items-center gap-2">
                          <MapPin size={13} className="text-amber-600 dark:text-amber-400" />
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Entrega</p>
                        </div>
                        <p className="text-sm text-foreground">{order.shipping_address || "Se coordina con el equipo comercial"}</p>
                      </SurfaceCard>
                    </div>

                    <SurfaceCard tone="subtle" padding="md" className="rounded-[20px] border border-border/70 bg-background/70">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Documentos asociados</p>
                          <p className="mt-1 text-sm text-foreground">Remito: <span className="font-semibold">{order.numero_remito || "Pendiente"}</span></p>
                          <p className="text-sm text-foreground">Facturas vinculadas: <span className="font-semibold">{relatedInvoices.length}</span></p>
                        </div>
                        {relatedInvoices.length > 0 ? <Button type="button" variant="toolbar" onClick={onGoToInvoices}>Ver facturas</Button> : null}
                      </div>
                      {relatedInvoices.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {relatedInvoices.map((invoice) => <Badge key={invoice.id} variant="outline">{invoice.invoice_number}</Badge>)}
                        </div>
                      ) : null}
                    </SurfaceCard>

                    {order.notes ? (
                      <SurfaceCard tone="subtle" padding="md" className="rounded-[20px] border border-border/70 bg-background/70">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Notas</p>
                        <p className="text-sm text-foreground">{order.notes}</p>
                      </SurfaceCard>
                    ) : null}

                    <div className="overflow-hidden rounded-[20px] border border-border/70 bg-background/70">
                      <div className="grid grid-cols-[1fr_80px_110px] gap-2 border-b border-border/70 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        <span>Producto</span>
                        <span className="text-center">Cant.</span>
                        <span className="text-right">Total</span>
                      </div>
                      {order.products.map((product, index) => (
                        <div key={`${orderId}-${product.product_id}-${index}`} className="grid grid-cols-[1fr_80px_110px] gap-2 border-t border-border/70 px-4 py-3 first:border-t-0">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{product.name}</p>
                            {product.sku ? <p className="text-[10px] font-mono text-muted-foreground">{product.sku}</p> : null}
                          </div>
                          <span className="text-center text-sm text-muted-foreground">{product.quantity}</span>
                          <span className="text-right text-sm font-semibold text-primary">{formatPrice(product.total_price ?? 0)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Total del pedido</p>
                        <p className="text-xl font-bold text-primary">{formatPrice(order.total)}</p>
                      </div>
                      <Button type="button" variant="toolbar" onClick={() => onRepeatOrder(order)}>Repetir pedido</Button>
                    </div>

                    <OrderPaymentProof orderId={order.id} existingProofs={order.payment_proofs} isDark={false} onProofsUpdated={(proofs) => { void Promise.resolve(onUpdateOrderProofs(order.id, proofs)); }} />
                  </div>
                ) : null}
              </SurfaceCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
