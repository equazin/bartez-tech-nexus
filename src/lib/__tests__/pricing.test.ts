import { describe, expect, it } from "vitest";
import {
  getUnitPrice,
  getEffectiveCostPrice,
  getAvailableStock,
  getNextTier,
} from "@/lib/pricing";
import type { Product } from "@/models/products";

const base: Product = {
  id: 1,
  name: "Test Product",
  description: "",
  image: "",
  cost_price: 100,
  category: "Test",
  stock: 10,
  sku: "TEST-01",
  supplier_id: 1,
};

describe("getUnitPrice", () => {
  it("returns cost_price when no price_tiers", () => {
    expect(getUnitPrice(base, 1)).toBe(100);
    expect(getUnitPrice(base, 50)).toBe(100);
  });

  it("returns cost_price when tiers array is empty", () => {
    const p = { ...base, price_tiers: [] };
    expect(getUnitPrice(p, 5)).toBe(100);
  });

  it("returns the matching tier price for exact min quantity", () => {
    const p = {
      ...base,
      price_tiers: [
        { min: 1, max: 9, price: 100 },
        { min: 10, max: null, price: 80 },
      ],
    };
    expect(getUnitPrice(p, 10)).toBe(80);
    expect(getUnitPrice(p, 15)).toBe(80);
  });

  it("falls back to cost_price when quantity is below all tier minimums", () => {
    const p = {
      ...base,
      price_tiers: [{ min: 5, max: null, price: 90 }],
    };
    // quantity=2 < min=5 → no tier applies → cost_price
    expect(getUnitPrice(p, 2)).toBe(100);
  });

  it("picks the highest applicable tier when multiple match", () => {
    const p = {
      ...base,
      price_tiers: [
        { min: 1, max: null, price: 95 },
        { min: 5, max: null, price: 90 },
        { min: 20, max: null, price: 80 },
      ],
    };
    expect(getUnitPrice(p, 1)).toBe(95);
    expect(getUnitPrice(p, 6)).toBe(90);
    expect(getUnitPrice(p, 25)).toBe(80);
  });
});

describe("getEffectiveCostPrice", () => {
  it("returns cost_price when no supplier_multiplier", () => {
    expect(getEffectiveCostPrice(base, 1)).toBe(100);
  });

  it("multiplies by supplier_multiplier", () => {
    const p = { ...base, supplier_multiplier: 1.5 };
    expect(getEffectiveCostPrice(p, 1)).toBe(150);
  });

  it("applies multiplier after tier price", () => {
    const p = {
      ...base,
      supplier_multiplier: 1.2,
      price_tiers: [{ min: 10, max: null, price: 80 }],
    };
    expect(getEffectiveCostPrice(p, 10)).toBeCloseTo(96);
  });

  it("supplier_multiplier=1 is a no-op", () => {
    const p = { ...base, supplier_multiplier: 1 };
    expect(getEffectiveCostPrice(p, 1)).toBe(100);
  });
});

describe("getAvailableStock", () => {
  it("returns stock when no reservation", () => {
    expect(getAvailableStock(base)).toBe(10);
  });

  it("returns stock minus reserved", () => {
    const p = { ...base, stock: 10, stock_reserved: 3 };
    expect(getAvailableStock(p)).toBe(7);
  });

  it("never returns negative stock", () => {
    const p = { ...base, stock: 5, stock_reserved: 8 };
    expect(getAvailableStock(p)).toBe(0);
  });

  it("treats null stock_reserved as 0", () => {
    const p = { ...base, stock: 10, stock_reserved: undefined };
    expect(getAvailableStock(p)).toBe(10);
  });
});

describe("getNextTier", () => {
  it("returns null when no price_tiers", () => {
    expect(getNextTier(base, 5)).toBeNull();
  });

  it("returns null when no higher tier exists", () => {
    const p = {
      ...base,
      price_tiers: [{ min: 1, max: null, price: 90 }],
    };
    expect(getNextTier(p, 10)).toBeNull();
  });

  it("returns the next tier above current quantity", () => {
    const p = {
      ...base,
      price_tiers: [
        { min: 1, max: null, price: 100 },
        { min: 10, max: null, price: 80 },
        { min: 50, max: null, price: 65 },
      ],
    };
    // At qty=5, next tier is min=10
    const next = getNextTier(p, 5);
    expect(next?.min).toBe(10);
    expect(next?.price).toBe(80);
  });

  it("returns the immediately next tier, not the highest", () => {
    const p = {
      ...base,
      price_tiers: [
        { min: 10, max: null, price: 80 },
        { min: 50, max: null, price: 65 },
      ],
    };
    // At qty=15 (past first tier), next is min=50
    const next = getNextTier(p, 15);
    expect(next?.min).toBe(50);
  });
});
