import Papa from "papaparse";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Product } from "@/models/products";
import type { PortalOrder } from "@/hooks/useOrders";
import { getAvailableStock } from "@/lib/pricing";

// ── Helpers ──────────────────────────────────────────────────────────────────

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob(["\uFEFF" + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function orderLabel(order: Pick<PortalOrder, "id" | "order_number">): string {
  return order.order_number
    ?? `ORD-${String(order.id).slice(-6).toUpperCase()}`;
}

// ── Catalog CSV ───────────────────────────────────────────────────────────────

export function exportCatalogCSV(products: Product[]) {
  const rows = products.map((p) => ({
    SKU: p.sku ?? "",
    Nombre: p.name,
    Categoría: p.category,
    "Precio base (USD)": p.cost_price,
    Stock: p.stock,
    "Stock reservado": p.stock_reserved ?? 0,
    "Stock disponible": getAvailableStock(p),
    "IVA %": p.iva_rate ?? 21,
    Descripción: p.description,
  }));
  const csv = Papa.unparse(rows);
  downloadBlob(csv, "catalogo.csv", "text/csv;charset=utf-8;");
}

// ── Catalog PDF ───────────────────────────────────────────────────────────────

export function exportCatalogPDF(
  products: Product[],
  formatPrice: (v: number) => string,
  currency: string
) {
  const doc = new jsPDF({ orientation: "landscape" });

  // Header
  doc.setFillColor(45, 159, 106);
  doc.rect(0, 0, 297, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Catálogo de Productos — Bartez Tecnología", 14, 12);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Generado el ${new Date().toLocaleDateString("es-AR")} · Precios en ${currency}`,
    297 - 14,
    12,
    { align: "right" }
  );

  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    startY: 22,
    head: [["SKU", "Nombre", "Categoría", "Stock disp.", "Precio base", "IVA", "Tier 1", "Tier 2", "Tier 3"]],
    body: products.map((p) => {
      const tiers = p.price_tiers ?? [];
      const fmtTier = (i: number) =>
        tiers[i]
          ? `${tiers[i].min}${tiers[i].max ? `–${tiers[i].max}` : "+"} → ${formatPrice(tiers[i].price)}`
          : "-";
      return [
        p.sku ?? "-",
        p.name,
        p.category,
        getAvailableStock(p),
        formatPrice(p.cost_price),
        `${p.iva_rate ?? 21}%`,
        fmtTier(0),
        fmtTier(1),
        fmtTier(2),
      ];
    }),
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [45, 159, 106], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: {
      0: { cellWidth: 22, font: "courier" },
      1: { cellWidth: 55 },
      2: { cellWidth: 28 },
      3: { cellWidth: 20, halign: "center" },
      4: { cellWidth: 26, halign: "right" },
      5: { cellWidth: 14, halign: "center" },
      6: { cellWidth: 33 },
      7: { cellWidth: 33 },
      8: { cellWidth: 33 },
    },
  });

  doc.save("catalogo-bartez.pdf");
}

// ── Reports CSV (ventas por cliente) ─────────────────────────────────────────

export function exportReportsCSV(
  orders: Array<{
    id: string;
    order_number?: string;
    total: number;
    status: string;
    created_at: string;
    client_id?: string;
  }>,
  clients: Array<{ id: string; company_name?: string; contact_name?: string }>
) {
  const clientMap = new Map(clients.map((c) => [c.id, c.company_name || c.contact_name || c.id]));
  const rows = orders.map((o) => ({
    "Nro. Pedido": o.order_number ?? `ORD-${o.id.slice(-6).toUpperCase()}`,
    "Cliente":     clientMap.get(o.client_id ?? "") ?? o.client_id ?? "",
    "Fecha":       new Date(o.created_at).toLocaleDateString("es-AR"),
    "Estado":      o.status,
    "Total":       o.total,
  }));
  const csv = Papa.unparse(rows);
  downloadBlob(csv, `reporte-ventas-${new Date().toISOString().slice(0, 10)}.csv`, "text/csv;charset=utf-8;");
}

