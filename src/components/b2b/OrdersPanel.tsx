import { useMemo, useState } from "react";
import { ClipboardList, MapPin, Package, Search, Truck } from "lucide-react";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { OrderPaymentProof } from "@/components/OrderPaymentProof";
import { OrderStatusTimeline } from "@/components/OrderStatusTimeline";
import type { PortalOrder } from "@/hooks/useOrders";
import type { Invoice } from "@/lib/api/invoices";

interface OrdersPanelProps {
  isDark: boolean;
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

const ORDER_STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "En revisión" },
  { value: "approved", label: "Aprobados" },
  { value: "preparing", label: "Preparando" },
  { value: "dispatched", label: "Despachados" },
  { value: "shipped", label: "Enviados" },
  { value: "delivered", label: "Entregados" },
  { value: "rejected", label: "Rechazados" },
] as const;

const ORDER_STATUS_COPY: Record<string, string> = {
  pending: "Estamos revisando el pedido con stock y condiciones comerciales.",
  approved: "Pedido confirmado. Próximo paso: preparación o despacho.",
  preparing: "Tu pedido está en preparación interna.",
  dispatched: "El pedido ya salió de depósito con remito emitido.",
  shipped: "El transporte está en curso.",
  delivered: "El pedido figura como entregado.",
  rejected: "El pedido quedó rechazado. Si querés, podés repetirlo ajustando condiciones.",
};

