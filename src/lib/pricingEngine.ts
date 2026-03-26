import type { Product } from "@/models/products";
import type { PricingRule, QuantityBreak } from "@/models/pricingRule";

/**
 * Type priority order (higher index = evaluated later, lower index = wins first).
 * product > client > category > supplier/tag/sku_prefix
 */
const TYPE_PRIORITY: Record<string, number> = {
  product:    4,
  client:     3,
  category:   2,
  supplier:   1,
  tag:        1,
  sku_prefix: 1,
};

function matchesRule(
  product: Product,
  rule: PricingRule,
  clientId?: string
): boolean {
  const val = rule.condition_value.toLowerCase().trim();

  switch (rule.condition_type) {
    case "product":
      return String(product.id) === val;

    case "client":
      return clientId != null && clientId.toLowerCase() === val;

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
 * Resolve the applicable margin from a list of quantity breaks.
 * Picks the break with the highest `min` that is still <= quantity.
 * Returns null if no break applies.
 */
function resolveQuantityBreak(
  breaks: QuantityBreak[],
  quantity: number
): number | null {
  const sorted = [...breaks].sort((a, b) => b.min - a.min);
  for (const b of sorted) {
    if (quantity >= b.min) return b.margin;
  }
  return null;
}

/**
 * Apply a single matching rule to a base margin, respecting quantity breaks.
 */
function applyRule(
  rule: PricingRule,
  baseMargin: number,
  quantity?: number
): number {
  // Volume pricing takes precedence when quantity is provided and breaks exist
  if (quantity != null && rule.quantity_breaks?.length) {
    const qMargin = resolveQuantityBreak(rule.quantity_breaks, quantity);
    if (qMargin != null) return qMargin;
  }

  if (rule.fixed_markup != null) return rule.fixed_markup;

  let margin = baseMargin;
  if (rule.min_margin != null) margin = Math.max(margin, rule.min_margin);
  if (rule.max_margin != null) margin = Math.min(margin, rule.max_margin);
  return margin;
}

/**
 * Resolve the effective margin for a product with full context.
 *
 * Priority (first match wins within type, then type priority):
 *   product rule > client rule > category rule > supplier/tag/sku_prefix > base
 *
 * @param product     The product being priced
 * @param rules       All active pricing rules
 * @param baseMargin  Fallback margin (client's default_margin)
 * @param clientId    Optional client UUID for client-specific rules
 * @param quantity    Optional order quantity for volume pricing
 */
export function resolveMarginWithContext(
  product: Product,
  rules: PricingRule[],
  baseMargin: number,
  clientId?: string,
  quantity?: number
): { margin: number; appliedRule: PricingRule | null; isVolumePricing: boolean } {
  const active = rules.filter((r) => r.active);

  // Group matching rules by type-priority bucket, then sort by rule.priority within
  let bestRule: PricingRule | null = null;
  let bestTypePriority = -1;
  let bestRulePriority = -1;

  for (const rule of active) {
    if (!matchesRule(product, rule, clientId)) continue;
    const tp = TYPE_PRIORITY[rule.condition_type] ?? 0;
    if (
      tp > bestTypePriority ||
      (tp === bestTypePriority && rule.priority > bestRulePriority)
    ) {
      bestTypePriority = tp;
      bestRulePriority = rule.priority;
      bestRule = rule;
    }
  }

  if (!bestRule) {
    return { margin: baseMargin, appliedRule: null, isVolumePricing: false };
  }

  const isVolumePricing =
    quantity != null &&
    (bestRule.quantity_breaks?.length ?? 0) > 0 &&
    resolveQuantityBreak(bestRule.quantity_breaks!, quantity) != null;

  return {
    margin: applyRule(bestRule, baseMargin, quantity),
    appliedRule: bestRule,
    isVolumePricing,
  };
}

/**
 * Simplified version — no client/quantity context.
 * Kept for backward compatibility with existing callers.
 */
export function applyPricingRules(
  product: Product,
  rules: PricingRule[],
  baseMargin: number
): number {
  return resolveMarginWithContext(product, rules, baseMargin).margin;
}

/**
 * Get effective margin + which rule was applied.
 * Legacy variant without client/quantity context.
 */
export function resolveMargin(
  product: Product,
  rules: PricingRule[],
  baseMargin: number
): { margin: number; appliedRule: PricingRule | null } {
  const { margin, appliedRule } = resolveMarginWithContext(product, rules, baseMargin);
  return { margin, appliedRule };
}
