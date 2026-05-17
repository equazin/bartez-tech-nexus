import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

export interface PortalSidebarBadges {
  ordersPending: number;
  ordersInTransit: number;
  quotesPending: number;
  approvalsPending: number;
  rmaPending: number;
}

const EMPTY: PortalSidebarBadges = {
  ordersPending: 0,
  ordersInTransit: 0,
  quotesPending: 0,
  approvalsPending: 0,
  rmaPending: 0,
};

async function countTable(
  table: string,
  filters: Record<string, string | string[]>,
): Promise<number> {
  try {
    let query = supabase.from(table).select("id", { count: "exact", head: true });
    for (const [column, value] of Object.entries(filters)) {
      query = Array.isArray(value) ? query.in(column, value) : query.eq(column, value);
    }
    const { count, error } = await query;
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export function usePortalSidebarBadges(): PortalSidebarBadges {
  const { user } = useAuth();
  const [badges, setBadges] = useState<PortalSidebarBadges>(EMPTY);

  useEffect(() => {
    if (!user?.id) {
      setBadges(EMPTY);
      return;
    }
    let cancelled = false;

    async function load(clientId: string) {
      const [ordersPending, ordersInTransit, quotesPending, approvalsPending, rmaPending] =
        await Promise.all([
          countTable("orders", { client_id: clientId, status: ["pending", "pending_approval"] }),
          countTable("orders", { client_id: clientId, status: ["approved", "preparing", "dispatched", "shipped"] }),
          countTable("quotes", { client_id: clientId, status: ["draft", "sent"] }),
          countTable("orders", { client_id: clientId, status: "pending_approval" }),
          countTable("rma_requests", { client_id: clientId, status: ["open", "pending"] }),
        ]);
      if (cancelled) return;
      setBadges({ ordersPending, ordersInTransit, quotesPending, approvalsPending, rmaPending });
    }

    void load(user.id);

    const channel = supabase
      .channel(`portal-badges-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `client_id=eq.${user.id}` },
        () => void load(user.id),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "quotes", filter: `client_id=eq.${user.id}` },
        () => void load(user.id),
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return badges;
}
