import type { Product } from "@/models/products";
import type { PricingRule } from "@/models/pricingRule";

/**
 * Apply pricing rules to determine the effective margin for a product.
 *
 * Rules are evaluated in descending priority order. The first matching
 * active rule wins. If no rule matches, the base margin is returned.
 *
 * Rules can set:
 *   - min_margin: floor — the margin can't go below this
 *   - max_margin: ceiling — the margin can't exceed this
 *   - fixed_markup: override — ignore base margin entirely
 */
export function applyPricingRules(
  product: Product,
  rules: PricingRule[],
  baseMargin: number
): number {
  const active = rules
    .filter((r) => r.active)
    .sort((a, b) => b.priority - a.priority);

  for (const rule of active) {
    if (!matchesRule(product, rule)) continue;

    // Fixed markup overrides everything
    if (rule.fixed_markup != null) return rule.fixed_markup;

    let margin = baseMargin;
    if (rule.min_margin != null) margin = Math.max(margin, rule.min_margin);
    if (rule.max_margin != null) margin = Math.min(margin, rule.max_margin);
    return margin;
  }

  return baseMargin;
}

function matchesRule(product: Product, rule: PricingRule): boolean {
  const val = rule.condition_value.toLowerCase().trim();

  switch (rule.condition_type) {
    case "category":
      return product.category?.toLowerCase().trim() === val;

    case "supplier":
      return (
        String(product.supplier_id ?? "") === val ||
        product.supplier_name?.toLowerCase().trim() === val
      );

    case "tag":
      return (product.tags ?? []).some((t) => t.toLowerCase().trim() === val);

    case "sku_prefix":
      return (product.sku ?? "").toUpperCase().startsWith(val.toUpperCase());

    default:
      return false;
  }
}

/**
 * Get the effective margin for a product given rules and a base margin.
 * Returns both the result and which rule was applied (for UI feedback).
 */
export function resolveMargin(
  product: Product,
  rules: PricingRule[],
  baseMargin: number
): { margin: number; appliedRule: PricingRule | null } {
  const active = rules
    .filter((r) => r.active)
    .sort((a, b) => b.priority - a.priority);

  for (const rule of active) {
    if (!matchesRule(product, rule)) continue;

    if (rule.fixed_markup != null) {
      return { margin: rule.fixed_markup, appliedRule: rule };
    }

    let margin = baseMargin;
    if (rule.min_margin != null) margin = Math.max(margin, rule.min_margin);
    if (rule.max_margin != null) margin = Math.min(margin, rule.max_margin);
    return { margin, appliedRule: rule };
  }

  return { margin: baseMargin, appliedRule: null };
}
