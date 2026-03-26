export type PricingRuleCondition = "category" | "supplier" | "tag" | "sku_prefix";

export interface PricingRule {
  id: string;
  name: string;
  condition_type: PricingRuleCondition;
  condition_value: string;
  min_margin: number;
  max_margin?: number | null;
  fixed_markup?: number | null;
  priority: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type PricingRuleInsert = Omit<PricingRule, "id" | "created_at" | "updated_at">;
export type PricingRuleUpdate = Partial<PricingRuleInsert>;

export const CONDITION_LABELS: Record<PricingRuleCondition, string> = {
  category:   "Categoría",
  supplier:   "Proveedor",
  tag:        "Etiqueta",
  sku_prefix: "Prefijo SKU",
};
