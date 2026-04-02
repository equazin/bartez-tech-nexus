import { useMemo } from "react";
import { 
  Users, TrendingUp, AlertTriangle, Package, Activity, 
  ShoppingBag, Target, ArrowRight, Download, Sparkles, 
  Trash2, Info, Clock, Archive, Search, RefreshCcw, UserX, UserCheck, BarChart3, Zap
} from "lucide-react";

interface InsightProps {
  clients: Array<{ id: string; company_name?: string; contact_name?: string; last_order_date?: string; total_orders: number }>;
  orders: Array<{ id: string; client_id: string; total: number; status: string; created_at: string }>;
  isDark: boolean;
  onNavigate: (tab: string) => void;
}

export function B2BInsights({ clients, orders, isDark, onNavigate }: InsightProps) {
  const dk = (d: string, l: string) => (isDark ? d : l);

  // 1. Churn Risk: Clients who haven't ordered in 30+ days but have 3+ orders
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

  // 2. High Value Clients: Top clients by volume in last 3 months
  const powerSellers = useMemo(() => {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const volumes: Record<string, number> = {};
    orders
      .filter(o => new Date(o.created_at) > ninetyDaysAgo && o.status !== 'rejected')
      .forEach(o => {
        volumes[o.client_id] = (volumes[o.client_id] || 0) + o.total;
      });

    return Object.entries(volumes)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 4)
      .map(([id, vol]) => ({
        client: clients.find(c => c.id === id),
        volume: vol
      }));
  }, [orders, clients]);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* 💳 Churn Risk Segment */}
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
                  <p className="text-[10px] text-gray-500">Última: {c.last_order_date ? new Date(c.last_order_date).toLocaleDateString() : "---"}</p>
                </div>
                <button 
                  onClick={() => onNavigate("clients")}
                  className={`p-1.5 rounded-lg border transition ${dk("border-[#262626] hover:bg-[#1a1a1a]", "border-[#e5e5e5] hover:bg-white")}`}
                >
                  <Activity size={11} className="text-[#EAB308]" />
                </button>
              </div>
            ))}
            {churnRisk.length === 0 && <p className="text-xs text-center py-4 text-[#525252]">No hay alertas críticas.</p>}
          </div>
        </div>

        {/* 🚀 Power Sellers - Top Performance */}
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
                  <p className="text-[10px] text-emerald-400 font-bold">$ {volume.toLocaleString()}</p>
                </div>
                <div className={`h-8 w-8 rounded-full border flex items-center justify-center ${dk("border-[#2D9F6A]/20 bg-[#2D9F6A]/10 text-[#2D9F6A]", "border-[#e5e5e5] bg-white")}`}>
                  <UserCheck size={12} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── STOCK AGING / INMOVILIZADO ── */}
        <div className={`p-6 rounded-2xl border ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-amber-400">
              <Archive size={16} />
              <h3 className="text-sm font-bold uppercase tracking-widest">Stock Inmovilizado</h3>
            </div>
            <Sparkles size={14} className="text-amber-400" />
          </div>
          <p className="text-[11px] text-[#525252] mb-4">Capital atrapado en productos con +60 días sin rotación.</p>
          
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className={`p-3 rounded-xl border ${dk("bg-[#0d0d0d] border-[#1a1a1a]", "bg-gray-50 border-[#eee]")}`}>
              <p className="text-[9px] text-gray-500 uppercase font-bold">SKUs en riesgo</p>
              <p className="text-sm font-extrabold text-amber-400">12</p>
            </div>
            <div className={`p-3 rounded-xl border ${dk("bg-[#0d0d0d] border-[#1a1a1a]", "bg-gray-50 border-[#eee]")}`}>
              <p className="text-[9px] text-gray-500 uppercase font-bold">Valor Est.</p>
              <p className="text-sm font-extrabold text-[#2D9F6A]">USD 4.5k</p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-amber-400/5 border border-amber-400/10">
            <p className="text-[10px] text-gray-400 leading-tight italic">
              "Línea de Accesorios Gamers sin ventas hace 72 días. Recomendamos cupón de liquidación."
            </p>
          </div>
        </div>
      </div>

      {/* ── STOCK FORECAST / REPOSICIÓN (Phase 4.4) ── */}
      <div className={`p-6 rounded-3xl border ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-blue-400/10 flex items-center justify-center">
              <Zap size={20} className="text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Inteligencia de Reposición (Stock Forecast)</h3>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Planificación de Compras</p>
            </div>
          </div>
          <button className="text-[10px] font-bold text-blue-500 hover:underline uppercase">Ver Orden de Compra Sugerida</button>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {[
            { label: "Quiebre detectado", value: "3 SKUs", color: "text-red-400" },
            { label: "Tiempo de Arribo Est.", value: "14 días", color: "text-blue-400" },
            { label: "Mejor Proveedor", value: "Elit S.A.", color: "text-[#2D9F6A]" },
          ].map((stat) => (
            <div key={stat.label} className={`p-4 rounded-2xl border ${dk("bg-[#0d0d0d] border-[#1a1a1a]", "bg-gray-50 border-[#eee]")}`}>
              <span className="text-[10px] text-gray-500 font-medium uppercase">{stat.label}</span>
              <p className={`text-base font-extrabold mt-1 ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 p-4 rounded-2xl bg-blue-400/5 border border-blue-400/10">
          <p className="text-[11px] text-blue-300 font-bold mb-1 tracking-tight flex items-center gap-2">
            <Sparkles size={14} /> Alerta de tendencia
          </p>
          <p className="text-[10px] text-gray-400 leading-relaxed italic">
            "Tu stock de 'Discos Sólidos 480GB' se agotará en aproximadamente **12 días** según la tendencia de ventas actual. 
            Elit S.A. tiene el mejor precio hoy (USD 32.50). ¿Quieres preparar el pedido?"
          </p>
        </div>
      </div>

      {/* Quick Actions (B2B Argentina) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Validar Padrón AFIP", icon: Search, color: "text-blue-400", bg: "bg-blue-400/10" },
          { label: "Vencimientos CC", icon: AlertTriangle, color: "text-red-400", bg: "bg-red-400/10" },
          { label: "Exportar deudas ARBA", icon: BarChart3, color: "text-purple-400", bg: "bg-purple-400/10" },
          { label: "Conciliación Bancaria", icon: RefreshCcw, color: "text-emerald-400", bg: "bg-emerald-400/10" },
        ].map(({ label, icon: Icon, color, bg }) => (
          <button 
            key={label} 
            className={`flex items-center gap-3 p-4 rounded-2xl border text-left transition ${dk("border-[#1f1f1f] bg-[#111] hover:border-[#333]", "bg-white border-[#e5e5e5] hover:border-[#d4d4d4]")}`}
          >
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