export function OrdersPanel({
  isDark,
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
  const dk = (d: string, l: string) => (isDark ? d : l);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof ORDER_STATUS_OPTIONS)[number]["value"]>("all");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const filteredOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return orders.filter((order) => {
      if (statusFilter !== "all" && order.status !== statusFilter) return false;
      if (!normalizedQuery) return true;

      const haystack = [
        order.order_number,
        String(order.id),
        order.numero_remito,
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
      { label: "Pedidos activos", value: String(activeOrders.length), accent: "text-[#2D9F6A]" },
      { label: "Despachados", value: String(orders.filter((order) => order.status === "dispatched").length), accent: "text-blue-400" },
      { label: "Entregados", value: String(deliveredOrders.length), accent: "text-emerald-400" },
      {
        label: "Monto en curso",
        value: formatPrice(activeOrders.reduce((sum, order) => sum + order.total, 0)),
        accent: "text-amber-400",
      },
    ];
  }, [orders, formatPrice]);

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className={`text-base font-bold ${dk("text-white", "text-[#171717]")}`}>Mis Pedidos</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Seguimiento comercial, logístico y comprobantes de pago.
          </p>
        </div>
        <button
          onClick={onGoToCatalog}
          className={`text-xs font-medium px-3 py-2 rounded-lg border transition ${dk("border-[#262626] text-gray-400 hover:text-white hover:bg-[#1a1a1a]", "border-[#e5e5e5] text-[#737373] hover:text-[#171717] hover:bg-[#f5f5f5]")}`}
        >
          Ir al catálogo
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className={`border rounded-xl px-4 py-3 ${dk("border-[#1f1f1f] bg-[#111]", "border-[#e5e5e5] bg-white")}`}>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{kpi.label}</p>
            <p className={`text-lg font-bold ${kpi.accent}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className={`border rounded-xl p-3 ${dk("border-[#1f1f1f] bg-[#111]", "border-[#e5e5e5] bg-white")}`}>
        <div className="grid gap-3 md:grid-cols-[1fr_180px]">
          <label className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por pedido, remito, SKU, dirección o nota"
              className={`w-full rounded-lg border pl-9 pr-3 py-2 text-sm outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white placeholder:text-[#404040]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] placeholder:text-[#a3a3a3]")}`}
            />
          </label>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as (typeof ORDER_STATUS_OPTIONS)[number]["value"])}
            className={`rounded-lg border px-3 py-2 text-sm outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717]")}`}
          >
            {ORDER_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className={`border rounded-xl py-20 text-center ${dk("border-[#1f1f1f] bg-[#111]", "border-[#e5e5e5] bg-white")}`}>
          <ClipboardList size={32} className="mx-auto mb-3 text-gray-500/40" />
          <p className="text-sm font-medium text-gray-500">No encontramos pedidos con esos filtros.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredOrders.map((order) => {
            const orderId = String(order.id);
            const isExpanded = expandedOrderId === orderId;
            const otherCurrencyValue = currency === "USD" ? formatARS(order.total) : formatUSD(order.total);
            const relatedInvoices = invoices.filter((invoice) => String(invoice.order_id) === orderId);
            const shippingLabel = order.shipping_type
              ? {
                  retiro: "Retiro en sucursal",
                  envio: "Envío coordinado",
                  transporte: "Transporte / expreso",
                }[order.shipping_type] ?? order.shipping_type
              : "Sin modalidad definida";

            return (
              <div key={orderId} className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-xl overflow-hidden`}>
                <button
                  onClick={() => setExpandedOrderId(isExpanded ? null : orderId)}
                  className={`w-full px-5 py-4 text-left transition ${dk("hover:bg-[#151515]", "hover:bg-[#fafafa]")}`}
                >
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-bold font-mono ${dk("text-white", "text-[#171717]")}`}>
                          {order.order_number ?? `#${orderId.slice(-6).toUpperCase()}`}
                        </span>
                        <OrderStatusBadge status={order.status} />
                        {order.numero_remito && (
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${dk("text-blue-400 border-blue-500/20 bg-blue-500/10", "text-blue-600 border-blue-200 bg-blue-50")}`}>
                            Remito {order.numero_remito}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1">
                        {new Date(order.created_at).toLocaleDateString("es-AR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {" · "}
                        {order.products.length} producto{order.products.length === 1 ? "" : "s"}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-base font-bold text-[#2D9F6A]">{formatPrice(order.total)}</p>
                      <p className="text-[11px] text-gray-500">{otherCurrencyValue}</p>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className={`border-t ${dk("border-[#1a1a1a]", "border-[#f0f0f0]")}`}>
                    <div className="grid gap-3 px-5 py-4 md:grid-cols-3">
                      <div className={`rounded-xl border px-4 py-3 ${dk("border-[#1f1f1f] bg-[#0d0d0d]", "border-[#ececec] bg-[#fafafa]")}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <Package size={13} className="text-[#2D9F6A]" />
                          <p className={`text-xs font-bold uppercase tracking-wider ${dk("text-gray-400", "text-[#737373]")}`}>Estado</p>
                        </div>
                        <p className={`text-sm ${dk("text-gray-300", "text-[#525252]")}`}>
                          {ORDER_STATUS_COPY[order.status] ?? "Estamos actualizando el estado del pedido."}
                        </p>
                        <div className="mt-3">
                          <OrderStatusTimeline status={order.status} />
                        </div>
                      </div>

                      <div className={`rounded-xl border px-4 py-3 ${dk("border-[#1f1f1f] bg-[#0d0d0d]", "border-[#ececec] bg-[#fafafa]")}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <Truck size={13} className="text-blue-400" />
                          <p className={`text-xs font-bold uppercase tracking-wider ${dk("text-gray-400", "text-[#737373]")}`}>Logística</p>
                        </div>
                        <p className={`text-sm font-medium ${dk("text-white", "text-[#171717]")}`}>{shippingLabel}</p>
                        {order.shipping_transport && (
                          <p className="text-[11px] text-gray-500 mt-1">Transporte: {order.shipping_transport}</p>
                        )}
                        {typeof order.shipping_cost === "number" && order.shipping_cost > 0 && (
                          <p className="text-[11px] text-gray-500 mt-1">Costo: {formatPrice(order.shipping_cost)}</p>
                        )}
                      </div>

                      <div className={`rounded-xl border px-4 py-3 ${dk("border-[#1f1f1f] bg-[#0d0d0d]", "border-[#ececec] bg-[#fafafa]")}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <MapPin size={13} className="text-amber-400" />
                          <p className={`text-xs font-bold uppercase tracking-wider ${dk("text-gray-400", "text-[#737373]")}`}>Entrega</p>
                        </div>
                        <p className={`text-sm ${dk("text-gray-300", "text-[#525252]")}`}>
                          {order.shipping_address || "Se coordina con el equipo comercial"}
                        </p>
                      </div>
                    </div>

                    <div className="px-5 pb-1">
                      <div className={`rounded-xl border px-4 py-3 ${dk("border-[#1f1f1f] bg-[#0d0d0d]", "border-[#ececec] bg-[#fafafa]")}`}>
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div>
                            <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${dk("text-gray-400", "text-[#737373]")}`}>Documentos asociados</p>
                            <p className={`text-sm ${dk("text-gray-300", "text-[#525252]")}`}>
                              Remito: <span className={`font-semibold ${dk("text-white", "text-[#171717]")}`}>{order.numero_remito || "Pendiente"}</span>
                            </p>
                            <p className={`text-sm ${dk("text-gray-300", "text-[#525252]")}`}>
                              Facturas vinculadas: <span className={`font-semibold ${dk("text-white", "text-[#171717]")}`}>{relatedInvoices.length}</span>
                            </p>
                          </div>
                          {relatedInvoices.length > 0 && (
                            <button
                              onClick={onGoToInvoices}
                              className={`text-xs font-medium px-3 py-2 rounded-lg border transition ${dk("border-[#262626] text-gray-400 hover:text-white hover:bg-[#1a1a1a]", "border-[#e5e5e5] text-[#737373] hover:text-[#171717] hover:bg-[#f5f5f5]")}`}
                            >
                              Ver facturas
                            </button>
                          )}
                        </div>
                        {relatedInvoices.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {relatedInvoices.map((invoice) => (
                              <span key={invoice.id} className={`text-[11px] px-2 py-1 rounded-full border ${dk("border-[#262626] text-gray-300", "border-[#e5e5e5] text-[#525252]")}`}>
                                {invoice.invoice_number}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {order.notes && (
                      <div className="px-5 pb-1">
                        <div className={`rounded-xl border px-4 py-3 ${dk("border-[#1f1f1f] bg-[#0d0d0d]", "border-[#ececec] bg-[#fafafa]")}`}>
                          <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${dk("text-gray-400", "text-[#737373]")}`}>Notas</p>
                          <p className={`text-sm ${dk("text-gray-300", "text-[#525252]")}`}>{order.notes}</p>
                        </div>
                      </div>
                    )}

                    <div className={`mx-5 my-4 border rounded-xl overflow-hidden ${dk("border-[#1f1f1f]", "border-[#ececec]")}`}>
                      <div className={`grid grid-cols-[1fr_80px_110px] gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-wider ${dk("bg-[#0d0d0d] text-gray-500", "bg-[#f5f5f5] text-[#a3a3a3]")}`}>
                        <span>Producto</span>
                        <span className="text-center">Cant.</span>
                        <span className="text-right">Total</span>
                      </div>
                      {order.products.map((product, index) => (
                        <div
                          key={`${orderId}-${product.product_id}-${index}`}
                          className={`grid grid-cols-[1fr_80px_110px] gap-2 px-4 py-2.5 border-t ${dk("border-[#1a1a1a]", "border-[#f0f0f0]")}`}
                        >
                          <div className="min-w-0">
                            <p className={`text-sm font-medium ${dk("text-white", "text-[#171717]")} truncate`}>{product.name}</p>
                            {product.sku && <p className="text-[10px] text-gray-500 font-mono">{product.sku}</p>}
                          </div>
                          <span className={`text-sm text-center ${dk("text-gray-300", "text-[#525252]")}`}>{product.quantity}</span>
                          <span className="text-sm text-right font-semibold text-[#2D9F6A]">
                            {formatPrice(product.total_price ?? 0)}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="px-5 pb-4">
                      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
                        <div>
                          <p className="text-xs text-gray-500">Total del pedido</p>
                          <p className="text-lg font-extrabold text-[#2D9F6A]">{formatPrice(order.total)}</p>
                        </div>
                        <button
                          onClick={() => onRepeatOrder(order)}
                          className={`text-xs font-semibold px-3 py-2 rounded-lg border transition ${dk("border-[#262626] text-gray-400 hover:text-white hover:bg-[#1a1a1a]", "border-[#e5e5e5] text-[#737373] hover:text-[#171717] hover:bg-[#f5f5f5]")}`}
                        >
                          Repetir pedido
                        </button>
                      </div>

                      <OrderPaymentProof
                        orderId={order.id}
                        existingProofs={order.payment_proofs}
                        isDark={isDark}
                        onProofsUpdated={(proofs) => {
                          void Promise.resolve(onUpdateOrderProofs(order.id, proofs));
                        }}
                      />
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
