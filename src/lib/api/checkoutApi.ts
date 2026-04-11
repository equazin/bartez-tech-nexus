import { backend } from "./backendClient";
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
  return backend.post<Order>("/v1/checkout", payload);
}
