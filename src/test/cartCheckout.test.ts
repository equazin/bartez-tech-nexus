import { beforeEach, describe, expect, it } from "vitest";
import {
  buildOrderNotes,
  clearCheckoutDraft,
  createEmptyOrderMeta,
  deleteCheckoutTemplate,
  getRecentShippingAddresses,
  parseInternalReferenceFromNotes,
  readCheckoutDraft,
  readCheckoutTemplates,
  rememberShippingAddress,
  saveCheckoutDraft,
  saveCheckoutTemplate,
  type CheckoutDraft,
  type CheckoutOrderMeta,
} from "@/lib/cartCheckout";

const USER_ID = "test-user";

function makeMeta(overrides: Partial<CheckoutOrderMeta> = {}): CheckoutOrderMeta {
  return { ...createEmptyOrderMeta(), ...overrides };
}

function makeDraft(overrides: Partial<CheckoutDraft> = {}): CheckoutDraft {
  return {
    cart: { 1: 2 },
    resellerMode: false,
    resellerMargin: 0,
    paymentMethod: "transferencia",
    echeqTermDays: 30,
    currentAccountSharePct: 100,
    shippingType: "retiro",
    shippingAddress: "",
    shippingTransport: "andreani",
    shippingCost: "",
    postalCode: "",
    notes: "",
    orderMeta: createEmptyOrderMeta(),
    savedAt: "",
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("buildOrderNotes", () => {
  it("returns base notes only when meta is empty", () => {
    const result = buildOrderNotes("Cliente prefiere caja x 6", createEmptyOrderMeta());
    expect(result).toBe("Cliente prefiere caja x 6");
  });

  it("returns empty string when nothing is provided", () => {
    expect(buildOrderNotes("", createEmptyOrderMeta())).toBe("");
  });

  it("joins base, operational, commercial and approval sections", () => {
    const meta = makeMeta({
      internalReference: "OC-1234",
      branchName: "Sucursal Norte",
      receiverContact: "Juan / 11-5555",
      requestedDate: "2026-06-01",
      finalClientName: "ACME",
      commercialMessage: "Pago contra remito.",
      approvalReason: "Tabla excedida.",
    });
    const notes = buildOrderNotes("Entregar antes del viernes", meta);
    expect(notes).toContain("Entregar antes del viernes");
    expect(notes).toContain("Datos operativos:");
    expect(notes).toContain("- Referencia / OC: OC-1234");
    expect(notes).toContain("- Sucursal / destino: Sucursal Norte");
    expect(notes).toContain("- Contacto de recepción: Juan / 11-5555");
    expect(notes).toContain("- Fecha requerida: 2026-06-01");
    expect(notes).toContain("- Cliente final: ACME");
    expect(notes).toContain("Mensaje comercial:\nPago contra remito.");
    expect(notes).toContain("Motivo de revisión / excepción:\nTabla excedida.");
    expect(notes.split("\n\n").length).toBe(4);
  });

  it("trims whitespace-only base notes", () => {
    const notes = buildOrderNotes("   ", makeMeta({ internalReference: "OC-1" }));
    expect(notes.startsWith("Datos operativos")).toBe(true);
  });
});

describe("parseInternalReferenceFromNotes", () => {
  it("extracts the PO from structured notes", () => {
    const built = buildOrderNotes("", makeMeta({ internalReference: "PO-2025-09" }));
    expect(parseInternalReferenceFromNotes(built)).toBe("PO-2025-09");
  });

  it("handles case-insensitive matches", () => {
    expect(parseInternalReferenceFromNotes("REFERENCIA / OC: ABC-123")).toBe("ABC-123");
  });

  it("returns undefined when no reference is present", () => {
    expect(parseInternalReferenceFromNotes("solo una nota libre")).toBeUndefined();
    expect(parseInternalReferenceFromNotes("")).toBeUndefined();
  });
});

describe("checkout draft persistence", () => {
  it("returns null when no draft is stored", () => {
    expect(readCheckoutDraft(USER_ID)).toBeNull();
  });

  it("saves and restores a draft, stamping savedAt", () => {
    const saved = saveCheckoutDraft(USER_ID, makeDraft({ savedAt: "old" }));
    expect(saved.savedAt).not.toBe("old");
    expect(saved.savedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const restored = readCheckoutDraft(USER_ID);
    expect(restored?.cart).toEqual({ 1: 2 });
    expect(restored?.orderMeta.quoteValidityDays).toBe(15);
  });

  it("hydrates missing orderMeta fields from defaults", () => {
    localStorage.setItem(
      "b2b_checkout_draft_" + USER_ID,
      JSON.stringify({ cart: {}, orderMeta: { internalReference: "X" } }),
    );
    const restored = readCheckoutDraft(USER_ID);
    expect(restored?.orderMeta.internalReference).toBe("X");
    expect(restored?.orderMeta.quoteValidityDays).toBe(15);
    expect(restored?.orderMeta.commercialMessage).toBe("");
  });

  it("returns null when the stored draft is malformed JSON", () => {
    localStorage.setItem("b2b_checkout_draft_" + USER_ID, "{not-json");
    expect(readCheckoutDraft(USER_ID)).toBeNull();
  });

  it("clears the draft from storage", () => {
    saveCheckoutDraft(USER_ID, makeDraft());
    clearCheckoutDraft(USER_ID);
    expect(readCheckoutDraft(USER_ID)).toBeNull();
  });
});

describe("recent shipping addresses", () => {
  it("returns [] when none stored", () => {
    expect(getRecentShippingAddresses(USER_ID)).toEqual([]);
  });

  it("prepends new addresses and dedupes", () => {
    rememberShippingAddress(USER_ID, "Av. Siempre Viva 742");
    rememberShippingAddress(USER_ID, "Calle Falsa 123");
    const result = rememberShippingAddress(USER_ID, "Av. Siempre Viva 742");
    expect(result).toEqual(["Av. Siempre Viva 742", "Calle Falsa 123"]);
  });

  it("caps the list at 5 entries", () => {
    for (let i = 1; i <= 7; i++) rememberShippingAddress(USER_ID, `Direccion ${i}`);
    const stored = getRecentShippingAddresses(USER_ID);
    expect(stored).toHaveLength(5);
    expect(stored[0]).toBe("Direccion 7");
  });

  it("ignores blank addresses", () => {
    rememberShippingAddress(USER_ID, "Calle Falsa 123");
    const result = rememberShippingAddress(USER_ID, "   ");
    expect(result).toEqual(["Calle Falsa 123"]);
  });
});

describe("checkout templates", () => {
  it("starts empty", () => {
    expect(readCheckoutTemplates(USER_ID)).toEqual([]);
  });

  it("saves templates capped at 12 entries", () => {
    for (let i = 0; i < 15; i++) {
      saveCheckoutTemplate(USER_ID, {
        name: `Plantilla ${i}`,
        clientType: "cliente",
        branchName: "General",
        paymentMethod: "transferencia",
        shippingType: "retiro",
        shippingTransport: "andreani",
        cart: { [i + 1]: 1 },
        notes: "",
        orderMeta: createEmptyOrderMeta(),
      });
    }
    const stored = readCheckoutTemplates(USER_ID);
    expect(stored).toHaveLength(12);
    expect(stored[0].name).toBe("Plantilla 14");
  });

  it("deletes by id", () => {
    const after = saveCheckoutTemplate(USER_ID, {
      name: "A",
      clientType: "cliente",
      branchName: "General",
      paymentMethod: "transferencia",
      shippingType: "retiro",
      shippingTransport: "andreani",
      cart: {},
      notes: "",
      orderMeta: createEmptyOrderMeta(),
    });
    const id = after[0].id;
    const next = deleteCheckoutTemplate(USER_ID, id);
    expect(next.find((t) => t.id === id)).toBeUndefined();
  });
});
