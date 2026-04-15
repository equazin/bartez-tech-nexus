import { supabase } from "@/lib/supabase";
import { backend, hasBackendUrl } from "@/lib/api/backend";
import type { PricingRule, PricingRuleInsert, PricingRuleUpdate } from "@/models/pricingRule";

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
