import { supabase } from "@/lib/supabase";
import type { PricingRule, PricingRuleInsert, PricingRuleUpdate } from "@/models/pricingRule";

const TABLE = "pricing_rules";

export async function fetchPricingRules(): Promise<PricingRule[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .order("priority", { ascending: false })
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as PricingRule[];
}

export async function createPricingRule(input: PricingRuleInsert): Promise<PricingRule> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert(input)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as PricingRule;
}

export async function updatePricingRule(id: string, input: PricingRuleUpdate): Promise<PricingRule> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as PricingRule;
}

export async function deletePricingRule(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
}
