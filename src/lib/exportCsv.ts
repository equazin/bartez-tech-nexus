import Papa from "papaparse";
import type { Product } from "@/models/products";
import type { PortalOrder } from "@/hooks/useOrders";
import { getAvailableStock } from "@/lib/pricing";

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
  return order.order_number ?? `ORD-${String(order.id).slice(-6).toUpperCase()}`;
}

export function exportCatalogCSV(products: Product[]) {
  const rows = products.map((p) => ({
    SKU: p.sku ?? "",
    Nombre: p.name,
    Categoria: p.category,
    "Precio base (USD)": p.cost_price,
    Stock: p.stock,
    "Stock reservado": p.stock_reserved ?? 0,
    "Stock disponible": getAvailableStock(p),
    "IVA %": p.iva_rate ?? 21,
    Descripcion: p.description,
  }));
  const csv = Papa.unparse(rows);
  downloadBlob(csv, "catalogo.csv", "text/csv;charset=utf-8;");
}

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
    Cliente: clientMap.get(o.client_id ?? "") ?? o.client_id ?? "",
    Fecha: new Date(o.created_at).toLocaleDateString("es-AR"),
    Estado: o.status,
    Total: o.total,
  }));
  const csv = Papa.unparse(rows);
  downloadBlob(csv, `reporte-ventas-${new Date().toISOString().slice(0, 10)}.csv`, "text/csv;charset=utf-8;");
}

export function exportOrdersCSV(
  orders: Array<Pick<PortalOrder, "id" | "order_number" | "numero_remito" | "created_at"> & {
    status: string;
    total: number;
    products: Array<{
      sku?: string;
      name: string;
      quantity: number;
      unit_price?: number;
      total_price?: number;
    }>;
  }>
) {
  const statusLabels: Record<string, string> = {
    pending: "En revision",
    approved: "Aprobado",
    rejected: "Rechazado",
    dispatched: "Despachado",
  };

  const rows: Record<string, unknown>[] = [];
  for (const order of orders) {
    for (const product of order.products) {
      rows.push({
        "Nro. Pedido": orderLabel(order),
        Estado: statusLabels[order.status] ?? order.status,
        Fecha: new Date(order.created_at).toLocaleDateString("es-AR"),
        "Nro. Remito": order.numero_remito ?? "",
        SKU: product.sku,
        Producto: product.name,
        Cantidad: product.quantity,
        "Precio unit.": product.unit_price,
        "Total item": product.total_price,
        "Total pedido": order.total,
      });
    }
  }

  const csv = Papa.unparse(rows);
  downloadBlob(csv, "pedidos.csv", "text/csv;charset=utf-8;");
}
