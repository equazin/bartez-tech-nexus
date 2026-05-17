import { useEffect } from "react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";

interface OrderInsertPayload {
  id: string | number;
  order_number?: string | null;
  total?: number | null;
  client_id?: string | null;
}

interface QuoteInsertPayload {
  id: string | number;
  client_id?: string | null;
  total?: number | null;
}

interface UseAdminRealtimeAlertsOptions {
  /** Disabled when admin is not active or impersonation is happening. */
  enabled?: boolean;
  /** Optional callback when an order arrives (e.g. to refresh the orders list). */
  onNewOrder?: (orderId: string | number) => void;
  /** Optional callback when a quote arrives. */
  onNewQuote?: (quoteId: string | number) => void;
  /** Optional handler when admin clicks the toast action. Receives the entity id. */
  onOpenOrder?: (orderId: string | number) => void;
  onOpenQuote?: (quoteId: string | number) => void;
}

const STATUS_TOAST_LABEL: Record<string, string> = {
  pending: "En revisión",
  approved: "Aprobado",
  preparing: "En preparación",
  dispatched: "Despachado",
  shipped: "En tránsito",
  delivered: "Entregado",
  rejected: "Rechazado",
};

/**
 * Subscribes to `orders` and `quotes` INSERTs across all clients (admin scope)
 * and surfaces a sonner toast with an "Open" action. Also listens to order
 * UPDATEs to flag status changes that need admin attention (e.g. a client
 * uploaded a payment proof).
 *
 * Designed to be mounted once at the Admin root; safe to leave enabled while
 * a tab is in the background — Supabase batches events.
 */
export function useAdminRealtimeAlerts({
  enabled = true,
  onNewOrder,
  onNewQuote,
  onOpenOrder,
  onOpenQuote,
}: UseAdminRealtimeAlertsOptions = {}) {
  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel("admin-realtime-alerts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const row = payload.new as OrderInsertPayload;
          const label = row.order_number ?? `#${String(row.id).slice(-6).toUpperCase()}`;
          toast.success(`Nuevo pedido ${label}`, {
            description: row.total ? `USD ${Number(row.total).toLocaleString("es-AR")}` : undefined,
            action: onOpenOrder
              ? { label: "Abrir", onClick: () => onOpenOrder(row.id) }
              : undefined,
            duration: 8000,
          });
          onNewOrder?.(row.id);
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "quotes" },
        (payload) => {
          const row = payload.new as QuoteInsertPayload;
          toast.info("Nueva cotización solicitada", {
            description: row.total ? `USD ${Number(row.total).toLocaleString("es-AR")}` : undefined,
            action: onOpenQuote
              ? { label: "Abrir", onClick: () => onOpenQuote(row.id) }
              : undefined,
            duration: 8000,
          });
          onNewQuote?.(row.id);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => {
          const next = payload.new as { id: string | number; status?: string; payment_proofs?: unknown[] };
          const prev = payload.old as { status?: string; payment_proofs?: unknown[] } | undefined;
          if (!next?.status) return;

          // Payment proof uploaded
          const prevProofs = Array.isArray(prev?.payment_proofs) ? prev.payment_proofs.length : 0;
          const nextProofs = Array.isArray(next.payment_proofs) ? next.payment_proofs.length : 0;
          if (nextProofs > prevProofs) {
            const label = `#${String(next.id).slice(-6).toUpperCase()}`;
            toast.info(`Comprobante de pago recibido (${label})`, {
              action: onOpenOrder ? { label: "Revisar", onClick: () => onOpenOrder(next.id) } : undefined,
              duration: 8000,
            });
            return;
          }

          // Status change initiated outside this admin tab
          if (prev?.status && prev.status !== next.status) {
            const friendly = STATUS_TOAST_LABEL[next.status] ?? next.status;
            const label = `#${String(next.id).slice(-6).toUpperCase()}`;
            toast(`Pedido ${label}: ${friendly}`, { duration: 4000 });
          }
        },
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [enabled, onNewOrder, onNewQuote, onOpenOrder, onOpenQuote]);
}
