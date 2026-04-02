import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

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
    const { data, error: err } = await supabase
      .from("client_price_agreements")
      .insert([input])
      .select()
      .single();

    if (err || !data) {
      setError(err?.message ?? "Error al crear acuerdo");
      return null;
    }
    const agreement = data as PriceAgreement;
    setAgreements((prev) => [agreement, ...prev]);
    return agreement;
  }, []);

  const update = useCallback(async (id: number, patch: Partial<PriceAgreement>): Promise<boolean> => {
    const { error: err } = await supabase
      .from("client_price_agreements")
      .update(patch)
      .eq("id", id);

    if (err) {
      setError(err.message);
      return false;
    }
    setAgreements((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    return true;
  }, []);

  const deactivate = useCallback(async (id: number): Promise<boolean> => {
    return update(id, { active: false });
  }, [update]);

  return { agreements, loading, error, create, update, deactivate, refetch: fetch };
}
