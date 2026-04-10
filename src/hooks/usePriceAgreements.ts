import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { createPriceAgreementApi, updatePriceAgreementApi } from "@/lib/api/ordersApi";

export interface PriceAgreement {
  id: number;
  client_id: string;
  name: string;
  margin_pct: number | null;
  discount_pct: number;
  price_list: "mayorista" | "distribuidor" | "standard";
  valid_from: string;
  valid_until: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

type CreateAgreementInput = Omit<PriceAgreement, "id" | "created_at" | "updated_at">;

export function usePriceAgreements(clientId?: string) {
  const [agreements, setAgreements] = useState<PriceAgreement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // GET stays as direct Supabase — read-only, RLS scopes to admin/vendedor
  const fetch = useCallback(async () => {
    if (!clientId) {
      setAgreements([]);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("client_price_agreements")
      .select("*")
      .eq("client_id", clientId)
      .order("valid_from", { ascending: false });

    if (err) {
      setError(err.message);
    } else {
      setAgreements((data ?? []) as PriceAgreement[]);
    }
    setLoading(false);
  }, [clientId]);

  useEffect(() => { void fetch(); }, [fetch]);

  const create = useCallback(async (input: CreateAgreementInput): Promise<PriceAgreement | null> => {
    try {
      const data = await createPriceAgreementApi(input) as PriceAgreement;
      setAgreements((prev) => [data, ...prev]);
      return data;
    } catch (err) {
      setError((err as Error).message);
      return null;
    }
  }, []);

  const update = useCallback(async (id: number, patch: Partial<PriceAgreement>): Promise<boolean> => {
    try {
      const data = await updatePriceAgreementApi(id, patch) as PriceAgreement;
      setAgreements((prev) => prev.map((a) => (a.id === id ? { ...a, ...data } : a)));
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    }
  }, []);

  const deactivate = useCallback(async (id: number): Promise<boolean> => {
    return update(id, { active: false });
  }, [update]);

  return { agreements, loading, error, create, update, deactivate, refetch: fetch };
}
