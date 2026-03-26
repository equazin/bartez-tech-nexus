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

function orderLabel(order: PortalOrder): string {
  return (order as any).order_number
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

// ── Orders CSV ────────────────────────────────────────────────────────────────

export function exportOrdersCSV(orders: PortalOrder[]) {
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
        "Nro. Remito":   (order as any).numero_remito ?? "",
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
