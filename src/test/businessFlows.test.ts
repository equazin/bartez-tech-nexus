import { describe, expect, it } from "vitest";
import {
  buildCommercialAlerts,
  buildCommercialStories,
  buildCommercialTasks,
  buildCommercialTimeline,
} from "@/lib/commercialOps";
import {
  buildCategoryMarginReport,
  buildDebtAgingReport,
  buildReorderForecast,
} from "@/lib/businessReporting";
import { formatAccessNote, parseAccessNote } from "@/lib/clientAccess";
import { getEffectiveInvoiceAmounts } from "@/lib/money";

describe("business flows", () => {
  it("flags a client with exhausted credit and a delayed commercial review", () => {
    const now = new Date("2026-03-29T10:00:00.000Z");
    const alerts = buildCommercialAlerts({
      orders: [
        {
          id: "ord-9",
          client_id: "client-1",
          total: 850000,
          status: "pending",
          created_at: "2026-03-24T10:00:00.000Z",
        },
      ],
      invoices: [],
      profiles: [
        {
          id: "client-1",
          company_name: "Cliente Riesgo",
          credit_limit: 1000000,
          credit_used: 970000,
        },
      ],
      products: [],
      now,
    });

    expect(alerts.some((alert) => alert.type === "credit" && alert.severity === "high")).toBe(true);
    expect(alerts.some((alert) => alert.type === "order_delay")).toBe(true);
  });

  it("builds a full document story with payment and remito", () => {
    const stories = buildCommercialStories({
      orders: [
        {
          id: "5",
          client_id: "client-1",
          total: 140000,
          status: "dispatched",
          created_at: "2026-03-20T10:00:00.000Z",
          order_number: "ORD-0005",
          numero_remito: "REM-005",
          products: [{ name: "Switch", quantity: 2, cost_price: 40000, total_price: 140000 }],
        },
      ],
      quotes: [
        {
          id: 12,
          client_id: "client-1",
          total: 140000,
          status: "approved",
          created_at: "2026-03-19T10:00:00.000Z",
          order_id: "5",
        },
      ],
      invoices: [
        {
          id: "inv-5",
          client_id: "client-1",
          total: 140000,
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
          monto: -70000,
          fecha: "2026-03-22T10:00:00.000Z",
          descripcion: "Pago reportado",
          reference_id: "inv-5",
        },
      ],
      clientMap: { "client-1": "Cliente Uno" },
    });

    expect(stories).toHaveLength(1);
    expect(stories[0].stage).toBe("Facturado");
    expect(stories[0].balance).toBe(70000);

    const timeline = buildCommercialTimeline(stories[0]);
    expect(timeline.some((entry) => entry.type === "shipment" && entry.label === "REM-005")).toBe(true);
    expect(timeline.some((entry) => entry.type === "payment" && entry.label === "Pago reportado")).toBe(true);
  });

  it("normalizes invoices in ARS and USD for debt aging", () => {
    const arsInvoice = {
      id: "ars-1",
      client_id: "client-1",
      invoice_number: "FAC-ARS",
      status: "overdue",
      subtotal: 100,
      iva_total: 21,
      total: 121,
      currency: "ARS" as const,
      exchange_rate: undefined,
      created_at: "2026-03-01T10:00:00.000Z",
      due_date: "2026-03-10T10:00:00.000Z",
    };
    const usdInvoice = {
      id: "usd-1",
      client_id: "client-1",
      invoice_number: "FAC-USD",
      status: "sent",
      subtotal: 100,
      iva_total: 21,
      total: 121,
      currency: "USD" as const,
      exchange_rate: 1300,
      created_at: "2026-03-15T10:00:00.000Z",
      due_date: "2026-03-28T10:00:00.000Z",
    };

    const arsEffective = getEffectiveInvoiceAmounts(arsInvoice as never, 1300);
    expect(arsEffective.total).toBe(157300);
    expect(arsEffective.isLegacyPreview).toBe(true);

    const aging = buildDebtAgingReport([arsInvoice, usdInvoice], "ARS", 1300, new Date("2026-03-29T10:00:00.000Z"));
    expect(aging.find((bucket) => bucket.label === "16-30 días")?.amount).toBeGreaterThan(0);
    expect(aging.find((bucket) => bucket.label === "1-15 días")?.count).toBe(1);
  });

  it("creates actionable tasks for collection, review and dispatch", () => {
    const stories = buildCommercialStories({
      orders: [
        {
          id: "ord-1",
          client_id: "client-1",
          total: 500000,
          status: "approved",
          created_at: "2026-03-20T10:00:00.000Z",
          order_number: "ORD-1",
        },
      ],
      quotes: [
        {
          id: 99,
          client_id: "client-2",
          total: 120000,
          status: "sent",
          created_at: "2026-03-27T10:00:00.000Z",
        },
      ],
      invoices: [
        {
          id: "inv-overdue",
          client_id: "client-3",
          total: 90000,
          status: "overdue",
          created_at: "2026-03-10T10:00:00.000Z",
          invoice_number: "FAC-VENC",
        },
      ],
      payments: [],
      clientMap: { "client-1": "Cliente A", "client-2": "Cliente B", "client-3": "Cliente C" },
      now: new Date("2026-03-29T10:00:00.000Z"),
    });

    const tasks = buildCommercialTasks(stories, []);
    expect(tasks.some((task) => task.kind === "dispatch")).toBe(true);
    expect(tasks.some((task) => task.kind === "approval")).toBe(true);
    expect(tasks.some((task) => task.kind === "collection")).toBe(true);
  });

  it("builds category margin and reorder forecast reports", () => {
    const orders = [
      {
        id: "1",
        client_id: "client-1",
        total: 300000,
        status: "approved",
        created_at: "2026-03-25T10:00:00.000Z",
        products: [
          { product_id: 1, name: "Notebook", quantity: 2, total_price: 220000, cost_price: 80000, category: "Equipos" },
          { product_id: 2, name: "Router", quantity: 4, total_price: 80000, cost_price: 12000, category: "Redes" },
        ],
      },
    ];
    const products = [
      { id: 1, name: "Notebook", description: "", image: "", cost_price: 80000, category: "Equipos", stock: 3, stock_min: 2 },
      { id: 2, name: "Router", description: "", image: "", cost_price: 12000, category: "Redes", stock: 1, stock_min: 2 },
    ];

    const categories = buildCategoryMarginReport(orders as never, products as never);
    expect(categories[0].grossProfit).toBeGreaterThan(0);

    const forecast = buildReorderForecast(orders as never, products as never, new Date("2026-03-29T10:00:00.000Z"));
    expect(forecast.some((item) => item.productName === "Router" && item.suggestedReorder > 0)).toBe(true);
  });

  it("formats and parses delegated access records", () => {
    const body = formatAccessNote({
      fullName: "Ana Perez",
      email: "ana@cliente.com",
      role: "aprobador",
      status: "active",
      allowedBranches: ["Casa central", "Sucursal Norte"],
      orderLimit: 1500000,
      comment: "Aprueba pedidos de alto monto",
    });

    const parsed = parseAccessNote({
      id: "note-1",
      client_id: "client-1",
      body,
      created_at: "2026-03-29T10:00:00.000Z",
    });

    expect(parsed?.role).toBe("aprobador");
    expect(parsed?.status).toBe("active");
    expect(parsed?.allowedBranches).toEqual(["Casa central", "Sucursal Norte"]);
    expect(parsed?.orderLimit).toBe(1500000);
  });
});
