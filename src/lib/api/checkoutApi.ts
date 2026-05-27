import { backend, hasBackendUrl } from "./backend";
import { supabase } from "@/lib/supabase";
import { enqueueAction } from "@/lib/syncQueue";
import type { Order } from "./ordersApi";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CartItem {
  product_id: number;
  quantity: number;
  bundle_id?: string | null;
  bundle_name?: string | null;
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
        bundle_id: item.bundle_id ?? null,
        bundle_name: item.bundle_name ?? null,
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

export interface QueuedCheckoutResult {
  /** True if the request was queued in IndexedDB instead of sent. */
  queued: boolean;
  /** Present when the request actually went through. */
  order?: Order;
}

/**
 * Submits the checkout; if the browser is offline, persists the payload in the
 * sync queue so it can be drained when connectivity returns.
 */
export async function submitCheckoutWithQueueFallback(
  payload: CheckoutPayload,
): Promise<QueuedCheckoutResult> {
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  if (offline) {
    await enqueueAction("place_order", payload);
    return { queued: true };
  }

  try {
    const order = await createOrderFromCart(payload);
    return { queued: false, order };
  } catch (err: unknown) {
    // Network-level failure: enqueue so we don't lose the order.
    const isNetworkError =
      err instanceof TypeError ||
      (err instanceof Error && /Failed to fetch|NetworkError|Network request failed/i.test(err.message));
    if (isNetworkError) {
      await enqueueAction("place_order", payload);
      return { queued: true };
    }
    throw err;
  }
}
