import { useEffect } from "react";
import { AlertTriangle, PackageX, RefreshCw, TrendingDown, Clock } from "lucide-react";
import { useReports } from "@/hooks/useReports";
import type { Product } from "@/models/products";

interface Props {
  products: Product[];
  orders: { products: any[]; created_at: string }[];
  formatPrice: (n: number) => string;
  isDark?: boolean;
}

export function ReportsTab({ products, orders, formatPrice, isDark = true }: Props) {
  const { lowStock, stale, loading, error, refresh } = useReports(products, orders);
  const dk = (d: string, l: string) => isDark ? d : l;

  useEffect(() => { refresh(); }, []); // eslint-disable-line

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
    </div>
  );
}
