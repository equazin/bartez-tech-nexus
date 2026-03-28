import { useEffect, useState, useCallback } from "react";
import { AlertTriangle, PackageX, RefreshCw, TrendingDown, Clock, Download, Users, TrendingUp, Package } from "lucide-react";
import { useReports } from "@/hooks/useReports";
import type { Product } from "@/models/products";
import Papa from "papaparse";
import { supabase } from "@/lib/supabase";

interface Props {
  products: Product[];
  orders: { products: any[]; created_at: string }[];
  formatPrice: (n: number) => string;
  isDark?: boolean;
}

interface RevenueByClient {
  client_id: string;
  company_name: string;
  client_type: string;
  order_count: number;
  total_revenue: number;
  avg_order_value: number;
  last_order_date: string;
}

interface TopProduct {
  product_id: number;
  product_name: string;
  units_sold: number;
  revenue: number;
  gross_margin: number;
}

export function ReportsTab({ products, orders, formatPrice, isDark = true }: Props) {
  const { lowStock, stale, loading, error, refresh } = useReports(products, orders);
  const dk = (d: string, l: string) => isDark ? d : l;

  const [revenueByClient, setRevenueByClient] = useState<RevenueByClient[]>([]);
  const [topProducts, setTopProducts]         = useState<TopProduct[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  const loadAnalytics = useCallback(async () => {
    setLoadingAnalytics(true);
    const [{ data: rev }, { data: top }] = await Promise.all([
      supabase.from("revenue_by_client").select("*").order("total_revenue", { ascending: false }).limit(20),
      supabase.from("top_products_revenue").select("*").limit(20),
    ]);
    setRevenueByClient((rev ?? []) as RevenueByClient[]);
    setTopProducts((top ?? []) as TopProduct[]);
    setLoadingAnalytics(false);
  }, []);

  useEffect(() => { refresh(); loadAnalytics(); }, []); // eslint-disable-line

  function downloadCSV(filename: string, rows: object[]) {
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportLowStock() {
    const rows = lowStock.map((p) => ({
      Nombre:       p.name,
      SKU:          p.sku ?? "",
      Categoría:    p.category,
      Stock:        p.stock,
      "Stock mín.": p.stock_min ?? "",
      Disponible:   p.available,
      Proveedor:    p.supplier_name ?? "",
    }));
    downloadCSV(`stock-bajo-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  function exportStale() {
    const rows = stale.map((p) => ({
      Nombre:          p.name,
      SKU:             p.sku ?? "",
      Categoría:       p.category,
      "Costo (USD)":   p.cost_price,
      Stock:           p.stock,
      "Días sin mov.": p.days_stale >= 9999 ? "Nunca" : p.days_stale,
    }));
    downloadCSV(`sin-movimiento-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  const bg = dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]");
  const rowEven = dk("bg-[#111]", "bg-white");
  const rowOdd  = dk("bg-[#0d0d0d]", "bg-[#fafafa]");
  const th = `text-[10px] font-bold uppercase tracking-wide px-3 py-2 ${dk("text-[#525252] bg-[#0a0a0a]", "text-[#a3a3a3] bg-[#f5f5f5]")}`;

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className={`font-bold text-base ${dk("text-white", "text-[#171717]")}`}>Reportes</h2>
        <button
          onClick={refresh}
          disabled={loading}
          className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition ${dk("border-[#2a2a2a] text-gray-400 hover:text-white hover:bg-[#1c1c1c]", "border-[#e5e5e5] text-[#737373] hover:bg-[#f5f5f5]")} disabled:opacity-40`}
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Actualizar
        </button>
      </div>

      {error && <p className="text-red-400 text-xs bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>}

      {/* ── Stock bajo ─────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={15} className="text-amber-400" />
          <h3 className={`font-bold text-sm ${dk("text-white", "text-[#171717]")}`}>
            Stock bajo
          </h3>
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
            lowStock.length > 0
              ? "bg-amber-500/15 text-amber-400"
              : dk("bg-[#1c1c1c] text-gray-500", "bg-[#f0f0f0] text-[#a3a3a3]")
          }`}>
            {lowStock.length}
          </span>
          {lowStock.length > 0 && (
            <button
              onClick={exportLowStock}
              className={`ml-auto flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border transition ${dk("border-[#2a2a2a] text-gray-400 hover:text-white hover:bg-[#1c1c1c]", "border-[#e5e5e5] text-[#737373] hover:bg-[#f5f5f5]")}`}
            >
              <Download size={10} /> CSV
            </button>
          )}
        </div>

        {lowStock.length === 0 ? (
          <div className={`text-center py-8 text-sm ${dk("text-gray-600", "text-[#a3a3a3]")} ${bg} border rounded-xl`}>
            Sin productos con stock bajo. Todo OK.
          </div>
        ) : (
          <div className={`rounded-xl border overflow-hidden ${dk("border-[#1f1f1f]", "border-[#e5e5e5]")}`}>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className={`${th} text-left`}>Producto</th>
                  <th className={`${th} text-left hidden sm:table-cell`}>Categoría</th>
                  <th className={`${th} text-center`}>Stock</th>
                  <th className={`${th} text-center`}>Mín.</th>
                  <th className={`${th} text-center`}>Disponible</th>
                  <th className={`${th} text-right hidden sm:table-cell`}>Proveedor</th>
                </tr>
              </thead>
              <tbody>
                {lowStock.map((p, i) => (
                  <tr key={p.id} className={`border-t ${dk("border-[#1a1a1a]", "border-[#f0f0f0]")} ${i % 2 === 0 ? rowEven : rowOdd}`}>
                    <td className="px-3 py-2.5">
                      <p className={`font-medium text-xs ${dk("text-gray-200", "text-[#171717]")}`}>{p.name}</p>
                      {p.sku && <p className={`text-[10px] font-mono ${dk("text-gray-600", "text-[#a3a3a3]")}`}>{p.sku}</p>}
                    </td>
                    <td className={`hidden sm:table-cell px-3 py-2.5 text-xs ${dk("text-gray-500", "text-[#737373]")}`}>{p.category}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="text-xs font-bold text-amber-400">{p.stock}</span>
                    </td>
                    <td className={`px-3 py-2.5 text-center text-xs ${dk("text-gray-500", "text-[#737373]")}`}>{p.stock_min ?? "—"}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`text-xs font-bold ${p.available === 0 ? "text-red-400" : "text-amber-400"}`}>{p.available}</span>
                    </td>
                    <td className={`hidden sm:table-cell px-3 py-2.5 text-right text-xs ${dk("text-gray-500", "text-[#737373]")}`}>
                      {p.supplier_name ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Sin movimiento ────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <PackageX size={15} className="text-blue-400" />
          <h3 className={`font-bold text-sm ${dk("text-white", "text-[#171717]")}`}>
            Sin movimiento (últimos 90 días)
          </h3>
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
            stale.length > 0
              ? "bg-blue-500/15 text-blue-400"
              : dk("bg-[#1c1c1c] text-gray-500", "bg-[#f0f0f0] text-[#a3a3a3]")
          }`}>
            {stale.length}
          </span>
          {stale.length > 0 && (
            <button
              onClick={exportStale}
              className={`ml-auto flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border transition ${dk("border-[#2a2a2a] text-gray-400 hover:text-white hover:bg-[#1c1c1c]", "border-[#e5e5e5] text-[#737373] hover:bg-[#f5f5f5]")}`}
            >
              <Download size={10} /> CSV
            </button>
          )}
        </div>

        {stale.length === 0 ? (
          <div className={`text-center py-8 text-sm ${dk("text-gray-600", "text-[#a3a3a3]")} ${bg} border rounded-xl`}>
            Todos los productos tuvieron movimiento recientemente.
          </div>
        ) : (
          <div className={`rounded-xl border overflow-hidden ${dk("border-[#1f1f1f]", "border-[#e5e5e5]")}`}>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className={`${th} text-left`}>Producto</th>
                  <th className={`${th} text-left hidden sm:table-cell`}>Categoría</th>
                  <th className={`${th} text-right hidden sm:table-cell`}>Precio</th>
                  <th className={`${th} text-center`}>Stock</th>
                  <th className={`${th} text-right`}>Último pedido</th>
                </tr>
              </thead>
              <tbody>
                {stale.map((p, i) => (
                  <tr key={p.id} className={`border-t ${dk("border-[#1a1a1a]", "border-[#f0f0f0]")} ${i % 2 === 0 ? rowEven : rowOdd}`}>
                    <td className="px-3 py-2.5">
                      <p className={`font-medium text-xs ${dk("text-gray-200", "text-[#171717]")}`}>{p.name}</p>
                      {p.sku && <p className={`text-[10px] font-mono ${dk("text-gray-600", "text-[#a3a3a3]")}`}>{p.sku}</p>}
                    </td>
                    <td className={`hidden sm:table-cell px-3 py-2.5 text-xs ${dk("text-gray-500", "text-[#737373]")}`}>{p.category}</td>
                    <td className={`hidden sm:table-cell px-3 py-2.5 text-right text-xs font-semibold text-[#2D9F6A]`}>
                      {formatPrice(p.cost_price)}
                    </td>
                    <td className={`px-3 py-2.5 text-center text-xs ${dk("text-gray-400", "text-[#525252]")}`}>{p.stock}</td>
                    <td className="px-3 py-2.5 text-right">
                      <div className={`flex items-center justify-end gap-1 text-[11px] ${p.days_stale >= 9999 ? "text-blue-400" : dk("text-gray-500", "text-[#737373]")}`}>
                        <Clock size={10} />
                        {p.days_stale >= 9999 ? "Nunca" : `${p.days_stale}d`}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Revenue por cliente (últimos 90 días) ──── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Users size={15} className="text-[#2D9F6A]" />
          <h3 className={`font-bold text-sm ${dk("text-white", "text-[#171717]")}`}>
            Revenue por cliente <span className={`text-[11px] font-normal ${dk("text-gray-500", "text-[#a3a3a3]")}`}>· últimos 90 días</span>
          </h3>
          <button
            onClick={loadAnalytics}
            disabled={loadingAnalytics}
            className={`ml-auto flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border transition ${dk("border-[#2a2a2a] text-gray-400 hover:text-white hover:bg-[#1c1c1c]", "border-[#e5e5e5] text-[#737373] hover:bg-[#f5f5f5]")} disabled:opacity-40`}
          >
            <RefreshCw size={10} className={loadingAnalytics ? "animate-spin" : ""} /> Actualizar
          </button>
        </div>

        {loadingAnalytics ? (
          <div className={`h-32 rounded-xl animate-pulse ${dk("bg-[#111]", "bg-white")}`} />
        ) : revenueByClient.length === 0 ? (
          <div className={`text-center py-8 text-sm ${dk("text-gray-600", "text-[#a3a3a3]")} ${bg} border rounded-xl`}>
            Sin datos (vista revenue_by_client).
          </div>
        ) : (
          <div className={`rounded-xl border overflow-hidden ${dk("border-[#1f1f1f]", "border-[#e5e5e5]")}`}>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className={`${th} text-left`}>Cliente</th>
                  <th className={`${th} text-left hidden sm:table-cell`}>Tipo</th>
                  <th className={`${th} text-center`}>Pedidos</th>
                  <th className={`${th} text-right`}>Revenue total</th>
                  <th className={`${th} text-right hidden sm:table-cell`}>Ticket prom.</th>
                  <th className={`${th} text-right hidden md:table-cell`}>Último pedido</th>
                </tr>
              </thead>
              <tbody>
                {revenueByClient.map((r, i) => (
                  <tr key={r.client_id} className={`border-t ${dk("border-[#1a1a1a]", "border-[#f0f0f0]")} ${i % 2 === 0 ? rowEven : rowOdd}`}>
                    <td className={`px-3 py-2.5 text-xs font-medium ${dk("text-gray-200", "text-[#171717]")}`}>
                      {r.company_name || r.client_id?.slice(0, 8)}
                    </td>
                    <td className={`hidden sm:table-cell px-3 py-2.5 text-xs ${dk("text-gray-500", "text-[#737373]")}`}>
                      {r.client_type}
                    </td>
                    <td className={`px-3 py-2.5 text-center text-xs ${dk("text-gray-400", "text-[#525252]")}`}>
                      {r.order_count}
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs font-bold text-[#2D9F6A]">
                      {formatPrice(r.total_revenue)}
                    </td>
                    <td className={`hidden sm:table-cell px-3 py-2.5 text-right text-xs ${dk("text-gray-400", "text-[#737373]")}`}>
                      {formatPrice(r.avg_order_value)}
                    </td>
                    <td className={`hidden md:table-cell px-3 py-2.5 text-right text-xs ${dk("text-gray-500", "text-[#a3a3a3]")}`}>
                      {r.last_order_date ? new Date(r.last_order_date).toLocaleDateString("es-AR") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Top productos por revenue ─────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={15} className="text-purple-400" />
          <h3 className={`font-bold text-sm ${dk("text-white", "text-[#171717]")}`}>Top productos por revenue</h3>
        </div>

        {loadingAnalytics ? (
          <div className={`h-32 rounded-xl animate-pulse ${dk("bg-[#111]", "bg-white")}`} />
        ) : topProducts.length === 0 ? (
          <div className={`text-center py-8 text-sm ${dk("text-gray-600", "text-[#a3a3a3]")} ${bg} border rounded-xl`}>
            Sin datos (vista top_products_revenue).
          </div>
        ) : (
          <div className={`rounded-xl border overflow-hidden ${dk("border-[#1f1f1f]", "border-[#e5e5e5]")}`}>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className={`${th} text-center w-8`}>#</th>
                  <th className={`${th} text-left`}>Producto</th>
                  <th className={`${th} text-center`}>Unidades</th>
                  <th className={`${th} text-right`}>Revenue</th>
                  <th className={`${th} text-right hidden sm:table-cell`}>Margen bruto</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p, i) => {
                  const marginPct = p.revenue > 0 ? (p.gross_margin / p.revenue) * 100 : 0;
                  return (
                    <tr key={p.product_id} className={`border-t ${dk("border-[#1a1a1a]", "border-[#f0f0f0]")} ${i % 2 === 0 ? rowEven : rowOdd}`}>
                      <td className={`px-3 py-2.5 text-center text-xs font-bold ${dk("text-gray-500", "text-[#a3a3a3]")}`}>
                        {i + 1}
                      </td>
                      <td className={`px-3 py-2.5 text-xs font-medium ${dk("text-gray-200", "text-[#171717]")}`}>
                        {p.product_name}
                      </td>
                      <td className={`px-3 py-2.5 text-center text-xs ${dk("text-gray-400", "text-[#525252]")}`}>
                        {p.units_sold}
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs font-bold text-[#2D9F6A]">
                        {formatPrice(p.revenue)}
                      </td>
                      <td className="hidden sm:table-cell px-3 py-2.5 text-right text-xs">
                        <span className={marginPct >= 20 ? "text-emerald-400 font-semibold" : dk("text-gray-400", "text-[#737373]")}>
                          {formatPrice(p.gross_margin)} ({marginPct.toFixed(1)}%)
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
