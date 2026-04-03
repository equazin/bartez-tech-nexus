import { useEffect, useState, useCallback, type ReactNode } from "react";
import { AlertTriangle, Clock, Download, RefreshCw } from "lucide-react";
import Papa from "papaparse";
import { supabase } from "@/lib/supabase";
import { useReports } from "@/hooks/useReports";
import { useCurrency } from "@/context/CurrencyContext";
import type { Product } from "@/models/products";
import {
  buildCategoryMarginReport,
  buildClientSalesReport,
  buildDebtAgingReport,
  buildProductSalesReport,
  buildReorderForecast,
} from "@/lib/businessReporting";

interface OrderRow {
  id: string | number;
  client_id: string;
  total: number;
  status: string;
  created_at: string;
  products: Array<{
    product_id?: number | string;
    sku?: string;
    name?: string;
    quantity?: number;
    total_price?: number;
    cost_price?: number;
    category?: string;
  }>;
}

interface ClientRow {
  id: string;
  company_name?: string;
  contact_name?: string;
}

interface InvoiceRow {
  id: string;
  client_id: string;
  invoice_number: string;
  status: string;
  total: number;
  subtotal: number;
  iva_total: number;
  currency: "USD" | "ARS";
  exchange_rate?: number | null;
  created_at: string;
  due_date?: string;
}

interface Props {
  products: Product[];
  orders: OrderRow[];
  clients: ClientRow[];
  invoices: InvoiceRow[];
  formatPrice: (n: number) => string;
  isDark?: boolean;
}

