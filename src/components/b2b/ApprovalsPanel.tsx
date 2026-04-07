import { useMemo, useState } from "react";
import { CheckCircle2, Search, XCircle, User, X } from "lucide-react";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import type { PortalOrder } from "@/hooks/useOrders";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface ApprovalsPanelProps {
  orders: PortalOrder[];
  formatPrice: (value: number) => string;
  formatUSD: (value: number) => string;
  formatARS: (value: number) => string;
  currency: "USD" | "ARS";
  onRefresh: () => void;
}

export function ApprovalsPanel({
  orders,
  formatPrice,
  onRefresh,
}: ApprovalsPanelProps) {
  const [query, setQuery] = useState("");
  const [processingId, setProcessingId] = useState<string | number | null>(null);
  const [rejectingId, setRejectingId] = useState<string | number | null>(null);
  const [rejectNote, setRejectNote] = useState("");

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
      const { error } = await supabase.rpc("approve_b2b_order", {
        p_order_id: orderId
      });
      if (error) throw error;
      toast.success("Pedido aprobado con éxito");
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al aprobar el pedido");
    } finally {
      setProcessingId(null);
    }
  }

  async function confirmReject(orderId: string | number) {
    setProcessingId(orderId);
    try {
      const notes = rejectNote.trim() || "Rechazado por el manager.";
      const { error } = await supabase
        .from("orders")
        .update({ status: "rejected", notes })
        .eq("id", orderId);
      if (error) throw error;
      toast.success("Pedido rechazado");
      setRejectingId(null);
      setRejectNote("");
      onRefresh();
    } catch (err) {
      toast.error("No se pudo rechazar el pedido");
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-foreground">Aprobaciones Pendientes</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pedidos de tus compradores que requieren autorización para ser procesados.
          </p>
        </div>
      </div>

      <div className="border border-border/70 bg-card rounded-xl p-3">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por pedido o producto..."
            className="w-full rounded-lg border border-border/70 bg-secondary pl-9 pr-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="border border-border/70 bg-card rounded-xl py-20 text-center">
          <CheckCircle2 size={32} className="mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">No hay pedidos pendientes de aprobación.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const isProcessing = processingId === order.id;
            return (
              <div key={order.id} className="bg-card border border-border/70 rounded-xl p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold font-mono text-foreground">
                        {order.order_number ?? `#${String(order.id).slice(-6).toUpperCase()}`}
                      </span>
                      <OrderStatusBadge status={order.status} />
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <User size={11} className="text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Cliente #{order.client_id?.slice(-6).toUpperCase() ?? "—"}</span>
                      <span className="text-xs text-muted-foreground">· {new Date(order.created_at).toLocaleDateString("es-AR")}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatPrice(order.total)}</p>
                    <p className="text-[10px] text-muted-foreground">Total sin impuestos</p>
                  </div>
                </div>

                <div className="rounded-lg border border-border/70 bg-secondary/40 mb-4">
                  <div className="px-4 py-2 border-b border-border/70">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Productos ({order.products.length})</p>
                  </div>
                  <div className="divide-y divide-border/70">
                    {order.products.map((p, i) => (
                      <div key={i} className="px-4 py-2 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate text-foreground">{p.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{p.sku}</p>
                        </div>
                        <span className="text-xs font-semibold text-muted-foreground">x{p.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {rejectingId === order.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                      placeholder="Motivo del rechazo (opcional)..."
                      rows={2}
                      className="w-full rounded-xl border border-border/70 bg-secondary/30 px-3 py-2 text-sm text-foreground outline-none resize-none placeholder:text-muted-foreground"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => confirmReject(order.id)}
                        disabled={isProcessing}
                        className="flex-1 flex items-center justify-center gap-2 bg-destructive hover:bg-destructive/90 disabled:opacity-50 text-white text-sm font-bold py-2 rounded-xl transition"
                      >
                        <XCircle size={15} /> Confirmar rechazo
                      </button>
                      <button
                        onClick={() => { setRejectingId(null); setRejectNote(""); }}
                        disabled={isProcessing}
                        className="flex items-center justify-center gap-1.5 border border-border/70 text-muted-foreground hover:text-foreground px-4 py-2 rounded-xl text-sm transition"
                      >
                        <X size={14} /> Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleApprove(order.id)}
                      disabled={isProcessing}
                      className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-sm font-bold py-2.5 rounded-xl transition"
                    >
                      <CheckCircle2 size={16} /> Aprobar Pedido
                    </button>
                    <button
                      onClick={() => setRejectingId(order.id)}
                      disabled={isProcessing}
                      className="flex-1 flex items-center justify-center gap-2 border border-border/70 text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30 transition disabled:opacity-50 text-sm font-bold py-2.5 rounded-xl"
                    >
                      <XCircle size={16} /> Rechazar
                    </button>
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
