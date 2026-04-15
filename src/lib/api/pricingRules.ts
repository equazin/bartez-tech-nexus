import { supabase } from "@/lib/supabase";
import { backend, hasBackendUrl } from "@/lib/api/backend";
import type { PricingRule, PricingRuleInsert, PricingRuleUpdate } from "@/models/pricingRule";
import { createPricingRuleApi, updatePricingRuleApi, deletePricingRuleApi } from "@/lib/api/ordersApi";

export async function fetchPricingRules(): Promise<PricingRule[]> {
  if (hasBackendUrl) {
    // Migrado: el backend lee pricing_rules con el service_role y aplica el orden correcto
    const rows = await backend.pricing.listRules();
    return rows as unknown as PricingRule[];
  }

  // Fallback: Supabase directo
  const { data, error } = await supabase
    .from("pricing_rules")
    .select("*")
    .order("priority", { ascending: false })
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as PricingRule[];
}

export async function createPricingRule(input: PricingRuleInsert): Promise<PricingRule> {
  return createPricingRuleApi(input) as Promise<PricingRule>;
}

export async function updatePricingRule(id: string, input: PricingRuleUpdate): Promise<PricingRule> {
  return updatePricingRuleApi(id, input) as Promise<PricingRule>;
}

export async function deletePricingRule(id: string): Promise<void> {
  await deletePricingRuleApi(id);
}
