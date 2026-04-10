import { supabase } from "@/lib/supabase";
import type { PricingRule, PricingRuleInsert, PricingRuleUpdate } from "@/models/pricingRule";
import { createPricingRuleApi, updatePricingRuleApi, deletePricingRuleApi } from "@/lib/api/ordersApi";

// GET remains a direct Supabase call — read-only, safe with RLS, and used for display only
export async function fetchPricingRules(): Promise<PricingRule[]> {
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
