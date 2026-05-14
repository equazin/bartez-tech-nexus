import { useState } from "react";
import { useOrderApprovals, type PendingApproval } from "@/hooks/useOrderApprovals";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, ClipboardCheck, User, Package } from "lucide-react";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoney(n: number, currency: string): string {
  return n.toLocaleString("es-AR", {
    style: "currency",
    currency: currency || "ARS",
    maximumFractionDigits: 0,
  });
}

export default function ApprovalsPageV2() {
  const { pending, loading, approve, reject } = useOrderApprovals();
  const [rejectingOrder, setRejectingOrder] = useState<PendingApproval | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState<string | null>(null);

  async function handleApprove(order: PendingApproval) {
    setSubmitting(order.order_id);
    await approve(order.order_id);
    setSubmitting(null);
  }

  async function handleReject() {
    if (!rejectingOrder) return;
    setSubmitting(rejectingOrder.order_id);
    const ok = await reject(rejectingOrder.order_id, reason.trim() || undefined);
    setSubmitting(null);
    if (ok) {
      setRejectingOrder(null);
      setReason("");
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Aprobaciones</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Pedidos del equipo esperando tu revisión.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : pending.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="h-8 w-8" />}
          title="Nada que aprobar"
          description="Cuando un buyer de tu equipo cargue un pedido que requiere aprobación, lo verás acá."
        />
      ) : (
        <div className="space-y-3">
          {pending.map((order) => (
            <div key={order.order_id} className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold">{order.order_number}</h3>
                    <Badge variant="outline" className="border-warning text-warning">
                      Pendiente de aprobación
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {order.buyer_name}
                    </span>
                    <span>{formatDate(order.created_at)}</span>
                    <span className="inline-flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      {Array.isArray(order.products) ? order.products.length : 0} ítems
                    </span>
                  </div>
                </div>
                <div className="text-right portal-tabular">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Total</div>
                  <div className="text-lg font-bold">{formatMoney(order.total, order.currency)}</div>
                </div>
              </div>

              {Array.isArray(order.products) && order.products.length > 0 && (
                <div className="mt-3 max-h-32 overflow-y-auto rounded-lg bg-muted/30 p-2 text-xs">
                  {order.products.slice(0, 5).map((p, idx) => (
                    <div key={idx} className="flex items-center justify-between border-b border-border/50 py-1 last:border-b-0">
                      <span className="truncate">
                        {p.sku ? <span className="portal-sku mr-2">{p.sku}</span> : null}
                        {p.name ?? `Producto #${p.product_id}`}
                      </span>
                      <span className="ml-3 portal-tabular text-muted-foreground">×{p.quantity}</span>
                    </div>
                  ))}
                  {order.products.length > 5 && (
                    <div className="pt-1 text-center text-muted-foreground">
                      … y {order.products.length - 5} más
                    </div>
                  )}
                </div>
              )}

              <div className="mt-3 flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={submitting === order.order_id}
                  onClick={() => { setRejectingOrder(order); setReason(""); }}
                >
                  <XCircle className="h-4 w-4 text-danger" />
                  Rechazar
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={submitting === order.order_id}
                  onClick={() => handleApprove(order)}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Aprobar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!rejectingOrder} onOpenChange={(open) => !open && setRejectingOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar pedido {rejectingOrder?.order_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              El buyer recibirá una notificación. Podés agregar un motivo (opcional).
            </p>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Motivo del rechazo (opcional)…"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectingOrder(null)} disabled={submitting !== null}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={submitting !== null}
            >
              Confirmar rechazo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
