import { describe, expect, it } from "vitest";
import { resolveMarginWithContext } from "@/lib/pricingEngine";
import type { Product } from "@/models/products";
import type { PricingRule } from "@/models/pricingRule";

const baseProduct: Product = {
  id: 101,
  name: "Switch 24p",
  description: "Switch gestionado",
  image: "",
  cost_price: 100,
  category: "Redes",
  stock: 8,
  sku: "SW-24",
  supplier_id: 10,
  supplier_name: "AIR",
  tags: ["switch", "redes"],
};

const baseRule: PricingRule = {
  id: "rule-1",
  name: "Regla categoria",
  condition_type: "category",
  condition_value: "Redes",
  min_margin: 18,
  max_margin: null,
  fixed_markup: null,
  priority: 1,
  active: true,
  quantity_breaks: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe("resolveMarginWithContext", () => {
  it("uses the highest priority matching rule", () => {
    const result = resolveMarginWithContext(
      baseProduct,
      [
        baseRule,
        {
          ...baseRule,
          id: "rule-2",
          name: "Regla producto",
          condition_type: "product",
          condition_value: String(baseProduct.id),
          fixed_markup: 25,
          min_margin: 0,
          priority: 5,
        },
      ],
      12,
      "client-1",
      2
    );

    expect(result.margin).toBe(25);
    expect(result.appliedRule?.id).toBe("rule-2");
  });

  it("applies volume pricing when quantity break matches", () => {
    const result = resolveMarginWithContext(
      baseProduct,
      [
        {
          ...baseRule,
          id: "rule-3",
          quantity_breaks: [
            { min: 1, margin: 20 },
            { min: 10, margin: 15 },
          ],
        },
      ],
      22,
      "client-1",
      10
    );

    expect(result.margin).toBe(15);
    expect(result.isVolumePricing).toBe(true);
  });
});
