import { describe, it, expect } from "vitest";
import { resolveMarginWithContext } from "./pricingEngine";
import { Product } from "@/models/products";
import { PricingRule } from "@/models/pricingRule";

describe("pricingEngine - resolveMarginWithContext", () => {
  const mockProduct: Product = {
    id: 1,
    name: "Test Product",
    category: "Computing",
    sku: "TEST-SKU",
    cost_price: 100,
    active: true,
    tags: ["premium", "new"],
    supplier_id: 10,
  } as any;

  const defaultMargin = 20;

  it("should return default margin when no rules match", () => {
    const result = resolveMarginWithContext(mockProduct, [], defaultMargin);
    expect(result.margin).toBe(20);
    expect(result.isVolumePricing).toBe(false);
  });

  it("should apply category rule", () => {
    const rules: PricingRule[] = [
      { id: "r1", name: "Cat Rule", condition_type: "category", condition_value: "Computing", min_margin: 25, priority: 1, active: true },
    ] as any;
    const result = resolveMarginWithContext(mockProduct, rules, defaultMargin);
    expect(result.margin).toBe(25);
  });

  it("should prioritize product rule over category rule", () => {
    const rules: PricingRule[] = [
      { id: "r1", name: "Cat Rule", condition_type: "category", condition_value: "Computing", min_margin: 25, priority: 1, active: true },
      { id: "r2", name: "Prod Rule", condition_type: "product", condition_value: "1", min_margin: 30, priority: 1, active: true },
    ] as any;
    const result = resolveMarginWithContext(mockProduct, rules, defaultMargin);
    expect(result.margin).toBe(30);
  });

  it("should respect priority field regardless of type", () => {
    const rules: PricingRule[] = [
      { id: "r1", name: "Cat High Priority", condition_type: "category", condition_value: "Computing", min_margin: 50, priority: 10, active: true },
      { id: "r2", name: "Prod Low Priority", condition_type: "product", condition_value: "1", min_margin: 30, priority: 1, active: true },
    ] as any;
    const result = resolveMarginWithContext(mockProduct, rules, defaultMargin);
    expect(result.margin).toBe(50);
  });

  it("should apply volume pricing if quantity is high enough", () => {
    const productWithTiers: Product = {
      ...mockProduct,
      price_tiers: [
        { min: 10, max: null, price: 80 }
      ]
    } as any;
    
    // cost is 100, tier is 80 (20% discount on cost)
    const result = resolveMarginWithContext(productWithTiers, [], defaultMargin, "user1", 10);
    expect(result.isVolumePricing).toBe(true);
    // When volume pricing is active, the engine returns the effective margin relative to the BASE cost
    // pricingEngine.ts: margin = ((cost - tierPrice) / cost) * 100
    // so ((100 - 80) / 100) * 100 = 20
    expect(result.margin).toBe(20);
  });

  it("should handle client-specific rules", () => {
    const userId = "user-123";
    const rules: PricingRule[] = [
      { id: "r1", name: "Client Rule", condition_type: "client", condition_value: userId, min_margin: 15, priority: 10, active: true },
    ] as any;
    const result = resolveMarginWithContext(mockProduct, rules, defaultMargin, userId);
    expect(result.margin).toBe(15);
  });
});
