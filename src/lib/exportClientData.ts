import type { PortalOrder } from "@/hooks/useOrders";
import type { Invoice } from "@/lib/api/invoices";
import type { Quote } from "@/models/quote";

export type ExportDateRange = "3m" | "6m" | "1y" | "all";

function isoLabel(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function cutoffDate(range: ExportDateRange): Date | null {
  if (range === "all") return null;
  const now = new Date();
  if (range === "3m") return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
  if (range === "6m") return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
  return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
}

function filterByDate<T extends { created_at: string }>(items: T[], range: ExportDateRange): T[] {
  const cutoff = cutoffDate(range);
  if (!cutoff) return items;
  return items.filter((item) => new Date(item.created_at) >= cutoff);
}

function downloadCsv(filename: string, rows: string[][]): void {
  const header = rows[0];
  const body = rows.slice(1);
  const csvContent = [header, ...body]
    .map((row) =>
      row
        .map((cell) => {
          const str = cell ?? "";
          const needsQuote = str.includes(",") || str.includes('"') || str.includes("\n");
          return needsQuote ? `"${str.replace(/"/g, '""')}"` : str;
        })
        .join(","),
    )
    .join("\r\n");

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  pending_approval: "En revisión",
  approved: "Aprobado",
  preparing: "Preparando",
  shipped: "Enviado",
  dispatched: "Despachado",
  delivered: "Entregado",
  rejected: "Rechazado",
};

export function exportClientOrders(orders: PortalOrder[], range: ExportDateRange = "all"): void {
  const filtered = filterByDate(orders, range);
  const rows: string[][] = [
    ["fecha", "numero_pedido", "estado", "items", "total_ars"],
  ];
  for (const order of filtered) {
    const fecha = new Date(order.created_at).toLocaleDateString("es-AR");
    const numero = order.order_number ?? `#${String(order.id).slice(-6).toUpperCase()}`;
    const estado = ORDER_STATUS_LABEL[order.status] ?? order.status;
    const items = order.products
      .map((p) => `${p.name} x${p.quantity}`)
      .join(" | ");
    const totalArs = String(order.total);
    rows.push([fecha, numero, estado, items, totalArs]);
  }
  downloadCsv(`bartez_pedidos_${isoLabel()}.csv`, rows);
}

const INVOICE_STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  sent: "Enviada",
  paid: "Pagada",
  overdue: "Vencida",
  cancelled: "Cancelada",
};

export function exportClientInvoices(invoices: Invoice[], range: ExportDateRange = "all"): void {
  const filtered = filterByDate(invoices, range);
  const rows: string[][] = [
    ["fecha", "numero_factura", "estado", "subtotal", "iva", "total", "moneda"],
  ];
  for (const inv of filtered) {
    const fecha = new Date(inv.created_at).toLocaleDateString("es-AR");
    const numero = inv.invoice_number;
    const estado = INVOICE_STATUS_LABEL[inv.status] ?? inv.status;
    const subtotal = String(inv.subtotal);
    const iva = String(inv.iva_total);
    const total = String(inv.total);
    const moneda = inv.currency;
    rows.push([fecha, numero, estado, subtotal, iva, total, moneda]);
  }
  downloadCsv(`bartez_facturas_${isoLabel()}.csv`, rows);
}

const QUOTE_STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  sent: "Enviada",
  viewed: "Vista",
  approved: "Aprobada",
  rejected: "Rechazada",
  converted: "Convertida",
  expired: "Expirada",
};

export function exportClientQuotes(quotes: Quote[], range: ExportDateRange = "all"): void {
  const filtered = filterByDate(quotes, range);
  const rows: string[][] = [
    ["fecha", "numero_cotizacion", "estado", "items", "total"],
  ];
  for (const q of filtered) {
    const fecha = new Date(q.created_at).toLocaleDateString("es-AR");
    const numero = `COT-${String(q.id).padStart(5, "0")}`;
    const estado = QUOTE_STATUS_LABEL[q.status] ?? q.status;
    const items = q.items
      .map((item) => `${item.name} x${item.quantity}`)
      .join(" | ");
    const total = String(q.total);
    rows.push([fecha, numero, estado, items, total]);
  }
  downloadCsv(`bartez_cotizaciones_${isoLabel()}.csv`, rows);
}
