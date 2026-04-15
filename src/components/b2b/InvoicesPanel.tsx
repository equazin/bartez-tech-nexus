import { useMemo, useState } from "react";
import { Download, FileText, Filter, Search } from "lucide-react";

import { useCurrency } from "@/context/CurrencyContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SurfaceCard } from "@/components/ui/surface-card";
import type { PortalOrder } from "@/hooks/useOrders";
import type { Invoice, InvoiceStatus } from "@/lib/api/invoices";
import { convertMoneyAmount, formatMoneyAmount, formatMoneyInPreferredCurrency, getEffectiveInvoiceAmounts } from "@/lib/money";

interface InvoicesPanelProps {
  invoices: Invoice[];
  orders?: PortalOrder[];
  loading: boolean;
  onGoToOrders: () => void;
}

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Borrador",
  sent: "Enviada",
  paid: "Pagada",
  overdue: "Vencida",
  cancelled: "Cancelada",
};

const STATUS_CLASSES: Record<InvoiceStatus, string> = {
  draft: "text-muted-foreground",
  sent: "text-blue-600 dark:text-blue-400",
  paid: "text-emerald-600 dark:text-emerald-400",
  overdue: "text-destructive",
  cancelled: "text-muted-foreground",
};

export function InvoicesPanel({ invoices, orders = [], loading, onGoToOrders }: InvoicesPanelProps) {
  const { currency, exchangeRate } = useCurrency();
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "all">("all");
  const [dueFilter, setDueFilter] = useState<"all" | "upcoming" | "overdue" | "unpaid">("all");
  const [query, setQuery] = useState("");
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);

  const filteredInvoices = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return invoices.filter((invoice) => {
      if (statusFilter !== "all" && invoice.status !== statusFilter) return false;
      if (dueFilter === "overdue" && invoice.status !== "overdue") return false;
      if (dueFilter === "unpaid" && !["draft", "sent", "overdue"].includes(invoice.status)) return false;
      if (dueFilter === "upcoming") {
        if (!invoice.due_date || !["draft", "sent", "overdue"].includes(invoice.status)) return false;
        const dueAt = new Date(invoice.due_date).getTime();
        const now = Date.now();
        const inFifteenDays = now + 1000 * 60 * 60 * 24 * 15;
        if (dueAt < now || dueAt > inFifteenDays) return false;
      }
      if (!normalizedQuery) return true;
      return [invoice.invoice_number, invoice.client_snapshot?.company_name, invoice.client_snapshot?.contact_name, invoice.notes, invoice.order_id ? String(invoice.order_id) : ""]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [dueFilter, invoices, query, statusFilter]);

  const summary = useMemo(() => {
    const overdue = invoices.filter((invoice) => invoice.status === "overdue");
    const pending = invoices.filter((invoice) => ["draft", "sent", "overdue"].includes(invoice.status));
    const paid = invoices.filter((invoice) => invoice.status === "paid");
    const nextDue = pending.filter((invoice) => invoice.due_date).sort((a, b) => new Date(a.due_date ?? "").getTime() - new Date(b.due_date ?? "").getTime())[0];
    const sumInCurrency = (list: Invoice[]) =>
      list.reduce((sum, invoice) => {
        const effective = getEffectiveInvoiceAmounts(invoice, exchangeRate.rate);
        return sum + convertMoneyAmount(effective.total, effective.currency, currency, exchangeRate.rate);
      }, 0);
    return [
      { label: "Pendientes", value: formatMoneyAmount(sumInCurrency(pending), currency, 0), accent: "text-amber-600 dark:text-amber-400" },
      { label: "Vencidas", value: formatMoneyAmount(sumInCurrency(overdue), currency, 0), accent: "text-destructive" },
      { label: "Pagadas", value: formatMoneyAmount(sumInCurrency(paid), currency, 0), accent: "text-emerald-600 dark:text-emerald-400" },
      { label: "Próximo vencimiento", value: nextDue?.due_date ? new Date(nextDue.due_date).toLocaleDateString("es-AR") : "Sin fecha", accent: nextDue ? "text-primary" : "text-muted-foreground" },
    ];
  }, [currency, exchangeRate.rate, invoices]);

  if (!loading && invoices.length === 0) {
    return (
      <EmptyState
        icon={<FileText size={22} />}
        title="No tenes facturas disponibles"
        description="A medida que se emitan documentos sobre tus pedidos, van a aparecer aca con vencimientos y descargas."
        actionLabel="Ver pedidos"
        onAction={onGoToOrders}
        className="rounded-[24px] border border-border/70 bg-card py-20"
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Mis facturas</h2>
          <p className="text-sm text-muted-foreground">Seguimiento financiero, vencimientos y descargas.</p>
        </div>
        <Button type="button" variant="toolbar" onClick={onGoToOrders}>Ver pedidos</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summary.map((card) => (
          <SurfaceCard key={card.label} tone="default" padding="md" className="rounded-[22px] border border-border/70 bg-card shadow-sm">
            <p className="mb-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{card.label}</p>
            <p className={`text-xl font-bold ${card.accent}`}>{card.value}</p>
          </SurfaceCard>
        ))}
      </div>

      <SurfaceCard tone="default" padding="md" className="rounded-[24px] border border-border/70 bg-card shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px]">
          <label className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por numero, pedido o nota" className="h-10 rounded-xl border-border/70 bg-background pl-9" />
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-border/70 bg-background px-3">
            <Filter size={13} className="text-muted-foreground" />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as InvoiceStatus | "all")} className="h-10 w-full bg-transparent text-sm text-foreground outline-none">
              <option value="all">Todos los estados</option>
              {(Object.keys(STATUS_LABELS) as InvoiceStatus[]).map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-border/70 bg-background px-3">
            <Filter size={13} className="text-muted-foreground" />
            <select value={dueFilter} onChange={(event) => setDueFilter(event.target.value as "all" | "upcoming" | "overdue" | "unpaid")} className="h-10 w-full bg-transparent text-sm text-foreground outline-none">
              <option value="all">Todos los vencimientos</option>
              <option value="upcoming">Vence pronto</option>
              <option value="overdue">Solo vencidas</option>
              <option value="unpaid">Impagas</option>
            </select>
          </label>
        </div>
      </SurfaceCard>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <SurfaceCard key={`invoice-skeleton-${index}`} tone="default" padding="none" className="overflow-hidden rounded-[24px] border border-border/70 bg-card shadow-sm">
              <div className="px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0 space-y-2">
                    <Skeleton className="h-3 w-36 animate-pulse rounded-md" />
                    <Skeleton className="h-3 w-40 animate-pulse rounded-md" />
                  </div>
                  <div className="space-y-2 text-right">
                    <Skeleton className="h-5 w-28 animate-pulse rounded-md" />
                    <Skeleton className="h-3 w-24 animate-pulse rounded-md" />
                  </div>
                </div>
              </div>
            </SurfaceCard>
          ))}
        </div>
      ) : filteredInvoices.length === 0 ? (
        <EmptyState title="No encontramos facturas con esos filtros" icon={<Search size={18} />} className="rounded-[24px] border border-border/70 bg-card py-16" />
      ) : (
        <div className="space-y-3">
          {filteredInvoices.map((invoice) => {
            const effective = getEffectiveInvoiceAmounts(invoice, exchangeRate.rate);
            const isExpanded = expandedInvoiceId === invoice.id;
            const itemCount = Array.isArray(invoice.items) ? invoice.items.length : 0;
            const relatedOrder = orders.find((order) => String(order.id) === String(invoice.order_id));
            return (
              <SurfaceCard key={invoice.id} tone="default" padding="none" className="overflow-hidden rounded-[24px] border border-border/70 bg-card shadow-sm">
                <button type="button" onClick={() => setExpandedInvoiceId(isExpanded ? null : invoice.id)} className="w-full px-5 py-4 text-left transition hover:bg-secondary/30">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">{invoice.invoice_number}</span>
                        <span className={`text-[11px] font-semibold ${STATUS_CLASSES[invoice.status]}`}>{STATUS_LABELS[invoice.status]}</span>
                        {invoice.order_id ? <Badge variant="outline" className="text-[10px]">Pedido #{invoice.order_id}</Badge> : null}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {invoice.due_date ? `Vence ${new Date(invoice.due_date).toLocaleDateString("es-AR")}` : "Sin vencimiento"}
                        {itemCount > 0 ? ` · ${itemCount} item${itemCount === 1 ? "" : "s"}` : ""}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold text-primary">{formatMoneyInPreferredCurrency(effective.total, effective.currency, currency, exchangeRate.rate, 0)}</p>
                      <p className="text-[11px] text-muted-foreground">Original {formatMoneyAmount(effective.total, effective.currency, 0)}</p>
                    </div>
                  </div>
                </button>

                {isExpanded ? (
                  <div className="space-y-4 border-t border-border/70 px-5 py-4">
                    <div className="grid gap-3 lg:grid-cols-3">
                      <SurfaceCard tone="subtle" padding="md" className="rounded-[20px] border border-border/70 bg-background/70">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Detalle impositivo</p>
                        <p className="text-sm text-foreground">Subtotal: {formatMoneyInPreferredCurrency(effective.subtotal, effective.currency, currency, exchangeRate.rate, 0)}</p>
                        <p className="text-sm text-foreground">IVA: {formatMoneyInPreferredCurrency(effective.ivaTotal, effective.currency, currency, exchangeRate.rate, 0)}</p>
                        <p className="text-sm font-semibold text-primary">Total: {formatMoneyInPreferredCurrency(effective.total, effective.currency, currency, exchangeRate.rate, 0)}</p>
                      </SurfaceCard>

                      <SurfaceCard tone="subtle" padding="md" className="rounded-[20px] border border-border/70 bg-background/70">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Cliente</p>
                        <p className="text-sm font-medium text-foreground">{invoice.client_snapshot?.company_name || "Cuenta B2B"}</p>
                        <p className="text-[11px] text-muted-foreground">{invoice.client_snapshot?.contact_name || "Sin contacto asociado"}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">Moneda emitida: {effective.currency}</p>
                        {effective.exchangeRate || invoice.exchange_rate ? <p className="mt-1 text-[11px] text-muted-foreground">Tipo de cambio: {(effective.exchangeRate ?? invoice.exchange_rate ?? 0).toLocaleString("es-AR")} ARS/USD</p> : null}
                      </SurfaceCard>

                      <SurfaceCard tone="subtle" padding="md" className="rounded-[20px] border border-border/70 bg-background/70">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Cobranza</p>
                        <p className="text-sm text-foreground">Estado: <span className={STATUS_CLASSES[invoice.status]}>{STATUS_LABELS[invoice.status]}</span></p>
                        <p className="text-[11px] text-muted-foreground">{invoice.paid_at ? `Pagada el ${new Date(invoice.paid_at).toLocaleDateString("es-AR")}` : "Pendiente de imputacion"}</p>
                        {invoice.due_date ? <p className="mt-1 text-[11px] text-muted-foreground">Vence {new Date(invoice.due_date).toLocaleDateString("es-AR")}</p> : null}
                      </SurfaceCard>
                    </div>

                    {invoice.cae || invoice.invoice_type ? (
                      <SurfaceCard tone="subtle" padding="md" className="rounded-[20px] border border-border/70 bg-background/70">
                        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                          <div className="flex-1 space-y-4">
                            <div className="flex items-center gap-2">
                              <FileText size={16} className="text-primary" />
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Informacion fiscal oficial</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                              <div><p className="text-[10px] uppercase text-muted-foreground">Tipo</p><p className="text-sm font-bold text-foreground">{invoice.invoice_type || "A"}</p></div>
                              <div><p className="text-[10px] uppercase text-muted-foreground">Punto venta</p><p className="text-xs font-mono font-bold text-foreground">{invoice.point_of_sale || "0001"}</p></div>
                              <div><p className="text-[10px] uppercase text-muted-foreground">CAE</p><p className="text-xs font-mono font-bold text-primary">{invoice.cae || "Pendiente"}</p></div>
                              <div><p className="text-[10px] uppercase text-muted-foreground">Vence CAE</p><p className="text-xs font-bold text-foreground">{invoice.cae_due_date ? new Date(invoice.cae_due_date).toLocaleDateString("es-AR") : "-"}</p></div>
                            </div>
                          </div>
                          {invoice.afip_qr ? (
                            <div className="rounded-lg border border-border/70 bg-white p-2">
                              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(invoice.afip_qr)}`} alt="AFIP QR" className="h-20 w-20" />
                              <p className="mt-1 text-center text-[8px] font-bold uppercase text-muted-foreground">AFIP oficial</p>
                            </div>
                          ) : null}
                        </div>
                      </SurfaceCard>
                    ) : null}

                    {invoice.order_id || relatedOrder?.numero_remito ? (
                      <SurfaceCard tone="subtle" padding="md" className="rounded-[20px] border border-border/70 bg-background/70">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Documentos asociados</p>
                        {invoice.order_id ? <p className="text-sm text-foreground">Pedido: <span className="font-semibold">{relatedOrder?.order_number ?? `#${invoice.order_id}`}</span></p> : null}
                        {relatedOrder?.numero_remito ? <p className="text-sm text-foreground">Remito: <span className="font-semibold">{relatedOrder.numero_remito}</span></p> : null}
                        {relatedOrder?.status ? <p className="mt-1 text-[11px] text-muted-foreground">Estado logistico: {relatedOrder.status}</p> : null}
                      </SurfaceCard>
                    ) : null}

                    {invoice.notes ? (
                      <SurfaceCard tone="subtle" padding="md" className="rounded-[20px] border border-border/70 bg-background/70">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Observaciones</p>
                        <p className="text-sm text-foreground">{invoice.notes}</p>
                      </SurfaceCard>
                    ) : null}

                    {effective.isLegacyPreview ? (
                      <div className="rounded-[20px] border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                        Se corrigio la visualizacion de una factura legacy usando la cotizacion actual.
                      </div>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-2">
                      {invoice.pdf_url ? (
                        <a href={invoice.pdf_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90">
                          <Download size={12} /> Descargar PDF
                        </a>
                      ) : (
                        <span className="rounded-xl border border-border/70 px-3 py-2 text-xs text-muted-foreground">PDF pendiente de carga</span>
                      )}

                      {invoice.order_id ? <Button type="button" variant="toolbar" size="sm" onClick={onGoToOrders}>Ver pedido relacionado</Button> : null}
                    </div>
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