// ── Remito PDF ────────────────────────────────────────────────────────────────

export function exportRemitoPDF(order: {
  id: string;
  order_number?: string;
  numero_remito?: string;
  created_at: string;
  status: string;
  total: number;
  products: Array<{ name: string; sku?: string; quantity: number; total_price?: number; unit_price?: number }>;
}, clientName: string, formatPrice: (v: number) => string) {
  const doc = new jsPDF();
  const fecha = new Date(order.created_at).toLocaleDateString("es-AR");
  const label = order.order_number ?? `ORD-${order.id.slice(-6).toUpperCase()}`;

  // Header strip
  doc.setFillColor(45, 159, 106);
  doc.rect(0, 0, 210, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("REMITO DE ENTREGA", 14, 10);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Bartez Tecnología · bartez.com.ar", 14, 17);

  doc.setTextColor(0, 0, 0);

  // Meta block
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Pedido:", 14, 32);
  doc.text("Remito:", 14, 38);
  doc.text("Fecha:", 14, 44);
  doc.text("Cliente:", 14, 50);

  doc.setFont("helvetica", "normal");
  doc.text(label, 40, 32);
  doc.text(order.numero_remito || "—", 40, 38);
  doc.text(fecha, 40, 44);
  doc.text(clientName, 40, 50);

  // Items table
  autoTable(doc, {
    startY: 60,
    head: [["SKU", "Descripción", "Cant.", "P. Unit.", "Total"]],
    body: order.products.map((p) => [
      p.sku ?? "—",
      p.name,
      String(p.quantity),
      formatPrice(p.unit_price ?? 0),
      formatPrice(p.total_price ?? 0),
    ]),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [45, 159, 106], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles: {
      0: { cellWidth: 25, font: "courier" },
      1: { cellWidth: 85 },
      2: { cellWidth: 18, halign: "center" },
      3: { cellWidth: 28, halign: "right" },
      4: { cellWidth: 28, halign: "right" },
    },
  });

  // Total footer
  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 140;
  doc.setFillColor(45, 159, 106);
  doc.rect(130, finalY + 4, 68, 9, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`TOTAL: ${formatPrice(order.total)}`, 198, finalY + 10, { align: "right" });

  // Footer
  doc.setTextColor(150, 150, 150);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("Bartez Tecnología — Este documento es válido como comprobante de entrega.", 14, 285);

  doc.save(`remito-${label}-${fecha}.pdf`);
}

// ── Orders CSV ────────────────────────────────────────────────────────────────

export function exportOrdersCSV(orders: Array<Pick<PortalOrder, "id" | "order_number" | "numero_remito" | "created_at"> & {
  status: string;
  total: number;
  products: Array<{
    sku?: string;
    name: string;
    quantity: number;
    unit_price?: number;
    total_price?: number;
  }>;
}>) {
  const STATUS_LABELS: Record<string, string> = {
    pending:    "En revisión",
    approved:   "Aprobado",
    rejected:   "Rechazado",
    dispatched: "Despachado",
  };

  const rows: Record<string, unknown>[] = [];
  for (const order of orders) {
    for (const p of order.products) {
      rows.push({
        "Nro. Pedido":   orderLabel(order),
        "Estado":        STATUS_LABELS[order.status] ?? order.status,
        "Fecha":         new Date(order.created_at).toLocaleDateString("es-AR"),
        "Nro. Remito":   order.numero_remito ?? "",
        "SKU":           p.sku,
        "Producto":      p.name,
        "Cantidad":      p.quantity,
        "Precio unit.":  p.unit_price,
        "Total ítem":    p.total_price,
        "Total pedido":  order.total,
      });
    }
  }
  const csv = Papa.unparse(rows);
  downloadBlob(csv, "pedidos.csv", "text/csv;charset=utf-8;");
}
