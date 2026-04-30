import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

export interface PendingApproval {
  order_id: string;
  order_number: string;
  client_id: string;
  client_name: string;
  buyer_name: string;
  total: number;
  currency: string;
  created_at: string;
  products: Array<{ product_id: number; quantity: number; name?: string; sku?: string }>;
}

interface UseOrderApprovalsReturn {
  pending: PendingApproval[];
  loading: boolean;
  approve: (orderId: string) => Promise<boolean>;
  reject: (orderId: string, reason?: string) => Promise<boolean>;
  refresh: () => void;
}

export function useOrderApprovals(): UseOrderApprovalsReturn {
  const { toast } = useToast();
  const [pending, setPending] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_pending_approvals");
    if (!error) setPending((data as PendingApproval[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const approve = useCallback(async (orderId: string) => {
    const { error } = await supabase.rpc("approve_b2b_order", { p_order_id: orderId });
    if (error) {
      toast({ title: "Error al aprobar", description: error.message, variant: "destructive" });
      return false;
    }
    setPending((prev) => prev.filter((p) => p.order_id !== orderId));
    toast({ title: "Orden aprobada" });
    return true;
  }, [toast]);

  const reject = useCallback(async (orderId: string, reason?: string) => {
    const { error } = await supabase.rpc("reject_b2b_order", {
      p_order_id: orderId,
      p_reason: reason ?? null,
    });
    if (error) {
      toast({ title: "Error al rechazar", description: error.message, variant: "destructive" });
      return false;
    }
    setPending((prev) => prev.filter((p) => p.order_id !== orderId));
    toast({ title: "Orden rechazada" });
    return true;
  }, [toast]);

  return { pending, loading, approve, reject, refresh: load };
}
