import { describe, expect, it, beforeEach } from "vitest";
import { getOrderProofs, addOrderProof } from "@/lib/orderEnhancements";
import type { PaymentProof } from "@/lib/orderEnhancements";

const makeProof = (overrides: Partial<PaymentProof> = {}): PaymentProof => ({
  orderId: "ord-1",
  type: "transferencia",
  amount: 50000,
  date: "2026-03-01",
  filePath: "user-1/ord-1/proof.pdf",
  publicUrl: "https://storage.example.com/proof.pdf",
  uploadedAt: "2026-03-01T10:00:00.000Z",
  ...overrides,
});

describe("getOrderProofs", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns empty array when no proofs exist", () => {
    expect(getOrderProofs("ord-999")).toEqual([]);
  });

  it("returns empty array for unknown order even if other orders have proofs", () => {
    addOrderProof("ord-1", makeProof());
    expect(getOrderProofs("ord-999")).toEqual([]);
  });
});

describe("addOrderProof", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("stores a proof and retrieves it", () => {
    const proof = makeProof();
    addOrderProof("ord-1", proof);
    const proofs = getOrderProofs("ord-1");
    expect(proofs).toHaveLength(1);
    expect(proofs[0].type).toBe("transferencia");
    expect(proofs[0].amount).toBe(50000);
  });

  it("prepends new proofs (most recent first)", () => {
    const first = makeProof({ amount: 10000, uploadedAt: "2026-03-01T10:00:00.000Z" });
    const second = makeProof({ amount: 20000, uploadedAt: "2026-03-02T10:00:00.000Z" });
    addOrderProof("ord-1", first);
    addOrderProof("ord-1", second);
    const proofs = getOrderProofs("ord-1");
    expect(proofs).toHaveLength(2);
    expect(proofs[0].amount).toBe(20000); // most recent first
    expect(proofs[1].amount).toBe(10000);
  });

  it("stores proofs for different orders independently", () => {
    addOrderProof("ord-1", makeProof({ orderId: "ord-1", amount: 100 }));
    addOrderProof("ord-2", makeProof({ orderId: "ord-2", amount: 200 }));
    expect(getOrderProofs("ord-1")).toHaveLength(1);
    expect(getOrderProofs("ord-2")).toHaveLength(1);
    expect(getOrderProofs("ord-1")[0].amount).toBe(100);
    expect(getOrderProofs("ord-2")[0].amount).toBe(200);
  });

  it("handles echeq proof type", () => {
    const proof = makeProof({ type: "echeq", amount: 250000 });
    addOrderProof("ord-1", proof);
    expect(getOrderProofs("ord-1")[0].type).toBe("echeq");
  });

  it("survives corrupted localStorage gracefully", () => {
    localStorage.setItem("b2b_order_payment_proofs", "{{invalid json}}");
    // Should not throw — falls back to empty map
    expect(() => getOrderProofs("ord-1")).not.toThrow();
    expect(getOrderProofs("ord-1")).toEqual([]);
  });
});
