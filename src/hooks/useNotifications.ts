import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { PortalOrder } from "@/hooks/useOrders";
import type { Product } from "@/models/products";

const STATUS_LABELS: Record<string, string> = {
  pending:    "En revisión",
  approved:   "Aprobado ✓",
  preparing:  "En preparación",
  shipped:    "Enviado",
  delivered:  "Entregado",
  rejected:   "Rechazado",
  dispatched: "Despachado",
};

function cacheKey(userId: string) {
  return `b2b_notif_cache_${userId}`;
}

interface NotifCache {
  orderStatuses: Record<string, string>;
  productPrices: Record<number, number>;
  productStock:  Record<number, number>;
}

function readCache(userId: string): NotifCache {
  try {
    return JSON.parse(localStorage.getItem(cacheKey(userId)) || "{}");
  } catch {
    return { orderStatuses: {}, productPrices: {}, productStock: {} };
  }
}

function writeCache(userId: string, data: NotifCache) {
  localStorage.setItem(cacheKey(userId), JSON.stringify(data));
}

export function useNotifications(
  userId: string | undefined,
  orders: PortalOrder[],
  products: Product[],
  onOrderStatusChange?: (orderId: string, newStatus: string) => void
) {
  const initialized = useRef(false);

  // ── Poll-based detection (existing logic) ────────────────────────────────
  useEffect(() => {
    if (!userId || !orders.length) return;

    const cache = readCache(userId);

    const newOrderStatuses: Record<string, string> = {};
    for (const order of orders) {
      const id = String(order.id);
      const label = order.order_number ?? id.slice(-6).toUpperCase();
      const prevStatus = cache.orderStatuses?.[id];
      const currStatus = order.status;
      newOrderStatuses[id] = currStatus;

      if (initialized.current && prevStatus && prevStatus !== currStatus) {
        const newLabel = STATUS_LABELS[currStatus] ?? currStatus;
        if (currStatus === "approved" || currStatus === "delivered") {
          toast.success(`Pedido ${label}: ${newLabel}`, { duration: 6000 });
        } else if (currStatus === "rejected") {
          toast.error(`Pedido ${label}: Rechazado`, { duration: 6000 });
        } else {
          toast.info(`Pedido ${label} → ${newLabel}`, { duration: 4000 });
        }
        onOrderStatusChange?.(id, currStatus);
      }
    }

    const newPrices: Record<number, number> = {};
    const newStock: Record<number, number> = {};
    for (const p of products) {
      newPrices[p.id] = p.cost_price;
      newStock[p.id] = p.stock;

      if (initialized.current) {
        const prevPrice = cache.productPrices?.[p.id];
        if (prevPrice !== undefined && prevPrice !== p.cost_price) {
          const dir = p.cost_price > prevPrice ? "subió" : "bajó";
          toast.info(`${p.name}: precio ${dir}`, { duration: 4000 });
        }

        const prevStock = cache.productStock?.[p.id];
        if (prevStock !== undefined && prevStock === 0 && p.stock > 0) {
          toast.success(`${p.name}: volvió a tener stock`, { duration: 4000 });
        } else if (prevStock !== undefined && prevStock > 0 && p.stock === 0) {
          toast.warning(`${p.name}: sin stock`, { duration: 4000 });
        }
      }
    }

    writeCache(userId, {
      orderStatuses: newOrderStatuses,
      productPrices: newPrices,
      productStock: newStock,
    });

    initialized.current = true;
  }, [userId, orders, products, onOrderStatusChange]);

  // ── Supabase Realtime — order status changes ──────────────────────────────
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`orders_realtime_${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `client_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as { id: string; status: string; order_number?: string };
          const prevStatus = payload.old?.status as string | undefined;
          if (!updated?.status || updated.status === prevStatus) return;

          const label = updated.order_number ?? String(updated.id).slice(-6).toUpperCase();
          const newLabel = STATUS_LABELS[updated.status] ?? updated.status;

          if (updated.status === "approved" || updated.status === "delivered") {
            toast.success(`Pedido ${label}: ${newLabel}`, { duration: 6000 });
          } else if (updated.status === "rejected") {
            toast.error(`Pedido ${label}: Rechazado`, { duration: 6000 });
          } else {
            toast.info(`Pedido ${label} → ${newLabel}`, { duration: 4000 });
          }

          onOrderStatusChange?.(String(updated.id), updated.status);

          // Update cache
          const cache = readCache(userId);
          cache.orderStatuses = { ...cache.orderStatuses, [String(updated.id)]: updated.status };
          writeCache(userId, cache);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, onOrderStatusChange]);
}
