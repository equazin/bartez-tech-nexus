import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  FileText,
  RefreshCw,
  Send,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SurfaceCard } from "@/components/ui/surface-card";
import { cn } from "@/lib/utils";
import type { QuoteStatus } from "@/models/quote";

interface Props {
  isDark?: boolean;
}

interface QuoteItemRow {
  id?: number | string;
  name?: string;
  product_name?: string;
  quantity?: number;
  totalWithIVA?: number;
  total_price?: number;
}

interface AdminQuote {
  id: number;
  client_id: string;
  client_name: string;
  items: QuoteItemRow[];
  subtotal: number;
  iva_total: number;
  total: number;
  currency: "USD" | "ARS";
  status: QuoteStatus;
  version: number;
  expires_at: string | null;
  converted_to_order_id: number | null;
  created_at: string;
  company_name?: string;
  contact_name?: string;
  client_email?: string;
}

type StatusConfig = {
  label: string;
  icon: typeof FileText;
  className: string;
};

const STATUS_CONFIG: Record<QuoteStatus, StatusConfig> = {
  draft: { label: "Borrador", icon: FileText, className: "bg-muted text-muted-foreground" },
  sent: { label: "Enviada", icon: Send, className: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  viewed: { label: "Vista", icon: Eye, className: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  approved: { label: "Aprobada", icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  rejected: { label: "Rechazada", icon: XCircle, className: "bg-red-500/10 text-red-600 dark:text-red-400" },
  converted: { label: "Convertida", icon: ArrowRight, className: "bg-teal-500/10 text-teal-600 dark:text-teal-400" },
  expired: { label: "Vencida", icon: AlertTriangle, className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
};

function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={cn("gap-1 border-border/70 text-[11px] font-semibold", config.className)}>
      <Icon size={10} />
      {config.label}
    </Badge>
  );
}

export function QuotesAdminTab({ isDark: _isDark = true }: Props) {
  const [quotes, setQuotes] = useState<AdminQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterClient, setFilterClient] = useState("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [converting, setConverting] = useState<number | null>(null);
  const [convertError, setConvertError] = useState<Record<number, string>>({});
  const [updatingStatus, setUpdatingStatus] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from("quotes")
      .select("*, profiles(company_name, contact_name, email)")
      .order("created_at", { ascending: false })
      .limit(200);

    if (filterStatus !== "all") {
      query = query.eq("status", filterStatus);
    }

    if (filterClient !== "all") {
      query = query.eq("client_id", filterClient);
    }

    const { data } = await query;

    setQuotes(
      ((data ?? []) as Array<AdminQuote & { profiles?: { company_name?: string; contact_name?: string; email?: string } | null }>).map((quote) => ({
        ...quote,
        iva_total: quote.iva_total ?? 0,
        items: Array.isArray(quote.items) ? quote.items : [],
        company_name: quote.profiles?.company_name,
        contact_name: quote.profiles?.contact_name,
        client_email: quote.profiles?.email,
      })),
    );

    setLoading(false);
  }, [filterClient, filterStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  const uniqueClients = useMemo(
    () =>
      Array.from(new Map(quotes.map((quote) => [quote.client_id, quote.company_name || quote.contact_name || quote.client_id])).entries()),
    [quotes],
  );

  const statusCounts = useMemo(
    () =>
      quotes.reduce<Record<string, number>>((accumulator, quote) => {
        accumulator[quote.status] = (accumulator[quote.status] ?? 0) + 1;
        return accumulator;
      }, {}),
    [quotes],
  );

  async function convertToOrder(quote: AdminQuote) {
    setConverting(quote.id);
    setConvertError((prev) => ({ ...prev, [quote.id]: "" }));

    const { error } = await supabase.rpc("convert_quote_to_order", {
      p_quote_id: String(quote.id),
      p_client_id: quote.client_id,
    });

    if (error) {
      setConvertError((prev) => ({ ...prev, [quote.id]: error.message }));
    } else {
      await load();
    }

    setConverting(null);
  }

  async function updateStatus(quoteId: number, status: QuoteStatus) {
    setUpdatingStatus(quoteId);

    await supabase.from("quotes").update({ status }).eq("id", quoteId);

    setQuotes((prev) => prev.map((quote) => (quote.id === quoteId ? { ...quote, status } : quote)));
    setUpdatingStatus(null);

    if (status === "approved" || status === "rejected") {
      const quote = quotes.find((item) => item.id === quoteId);

      if (quote?.client_email) {
        void fetch("/api/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: status === "approved" ? "quote_approved" : "quote_rejected",
            orderNumber: `COT-${quoteId}`,
            quoteId,
            clientId: quote.client_id,
            clientEmail: quote.client_email,
            clientName: quote.company_name || quote.contact_name || quote.client_name,
            products: [],
            total: quote.total,
          }),
        }).catch(() => {
          // Non-critical notification failure.
        });
      }
    }
  }

  const formatMoney = (amount: number, currency: "USD" | "ARS") =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);

  const isExpired = (quote: AdminQuote) => (quote.expires_at ? new Date(quote.expires_at) < new Date() : false);

  return (
    <div className="space-y-4">
      <SurfaceCard tone="default" padding="md" className="rounded-[24px] border-border/70">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Ventas</p>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Cotizaciones</h2>
              <p className="text-sm text-muted-foreground">{quotes.length} cotizaciones administradas desde ventas.</p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-[180px_220px_auto]">
            <select
              value={filterStatus}
              onChange={(event) => setFilterStatus(event.target.value)}
              className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary/40"
            >
              <option value="all">Todos los estados</option>
              {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                <option key={status} value={status}>
                  {config.label}
                  {statusCounts[status] ? ` (${statusCounts[status]})` : ""}
                </option>
              ))}
            </select>

            <select
              value={filterClient}
              onChange={(event) => setFilterClient(event.target.value)}
              className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary/40"
            >
              <option value="all">Todos los clientes</option>
              {uniqueClients.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>

            <Button variant="toolbar" size="icon" className="h-10 w-10 rounded-xl" onClick={() => void load()}>
              <RefreshCw size={14} />
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(STATUS_CONFIG)
            .filter(([status]) => statusCounts[status])
            .map(([status, config]) => {
              const Icon = config.icon;
              const isActive = filterStatus === status;

              return (
                <button
                  key={status}
                  onClick={() => setFilterStatus(isActive ? "all" : status)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition",
                    isActive
                      ? cn("border-primary/40 shadow-sm shadow-primary/10", config.className)
                      : "border-border/70 bg-card text-muted-foreground hover:border-border hover:bg-secondary/70 hover:text-foreground",
                  )}
                >
                  <Icon size={10} />
                  {config.label} ({statusCounts[status]})
                </button>
              );
            })}
        </div>
      </SurfaceCard>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-2xl bg-card" />
          ))}
        </div>
      ) : quotes.length === 0 ? (
        <EmptyState title="Sin cotizaciones" description="No hay cotizaciones para los filtros actuales." />
      ) : (
        <SurfaceCard tone="default" padding="none" className="overflow-hidden rounded-[24px] border-border/70">
          {quotes.map((quote, index) => {
            const isExpanded = expandedId === quote.id;
            const clientLabel = quote.company_name || quote.contact_name || quote.client_id.slice(0, 8);
            const expired = isExpired(quote);

            return (
              <div key={quote.id} className={cn(index > 0 && "border-t border-border/70")}>
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : quote.id)}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-3 text-left transition",
                    isExpanded ? "bg-secondary/60" : "bg-card hover:bg-secondary/50",
                  )}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
                    <FileText size={13} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">{clientLabel}</span>
                      <QuoteStatusBadge status={quote.status} />
                      {quote.version > 1 ? <span className="text-[10px] text-muted-foreground">v{quote.version}</span> : null}
                      {expired && quote.status !== "expired" ? (
                        <span className="text-[10px] font-medium text-amber-500 dark:text-amber-400">Vencida</span>
                      ) : null}
                    </div>

                    <p className="text-[11px] text-muted-foreground">
                      {new Date(quote.created_at).toLocaleDateString("es-AR")}
                      {quote.expires_at ? ` · vence ${new Date(quote.expires_at).toLocaleDateString("es-AR")}` : ""}
                      {` · ${quote.items?.length ?? 0} items`}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-xs font-bold text-foreground">{formatMoney(quote.total, quote.currency)}</p>
                    <p className="text-[10px] text-muted-foreground">{quote.currency}</p>
                  </div>

                  {isExpanded ? (
                    <ChevronUp size={13} className="shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronDown size={13} className="shrink-0 text-muted-foreground" />
                  )}
                </button>

                {isExpanded ? (
                  <div className="space-y-4 border-t border-border/70 bg-surface/60 px-4 py-4">
                    {quote.items.length > 0 ? (
                      <SurfaceCard tone="subtle" padding="sm" className="rounded-2xl">
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Items</p>

                          {quote.items.map((item, itemIndex) => (
                            <div key={item.id ?? `${quote.id}-${itemIndex}`} className="flex items-center justify-between gap-3 py-1">
                              <span className="text-xs text-foreground">
                                {item.name ?? item.product_name ?? "Sin descripcion"} x {item.quantity ?? 0}
                              </span>
                              <span className="text-xs font-mono text-muted-foreground">
                                {formatMoney(item.totalWithIVA ?? item.total_price ?? 0, quote.currency)}
                              </span>
                            </div>
                          ))}

                          <div className="flex items-center justify-between border-t border-border/70 pt-2 text-xs font-semibold text-foreground">
                            <span>Total</span>
                            <span>{formatMoney(quote.total, quote.currency)}</span>
                          </div>
                        </div>
                      </SurfaceCard>
                    ) : null}

                    {convertError[quote.id] ? (
                      <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                        {convertError[quote.id]}
                      </div>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-2">
                      {quote.status === "draft" ? (
                        <Button
                          size="sm"
                          onClick={() => void updateStatus(quote.id, "sent")}
                          disabled={updatingStatus === quote.id}
                        >
                          <Send size={12} />
                          Marcar enviada
                        </Button>
                      ) : null}

                      {["draft", "sent", "viewed"].includes(quote.status) ? (
                        <Button
                          size="sm"
                          onClick={() => void updateStatus(quote.id, "approved")}
                          disabled={updatingStatus === quote.id}
                        >
                          <CheckCircle2 size={12} />
                          Aprobar
                        </Button>
                      ) : null}

                      {!["rejected", "expired", "converted"].includes(quote.status) ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void updateStatus(quote.id, "rejected")}
                          disabled={updatingStatus === quote.id}
                        >
                          <XCircle size={12} />
                          Rechazar
                        </Button>
                      ) : null}

                      {["sent", "approved"].includes(quote.status) && !quote.converted_to_order_id ? (
                        <Button
                          size="sm"
                          className="ml-auto"
                          onClick={() => void convertToOrder(quote)}
                          disabled={converting === quote.id}
                        >
                          <ArrowRight size={12} />
                          {converting === quote.id ? "Convirtiendo..." : "Convertir a pedido"}
                        </Button>
                      ) : null}

                      {quote.converted_to_order_id ? (
                        <Badge variant="outline" className="ml-auto gap-1 border-teal-500/20 bg-teal-500/10 text-teal-600 dark:text-teal-400">
                          <CheckCircle2 size={11} />
                          Pedido #{quote.converted_to_order_id}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </SurfaceCard>
      )}
    </div>
  );
}
