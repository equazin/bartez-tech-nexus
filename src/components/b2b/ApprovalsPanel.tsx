import { useMemo, useState, useEffect } from "react";
import { CheckCircle2, ClipboardList, Package, Search, XCircle, AlertTriangle, Clock, User } from "lucide-react";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import type { PortalOrder } from "@/hooks/useOrders";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface ApprovalsPanelProps {
  isDark: boolean;
  orders: PortalOrder[];
  formatPrice: (value: number) => string;
  formatUSD: (value: number) => string;
  formatARS: (value: number) => string;
  currency: "USD" | "ARS";
  onRefresh: () => void;
}

export function ApprovalsPanel({
  isDark,
  orders,
  formatPrice,
  formatUSD,
  formatARS,
  currency,
  onRefresh,
}: ApprovalsPanelProps) {
  const dk = (d: string, l: string) => (isDark ? d : l);

  const [query, setQuery] = useState("");
  const [processingId, setProcessingId] = useState<string | number | null>(null);

  const pendingApprovals = useMemo(() => {
    return orders.filter(o => o.status === "pending_approval");
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return pendingApprovals.filter((order) => {
      if (!normalizedQuery) return true;
      const haystack = [
        order.order_number,
        String(order.id),
        ...order.products.map((product) => `${product.name} ${product.sku}`),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [pendingApprovals, query]);

  async function handleApprove(orderId: string | number) {
    setProcessingId(orderId);
    try {
      const { data, error } = await supabase.rpc("approve_b2b_order", {
        p_order_id: orderId
      });

      if (error) throw error;
      toast.success("Pedido aprobado con éxito");
      onRefresh();
    } catch (err) {
      console.error("Error approving order:", err);
      toast.error(err instanceof Error ? err.message : "Error al aprobar el pedido");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject(orderId: string | number) {
    setProcessingId(orderId);
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: "rejected", notes: "Rechazado por el manager." })
        .eq("id", orderId);

      if (error) throw error;
      toast.success("Pedido rechazado");
      onRefresh();
    } catch (err) {
      console.error("Error rejecting order:", err);
      toast.error("No se pudo rechazar el pedido");
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className={`text-base font-bold ${dk("text-white", "text-[#171717]")}`}>Aprobaciones Pendientes</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Pedidos de tus compradores que requieren autorización para ser procesados.
          </p>
        </div>
      </div>

      <div className={`border rounded-xl p-3 ${dk("border-[#1f1f1f] bg-[#111]", "border-[#e5e5e5] bg-white")}`}>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por pedido o producto..."
            className={`w-full rounded-lg border pl-9 pr-3 py-2 text-sm outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white placeholder:text-[#404040]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] placeholder:text-[#a3a3a3]")}`}
          />
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className={`border rounded-xl py-20 text-center ${dk("border-[#1f1f1f] bg-[#111]", "border-[#e5e5e5] bg-white")}`}>
          <CheckCircle2 size={32} className="mx-auto mb-3 text-gray-500/40" />
          <p className="text-sm font-medium text-gray-500">No hay pedidos pendientes de aprobación.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const isProcessing = processingId === order.id;
            return (
              <div key={order.id} className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-xl p-5`}>
                <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                       <span className={`text-sm font-bold font-mono ${dk("text-white", "text-[#171717]")}`}>
                        {order.order_number ?? `#${String(order.id).slice(-6).toUpperCase()}`}
                      </span>
                      <OrderStatusBadge status={order.status} />
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                        <User size={11} className="text-gray-500" />
                        <span className="text-xs text-gray-400">Comprador: {order.client_id?.slice(0, 8)}...</span>
                        <span className="text-xs text-gray-500">· {new Date(order.created_at).toLocaleDateString("es-AR")}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-[#2D9F6A]">{formatPrice(order.total)}</p>
                    <p className="text-[10px] text-gray-500">Total con impuestos incluidos</p>
                  </div>
                </div>

                <div className={`rounded-lg border mb-4 ${dk("border-[#1a1a1a] bg-[#0d0d0d]", "border-[#f0f0f0] bg-[#fafafa]")}`}>
                    <div className="px-4 py-2 border-b border-inherit bg-inherit/50">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Productos ({order.products.length})</p>
                    </div>
                    <div className="divide-y divide-inherit">
                        {order.products.map((p, i) => (
                            <div key={i} className="px-4 py-2 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className={`text-xs font-medium truncate ${dk("text-white", "text-[#171717]")}`}>{p.name}</p>
                                    <p className="text-[10px] text-gray-500 font-mono">{p.sku}</p>
                                </div>
                                <span className="text-xs font-semibold text-gray-400">x{p.quantity}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleApprove(order.id)}
                    disabled={isProcessing}
                    className="flex-1 flex items-center justify-center gap-2 bg-[#2D9F6A] hover:bg-[#25835A] disabled:opacity-50 text-white text-sm font-bold py-2.5 rounded-xl transition"
                  >
                    <CheckCircle2 size={16} /> Aprobar Pedido
                  </button>
                  <button
                    onClick={() => handleReject(order.id)}
                    disabled={isProcessing}
                    className={`flex-1 flex items-center justify-center gap-2 border transition disabled:opacity-50 text-sm font-bold py-2.5 rounded-xl ${dk("border-[#262626] text-gray-400 hover:text-white hover:bg-red-500/10 hover:border-red-500/20", "border-[#e5e5e5] text-[#737373] hover:text-red-600 hover:bg-red-50 hover:border-red-200")}`}
                  >
                    <XCircle size={16} /> Rechazar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
