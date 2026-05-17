import { describe, expect, it } from "vitest";
import {
  INVID_FIXED_COST_USD,
  applyInvidFixedCostUsd,
  getAvailableStock,
  getEffectiveCostPrice,
  getNextTier,
  getUnitPrice,
  hasInvidFixedCostApplied,
  isInvidProduct,
} from "@/lib/pricing";
import type { Product } from "@/models/products";

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 1,
    name: "Producto demo",
    description: "",
    image: "",
    cost_price: 100,
    category: "Generico",
    stock: 10,
    sku: "DEMO-001",
    ...overrides,
  };
}

describe("getUnitPrice", () => {
  it("returns the base cost when no tiers are defined", () => {
    const product = makeProduct({ cost_price: 100 });
    expect(getUnitPrice(product, 1)).toBe(100);
    expect(getUnitPrice(product, 50)).toBe(100);
  });

  it("uses the matching tier for the requested quantity", () => {
    const product = makeProduct({
      cost_price: 100,
      price_tiers: [
        { min: 1, max: 5, price: 100 },
        { min: 6, max: 11, price: 90 },
        { min: 12, max: null, price: 80 },
      ],
    });
    expect(getUnitPrice(product, 1)).toBe(100);
    expect(getUnitPrice(product, 5)).toBe(100);
    expect(getUnitPrice(product, 6)).toBe(90);
    expect(getUnitPrice(product, 11)).toBe(90);
    expect(getUnitPrice(product, 12)).toBe(80);
    expect(getUnitPrice(product, 9999)).toBe(80);
  });

  it("falls back to base cost if no tier matches (quantity below first tier)", () => {
    const product = makeProduct({
      cost_price: 100,
      price_tiers: [{ min: 5, max: null, price: 80 }],
    });
    expect(getUnitPrice(product, 1)).toBe(100);
    expect(getUnitPrice(product, 5)).toBe(80);
  });

  it("treats unsorted tier arrays the same as sorted ones", () => {
    const product = makeProduct({
      cost_price: 100,
      price_tiers: [
        { min: 12, max: null, price: 80 },
        { min: 1, max: 5, price: 100 },
        { min: 6, max: 11, price: 90 },
      ],
    });
    expect(getUnitPrice(product, 7)).toBe(90);
    expect(getUnitPrice(product, 20)).toBe(80);
  });

  it("treats nullish cost_price as 0", () => {
    const product = makeProduct({ cost_price: undefined as unknown as number });
    expect(getUnitPrice(product, 1)).toBe(0);
  });
});

describe("getNextTier", () => {
  it("returns the next higher tier above current quantity", () => {
    const product = makeProduct({
      cost_price: 100,
      price_tiers: [
        { min: 1, max: 5, price: 100 },
        { min: 6, max: 11, price: 90 },
        { min: 12, max: null, price: 80 },
      ],
    });
    expect(getNextTier(product, 1)?.min).toBe(6);
    expect(getNextTier(product, 6)?.min).toBe(12);
  });

  it("returns null when already at the highest tier", () => {
    const product = makeProduct({
      cost_price: 100,
      price_tiers: [
        { min: 1, max: 5, price: 100 },
        { min: 6, max: null, price: 90 },
      ],
    });
    expect(getNextTier(product, 6)).toBeNull();
    expect(getNextTier(product, 100)).toBeNull();
  });

  it("returns null when product has no tiers", () => {
    expect(getNextTier(makeProduct(), 1)).toBeNull();
  });
});

describe("getEffectiveCostPrice", () => {
  it("multiplies the tier price by the supplier multiplier", () => {
    const product = makeProduct({ cost_price: 100, supplier_multiplier: 1.2 });
    expect(getEffectiveCostPrice(product, 1)).toBeCloseTo(120, 5);
  });

  it("defaults to multiplier 1 when undefined", () => {
    const product = makeProduct({ cost_price: 100 });
    expect(getEffectiveCostPrice(product, 1)).toBe(100);
  });

  it("composes tier price with supplier multiplier", () => {
    const product = makeProduct({
      cost_price: 100,
      supplier_multiplier: 1.1,
      price_tiers: [
        { min: 1, max: 5, price: 100 },
        { min: 6, max: null, price: 80 },
      ],
    });
    expect(getEffectiveCostPrice(product, 6)).toBeCloseTo(88, 5);
  });
});

describe("INVID fixed cost", () => {
  it("detects INVID supplier from supplier_name", () => {
    expect(isInvidProduct({ supplier_name: "INVID Corp", specs: {} })).toBe(true);
    expect(isInvidProduct({ supplier_name: "invid s.a.", specs: {} })).toBe(true);
    expect(isInvidProduct({ supplier_name: "other", specs: {} })).toBe(false);
  });

  it("detects INVID supplier from specs.sync_supplier", () => {
    expect(isInvidProduct({ supplier_name: "other", specs: { sync_supplier: "INVID" } })).toBe(true);
  });

  it("recognises when the fixed cost has already been applied", () => {
    expect(hasInvidFixedCostApplied({ specs: { invid_extra_cost_applied: true } })).toBe(true);
    expect(hasInvidFixedCostApplied({ specs: { invid_extra_cost_applied: "true" } })).toBe(true);
    expect(hasInvidFixedCostApplied({ specs: { invid_extra_cost_applied: 1 } })).toBe(true);
    expect(hasInvidFixedCostApplied({ specs: { invid_extra_cost_applied: "1" } })).toBe(true);
    expect(hasInvidFixedCostApplied({ specs: {} })).toBe(false);
    expect(hasInvidFixedCostApplied({ specs: { invid_extra_cost_applied: false } })).toBe(false);
  });

  it("adds INVID_FIXED_COST_USD via helper", () => {
    expect(applyInvidFixedCostUsd(100)).toBe(100 + INVID_FIXED_COST_USD);
  });

  it("applies the INVID fixed cost only when applicable", () => {
    const invidPending = makeProduct({ supplier_name: "INVID", cost_price: 100 });
    expect(getUnitPrice(invidPending, 1)).toBe(100 + INVID_FIXED_COST_USD);

    const invidAlreadyApplied = makeProduct({
      supplier_name: "INVID",
      cost_price: 100,
      specs: { invid_extra_cost_applied: true },
    });
    expect(getUnitPrice(invidAlreadyApplied, 1)).toBe(100);

    const nonInvid = makeProduct({ supplier_name: "AIR", cost_price: 100 });
    expect(getUnitPrice(nonInvid, 1)).toBe(100);
  });

  it("applies INVID fixed cost to tier price too", () => {
    const product = makeProduct({
      supplier_name: "INVID",
      cost_price: 100,
      price_tiers: [{ min: 5, max: null, price: 80 }],
    });
    expect(getUnitPrice(product, 5)).toBe(80 + INVID_FIXED_COST_USD);
  });
});

describe("getAvailableStock", () => {
  it("returns stock minus reserved", () => {
    expect(getAvailableStock(makeProduct({ stock: 10, stock_reserved: 3 }))).toBe(7);
  });

  it("treats missing stock_reserved as 0", () => {
    expect(getAvailableStock(makeProduct({ stock: 10 }))).toBe(10);
  });

  it("never returns a negative number", () => {
    expect(getAvailableStock(makeProduct({ stock: 2, stock_reserved: 10 }))).toBe(0);
  });
});
