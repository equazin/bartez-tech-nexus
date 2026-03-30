import { describe, expect, it } from "vitest";
import {
  buildCommercialAlerts,
  buildCommercialStories,
  buildCommercialTimeline,
} from "@/lib/commercialOps";
import { buildDebtAgingReport } from "@/lib/businessReporting";
import { getEffectiveInvoiceAmounts } from "@/lib/money";

describe("platform smoke", () => {
  it("handles a new client with no sales history", () => {
    const stories = buildCommercialStories({
      orders: [],
      quotes: [],
      invoices: [],
      payments: [],
      clientMap: { "client-new": "Cliente Nuevo" },
    });

    expect(stories).toEqual([]);
  });

  it("flags client with exhausted credit", () => {
    const alerts = buildCommercialAlerts({
      orders: [],
      invoices: [],
      products: [],
      profiles: [
        {
          id: "client-risk",
          company_name: "Cliente Riesgo",
          credit_limit: 1000000,
          credit_used: 980000,
        },
      ],
      now: new Date("2026-03-29T10:00:00.000Z"),
    });

    expect(alerts.some((alert) => alert.type === "credit" && alert.severity === "high")).toBe(true);
  });

  it("flags pending order requiring commercial review follow-up", () => {
    const alerts = buildCommercialAlerts({
      orders: [
        {
          id: "ord-review",
          client_id: "client-1",
          total: 250000,
          status: "pending",
          created_at: "2026-03-25T10:00:00.000Z",
        },
      ],
      invoices: [],
      products: [],
      profiles: [],
      now: new Date("2026-03-29T10:00:00.000Z"),
    });

    expect(alerts.some((alert) => alert.type === "order_delay")).toBe(true);
  });

  it("normalizes ARS and USD invoices consistently", () => {
    const arsInvoice = {
      id: "ars-smoke",
      client_id: "client-1",
      invoice_number: "FAC-ARS",
      status: "sent",
      subtotal: 100,
      iva_total: 21,
      total: 121,
      currency: "ARS" as const,
      exchange_rate: undefined,
      created_at: "2026-03-20T10:00:00.000Z",
      due_date: "2026-03-26T10:00:00.000Z",
    };
    const usdInvoice = {
      id: "usd-smoke",
      client_id: "client-1",
      invoice_number: "FAC-USD",
      status: "overdue",
      subtotal: 100,
      iva_total: 21,
      total: 121,
      currency: "USD" as const,
      exchange_rate: 1300,
      created_at: "2026-03-20T10:00:00.000Z",
      due_date: "2026-03-24T10:00:00.000Z",
    };

    const effectiveArs = getEffectiveInvoiceAmounts(arsInvoice as never, 1300);
    expect(effectiveArs.total).toBe(157300);

    const aging = buildDebtAgingReport(
      [arsInvoice, usdInvoice],
      "ARS",
      1300,
      new Date("2026-03-29T10:00:00.000Z")
    );
    expect(aging.some((bucket) => bucket.count > 0)).toBe(true);
  });

  it("adds reported payments to story balance", () => {
    const stories = buildCommercialStories({
      orders: [
        {
          id: 5,
          client_id: "client-1",
          total: 200000,
          status: "dispatched",
          created_at: "2026-03-20T10:00:00.000Z",
          order_number: "ORD-0005",
          numero_remito: "REM-0005",
        },
      ],
      quotes: [],
      invoices: [
        {
          id: "inv-5",
          client_id: "client-1",
          total: 200000,
          status: "sent",
          created_at: "2026-03-21T10:00:00.000Z",
          invoice_number: "FAC-0005",
          order_id: 5,
        },
      ],
      payments: [
        {
          id: "pay-5",
          client_id: "client-1",
          monto: -50000,
          fecha: "2026-03-22T10:00:00.000Z",
          descripcion: "Pago reportado por cliente",
          reference_id: "inv-5",
        },
      ],
      clientMap: { "client-1": "Cliente Uno" },
    });

    expect(stories).toHaveLength(1);
    expect(stories[0].paidAmount).toBe(50000);
    expect(stories[0].balance).toBe(150000);
  });

  it("includes remito in document timeline", () => {
    const stories = buildCommercialStories({
      orders: [
        {
          id: "ord-rem",
          client_id: "client-2",
          total: 120000,
          status: "dispatched",
          created_at: "2026-03-20T10:00:00.000Z",
          order_number: "ORD-REM",
          numero_remito: "REM-123",
        },
      ],
      quotes: [],
      invoices: [],
      payments: [],
      clientMap: { "client-2": "Cliente Dos" },
    });

    const timeline = buildCommercialTimeline(stories[0]);
    expect(timeline.some((entry) => entry.type === "shipment" && entry.label === "REM-123")).toBe(true);
  });
});
