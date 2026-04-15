import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { parseInternalReferenceFromNotes } from "@/lib/cartCheckout";
import { logActivity } from "@/lib/api/activityLog";
import { createOrderFromCart } from "@/lib/api/checkoutApi";
import { trackFirstOrder, trackOrderPlaced } from "@/lib/marketingTracker";
import { backend, hasBackendUrl } from "@/lib/api/backend";
import type { BackendOrder, BackendOrderStatus } from "@/lib/api/backendTypes";

export interface PortalOrder {
  id: string | number;
  client_id?: string;
  products: PortalOrderProduct[];
  total: number;
  status: "pending_approval" | "pending" | "approved" | "preparing" | "shipped" | "delivered" | "rejected" | "dispatched";
  /** Número correlativo visible: ORD-0001, ORD-0002 … generado server-side */
  order_number?: string;
  /** Número de PO / Referencia interna del cliente parsed from notes */
  internal_reference?: string;
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

// ─── Mapping helpers ─────────────────────────────────────────────────────────

const BACKEND_STATUS_MAP: Partial<Record<BackendOrderStatus, PortalOrder["status"]>> = {
  pending: "pending",
  confirmed: "approved",
  processing: "preparing",
  shipped: "shipped",
  delivered: "delivered",
  cancelled: "rejected",
};

function toPortalOrder(o: BackendOrder): PortalOrder {
  return {
    id: o.id,
    client_id: o.client_id,
    products: o.items.map((item) => ({
      product_id: Number(item.product_id),
      name: item.name,
      sku: item.sku,
      quantity: item.quantity,
      cost_price: 0, // no expuesto por el backend (por seguridad)
      unit_price: item.unit_price,
      total_price: item.line_total,
      margin: 0, // no expuesto por el backend (por seguridad)
    })),
    total: o.total,
    status: BACKEND_STATUS_MAP[o.status] ?? "pending",
    notes: o.notes ?? undefined,
    payment_method: o.payment_method ?? undefined,
    payment_surcharge_pct: o.payment_surcharge_pct ?? undefined,
    shipping_type: o.shipping_type ?? undefined,
    shipping_address: o.shipping_address ?? undefined,
    shipping_transport: o.shipping_transport ?? undefined,
    shipping_cost: o.shipping_cost ?? undefined,
    coupon_id: o.coupon_id ?? undefined,
    discount_amount: o.discount,
    created_at: o.created_at,
    internal_reference: parseInternalReferenceFromNotes(o.notes ?? ""),
  };
}

// ─────────────────────────────────────────────────────────────────────────────

export function useOrders() {
  const { user, profile } = useAuth();
  const [orders, setOrders] = useState<PortalOrder[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchOrders = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (hasBackendUrl) {
        // Migrado: el backend resuelve precios y devuelve los pedidos
        const { items } = await backend.me.orders({ limit: 200 });
        setOrders(items.map(toPortalOrder));
      } else {
        // Fallback: consulta directa a Supabase (sin backend configurado)
        const { data, error } = await supabase
          .from("orders")
          .select(`
            *,
            order_items (
              product_id, name, sku, quantity,
              cost_price, unit_price, total_price, margin, iva_rate
            )
          `)
          .eq("client_id", user.id)
          .order("created_at", { ascending: false });

        if (!error && data) {
          const merged = (data as unknown[]).map((order) => {
            const o = order as Record<string, unknown> & { order_items?: PortalOrderProduct[]; products?: PortalOrderProduct[]; notes?: string };
            return {
              ...o,
              products: o.order_items && o.order_items.length > 0 ? o.order_items : (o.products ?? []),
              internal_reference: parseInternalReferenceFromNotes(o.notes ?? ""),
            };
          });
          setOrders(merged as PortalOrder[]);
        }
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

      // 2. Get orders for those children with normalized items
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          order_items (
            product_id, name, sku, quantity,
            cost_price, unit_price, total_price, margin, iva_rate
          )
        `)
        .in("client_id", ids)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const merged = ((data || []) as (PortalOrder & { order_items?: PortalOrderProduct[] })[]).map((order) => {
        return { 
          ...order, 
          products: order.order_items && order.order_items.length > 0 ? order.order_items : order.products,
          internal_reference: parseInternalReferenceFromNotes(order.notes ?? "")
        };
      });
      return merged as PortalOrder[];
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
   * Creates the order through the dedicated backend checkout endpoint.
   * Frontend keeps the UX and local refresh behavior while the server resolves
   * pricing, validates stock/coupons, and persists the order.
   */
  const addOrder = async (
    orderData: AddOrderPayload
  ): Promise<{ error: string | null; orderId?: string | number; orderNumber?: string }> => {
    if (!user) return { error: "No autenticado" };

    try {
      const orderResult = await createOrderFromCart({
        items: orderData.products.map((product) => ({
          product_id: product.product_id,
          quantity: product.quantity,
        })),
        payment_method: orderData.payment_method ?? null,
        payment_surcharge_pct: orderData.payment_surcharge_pct ?? null,
        shipping_type: orderData.shipping_type ?? null,
        shipping_address: orderData.shipping_address ?? null,
        shipping_transport: orderData.shipping_transport ?? null,
        shipping_cost: orderData.shipping_cost ?? null,
        notes: orderData.notes ?? null,
        coupon_code: orderData.coupon_code ?? null,
      });
      const orderId = orderResult.id;
      const orderNumber =
        typeof (orderResult as { order_number?: unknown }).order_number === "string"
          ? ((orderResult as { order_number?: string }).order_number ?? undefined)
          : undefined;

      // Log activity
      void logActivity({
        action: "place_order",
        entity_type: "order",
        entity_id: String(orderId),
        metadata: { order_number: orderNumber ?? String(orderId), total: orderData.total }
      });

      // Refresh local list
      void fetchOrders();

      // Marketing tracking: first_order vs order_placed
      if (orders.length === 0) {
        trackFirstOrder(user.id, String(orderId), orderData.total);
      } else {
        trackOrderPlaced(user.id, String(orderId), orderData.total);
      }

      // Fire order confirmation email in background (non-blocking)
      void (async () => {
        try {
          const numericOrderId = Number(orderId);
          await fetch("/api/email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "order_confirmed",
              ...(Number.isFinite(numericOrderId) ? { orderId: numericOrderId } : {}),
              orderNumber: orderNumber ?? String(orderId),
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
