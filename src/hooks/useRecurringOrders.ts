import { useCallback, useEffect, useState } from "react";

import { createOrderFromCart } from "@/lib/api/checkoutApi";
import { supabase } from "@/lib/supabase";
import {
  computeNextRecurringRun,
  type RecurringFrequency,
  type RecurringMode,
  type RecurringOrderItem,
  type RecurringOrderTemplate,
} from "@/lib/recurringOrders";

export interface RecurringOrderDraft {
  name: string;
  items: RecurringOrderItem[];
  frequency: RecurringFrequency;
  custom_days?: number | null;
  next_run_at: string;
  mode: RecurringMode;
  active?: boolean;
}

export interface UseRecurringOrdersOptions {
  userId?: string | null;
  companyId?: string | null;
}

export interface UseRecurringOrdersResult {
  recurringOrders: RecurringOrderTemplate[];
  loading: boolean;
  createRecurringOrder: (draft: RecurringOrderDraft) => Promise<RecurringOrderTemplate | null>;
  updateRecurringOrder: (id: string, patch: Partial<RecurringOrderDraft>) => Promise<RecurringOrderTemplate | null>;
  deleteRecurringOrder: (id: string) => Promise<void>;
  toggleRecurringOrder: (id: string, active: boolean) => Promise<void>;
  executeNow: (id: string) => Promise<{ id: string | number; order_number?: string } | null>;
  refetch: () => Promise<void>;
}

function normalizeRecurringItems(items: RecurringOrderItem[]): RecurringOrderItem[] {
  return items
    .map((item) => ({
      product_id: Number(item.product_id),
      quantity: Math.max(1, Number(item.quantity) || 1),
    }))
    .filter((item) => Number.isFinite(item.product_id) && item.product_id > 0);
}

export function useRecurringOrders({
  userId,
  companyId,
}: UseRecurringOrdersOptions): UseRecurringOrdersResult {
  const [recurringOrders, setRecurringOrders] = useState<RecurringOrderTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRecurringOrders = useCallback(async () => {
    if (!userId || userId === "guest") {
      setRecurringOrders([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("recurring_orders")
        .select("*")
        .eq("profile_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRecurringOrders((data ?? []) as RecurringOrderTemplate[]);
    } catch {
      setRecurringOrders([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void fetchRecurringOrders();
  }, [fetchRecurringOrders]);

  const createRecurringOrder = useCallback(
    async (draft: RecurringOrderDraft): Promise<RecurringOrderTemplate | null> => {
      if (!userId || userId === "guest") return null;

      const payload = {
        profile_id: userId,
        company_id: companyId ?? null,
        name: draft.name.trim(),
        items: normalizeRecurringItems(draft.items),
        frequency: draft.frequency,
        custom_days: draft.frequency === "custom" ? Math.max(1, Number(draft.custom_days) || 1) : null,
        next_run_at: draft.next_run_at,
        mode: draft.mode,
        active: draft.active ?? true,
      };

      const { data, error } = await supabase
        .from("recurring_orders")
        .insert(payload)
        .select("*")
        .single();

      if (error || !data) return null;

      const next = data as RecurringOrderTemplate;
      setRecurringOrders((prev) => [next, ...prev]);
      return next;
    },
    [companyId, userId],
  );

  const updateRecurringOrder = useCallback(
    async (id: string, patch: Partial<RecurringOrderDraft>): Promise<RecurringOrderTemplate | null> => {
      const payload: Record<string, unknown> = {};

      if (typeof patch.name === "string") payload.name = patch.name.trim();
      if (patch.items) payload.items = normalizeRecurringItems(patch.items);
      if (patch.frequency) payload.frequency = patch.frequency;
      if (patch.custom_days !== undefined) {
        payload.custom_days = patch.frequency === "custom" || patch.custom_days ? patch.custom_days : null;
      }
      if (patch.next_run_at) payload.next_run_at = patch.next_run_at;
      if (patch.mode) payload.mode = patch.mode;
      if (patch.active !== undefined) payload.active = patch.active;

      const { data, error } = await supabase
        .from("recurring_orders")
        .update(payload)
        .eq("id", id)
        .select("*")
        .single();

      if (error || !data) return null;

      const next = data as RecurringOrderTemplate;
      setRecurringOrders((prev) => prev.map((item) => (item.id === id ? next : item)));
      return next;
    },
    [],
  );

  const toggleRecurringOrder = useCallback(
    async (id: string, active: boolean) => {
      const template = recurringOrders.find((item) => item.id === id);
      const nextRunAt =
        active && template
          ? computeNextRecurringRun(template.next_run_at, template.frequency, template.custom_days)
          : undefined;

      await updateRecurringOrder(id, {
        active,
        ...(nextRunAt ? { next_run_at: nextRunAt } : {}),
      });
    },
    [recurringOrders, updateRecurringOrder],
  );

  const executeNow = useCallback(
    async (id: string): Promise<{ id: string | number; order_number?: string } | null> => {
      const template = recurringOrders.find((item) => item.id === id);
      if (!template) return null;

      const order = await createOrderFromCart({
        items: template.items.map((item) => ({
          product_id: String(item.product_id),
          quantity: item.quantity,
        })),
        notes: `Pedido generado desde plantilla recurrente "${template.name}".`,
      });

      await updateRecurringOrder(id, {
        next_run_at: computeNextRecurringRun(new Date(), template.frequency, template.custom_days),
      });

      const orderRecord = order as unknown as Record<string, unknown>;

      return {
        id: order.id,
        order_number: typeof orderRecord.order_number === "string" ? orderRecord.order_number : undefined,
      };
    },
    [recurringOrders, updateRecurringOrder],
  );

  const deleteRecurringOrder = useCallback(async (id: string): Promise<void> => {
    await supabase.from("recurring_orders").delete().eq("id", id);
    setRecurringOrders((prev) => prev.filter((item) => item.id !== id));
  }, []);

  return {
    recurringOrders,
    loading,
    createRecurringOrder,
    updateRecurringOrder,
    deleteRecurringOrder,
    toggleRecurringOrder,
    executeNow,
    refetch: fetchRecurringOrders,
  };
}
