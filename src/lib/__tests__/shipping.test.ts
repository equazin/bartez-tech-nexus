import { describe, expect, it } from "vitest";
import { estimateShipping } from "@/lib/shipping";
import type { ShippingItem } from "@/lib/shipping";

const RATE = 1300; // ARS per USD

const singleItem: ShippingItem[] = [{ weight_kg: 1, quantity: 1 }];

describe("estimateShipping", () => {
  it("returns both andreani and oca estimates", () => {
    const estimates = estimateShipping(singleItem, "1000", RATE);
    const carriers = estimates.map((e) => e.carrier);
    expect(carriers).toContain("andreani");
    expect(carriers).toContain("oca");
  });

  it("OCA is cheaper than Andreani", () => {
    const estimates = estimateShipping(singleItem, "1000", RATE);
    const andreani = estimates.find((e) => e.carrier === "andreani")!;
    const oca = estimates.find((e) => e.carrier === "oca")!;
    expect(oca.price_ars).toBeLessThan(andreani.price_ars);
  });

  it("Zone 1 (GBA/CABA 1xxx) is cheaper than Zone 2 (interior)", () => {
    const gba = estimateShipping(singleItem, "1050", RATE);
    const interior = estimateShipping(singleItem, "5000", RATE);
    const gbaAndreani = gba.find((e) => e.carrier === "andreani")!;
    const intAndreani = interior.find((e) => e.carrier === "andreani")!;
    expect(gbaAndreani.price_ars).toBeLessThan(intAndreani.price_ars);
  });

  it("Zone 3 (Patagonia 8xxx+) is the most expensive", () => {
    const interior = estimateShipping(singleItem, "5000", RATE);
    const patagonia = estimateShipping(singleItem, "8400", RATE);
    const intAndreani = interior.find((e) => e.carrier === "andreani")!;
    const patAndreani = patagonia.find((e) => e.carrier === "andreani")!;
    expect(patAndreani.price_ars).toBeGreaterThan(intAndreani.price_ars);
  });

  it("heavier shipments cost more", () => {
    const light = estimateShipping([{ weight_kg: 0.5, quantity: 1 }], "1000", RATE);
    const heavy = estimateShipping([{ weight_kg: 10, quantity: 1 }], "1000", RATE);
    const lightPrice = light.find((e) => e.carrier === "andreani")!.price_ars;
    const heavyPrice = heavy.find((e) => e.carrier === "andreani")!.price_ars;
    expect(heavyPrice).toBeGreaterThan(lightPrice);
  });

  it("aggregates weight across multiple items", () => {
    const single = estimateShipping([{ weight_kg: 5, quantity: 1 }], "1000", RATE);
    const multi = estimateShipping(
      [{ weight_kg: 2, quantity: 1 }, { weight_kg: 3, quantity: 1 }],
      "1000",
      RATE
    );
    const singlePrice = single.find((e) => e.carrier === "andreani")!.price_ars;
    const multiPrice = multi.find((e) => e.carrier === "andreani")!.price_ars;
    expect(multiPrice).toBe(singlePrice);
  });

  it("uses 0.5 kg per unit when weight_kg=0", () => {
    const withZeroWeight = estimateShipping([{ weight_kg: 0, quantity: 2 }], "1000", RATE);
    const withActualWeight = estimateShipping([{ weight_kg: 1, quantity: 1 }], "1000", RATE);
    // 0 weight × 2 qty = 0.5×2=1kg, should match 1 item at 1kg
    expect(withZeroWeight.find((e) => e.carrier === "andreani")!.price_ars).toBe(
      withActualWeight.find((e) => e.carrier === "andreani")!.price_ars
    );
  });

  it("converts ARS to USD using exchange rate", () => {
    const estimates = estimateShipping(singleItem, "1000", 1300);
    const andreani = estimates.find((e) => e.carrier === "andreani")!;
    expect(andreani.price_usd).toBeCloseTo(andreani.price_ars / 1300, 2);
  });

  it("returns 0 USD price when exchange rate is 0", () => {
    const estimates = estimateShipping(singleItem, "1000", 0);
    for (const e of estimates) {
      expect(e.price_usd).toBe(0);
    }
  });

  it("bonifies shipping for orders from USD 800", () => {
    const estimates = estimateShipping(singleItem, "1000", RATE, 800);
    for (const e of estimates) {
      expect(e.price_ars).toBe(0);
      expect(e.price_usd).toBe(0);
      expect(e.notes).toBeTruthy();
    }
  });

  it("keeps normal shipping below USD 800", () => {
    const estimates = estimateShipping(singleItem, "1000", RATE, 799);
    for (const e of estimates) {
      expect(e.price_ars).toBeGreaterThan(0);
      expect(e.price_usd).toBeGreaterThan(0);
      expect(e.notes).toBeUndefined();
    }
  });

  it("GBA delivery window is 1-2 days for Andreani", () => {
    const estimates = estimateShipping(singleItem, "1200", RATE);
    const andreani = estimates.find((e) => e.carrier === "andreani")!;
    expect(andreani.days_min).toBe(1);
    expect(andreani.days_max).toBe(2);
  });
});
