import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useCurrency } from "@/context/CurrencyContext";
import {
  FileText,
  CheckCircle2,
  Clock,
  Send,
  DollarSign,
  AlertTriangle,
  XCircle,
  ChevronDown,
  Plus,
  RefreshCw,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  fetchInvoices,
  markInvoicePaid,
  sendInvoice,
  createInvoiceFromOrder,
  repairInvoice,
  type Invoice,
  type InvoiceStatus,
} from "@/lib/api/invoices";
import {
  formatMoneyAmount,
  formatMoneyInPreferredCurrency,
  getEffectiveInvoiceAmounts,
} from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SurfaceCard } from "@/components/ui/surface-card";
import { cn } from "@/lib/utils";

interface Props { isDark?: boolean }

interface OrderOption {
  id: number;
  order_number: string;
  client_name: string;
  total: number;
}

interface ProfileRow {
  id: string;
  company_name: string | null;
  contact_name: string | null;
}

interface OrderRow {
  id: number;
  order_number: string | null;
  client_id: string;
  total: number | null;
}

interface InvoiceOrderRef {
  order_id: number | null;
}

const STATUS_MAP: Record<InvoiceStatus, { label: string; icon: LucideIcon; cls: string }> = {
  draft: { label: "Borrador", icon: Clock, cls: "bg-muted text-muted-foreground" },
  sent: { label: "Enviada", icon: Send, cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  paid: { label: "Pagada", icon: CheckCircle2, cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  overdue: { label: "Vencida", icon: AlertTriangle, cls: "bg-red-500/10 text-red-600 dark:text-red-400" },
  cancelled: { label: "Cancelada", icon: XCircle, cls: "bg-muted text-muted-foreground" },
};

function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const { label, icon: Icon, cls } = STATUS_MAP[status] ?? STATUS_MAP.draft;
  return (
    <Badge variant="outline" className={cn("gap-1 border-border/70 text-[11px] font-semibold", cls)}>
      <Icon size={10} />
      {label}
    </Badge>
  );
}

export function InvoicesTab({ isDark: _isDark = true }: Props) {
  const { exchangeRate, currency, setCurrency } = useCurrency();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<InvoiceStatus | "all">("all");
  const [clientMap, setClientMap] = useState<Record<string, string>>({});

  const [showCreate, setShowCreate] = useState(false);
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [createForm, setCreateForm] = useState({
    orderId: "" as string,
    dueDays: 30,
    currency: currency as "ARS" | "USD",
    exchangeRate: String(exchangeRate.rate),
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let data = await fetchInvoices(filterStatus !== "all" ? { status: filterStatus } : {});
    const legacyInvoices = data.filter((invoice) => invoice.currency === "ARS" && (!invoice.exchange_rate || invoice.exchange_rate <= 0));

    if (legacyInvoices.length > 0) {
      await Promise.allSettled(
        legacyInvoices.map((invoice) =>
          repairInvoice(invoice.id, {
            currency: "ARS",
            exchangeRate: exchangeRate.rate,
          }),
        ),
      );
      data = await fetchInvoices(filterStatus !== "all" ? { status: filterStatus } : {});
    }

    setInvoices(data);
    setLoading(false);
  }, [exchangeRate.rate, filterStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    supabase.from("profiles").select("id, company_name, contact_name").then(({ data }) => {
      const map: Record<string, string> = {};
      ((data as ProfileRow[] | null) ?? []).forEach((profile) => {
        map[profile.id] = profile.company_name || profile.contact_name || profile.id;
      });
      setClientMap(map);
    });
  }, []);

  async function openCreate() {
    setShowCreate(true);
    setCreateError("");
    setCreateForm({
      orderId: "",
      dueDays: 30,
      currency: currency as "ARS" | "USD",
      exchangeRate: String(exchangeRate.rate),
    });
    setLoadingOrders(true);

    const { data: orderRows, error: ordersError } = await supabase
      .from("orders")
      .select("id, order_number, client_id, total")
      .not("status", "in", '("rejected","cancelled")')
      .order("created_at", { ascending: false })
      .limit(100);

    if (ordersError) {
      setOrders([]);
      setCreateError(`No se pudieron cargar los pedidos: ${ordersError.message}`);
      setLoadingOrders(false);
      return;
    }

    const ordersData = (orderRows as OrderRow[] | null) ?? [];
    const clientIds = Array.from(new Set(ordersData.map((order) => order.client_id).filter(Boolean)));

    const [profilesResult, invoicesResult] = await Promise.all([
      clientIds.length > 0
        ? supabase.from("profiles").select("id, company_name, contact_name").in("id", clientIds)
        : Promise.resolve({ data: [], error: null }),
      supabase.from("invoices").select("order_id").not("order_id", "is", null),
    ]);

    if (profilesResult.error) {
      setOrders([]);
      setCreateError(`No se pudieron cargar los clientes de los pedidos: ${profilesResult.error.message}`);
      setLoadingOrders(false);
      return;
    }

    if (invoicesResult.error) {
      setOrders([]);
      setCreateError(`No se pudieron revisar las facturas existentes: ${invoicesResult.error.message}`);
      setLoadingOrders(false);
      return;
    }

    const profilesById = new Map(
      (((profilesResult.data as ProfileRow[] | null) ?? []).map((profile) => [
        profile.id,
        profile.company_name || profile.contact_name || profile.id,
      ])),
    );
    const invoicedOrderIds = new Set(
      (((invoicesResult.data as InvoiceOrderRef[] | null) ?? [])
        .map((invoice) => invoice.order_id)
        .filter((orderId): orderId is number => typeof orderId === "number")),
    );

    setOrders(
      ordersData
        .filter((order) => !invoicedOrderIds.has(order.id))
        .map((order) => ({
          id: order.id,
          order_number: order.order_number ?? `#${String(order.id).slice(-6)}`,
          client_name: profilesById.get(order.client_id) ?? order.client_id,
          total: order.total ?? 0,
        })),
    );
    setLoadingOrders(false);
  }

  async function handleCreate() {
    if (!createForm.orderId) {
      setCreateError("Selecciona un pedido.");
      return;
    }

    setCreating(true);
    setCreateError("");
    try {
      await createInvoiceFromOrder(Number(createForm.orderId), {
        dueDays: createForm.dueDays,
        currency: createForm.currency,
        exchangeRate: createForm.currency === "ARS" && createForm.exchangeRate ? Number(createForm.exchangeRate) : undefined,
      });
      setShowCreate(false);
      await load();
    } catch (error: unknown) {
      setCreateError(error instanceof Error ? error.message : "Error al crear factura.");
    } finally {
      setCreating(false);
    }
  }

  async function handleMarkPaid(invoiceId: string) {
    setActionLoading(`${invoiceId}-paid`);
    await markInvoicePaid(invoiceId);
    setActionLoading(null);
    await load();
  }

  async function handleSend(invoiceId: string) {
    setActionLoading(`${invoiceId}-send`);
    await sendInvoice(invoiceId);
    setActionLoading(null);
    await load();
  }

  const orderPreviewTotal = (amountUsd: number) => {
    if (createForm.currency === "ARS" && createForm.exchangeRate.trim()) {
      return formatMoneyAmount(amountUsd * Number(createForm.exchangeRate), "ARS", 0);
    }
    return formatMoneyAmount(amountUsd, "USD", 0);
  };

  const selectedInvoice = invoices.find((invoice) => invoice.id === selectedId);

  return (
    <div className="space-y-4">
      <SurfaceCard tone="default" padding="md" className="rounded-[24px] border-border/70">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Finanzas</p>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Facturacion</h2>
              <p className="text-sm text-muted-foreground">{invoices.length} facturas activas en el circuito financiero.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-2xl border border-border/70 bg-card p-1">
              {(["USD", "ARS"] as const).map((option) => (
                <Button key={option} variant={currency === option ? "soft" : "ghost"} size="sm" onClick={() => setCurrency(option)}>
                  {option}
                </Button>
              ))}
            </div>

            <select
              value={filterStatus}
              onChange={(event) => setFilterStatus(event.target.value as InvoiceStatus | "all")}
              className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary/40"
            >
              <option value="all">Todos los estados</option>
              {(Object.keys(STATUS_MAP) as InvoiceStatus[]).map((status) => (
                <option key={status} value={status}>{STATUS_MAP[status].label}</option>
              ))}
            </select>

            <Button variant="toolbar" size="icon" className="h-10 w-10 rounded-xl" onClick={() => void load()}>
              <RefreshCw size={14} />
            </Button>
            <Button size="sm" className="h-10 rounded-xl px-4" onClick={openCreate}>
              <Plus size={12} />
              Nueva factura
            </Button>
          </div>
        </div>
      </SurfaceCard>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-16 animate-pulse rounded-2xl bg-card" />
              ))}
            </div>
          ) : invoices.length === 0 ? (
            <EmptyState title="Sin facturas" description="No hay facturas para los filtros actuales." icon={<FileText size={22} />} />
          ) : (
            <SurfaceCard tone="default" padding="none" className="overflow-hidden rounded-[24px] border-border/70">
              {invoices.map((invoice, index) => {
                const effective = getEffectiveInvoiceAmounts(invoice, exchangeRate.rate);
                const clientName = invoice.client_snapshot?.company_name || clientMap[invoice.client_id] || invoice.client_id.slice(0, 8);
                const isSelected = selectedId === invoice.id;

                return (
                  <button
                    key={invoice.id}
                    type="button"
                    onClick={() => setSelectedId(isSelected ? null : invoice.id)}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-3 text-left transition",
                      index > 0 && "border-t border-border/70",
                      isSelected ? "bg-secondary/60" : "bg-card hover:bg-secondary/50",
                    )}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
                      <FileText size={13} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">{invoice.invoice_number}</span>
                        <InvoiceStatusBadge status={invoice.status} />
                      </div>
                      <p className="truncate text-[11px] text-muted-foreground">{clientName}</p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-xs font-bold text-foreground">
                        {formatMoneyInPreferredCurrency(effective.total, effective.currency, currency, exchangeRate.rate, 0)}
                      </p>
                      {invoice.due_date ? (
                        <p className="text-[10px] text-muted-foreground">Vence {new Date(invoice.due_date).toLocaleDateString("es-AR")}</p>
                      ) : null}
                    </div>

                    <ChevronDown size={13} className={cn("shrink-0 text-muted-foreground transition-transform", isSelected && "rotate-180")} />
                  </button>
                );
              })}
            </SurfaceCard>
          )}
        </div>

        {selectedInvoice ? (() => {
          const effective = getEffectiveInvoiceAmounts(selectedInvoice, exchangeRate.rate);
          const detailRows = [
            { label: "Cliente", value: selectedInvoice.client_snapshot?.company_name || clientMap[selectedInvoice.client_id] || "-" },
            { label: "Contacto", value: selectedInvoice.client_snapshot?.contact_name || "-" },
            { label: "Moneda de emision", value: effective.currency },
            { label: "Visualizacion", value: currency },
            { label: "Subtotal", value: formatMoneyInPreferredCurrency(effective.subtotal, effective.currency, currency, exchangeRate.rate, 0) },
            { label: "IVA", value: formatMoneyInPreferredCurrency(effective.ivaTotal, effective.currency, currency, exchangeRate.rate, 0) },
            { label: "Total", value: formatMoneyInPreferredCurrency(effective.total, effective.currency, currency, exchangeRate.rate, 0), bold: true },
            { label: "Original", value: formatMoneyAmount(effective.total, effective.currency, 0) },
            { label: "Vencimiento", value: selectedInvoice.due_date ? new Date(selectedInvoice.due_date).toLocaleDateString("es-AR") : "-" },
            { label: "Pagada", value: selectedInvoice.paid_at ? new Date(selectedInvoice.paid_at).toLocaleDateString("es-AR") : "-" },
            { label: "Creada", value: new Date(selectedInvoice.created_at).toLocaleDateString("es-AR") },
          ];

          return (
            <SurfaceCard tone="default" padding="md" className="h-fit space-y-4 rounded-[24px] border-border/70">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-foreground">{selectedInvoice.invoice_number}</p>
                  <InvoiceStatusBadge status={selectedInvoice.status} />
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => setSelectedId(null)}>
                  <X size={14} />
                </Button>
              </div>

              <div className="space-y-2">
                {detailRows.map(({ label, value, bold }) => (
                  <div key={label} className="flex items-start justify-between gap-3">
                    <span className="text-[11px] text-muted-foreground">{label}</span>
                    <span className={cn("text-[11px] text-right text-foreground", bold && "font-semibold")}>{value}</span>
                  </div>
                ))}
              </div>

              {effective.isLegacyPreview ? (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                  Factura legacy normalizada con la cotizacion actual para corregir moneda e IVA.
                </div>
              ) : null}

              {selectedInvoice.notes ? (
                <p className="text-xs italic text-muted-foreground">{selectedInvoice.notes}</p>
              ) : null}

              <div className="space-y-2 pt-1">
                {selectedInvoice.status === "draft" ? (
                  <Button
                    className="w-full"
                    onClick={() => void handleSend(selectedInvoice.id)}
                    disabled={actionLoading === `${selectedInvoice.id}-send`}
                  >
                    <Send size={12} />
                    Marcar como enviada
                  </Button>
                ) : null}
                {(selectedInvoice.status === "sent" || selectedInvoice.status === "overdue") ? (
                  <Button
                    className="w-full"
                    onClick={() => void handleMarkPaid(selectedInvoice.id)}
                    disabled={actionLoading === `${selectedInvoice.id}-paid`}
                  >
                    <DollarSign size={12} />
                    Marcar como pagada
                  </Button>
                ) : null}
              </div>
            </SurfaceCard>
          );
        })() : null}
      </div>

      {showCreate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <SurfaceCard tone="default" padding="none" className="w-full max-w-md overflow-hidden rounded-[28px] border-border/70 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/70 px-6 py-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Finanzas</p>
                <h3 className="text-sm font-semibold text-foreground">Nueva factura desde pedido</h3>
              </div>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => setShowCreate(false)}>
                <X size={16} />
              </Button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Pedido *</label>
                {loadingOrders ? (
                  <div className="text-xs text-muted-foreground">Cargando pedidos...</div>
                ) : (
                  <select
                    value={createForm.orderId}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, orderId: event.target.value }))}
                    className="h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground outline-none focus:border-primary/40"
                  >
                    <option value="">Selecciona un pedido...</option>
                    {orders.map((order) => (
                      <option key={order.id} value={order.id}>
                        {order.order_number} - {order.client_name} - {orderPreviewTotal(order.total)}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Vence en (dias)</label>
                  <input
                    type="number"
                    value={createForm.dueDays}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, dueDays: Number(event.target.value) }))}
                    className="h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground outline-none focus:border-primary/40"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Moneda</label>
                  <select
                    value={createForm.currency}
                    onChange={(event) => {
                      const nextCurrency = event.target.value as "ARS" | "USD";
                      setCreateForm((prev) => ({
                        ...prev,
                        currency: nextCurrency,
                        exchangeRate: nextCurrency === "ARS" ? (prev.exchangeRate || String(exchangeRate.rate)) : "",
                      }));
                    }}
                    className="h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground outline-none focus:border-primary/40"
                  >
                    <option value="ARS">ARS</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                {createForm.currency === "ARS" ? (
                  <div className="col-span-2">
                    <label className="mb-1 block text-xs text-muted-foreground">Tipo de cambio (ARS por USD)</label>
                    <input
                      type="number"
                      value={createForm.exchangeRate}
                      onChange={(event) => setCreateForm((prev) => ({ ...prev, exchangeRate: event.target.value }))}
                      placeholder={`Ej: ${Math.round(exchangeRate.rate)}`}
                      className="h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40"
                    />
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-border/70 bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                Moneda principal actual: <span className="font-semibold text-foreground">{currency}</span> ? Cotizacion: <span className="font-semibold text-foreground">{exchangeRate.rate.toLocaleString("es-AR")} ARS/USD</span>
              </div>

              {createError ? (
                <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">{createError}</div>
              ) : null}
            </div>

            <div className="flex justify-end gap-2 border-t border-border/70 px-6 py-4">
              <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancelar</Button>
              <Button
                onClick={() => void handleCreate()}
                disabled={creating || !createForm.orderId || (createForm.currency === "ARS" && !createForm.exchangeRate.trim())}
              >
                <FileText size={11} />
                {creating ? "Creando..." : "Crear factura"}
              </Button>
            </div>
          </SurfaceCard>
        </div>
      ) : null}
    </div>
  );
}
