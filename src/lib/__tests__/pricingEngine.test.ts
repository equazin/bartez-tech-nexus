import { describe, it, expect } from "vitest";
import { resolveMarginWithContext, applyPricingRules } from "../pricingEngine";
import type { Product } from "@/models/products";
import type { PricingRule } from "@/models/pricingRule";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 1,
    name: "Test Product",
    description: "",
    image: "",
    cost_price: 100,
    category: "notebooks",
    stock: 10,
    sku: "SKU-001",
    supplier_id: 42,
    supplier_name: "Dell",
    tags: ["enterprise"],
    ...overrides,
  };
}

function makeRule(overrides: Partial<PricingRule> = {}): PricingRule {
  return {
    id: "rule-1",
    condition_type: "category",
    condition_value: "notebooks",
    fixed_markup: null,
    min_margin: null,
    max_margin: null,
    priority: 1,
    active: true,
    quantity_breaks: [],
    ...overrides,
  };
}

// ── resolveMarginWithContext ──────────────────────────────────────────────────

describe("resolveMarginWithContext", () => {
  it("returns baseMargin when no rules match", () => {
    const product = makeProduct({ category: "servers" });
    const rules: PricingRule[] = [makeRule({ condition_value: "notebooks" })];
    const { margin } = resolveMarginWithContext(product, rules, 20);
    expect(margin).toBe(20);
  });

  it("applies fixed_markup from a matching category rule", () => {
    const product = makeProduct({ category: "notebooks" });
    const rules = [makeRule({ fixed_markup: 30, condition_value: "notebooks" })];
    const { margin } = resolveMarginWithContext(product, rules, 20);
    expect(margin).toBe(30);
  });

  it("applies min_margin from a matching rule", () => {
    const product = makeProduct({ category: "notebooks" });
    const rules = [makeRule({ min_margin: 15, condition_value: "notebooks" })];
    const { margin } = resolveMarginWithContext(product, rules, 20);
    expect(margin).toBe(15);
  });

  it("product rule wins over category rule (higher TYPE_PRIORITY)", () => {
    const product = makeProduct({ id: 7, category: "notebooks" });
    const rules = [
      makeRule({ id: "cat-rule", condition_type: "category", condition_value: "notebooks", fixed_markup: 25, priority: 1 }),
      makeRule({ id: "prod-rule", condition_type: "product", condition_value: "7", fixed_markup: 10, priority: 1 }),
    ];
    const { margin, appliedRule } = resolveMarginWithContext(product, rules, 20);
    expect(margin).toBe(10);
    expect(appliedRule?.id).toBe("prod-rule");
  });

  it("client rule wins over category rule (higher TYPE_PRIORITY)", () => {
    const product = makeProduct({ category: "notebooks" });
    const rules = [
      makeRule({ id: "cat-rule", condition_type: "category", condition_value: "notebooks", fixed_markup: 25, priority: 1 }),
      makeRule({ id: "client-rule", condition_type: "client", condition_value: "client-abc", fixed_markup: 12, priority: 1 }),
    ];
    const { margin } = resolveMarginWithContext(product, rules, 20, "client-abc");
    expect(margin).toBe(12);
  });

  it("higher record priority wins over same type rule", () => {
    const product = makeProduct({ category: "notebooks" });
    const rules = [
      makeRule({ id: "low", condition_value: "notebooks", fixed_markup: 25, priority: 1 }),
      makeRule({ id: "high", condition_value: "notebooks", fixed_markup: 15, priority: 5 }),
    ];
    const { margin, appliedRule } = resolveMarginWithContext(product, rules, 20);
    expect(margin).toBe(15);
    expect(appliedRule?.id).toBe("high");
  });

  it("inactive rules are ignored", () => {
    const product = makeProduct({ category: "notebooks" });
    const rules = [makeRule({ fixed_markup: 5, active: false })];
    const { margin } = resolveMarginWithContext(product, rules, 20);
    expect(margin).toBe(20);
  });

  it("matches supplier by supplier_name", () => {
    const product = makeProduct({ supplier_name: "dell" });
    const rules = [makeRule({ condition_type: "supplier", condition_value: "dell", fixed_markup: 18 })];
    const { margin } = resolveMarginWithContext(product, rules, 20);
    expect(margin).toBe(18);
  });

  it("matches tag rule", () => {
    const product = makeProduct({ tags: ["enterprise", "server"] });
    const rules = [makeRule({ condition_type: "tag", condition_value: "enterprise", fixed_markup: 22 })];
    const { margin } = resolveMarginWithContext(product, rules, 20);
    expect(margin).toBe(22);
  });

  it("matches sku_prefix rule", () => {
    const product = makeProduct({ sku: "DELL-NB-001" });
    const rules = [makeRule({ condition_type: "sku_prefix", condition_value: "DELL", fixed_markup: 17 })];
    const { margin } = resolveMarginWithContext(product, rules, 20);
    expect(margin).toBe(17);
  });

  it("returns isVolumePricing=false when no quantity breaks apply", () => {
    const product = makeProduct();
    const rules = [makeRule({ fixed_markup: 20 })];
    const { isVolumePricing } = resolveMarginWithContext(product, rules, 20, undefined, 5);
    expect(isVolumePricing).toBe(false);
  });

  it("applies quantity break margin when quantity threshold is met", () => {
    const product = makeProduct({ category: "notebooks" });
    const rules = [
      makeRule({
        fixed_markup: 20,
        quantity_breaks: [
          { min: 1,  max: 9,  margin: 20 },
          { min: 10, max: null, margin: 12 },
        ],
      }),
    ];
    const { margin, isVolumePricing } = resolveMarginWithContext(product, rules, 20, undefined, 10);
    expect(margin).toBe(12);
    expect(isVolumePricing).toBe(true);
  });

  it("does NOT apply quantity break when quantity is below threshold", () => {
    const product = makeProduct({ category: "notebooks" });
    const rules = [
      makeRule({
        fixed_markup: 20,
        quantity_breaks: [{ min: 10, max: null, margin: 12 }],
      }),
    ];
    const { margin, isVolumePricing } = resolveMarginWithContext(product, rules, 20, undefined, 5);
    expect(margin).toBe(20);
    expect(isVolumePricing).toBe(false);
  });

  it("returns appliedRule=null when no rule matches", () => {
    const product = makeProduct({ category: "other" });
    const { appliedRule } = resolveMarginWithContext(product, [], 20);
    expect(appliedRule).toBeNull();
  });
});

// ── applyPricingRules (backward compat) ──────────────────────────────────────

describe("applyPricingRules", () => {
  it("returns baseMargin when no rules", () => {
    expect(applyPricingRules(makeProduct(), [], 25)).toBe(25);
  });

  it("applies first matching rule", () => {
    const product = makeProduct({ category: "notebooks" });
    const rules = [makeRule({ fixed_markup: 18 })];
    expect(applyPricingRules(product, rules, 25)).toBe(18);
  });
});
