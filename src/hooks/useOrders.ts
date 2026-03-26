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
      const { data, error } = await supabase
        .from("orders")
        .insert([{ ...orderData, client_id: user.id }])
        .select()
        .single();

      if (error) return { error: error.message };
      if (data) setOrders((prev) => [data as PortalOrder, ...prev]);
      return { error: null };
    } catch (e: any) {
      return { error: e.message };
    }
  };

  return { orders, loading, addOrder, refetch: fetchOrders };
}
