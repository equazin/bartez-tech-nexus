import { supabase } from "@/lib/supabase";
import type { PricingRule, PricingRuleInsert, PricingRuleUpdate } from "@/models/pricingRule";

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
  const { data, error } = await supabase.from("pricing_rules").insert(input).select("*").single();
  if (error || !data) throw new Error(error?.message ?? "No se pudo crear la regla.");
  return data as PricingRule;
}

export async function updatePricingRule(id: string, input: PricingRuleUpdate): Promise<PricingRule> {
  const { data, error } = await supabase
    .from("pricing_rules")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "No se pudo actualizar la regla.");
  return data as PricingRule;
}

export async function deletePricingRule(id: string): Promise<void> {
  const { error } = await supabase.from("pricing_rules").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