function downloadCSV(filename: string, rows: object[]) {
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function TableShell({
  title,
  subtitle,
  children,
  isDark,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  isDark: boolean;
}) {
  const dk = (d: string, l: string) => (isDark ? d : l);
  return (
    <div className={`rounded-xl border overflow-hidden ${dk("border-[#1f1f1f] bg-[#111]", "border-[#e5e5e5] bg-white")}`}>
      <div className={`px-4 py-3 border-b ${dk("border-[#1a1a1a]", "border-[#f0f0f0]")}`}>
        <h3 className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>{title}</h3>
        {subtitle && <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function ReportsTab({
  products,
  orders,
  clients,
  invoices,
  formatPrice,
  isDark = true,
}: Props) {
  const { lowStock, stale, loading, error, refresh } = useReports(products, orders);
  const { currency, exchangeRate } = useCurrency();
  const dk = (d: string, l: string) => (isDark ? d : l);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const [stats, setStats] = useState<{ monthly: any[], categories: any[], products: any[], clients: any[] }>({
    monthly: [],
    categories: [],
    products: [],
    clients: []
  });
  const [loadingStats, setLoadingStats] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    const [monthly, cat, prod, cli] = await Promise.all([
      supabase.from("analytics_monthly_sales").select("*"),
      supabase.from("analytics_category_stats").select("*"),
      supabase.from("analytics_top_products").select("*"),
      supabase.from("analytics_client_stats").select("*"),
    ]);
    setStats({
      monthly: monthly.data ?? [],
      categories: cat.data ?? [],
      products: prod.data ?? [],
      clients: cli.data ?? []
    });
    setLoadingStats(false);
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const clientMap = clients.reduce<Record<string, string>>((acc, client) => {
    acc[client.id] = client.company_name || client.contact_name || client.id;
    return acc;
  }, {});

  const salesByClient = stats.clients;
  const salesByProduct = stats.products;
  const marginByCategory = stats.categories;
  const debtAging = buildDebtAgingReport(invoices, currency, exchangeRate.rate);
  const reorderForecast = buildReorderForecast(orders, products);

  const th = `text-[10px] font-bold uppercase tracking-wide px-3 py-2 ${dk("text-[#525252] bg-[#0a0a0a]", "text-[#a3a3a3] bg-[#f5f5f5]")}`;
  const rowEven = dk("bg-[#111]", "bg-white");
  const rowOdd = dk("bg-[#0d0d0d]", "bg-[#fafafa]");

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className={`font-bold text-base ${dk("text-white", "text-[#171717]")}`}>Reportes</h2>
        <button
          onClick={() => void refresh()}
          disabled={loading}
          className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition ${dk("border-[#2a2a2a] text-gray-400 hover:text-white hover:bg-[#1c1c1c]", "border-[#e5e5e5] text-[#737373] hover:bg-[#f5f5f5]")} disabled:opacity-40`}
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Actualizar
        </button>
      </div>

      {error && <p className="text-red-400 text-xs bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>}

      <div className="grid gap-4 md:grid-cols-2">
        <TableShell title="Stock bajo" subtitle="Productos debajo del mínimo o con stock crítico." isDark={isDark}>
          <div className="px-4 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400 text-sm font-semibold">
                <AlertTriangle size={14} /> {lowStock.length} alerta(s)
              </div>
              {lowStock.length > 0 && (
                <button
                  onClick={() =>
                    downloadCSV("stock-bajo.csv", lowStock.map((item) => ({
                      Producto: item.name,
                      SKU: item.sku ?? "",
                      Categoria: item.category,
                      Stock: item.stock,
                      StockMinimo: item.stock_min ?? "",
                      Disponible: item.available,
                    })))
                  }
                  className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border ${dk("border-[#2a2a2a] text-gray-400 hover:text-white hover:bg-[#1c1c1c]", "border-[#e5e5e5] text-[#737373] hover:bg-[#f5f5f5]")}`}
                >
                  <Download size={10} /> CSV
                </button>
              )}
            </div>
            <div className="space-y-2">
              {lowStock.slice(0, 6).map((item) => (
                <div key={item.id} className={`rounded-lg border px-3 py-2 ${dk("border-[#1a1a1a] bg-[#0d0d0d]", "border-[#ececec] bg-[#fafafa]")}`}>
                  <p className={`text-sm font-semibold ${dk("text-white", "text-[#171717]")}`}>{item.name}</p>
                  <p className="text-[11px] text-gray-500">{item.category} · stock {item.stock} · disponible {item.available}</p>
                </div>
              ))}
              {lowStock.length === 0 && <p className="text-sm text-gray-500">No hay productos con stock bajo.</p>}
            </div>
          </div>
        </TableShell>

        <TableShell title="Sin movimiento" subtitle="Productos sin ventas recientes." isDark={isDark}>
          <div className="px-4 py-4 space-y-2">
            {stale.slice(0, 6).map((item) => (
              <div key={item.id} className={`rounded-lg border px-3 py-2 ${dk("border-[#1a1a1a] bg-[#0d0d0d]", "border-[#ececec] bg-[#fafafa]")}`}>
                <p className={`text-sm font-semibold ${dk("text-white", "text-[#171717]")}`}>{item.name}</p>
                <p className="text-[11px] text-gray-500">{item.category} · {item.days_stale >= 9999 ? "sin ventas" : `${item.days_stale} días sin movimiento`}</p>
              </div>
            ))}
            {stale.length === 0 && <p className="text-sm text-gray-500">Todos los productos tuvieron movimiento reciente.</p>}
          </div>
        </TableShell>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TableShell title="Ventas por cliente" subtitle="Revenue, ticket promedio y margen bruto." isDark={isDark}>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className={`${th} text-left`}>Cliente</th>
                <th className={`${th} text-center`}>Pedidos</th>
                <th className={`${th} text-right`}>Revenue</th>
                <th className={`${th} text-right hidden sm:table-cell`}>Margen</th>
              </tr>
            </thead>
            <tbody>
              {salesByClient.map((row, index) => (
                <tr key={row.clientId} className={`border-t ${dk("border-[#1a1a1a]", "border-[#f0f0f0]")} ${index % 2 === 0 ? rowEven : rowOdd}`}>
                  <td className="px-3 py-2.5">
                    <p className={`text-xs font-semibold ${dk("text-white", "text-[#171717]")}`}>{row.clientName}</p>
                    <p className="text-[10px] text-gray-500">{row.lastOrderDate ? new Date(row.lastOrderDate).toLocaleDateString("es-AR") : "Sin pedidos"}</p>
                  </td>
                  <td className="px-3 py-2.5 text-center text-xs">{row.orderCount}</td>
                  <td className="px-3 py-2.5 text-right text-xs font-bold text-[#2D9F6A]">{formatPrice(row.revenue)}</td>
                  <td className="hidden sm:table-cell px-3 py-2.5 text-right text-xs">
                    {formatPrice(row.grossProfit)} ({(row.marginPct ?? 0).toFixed(1)}%)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>

        <TableShell title="Ventas por producto" subtitle="Lo más vendido y su margen real." isDark={isDark}>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className={`${th} text-left`}>Producto</th>
                <th className={`${th} text-center`}>Unidades</th>
                <th className={`${th} text-right`}>Revenue</th>
                <th className={`${th} text-right hidden sm:table-cell`}>Margen</th>
              </tr>
            </thead>
            <tbody>
              {salesByProduct.map((row, index) => (
                <tr key={`${row.productName}-${index}`} className={`border-t ${dk("border-[#1a1a1a]", "border-[#f0f0f0]")} ${index % 2 === 0 ? rowEven : rowOdd}`}>
                  <td className="px-3 py-2.5">
                    <p className={`text-xs font-semibold ${dk("text-white", "text-[#171717]")}`}>{row.productName}</p>
                    <p className="text-[10px] text-gray-500">{row.category}</p>
                  </td>
                  <td className="px-3 py-2.5 text-center text-xs">{row.units}</td>
                  <td className="px-3 py-2.5 text-right text-xs font-bold text-[#2D9F6A]">{formatPrice(row.revenue)}</td>
                  <td className="hidden sm:table-cell px-3 py-2.5 text-right text-xs">
                    {formatPrice(row.grossProfit)} ({(row.marginPct ?? 0).toFixed(1)}%)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <TableShell title="Margen por categoría" subtitle="Dónde está quedando la rentabilidad." isDark={isDark}>
          <div className="px-4 py-4 space-y-3">
            {marginByCategory.map((row) => (
              <div key={row.category} className={`rounded-lg border px-3 py-3 ${dk("border-[#1a1a1a] bg-[#0d0d0d]", "border-[#ececec] bg-[#fafafa]")}`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className={`text-sm font-semibold ${dk("text-white", "text-[#171717]")}`}>{row.category}</p>
                    <p className="text-[11px] text-gray-500">{row.units} u. · revenue {formatPrice(row.revenue)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-[#2D9F6A]">{formatPrice(row.grossProfit || 0)}</p>
                    <p className="text-[11px] text-gray-500">{(row.marginPct ?? 0).toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TableShell>

        <TableShell title="Aging de deuda" subtitle={`Facturas pendientes en ${currency}.`} isDark={isDark}>
          <div className="px-4 py-4 space-y-3">
            {debtAging.map((bucket) => (
              <div key={bucket.label} className={`rounded-lg border px-3 py-3 ${dk("border-[#1a1a1a] bg-[#0d0d0d]", "border-[#ececec] bg-[#fafafa]")}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Clock size={13} className={bucket.amount > 0 ? "text-amber-400" : "text-gray-400"} />
                    <p className={`text-sm font-semibold ${dk("text-white", "text-[#171717]")}`}>{bucket.label}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${bucket.amount > 0 ? "text-amber-400" : dk("text-gray-400", "text-[#737373]")}`}>{formatPrice(bucket.amount)}</p>
                    <p className="text-[11px] text-gray-500">{bucket.count} factura(s)</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TableShell>
      </div>

      <TableShell title="Forecast simple de reposición" subtitle="Velocidad 30 días, cobertura y sugerencia de compra." isDark={isDark}>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className={`${th} text-left`}>Producto</th>
              <th className={`${th} text-center`}>Stock</th>
              <th className={`${th} text-center hidden sm:table-cell`}>Vel./30d</th>
              <th className={`${th} text-right`}>Cobertura</th>
              <th className={`${th} text-right`}>Sugerido</th>
            </tr>
          </thead>
          <tbody>
            {reorderForecast.map((row, index) => (
              <tr key={`${row.productName}-${index}`} className={`border-t ${dk("border-[#1a1a1a]", "border-[#f0f0f0]")} ${index % 2 === 0 ? rowEven : rowOdd}`}>
                <td className="px-3 py-2.5">
                  <p className={`text-xs font-semibold ${dk("text-white", "text-[#171717]")}`}>{row.productName}</p>
                  <p className="text-[10px] text-gray-500">{row.category}</p>
                </td>
                <td className="px-3 py-2.5 text-center text-xs">{row.stock}</td>
                <td className="hidden sm:table-cell px-3 py-2.5 text-center text-xs">{(row.velocity30d ?? 0).toFixed(2)}</td>
                <td className="px-3 py-2.5 text-right text-xs">
                  {row.daysOfCover == null ? "Sin consumo" : `${(row.daysOfCover ?? 0).toFixed(1)} días`}
                </td>
                <td className="px-3 py-2.5 text-right text-xs font-bold text-amber-400">{row.suggestedReorder}</td>
              </tr>
            ))}
            {reorderForecast.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500">
                  No hay suficiente señal de ventas para forecast por ahora.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableShell>
    </div>
  );
}
