import { useEffect, useRef } from "react";
import { toast } from "sonner";
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
function priceKey() {
  return `b2b_price_cache`;
}

interface NotifCache {
  orderStatuses: Record<string, string>; // id → status
  productPrices: Record<number, number>; // id → cost_price
  productStock:  Record<number, number>; // id → stock
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
  products: Product[]
) {
  const initialized = useRef(false);

  useEffect(() => {
    if (!userId || !orders.length) return;

    const cache = readCache(userId);

    // ── Order status changes ───────────────────────────────────────────────
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
      }
    }

    // ── Product price / stock changes ─────────────────────────────────────
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
  }, [userId, orders, products]);
}
