import { useMemo, useState } from "react";
import { Download, FileText, Filter, Search } from "lucide-react";
import type { Invoice, InvoiceStatus } from "@/lib/api/invoices";
import { useCurrency } from "@/context/CurrencyContext";
import type { PortalOrder } from "@/hooks/useOrders";
import {
  formatMoneyAmount,
  formatMoneyInPreferredCurrency,
  getEffectiveInvoiceAmounts,
} from "@/lib/money";

interface InvoicesPanelProps {
  invoices: Invoice[];
  orders?: PortalOrder[];
  isDark: boolean;
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
  draft: "text-gray-400",
  sent: "text-blue-400",
  paid: "text-emerald-400",
  overdue: "text-red-400",
  cancelled: "text-gray-500",
};

export function InvoicesPanel({
  invoices,
  orders = [],
  isDark,
  loading,
  onGoToOrders,
}: InvoicesPanelProps) {
  const dk = (d: string, l: string) => (isDark ? d : l);
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
      return [
        invoice.invoice_number,
        invoice.client_snapshot?.company_name,
        invoice.client_snapshot?.contact_name,
        invoice.notes,
        invoice.order_id ? String(invoice.order_id) : "",
      ]
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
    const nextDue = pending
      .filter((invoice) => invoice.due_date)
      .sort((a, b) => new Date(a.due_date ?? "").getTime() - new Date(b.due_date ?? "").getTime())[0];
    const sumInPreferredCurrency = (list: Invoice[]) =>
      list.reduce((sum, invoice) => {
        const effective = getEffectiveInvoiceAmounts(invoice, exchangeRate.rate);
        const converted = effective.currency === currency
          ? effective.total
          : effective.currency === "USD"
            ? effective.total * exchangeRate.rate
            : effective.total / exchangeRate.rate;
        return sum + converted;
      }, 0);
    return [
      { label: "Pendientes", value: String(pending.length), accent: "text-amber-400" },
      {
        label: "Vencidas",
        value: formatMoneyAmount(sumInPreferredCurrency(overdue), currency, 0),
        accent: "text-red-400",
      },
      {
        label: "Pagadas",
        value: String(paid.length),
        accent: "text-emerald-400",
      },
      {
        label: "Próximo vencimiento",
        value: nextDue?.due_date ? new Date(nextDue.due_date).toLocaleDateString("es-AR") : "Sin fecha",
        accent: nextDue ? "text-[#2D9F6A]" : "text-gray-400",
      },
    ];
  }, [currency, exchangeRate.rate, invoices]);

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className={`text-base font-bold ${dk("text-white", "text-[#171717]")}`}>Mis Facturas</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Seguimiento financiero, vencimientos y documentos descargables.
          </p>
        </div>
        <button
          onClick={onGoToOrders}
          className={`text-xs font-medium px-3 py-2 rounded-lg border transition ${dk("border-[#262626] text-gray-400 hover:text-white hover:bg-[#1a1a1a]", "border-[#e5e5e5] text-[#737373] hover:text-[#171717] hover:bg-[#f5f5f5]")}`}
        >
          Ver pedidos y comprobantes
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {summary.map((card) => (
          <div key={card.label} className={`border rounded-xl px-4 py-3 ${dk("border-[#1f1f1f] bg-[#111]", "border-[#e5e5e5] bg-white")}`}>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{card.label}</p>
            <p className={`text-lg font-bold ${card.accent}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className={`border rounded-xl p-3 ${dk("border-[#1f1f1f] bg-[#111]", "border-[#e5e5e5] bg-white")}`}>
        <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
          <label className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por número, pedido o nota"
              className={`w-full rounded-lg border pl-9 pr-3 py-2 text-sm outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white placeholder:text-[#404040]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] placeholder:text-[#a3a3a3]")}`}
            />
          </label>

          <label className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717]")}`}>
            <Filter size={13} className="text-gray-500" />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as InvoiceStatus | "all")}
              className="w-full bg-transparent text-sm outline-none"
            >
              <option value="all">Todos los estados</option>
              {(Object.keys(STATUS_LABELS) as InvoiceStatus[]).map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>

          <label className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717]")}`}>
            <Filter size={13} className="text-gray-500" />
            <select
              value={dueFilter}
              onChange={(event) => setDueFilter(event.target.value as "all" | "upcoming" | "overdue" | "unpaid")}
              className="w-full bg-transparent text-sm outline-none"
            >
              <option value="all">Todos los vencimientos</option>
              <option value="upcoming">Vence pronto</option>
              <option value="overdue">Solo vencidas</option>
              <option value="unpaid">Impagas</option>
            </select>
          </label>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className={`h-20 rounded-xl animate-pulse ${dk("bg-[#111]", "bg-white")}`} />
          ))}
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className={`border rounded-xl py-20 text-center ${dk("border-[#1f1f1f] bg-[#111]", "border-[#e5e5e5] bg-white")}`}>
          <FileText size={32} className="mx-auto mb-3 text-gray-500/40" />
          <p className="text-sm font-medium text-gray-500">No encontramos facturas con esos filtros.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredInvoices.map((invoice) => {
            const effective = getEffectiveInvoiceAmounts(invoice, exchangeRate.rate);
            const isExpanded = expandedInvoiceId === invoice.id;
            const itemCount = Array.isArray(invoice.items) ? invoice.items.length : 0;
            const relatedOrder = orders.find((order) => String(order.id) === String(invoice.order_id));
            return (
              <div key={invoice.id} className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-xl overflow-hidden`}>
                <button
                  onClick={() => setExpandedInvoiceId(isExpanded ? null : invoice.id)}
                  className={`w-full px-5 py-4 text-left transition ${dk("hover:bg-[#151515]", "hover:bg-[#fafafa]")}`}
                >
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-bold font-mono ${dk("text-white", "text-[#171717]")}`}>{invoice.invoice_number}</span>
                        <span className={`text-[11px] font-semibold ${STATUS_CLASSES[invoice.status]}`}>{STATUS_LABELS[invoice.status]}</span>
                        {invoice.order_id && (
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${dk("text-[#a3a3a3] border-[#262626] bg-[#0d0d0d]", "text-[#525252] border-[#e5e5e5] bg-[#f5f5f5]")}`}>
                            Pedido #{invoice.order_id}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1">
                        {invoice.due_date
                          ? `Vence ${new Date(invoice.due_date).toLocaleDateString("es-AR")}`
                          : "Sin vencimiento"}
                        {itemCount > 0 ? ` · ${itemCount} ítem${itemCount === 1 ? "" : "s"}` : ""}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-base font-bold text-[#2D9F6A]">
                        {formatMoneyInPreferredCurrency(effective.total, effective.currency, currency, exchangeRate.rate, 0)}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        Original {formatMoneyAmount(effective.total, effective.currency, 0)}
                      </p>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className={`border-t px-5 py-4 space-y-4 ${dk("border-[#1a1a1a]", "border-[#f0f0f0]")}`}>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className={`rounded-xl border px-4 py-3 ${dk("border-[#1f1f1f] bg-[#0d0d0d]", "border-[#ececec] bg-[#fafafa]")}`}>
                        <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${dk("text-gray-400", "text-[#737373]")}`}>Detalle impositivo</p>
                        <p className={`text-sm ${dk("text-gray-300", "text-[#525252]")}`}>Subtotal: {formatMoneyInPreferredCurrency(effective.subtotal, effective.currency, currency, exchangeRate.rate, 0)}</p>
                        <p className={`text-sm ${dk("text-gray-300", "text-[#525252]")}`}>IVA: {formatMoneyInPreferredCurrency(effective.ivaTotal, effective.currency, currency, exchangeRate.rate, 0)}</p>
                        <p className="text-sm font-semibold text-[#2D9F6A]">Total: {formatMoneyInPreferredCurrency(effective.total, effective.currency, currency, exchangeRate.rate, 0)}</p>
                      </div>

                      <div className={`rounded-xl border px-4 py-3 ${dk("border-[#1f1f1f] bg-[#0d0d0d]", "border-[#ececec] bg-[#fafafa]")}`}>
                        <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${dk("text-gray-400", "text-[#737373]")}`}>Cliente</p>
                        <p className={`text-sm font-medium ${dk("text-white", "text-[#171717]")}`}>
                          {invoice.client_snapshot?.company_name || "Cuenta B2B"}
                        </p>
                        <p className="text-[11px] text-gray-500">{invoice.client_snapshot?.contact_name || "Sin contacto asociado"}</p>
                        <p className="text-[11px] text-gray-500 mt-1">Moneda emitida: {effective.currency}</p>
                        {(effective.exchangeRate || invoice.exchange_rate) && (
                          <p className="text-[11px] text-gray-500 mt-1">Tipo de cambio: {(effective.exchangeRate ?? invoice.exchange_rate ?? 0).toLocaleString("es-AR")} ARS/USD</p>
                        )}
                      </div>

                      <div className={`rounded-xl border px-4 py-3 ${dk("border-[#1f1f1f] bg-[#0d0d0d]", "border-[#ececec] bg-[#fafafa]")}`}>
                        <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${dk("text-gray-400", "text-[#737373]")}`}>Cobranza</p>
                        <p className={`text-sm ${dk("text-gray-300", "text-[#525252]")}`}>
                          Estado: <span className={STATUS_CLASSES[invoice.status]}>{STATUS_LABELS[invoice.status]}</span>
                        </p>
                        <p className="text-[11px] text-gray-500">
                          {invoice.paid_at
                            ? `Pagada el ${new Date(invoice.paid_at).toLocaleDateString("es-AR")}`
                            : "Pendiente de imputación"}
                        </p>
                        {invoice.due_date && (
                          <p className="text-[11px] text-gray-500 mt-1">
                            Vence {new Date(invoice.due_date).toLocaleDateString("es-AR")}
                          </p>
                        )}
                      </div>
                    </div>

                    {(invoice.order_id || relatedOrder?.numero_remito) && (
                      <div className={`rounded-xl border px-4 py-3 ${dk("border-[#1f1f1f] bg-[#0d0d0d]", "border-[#ececec] bg-[#fafafa]")}`}>
                        <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${dk("text-gray-400", "text-[#737373]")}`}>Documentos asociados</p>
                        {invoice.order_id && (
                          <p className={`text-sm ${dk("text-gray-300", "text-[#525252]")}`}>
                            Pedido: <span className={`font-semibold ${dk("text-white", "text-[#171717]")}`}>{relatedOrder?.order_number ?? `#${invoice.order_id}`}</span>
                          </p>
                        )}
                        {relatedOrder?.numero_remito && (
                          <p className={`text-sm ${dk("text-gray-300", "text-[#525252]")}`}>
                            Remito: <span className={`font-semibold ${dk("text-white", "text-[#171717]")}`}>{relatedOrder.numero_remito}</span>
                          </p>
                        )}
                        {relatedOrder?.status && (
                          <p className="text-[11px] text-gray-500 mt-1">Estado logístico: {relatedOrder.status}</p>
                        )}
                      </div>
                    )}

                    {invoice.notes && (
                      <div className={`rounded-xl border px-4 py-3 ${dk("border-[#1f1f1f] bg-[#0d0d0d]", "border-[#ececec] bg-[#fafafa]")}`}>
                        <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${dk("text-gray-400", "text-[#737373]")}`}>Observaciones</p>
                        <p className={`text-sm ${dk("text-gray-300", "text-[#525252]")}`}>{invoice.notes}</p>
                      </div>
                    )}

                    {effective.isLegacyPreview && (
                      <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
                        <p className="text-sm text-amber-400">Se corrigió la visualización de una factura legacy usando la cotización actual.</p>
                      </div>
                    )}

                    <div className="flex items-center gap-2 flex-wrap">
                      {invoice.pdf_url ? (
                        <a
                          href={invoice.pdf_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs bg-[#2D9F6A] hover:bg-[#25875a] text-white px-3 py-2 rounded-lg transition"
                        >
                          <Download size={12} />
                          Descargar PDF
                        </a>
                      ) : (
                        <span className={`text-xs px-3 py-2 rounded-lg border ${dk("border-[#262626] text-gray-500", "border-[#e5e5e5] text-[#737373]")}`}>
                          PDF pendiente de carga
                        </span>
                      )}

                      {invoice.order_id && (
                        <button
                          onClick={onGoToOrders}
                          className={`text-xs font-medium px-3 py-2 rounded-lg border transition ${dk("border-[#262626] text-gray-400 hover:text-white hover:bg-[#1a1a1a]", "border-[#e5e5e5] text-[#737373] hover:text-[#171717] hover:bg-[#f5f5f5]")}`}
                        >
                          Ver pedido relacionado
                        </button>
                      )}
                      {invoice.order_id && invoice.status !== "paid" && (
                        <button
                          onClick={onGoToOrders}
                          className={`text-xs font-medium px-3 py-2 rounded-lg border transition ${dk("border-amber-500/30 text-amber-400 hover:bg-amber-500/10", "border-amber-200 text-amber-700 hover:bg-amber-50")}`}
                        >
                          Reportar pago en pedido
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
