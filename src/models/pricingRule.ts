export type PricingRuleCondition =
  | "product"
  | "client"
  | "category"
  | "supplier"
  | "tag"
  | "sku_prefix";

export interface QuantityBreak {
  min: number;
  margin: number;
}

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
  /** Volume pricing tiers: [{min: 1, margin: 20}, {min: 10, margin: 15}] */
  quantity_breaks?: QuantityBreak[] | null;
  created_at: string;
  updated_at: string;
}

export type PricingRuleInsert = Omit<PricingRule, "id" | "created_at" | "updated_at">;
export type PricingRuleUpdate = Partial<PricingRuleInsert>;

/** Ordering mirrors engine priority: product > client > category > others */
export const CONDITION_LABELS: Record<PricingRuleCondition, string> = {
  product:    "Producto (ID)",
  client:     "Cliente (ID)",
  category:   "Categoría",
  supplier:   "Proveedor",
  tag:        "Etiqueta",
  sku_prefix: "Prefijo SKU",
};
