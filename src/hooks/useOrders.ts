import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

export interface PortalOrder {
  id: string | number;
  client_id?: string;
  products: PortalOrderProduct[];
  total: number;
  status: "pending" | "approved" | "preparing" | "shipped" | "delivered" | "rejected" | "dispatched";
  /** Número correlativo visible: ORD-0001, ORD-0002 ... */
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

export function useOrders() {
  const { user } = useAuth();
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

  const addOrder = async (
    orderData: Omit<PortalOrder, "id" | "client_id">
  ): Promise<{ error: string | null }> => {
    if (!user) return { error: "No autenticado" };
    try {
      let insertPayload: Record<string, unknown> = { ...orderData, client_id: user.id };
      let { data, error } = await supabase
        .from("orders")
        .insert([insertPayload])
        .select()
        .single();

      // Backward compatibility with legacy schemas lacking new checkout fields.
      if (error && /column .* does not exist/i.test(error.message)) {
        insertPayload = {
          client_id: user.id,
          products: orderData.products,
          total: orderData.total,
          status: orderData.status,
          order_number: orderData.order_number,
          numero_remito: orderData.numero_remito ?? null,
          created_at: orderData.created_at,
        };
        const retry = await supabase.from("orders").insert([insertPayload]).select().single();
        data = retry.data;
        error = retry.error;
      }

      if (error) return { error: error.message };
      if (data) setOrders((prev) => [data as PortalOrder, ...prev]);
      return { error: null };
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
        .eq("client_id", user?.id)
        .select("*")
        .single();
      if (error) return { error: error.message };
      if (data) {
        setOrders((prev) => prev.map((o) => (String(o.id) === String(orderId) ? (data as PortalOrder) : o)));
      }
      return { error: null };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Error al actualizar pedido";
      return { error: message };
    }
  };

  return { orders, loading, addOrder, updateOrder, refetch: fetchOrders };
}
