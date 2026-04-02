import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { logActivity } from "@/lib/api/activityLog";

export interface PortalOrder {
  id: string | number;
  client_id?: string;
  products: PortalOrderProduct[];
  total: number;
  status: "pending_approval" | "pending" | "approved" | "preparing" | "shipped" | "delivered" | "rejected" | "dispatched";
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
  shipping_provider?: 'andreani' | 'oca' | 'propio' | 'otro';
  tracking_number?: string;
  notes?: string;
  payment_proofs?: unknown[];
  coupon_id?: string;
  discount_amount?: number;
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

export type AddOrderPayload = Omit<PortalOrder, "id" | "client_id" | "order_number"> & {
  coupon_code?: string;
};

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

  const fetchManagedOrders = useCallback(async () => {
    if (!user) return [];
    setLoading(true);
    try {
      // 1. Get children IDs
      const { data: children } = await supabase
        .from("profiles")
        .select("id")
        .eq("parent_id", user.id);

      if (!children || children.length === 0) return [];

      const ids = children.map(c => c.id);

      // 2. Get orders for those children
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .in("client_id", ids)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as PortalOrder[];
    } catch (err) {
      console.error("Error fetching managed orders:", err);
      return [];
    } finally {
      setLoading(false);
    }
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
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || "";

      const payload = {
        products: orderData.products.map((p) => ({ id: p.product_id, quantity: p.quantity })),
        status: orderData.status ?? "pending",
        payment_method: orderData.payment_method ?? null,
        payment_surcharge_pct: orderData.payment_surcharge_pct ?? null,
        shipping_type: orderData.shipping_type ?? null,
        shipping_address: orderData.shipping_address ?? null,
        shipping_transport: orderData.shipping_transport ?? null,
        shipping_cost: orderData.shipping_cost ?? null,
        notes: orderData.notes ?? null,
        coupon_code: orderData.coupon_code ?? null,
      };

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Error en el checkout");

      // checkout returns { ok: true, data: { id, order_number, status } }
      const orderResult = body.data ?? body;
      const orderId = orderResult.id;
      const orderNumber = orderResult.order_number;

      // Log activity
      void logActivity({
        action: "place_order",
        entity_type: "order",
        entity_id: String(orderId),
        metadata: { order_number: orderNumber, total: orderData.total }
      });

      // Refresh local list
      void fetchOrders();

      // Fire order confirmation email in background (non-blocking)
      void (async () => {
        try {
          await fetch("/api/email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "order_confirmed",
              orderId: Number(orderId),
              orderNumber: orderNumber ?? "",
              clientId: user.id,
              clientEmail: user.email ?? undefined,
              clientName: profile?.company_name || profile?.contact_name || undefined,
              products: orderData.products.map((p) => ({
                product_id: p.product_id,
                name: p.name,
                sku: p.sku,
                quantity: p.quantity,
                unit_price: p.unit_price,
                total_price: p.total_price,
              })),
              total: orderData.total,
            }),
          });
        } catch {
          // Email es non-critical, nunca bloquea el flujo del pedido
        }
      })();

      return { error: null, orderId, orderNumber };
    } catch (err) {
      console.error("AddOrder error:", err);
      return { error: err instanceof Error ? err.message : "Error al procesar el pedido" };
    }
  };

  const updateOrder = async (id: string | number, updates: Partial<PortalOrder>) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("orders")
        .update(updates)
        .eq("id", id);
      if (!error) {
        setOrders(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
      }
    } catch (err) {
      console.error("UpdateOrder error:", err);
    }
  };

  return {
    orders,
    loading,
    fetchOrders,
    fetchManagedOrders,
    addOrder,
    updateOrder
  };
}
