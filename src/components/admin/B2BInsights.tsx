import { useMemo, useEffect, useState } from "react";
import {
  TrendingUp, AlertTriangle, Package,
  Activity, Archive, Sparkles,
  RefreshCcw, UserX, UserCheck, BarChart3, Zap, Search,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface InsightProps {
  clients: Array<{ id: string; company_name?: string; contact_name?: string; last_order_date?: string; total_orders: number }>;
  orders: Array<{ id: string; client_id: string; total: number; status: string; created_at: string }>;
  isDark: boolean;
  onNavigate: (tab: string) => void;
}

interface StockRiskProduct {
  id: number;
  name: string;
  sku: string | null;
  stock: number;
  cost_price: number | null;
  supplier_name: string | null;
}

export function B2BInsights({ clients, orders, isDark, onNavigate }: InsightProps) {
  const dk = (d: string, l: string) => (isDark ? d : l);

  // ── 1. Churn Risk ─────────────────────────────────────────────
  const churnRisk = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return clients
      .filter(c => {
        const lastOrder = c.last_order_date ? new Date(c.last_order_date) : null;
        return lastOrder && lastOrder < thirtyDaysAgo && c.total_orders >= 3;
      })
      .slice(0, 4);
  }, [clients]);

  // ── 2. Power Sellers ──────────────────────────────────────────
  const powerSellers = useMemo(() => {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const volumes: Record<string, number> = {};
    orders
      .filter(o => new Date(o.created_at) > ninetyDaysAgo && o.status !== "rejected")
      .forEach(o => { volumes[o.client_id] = (volumes[o.client_id] || 0) + o.total; });
    return Object.entries(volumes)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 4)
      .map(([id, vol]) => ({ client: clients.find(c => c.id === id), volume: vol }));
  }, [orders, clients]);

  // ── 3. Stock Inmovilizado — real DB query ──────────────────────
  // Products with stock > 0 but very low stock (below stock_min) or
  // high stock that hasn't moved (using stock_min as proxy for slow movers)
  const [stockRisk, setStockRisk]     = useState<StockRiskProduct[]>([]);
  const [stockLoading, setStockLoading] = useState(true);
  const [stockTotalValue, setStockTotalValue] = useState(0);

  useEffect(() => {
    async function loadStockRisk() {
      setStockLoading(true);
      // Products with stock > stock_min * 3 (overstocked / slow movers)
      // OR products that are below stock_min (risk of stockout)
      const { data } = await supabase
        .from("products")
        .select("id, name, sku, stock, stock_min, cost_price, brand_name")
        .eq("active", true)
        .gt("stock", 0)
        .order("stock", { ascending: false })
        .limit(200);

      if (!data) { setStockLoading(false); return; }

      // Identify overstocked: stock > stock_min * 4 (capital inmovilizado)
      const overstocked = (data as any[])
        .filter(p => (p.stock_min ?? 0) > 0 && p.stock > (p.stock_min * 4))
        .sort((a: any, b: any) => {
          const aVal = (a.stock - a.stock_min * 2) * (a.cost_price ?? 0);
          const bVal = (b.stock - b.stock_min * 2) * (b.cost_price ?? 0);
          return bVal - aVal;
        })
        .slice(0, 5)
        .map((p: any) => ({
          id: p.id, name: p.name, sku: p.sku,
          stock: p.stock, cost_price: p.cost_price, supplier_name: p.brand_name,
        }));

      // Also get products near stockout
      const nearStockout = (data as any[])
        .filter(p => (p.stock_min ?? 0) > 0 && p.stock <= p.stock_min && p.stock > 0)
        .slice(0, 5)
        .map((p: any) => ({
          id: p.id, name: p.name, sku: p.sku,
          stock: p.stock, cost_price: p.cost_price, supplier_name: p.brand_name,
        }));

      setStockRisk(overstocked);

      // Total estimated value of overstocked units
      const totalVal = overstocked.reduce((s, p) => {
        const excess = Math.max(0, p.stock - ((data as any[]).find(d => d.id === p.id)?.stock_min ?? 0) * 2);
        return s + excess * (p.cost_price ?? 0);
      }, 0);
      setStockTotalValue(totalVal);

      // Store near-stockout separately for the forecast section
      setNearStockout(nearStockout);
      setStockLoading(false);
    }
    void loadStockRisk();
  }, []);

  const [nearStockout, setNearStockout] = useState<StockRiskProduct[]>([]);

  const fmtUSD = (n: number) => n > 0 ? `USD ${(n / 1000).toFixed(1)}k` : "USD 0";

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Churn Risk */}
        <div className={`p-6 rounded-2xl border ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
          <div className="flex items-center gap-2 mb-4 text-[#EAB308]">
            <UserX size={16} />
            <h3 className="text-sm font-bold uppercase tracking-widest">Riesgo de Churn (30d+)</h3>
          </div>
          <p className="text-[11px] text-[#525252] mb-4">Clientes recurrentes que dejaron de comprar recientemente.</p>
          <div className="space-y-3">
            {churnRisk.map(c => (
              <div key={c.id} className={`flex items-center justify-between p-3 rounded-xl border ${dk("bg-[#0a0a0a] border-[#1a1a1a]", "bg-[#fafafa] border-[#f0f0f0]")}`}>
                <div className="min-w-0">
                  <p className={`text-xs font-bold truncate ${dk("text-white", "text-[#171717]")}`}>{c.company_name || c.contact_name}</p>
                  <p className="text-[10px] text-gray-500">Última: {c.last_order_date ? new Date(c.last_order_date).toLocaleDateString("es-AR") : "---"}</p>
                </div>
                <button onClick={() => onNavigate("clients")}
                  className={`p-1.5 rounded-lg border transition ${dk("border-[#262626] hover:bg-[#1a1a1a]", "border-[#e5e5e5] hover:bg-white")}`}>
                  <Activity size={11} className="text-[#EAB308]" />
                </button>
              </div>
            ))}
            {churnRisk.length === 0 && <p className="text-xs text-center py-4 text-[#525252]">No hay alertas críticas.</p>}
          </div>
        </div>

        {/* Power Sellers */}
        <div className={`p-6 rounded-2xl border ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
          <div className="flex items-center gap-2 mb-4 text-[#2D9F6A]">
            <TrendingUp size={16} />
            <h3 className="text-sm font-bold uppercase tracking-widest">Power Sellers (90d)</h3>
          </div>
          <p className="text-[11px] text-[#525252] mb-4">Clientes con mayor volumen de compra trimestral.</p>
          <div className="space-y-3">
            {powerSellers.map(({ client, volume }) => (
              <div key={client?.id} className={`flex items-center justify-between p-3 rounded-xl border ${dk("bg-[#0a0a0a] border-[#1a1a1a]", "bg-[#fafafa] border-[#f0f0f0]")}`}>
                <div className="min-w-0">
                  <p className={`text-xs font-bold truncate ${dk("text-white", "text-[#171717]")}`}>{client?.company_name || "---"}</p>
                  <p className="text-[10px] text-emerald-400 font-bold">$ {volume.toLocaleString("es-AR")}</p>
                </div>
                <div className={`h-8 w-8 rounded-full border flex items-center justify-center ${dk("border-[#2D9F6A]/20 bg-[#2D9F6A]/10 text-[#2D9F6A]", "border-[#e5e5e5] bg-white")}`}>
                  <UserCheck size={12} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stock Inmovilizado — real data */}
        <div className={`p-6 rounded-2xl border ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-amber-400">
              <Archive size={16} />
              <h3 className="text-sm font-bold uppercase tracking-widest">Stock Inmovilizado</h3>
            </div>
            <Sparkles size={14} className="text-amber-400" />
          </div>
          <p className="text-[11px] text-[#525252] mb-4">Capital atrapado en productos con stock 4x mayor al mínimo.</p>

          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className={`p-3 rounded-xl border ${dk("bg-[#0d0d0d] border-[#1a1a1a]", "bg-gray-50 border-[#eee]")}`}>
              <p className="text-[9px] text-gray-500 uppercase font-bold">SKUs en riesgo</p>
              <p className="text-sm font-extrabold text-amber-400">
                {stockLoading ? "..." : stockRisk.length}
              </p>
            </div>
            <div className={`p-3 rounded-xl border ${dk("bg-[#0d0d0d] border-[#1a1a1a]", "bg-gray-50 border-[#eee]")}`}>
              <p className="text-[9px] text-gray-500 uppercase font-bold">Valor Est.</p>
              <p className="text-sm font-extrabold text-[#2D9F6A]">
                {stockLoading ? "..." : fmtUSD(stockTotalValue)}
              </p>
            </div>
          </div>

          {stockRisk.length > 0 ? (
            <div className="space-y-1.5">
              {stockRisk.slice(0, 3).map(p => (
                <div key={p.id} className={`px-3 py-2 rounded-lg border ${dk("border-amber-500/20 bg-amber-500/5", "border-amber-200 bg-amber-50")}`}>
                  <p className="text-[10px] font-semibold text-amber-400 truncate">{p.name}</p>
                  <p className="text-[9px] text-gray-500">Stock: {p.stock} u. · {p.sku ?? "—"}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-amber-400/5 border border-amber-400/10">
              <p className="text-[10px] text-gray-400 leading-tight italic">
                {stockLoading ? "Analizando inventario..." : "Sin stock inmovilizado detectado."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Stock Forecast / Reposición — real data ── */}
      <div className={`p-6 rounded-3xl border ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-blue-400/10 flex items-center justify-center">
              <Zap size={20} className="text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Alerta de Reposición (Stock Forecast)</h3>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Productos por debajo del mínimo</p>
            </div>
          </div>
          <button onClick={() => onNavigate("stock")} className="text-[10px] font-bold text-blue-500 hover:underline uppercase">
            Ver Stock completo
          </button>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div className={`p-4 rounded-2xl border ${dk("bg-[#0d0d0d] border-[#1a1a1a]", "bg-gray-50 border-[#eee]")}`}>
            <span className="text-[10px] text-gray-500 font-medium uppercase">Quiebres detectados</span>
            <p className="text-base font-extrabold mt-1 text-red-400">
              {stockLoading ? "..." : `${nearStockout.length} SKUs`}
            </p>
          </div>
          <div className={`p-4 rounded-2xl border ${dk("bg-[#0d0d0d] border-[#1a1a1a]", "bg-gray-50 border-[#eee]")}`}>
            <span className="text-[10px] text-gray-500 font-medium uppercase">Stock inmovilizado</span>
            <p className="text-base font-extrabold mt-1 text-amber-400">
              {stockLoading ? "..." : `${stockRisk.length} SKUs`}
            </p>
          </div>
          <div className={`p-4 rounded-2xl border ${dk("bg-[#0d0d0d] border-[#1a1a1a]", "bg-gray-50 border-[#eee]")}`}>
            <span className="text-[10px] text-gray-500 font-medium uppercase">Capital inmovilizado est.</span>
            <p className="text-base font-extrabold mt-1 text-[#2D9F6A]">
              {stockLoading ? "..." : fmtUSD(stockTotalValue)}
            </p>
          </div>
        </div>

        {nearStockout.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className={`text-[10px] uppercase tracking-widest font-bold ${dk("text-[#525252]", "text-[#a3a3a3]")}`}>
              Productos por reponer ahora
            </p>
            {nearStockout.map(p => (
              <div key={p.id} className="p-3 rounded-xl bg-red-400/5 border border-red-400/20 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className={`text-xs font-semibold truncate ${dk("text-white", "text-[#171717]")}`}>{p.name}</p>
                  <p className="text-[10px] text-gray-500">{p.sku ?? "—"} · Stock actual: <span className="text-red-400 font-bold">{p.stock} u.</span></p>
                </div>
                {p.supplier_name && (
                  <span className="text-[10px] text-[#2D9F6A] bg-[#2D9F6A]/10 border border-[#2D9F6A]/20 px-2 py-0.5 rounded-full whitespace-nowrap">
                    {p.supplier_name}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {!stockLoading && nearStockout.length === 0 && (
          <div className="mt-4 p-4 rounded-2xl bg-blue-400/5 border border-blue-400/10">
            <p className="text-[11px] text-blue-300 font-bold mb-1 tracking-tight flex items-center gap-2">
              <Sparkles size={14} /> Sin alertas urgentes
            </p>
            <p className="text-[10px] text-gray-400 leading-relaxed">
              Todos los productos tienen stock por encima del mínimo configurado.
            </p>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Validar Padrón AFIP", icon: Search, color: "text-blue-400", bg: "bg-blue-400/10", tab: "clients" },
          { label: "Vencimientos CC",      icon: AlertTriangle, color: "text-red-400", bg: "bg-red-400/10", tab: "invoices" },
          { label: "Exportar deudas",      icon: BarChart3, color: "text-purple-400", bg: "bg-purple-400/10", tab: "reports" },
          { label: "Ver Stock",            icon: Package, color: "text-emerald-400", bg: "bg-emerald-400/10", tab: "stock" },
        ].map(({ label, icon: Icon, color, bg, tab }) => (
          <button key={label} onClick={() => onNavigate(tab)}
            className={`flex items-center gap-3 p-4 rounded-2xl border text-left transition ${dk("border-[#1f1f1f] bg-[#111] hover:border-[#333]", "bg-white border-[#e5e5e5] hover:border-[#d4d4d4]")}`}>
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${bg} ${color}`}>
              <Icon size={18} />
            </div>
            <span className={`text-xs font-bold ${dk("text-[#d4d4d4]", "text-[#404040]")}`}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
