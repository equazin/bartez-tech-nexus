import { useState, useEffect, useCallback } from "react";
import {
  fetchPricingRules, createPricingRule, updatePricingRule, deletePricingRule,
} from "@/lib/api/pricingRules";
import type { PricingRule, PricingRuleInsert, PricingRuleUpdate } from "@/models/pricingRule";

export function usePricingRules() {
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRules(await fetchPricingRules());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar reglas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function add(input: PricingRuleInsert): Promise<PricingRule> {
    const created = await createPricingRule(input);
    setRules((prev) => [created, ...prev]);
    return created;
  }

  async function edit(id: string, input: PricingRuleUpdate): Promise<void> {
    const updated = await updatePricingRule(id, input);
    setRules((prev) => prev.map((r) => (r.id === id ? updated : r)));
  }

  async function remove(id: string): Promise<void> {
    await deletePricingRule(id);
    setRules((prev) => prev.filter((r) => r.id !== id));
  }

  return { rules, loading, error, refresh: load, add, edit, remove };
}
