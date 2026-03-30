import type { Product } from "@/models/products";

export async function exportCatalogPdf(
  products: Product[],
  formatPrice: (value: number) => string,
  currency: string
) {
  const { exportCatalogPDF } = await import("./exports");
  return exportCatalogPDF(products, formatPrice, currency);
}

export async function exportRemitoPdf(
  order: {
    id: string;
    order_number?: string;
    numero_remito?: string;
    created_at: string;
    status: string;
    total: number;
    products: Array<{ name: string; sku?: string; quantity: number; total_price?: number; unit_price?: number }>;
  },
  clientName: string,
  formatPrice: (value: number) => string
) {
  const { exportRemitoPDF } = await import("./exports");
  return exportRemitoPDF(order, clientName, formatPrice);
}
