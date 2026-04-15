import { backend, hasBackendUrl } from "./backend";
import { supabase } from "@/lib/supabase";
import type { Order } from "./ordersApi";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CartItem {
  product_id: string;
  quantity: number;
}

export interface CheckoutPayload {
  /** Admin / vendedor can specify a client_id; clients use their own identity */
  client_id?: string | null;
  items: CartItem[];
  coupon_code?: string | null;
  notes?: string | null;
  payment_method?: string | null;
  /** Additional percentage applied on the base total (e.g. 5 = +5%) */
  payment_surcharge_pct?: number | null;
  shipping_type?: string | null;
  shipping_address?: string | null;
  shipping_transport?: string | null;
  shipping_cost?: number | null;
}

// ─── API ──────────────────────────────────────────────────────────────────────

/**
 * Creates an order from a cart. The backend resolves prices using the client's
 * pricing rules, validates the coupon (if any), and returns the created order.
 */
export async function createOrderFromCart(payload: CheckoutPayload): Promise<Order> {
  if (hasBackendUrl) {
    return backend.post<Order>("/v1/checkout", payload);
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const response = await fetch("/api/checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify({
      products: payload.items.map((item) => ({
        id: item.product_id,
        quantity: item.quantity,
      })),
      payment_method: payload.payment_method ?? null,
      payment_surcharge_pct: payload.payment_surcharge_pct ?? null,
      shipping_type: payload.shipping_type ?? null,
      shipping_address: payload.shipping_address ?? null,
      shipping_transport: payload.shipping_transport ?? null,
      shipping_cost: payload.shipping_cost ?? null,
      notes: payload.notes ?? null,
      coupon_code: payload.coupon_code ?? null,
    }),
  });

  const raw = await response.text();
  let parsed: Record<string, unknown> = {};

  if (raw) {
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new Error(raw);
    }
  }

  if (!response.ok) {
    throw new Error(
      typeof parsed.error === "string" && parsed.error.trim().length > 0
        ? parsed.error
        : raw || "Error en el checkout",
    );
  }

  const result =
    parsed.ok === true && parsed.data && typeof parsed.data === "object"
      ? parsed.data
      : parsed;

  return result as Order;
}
