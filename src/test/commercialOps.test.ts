import { describe, expect, it } from "vitest";
import {
  buildCommercialAlerts,
  buildCommercialStories,
  buildCommercialTasks,
  calculateOrderProfitability,
} from "@/lib/commercialOps";

describe("commercialOps", () => {
  it("calculates profitability from order lines", () => {
    const metrics = calculateOrderProfitability({
      id: "ord-1",
      client_id: "client-1",
      total: 260,
      status: "approved",
      created_at: "2026-03-10T10:00:00.000Z",
      products: [
        { quantity: 2, cost_price: 50, total_price: 160 },
        { quantity: 1, cost_price: 40, total_price: 100 },
      ],
    });

    expect(metrics.revenue).toBe(260);
    expect(metrics.cost).toBe(140);
    expect(metrics.grossProfit).toBe(120);
    expect(metrics.marginPct).toBeCloseTo(46.15, 1);
  });

  it("builds a unified story for quote, order, invoice and payment", () => {
    const stories = buildCommercialStories({
      orders: [
        {
          id: "101",
          client_id: "client-1",
          total: 1000,
          status: "dispatched",
          created_at: "2026-03-20T10:00:00.000Z",
          order_number: "PED-101",
          numero_remito: "REM-9",
          products: [{ quantity: 2, cost_price: 300, total_price: 1000 }],
        },
      ],
      quotes: [
        {
          id: 44,
          client_id: "client-1",
          total: 1000,
          status: "approved",
          created_at: "2026-03-19T10:00:00.000Z",
          order_id: "101",
        },
      ],
      invoices: [
        {
          id: "inv-1",
          client_id: "client-1",
          total: 1000,
          status: "sent",
          created_at: "2026-03-21T10:00:00.000Z",
          invoice_number: "FAC-0001",
          order_id: 101,
        },
      ],
      payments: [
        {
          id: "pay-1",
          client_id: "client-1",
          monto: -400,
          fecha: "2026-03-22T10:00:00.000Z",
          reference_id: "inv-1",
          descripcion: "Transferencia",
        },
      ],
      clientMap: { "client-1": "Bartez Cliente" },
    });

    expect(stories).toHaveLength(1);
    expect(stories[0].clientName).toBe("Bartez Cliente");
    expect(stories[0].quote?.label).toBe("COT-00044");
    expect(stories[0].order?.label).toBe("PED-101");
    expect(stories[0].invoices[0].label).toBe("FAC-0001");
    expect(stories[0].paidAmount).toBe(400);
    expect(stories[0].balance).toBe(600);
  });

  it("creates alerts and tasks for stock, credit, overdue invoices and delayed orders", () => {
    const now = new Date("2026-03-29T10:00:00.000Z");
    const alerts = buildCommercialAlerts({
      orders: [
        {
          id: "ord-1",
          client_id: "client-1",
          total: 500,
          status: "pending",
          created_at: "2026-03-25T10:00:00.000Z",
        },
      ],
      invoices: [
        {
          id: "inv-1",
          client_id: "client-1",
          total: 900,
          status: "overdue",
          created_at: "2026-03-10T10:00:00.000Z",
          invoice_number: "FAC-9",
        },
      ],
      profiles: [
        {
          id: "client-1",
          company_name: "Cliente Uno",
          credit_limit: 1000,
          credit_used: 900,
        },
      ],
      products: [
        { id: 1, name: "Notebook", stock: 2, stock_min: 3 },
      ],
      now,
    });

    expect(alerts.some((alert) => alert.type === "low_stock")).toBe(true);
    expect(alerts.some((alert) => alert.type === "credit")).toBe(true);
    expect(alerts.some((alert) => alert.type === "invoice_overdue")).toBe(true);
    expect(alerts.some((alert) => alert.type === "order_delay")).toBe(true);

    const stories = buildCommercialStories({
      orders: [
        {
          id: "ord-1",
          client_id: "client-1",
          total: 500,
          status: "pending",
          created_at: "2026-03-25T10:00:00.000Z",
        },
      ],
      quotes: [],
      invoices: [
        {
          id: "inv-1",
          client_id: "client-1",
          total: 900,
          status: "overdue",
          created_at: "2026-03-10T10:00:00.000Z",
          invoice_number: "FAC-9",
        },
      ],
      payments: [],
      clientMap: { "client-1": "Cliente Uno" },
      now,
    });

    const tasks = buildCommercialTasks(stories, [
      { id: "client-1", company_name: "Cliente Uno", credit_limit: 1000, credit_used: 900 },
    ]);

    expect(tasks.some((task) => task.kind === "collection")).toBe(true);
    expect(tasks.some((task) => task.kind === "follow_up")).toBe(true);
    expect(tasks.some((task) => task.kind === "risk")).toBe(true);
  });
});
