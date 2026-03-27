import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { logActivity } from "@/lib/api/activityLog";

export interface PortalOrder {
  id: string | number;
  client_id?: string;
  products: PortalOrderProduct[];
  total: number;
  status: "pending" | "approved" | "preparing" | "shipped" | "delivered" | "rejected" | "dispatched";
  /** Número correlativo visible: ORD-0001, ORD-0002 … generado server-side */
  order_number?: string;
  /** Número de remito al despachar */
  numero_remito?: string;
  payment_method?: string;
  payment_surcharge_pct?: number;
  shipping_type?: string;
  shipping_address?: string;
  shipping_transport?: string;
  shipping_cost?: number;
  notes?: string;
  payment_proofs?: unknown[];
  created_at: string;
}

export interface PortalOrderProduct {
  product_id: number;
  name: string;
  sku: string;
  quantity: number;
  cost_price: number;
  unit_price: number;
  total_price: number;
  margin: number;
}

export type AddOrderPayload = Omit<PortalOrder, "id" | "client_id" | "order_number">;

export function useOrders() {
  const { user, profile } = useAuth();
  const [orders, setOrders] = useState<PortalOrder[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchOrders = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("client_id", user.id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setOrders(data as PortalOrder[]);
      }
    } catch {
      // Silencioso — tabla puede no existir todavía
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  /**
   * Confirms an order via the `reserve_stock_and_create_order` RPC.
   * This atomically:
   *   1. Validates and reserves stock for each product (FOR UPDATE row lock)
   *   2. Creates the order with a server-side order number (ORD-XXXX)
   * Returns { error: null } on success or { error: string } on failure.
   * After success, fires a background email notification.
   */
  const addOrder = async (
    orderData: AddOrderPayload
  ): Promise<{ error: string | null; orderId?: string | number; orderNumber?: string }> => {
    if (!user) return { error: "No autenticado" };

    try {
      const { data, error } = await supabase.rpc("reserve_stock_and_create_order", {
        p_client_id:             user.id,
        p_products:              orderData.products,
        p_total:                 orderData.total,
        p_status:                orderData.status ?? "pending",
        p_payment_method:        orderData.payment_method        ?? null,
        p_payment_surcharge_pct: orderData.payment_surcharge_pct ?? null,
        p_shipping_type:         orderData.shipping_type         ?? null,
        p_shipping_address:      orderData.shipping_address      ?? null,
        p_shipping_transport:    orderData.shipping_transport     ?? null,
        p_shipping_cost:         orderData.shipping_cost         ?? null,
        p_notes:                 orderData.notes                 ?? null,
      });

      if (error) return { error: error.message };

      const result = data as { id: number; order_number: string; status: string };

      // Fetch the full order row to update local state
      const { data: fullOrder } = await supabase
        .from("orders")
        .select("*")
        .eq("id", result.id)
        .single();

      if (fullOrder) {
        setOrders((prev) => [fullOrder as PortalOrder, ...prev]);
      }

      // Log activity
      logActivity({
        user_id:     user.id,
        action:      "place_order",
        entity_type: "order",
        entity_id:   String(result.id),
        metadata:    { order_number: result.order_number, total: orderData.total },
      });

      // Fire-and-forget email notification (does not block order success)
      sendOrderConfirmationEmail({
        orderId:     result.id,
        orderNumber: result.order_number,
        clientId:    user.id,
        clientEmail: user.email ?? undefined,
        clientName:  profile?.company_name ?? profile?.contact_name ?? undefined,
        products:    orderData.products,
        total:       orderData.total,
      }).catch(() => {/* silencioso */});

      return { error: null, orderId: result.id, orderNumber: result.order_number };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Error al crear pedido";
      return { error: message };
    }
  };

  const updateOrder = async (
    orderId: string | number,
    patch: Partial<PortalOrder>
  ): Promise<{ error: string | null }> => {
    if (!user) return { error: "No autenticado" };
    try {
      const { data, error } = await supabase
        .from("orders")
        .update(patch)
        .eq("id", orderId)
        .eq("client_id", user.id)
        .select("*")
        .single();
      if (error) return { error: error.message };
      if (data) {
        setOrders((prev) =>
          prev.map((o) => (String(o.id) === String(orderId) ? (data as PortalOrder) : o))
        );
      }
      return { error: null };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Error al actualizar pedido";
      return { error: message };
    }
  };

  return { orders, loading, addOrder, updateOrder, refetch: fetchOrders };
}

// ── Email helper ─────────────────────────────────────────────────────────────

async function sendOrderConfirmationEmail(payload: {
  orderId: number;
  orderNumber: string;
  clientId: string;
  clientEmail?: string;
  clientName?: string;
  products: PortalOrderProduct[];
  total: number;
}): Promise<void> {
  await fetch("/api/email", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      type:        "order_confirmed",
      orderId:     payload.orderId,
      orderNumber: payload.orderNumber,
      clientId:    payload.clientId,
      clientEmail: payload.clientEmail,
      clientName:  payload.clientName,
      products:    payload.products,
      total:       payload.total,
    }),
  });
}
