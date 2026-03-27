import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { KanbanOrder } from "@/components/admin/OrderKanban";

/**
 * Admin-scoped orders hook with Supabase Realtime subscription.
 * Fetches all orders (no client_id filter) and updates live when
 * any order is inserted, updated, or deleted.
 */
export function useOrdersRealtime() {
  const [orders, setOrders]   = useState<KanbanOrder[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, client_id, total, status, products, created_at, notes")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setOrders(data.map(rowToKanban));
      }
    } catch {
      // Silencioso
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();

    const channel = supabase
      .channel("orders-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          setOrders((prev) => [rowToKanban(payload.new), ...prev]);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => {
          setOrders((prev) =>
            prev.map((o) =>
              String(o.id) === String(payload.new.id) ? rowToKanban(payload.new) : o
            )
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "orders" },
        (payload) => {
          setOrders((prev) =>
            prev.filter((o) => String(o.id) !== String(payload.old.id))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  const updateStatus = useCallback(
    async (orderId: string, status: KanbanOrder["status"]): Promise<void> => {
      await supabase.from("orders").update({ status }).eq("id", orderId);
      // Realtime will update local state automatically
    },
    []
  );

  return { orders, loading, refetch: fetchAll, updateStatus };
}

// ── Mapper ────────────────────────────────────────────────────────────────────

function rowToKanban(row: Record<string, unknown>): KanbanOrder {
  const products = (row.products as { name?: string; quantity?: number }[]) ?? [];
  return {
    id:           String(row.id),
    order_number: row.order_number as string | undefined,
    client_name:  (row.client_id as string) ?? undefined, // resolved by Admin from profiles
    total:        Number(row.total ?? 0),
    created_at:   row.created_at as string,
    status:       (row.status as KanbanOrder["status"]) ?? "pending",
    products:     products.map((p) => ({
      name:     p.name     ?? "Producto",
      quantity: p.quantity ?? 0,
    })),
  };
}
