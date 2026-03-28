import { useState, useEffect, useCallback } from "react";
import { RefreshCw, ArrowUpCircle, ArrowDownCircle, Package } from "lucide-react";
import { fetchRecentMovements, type StockMovement, type MovementType } from "@/lib/api/stockMovements";

interface Props { isDark?: boolean }

const MOVEMENT_CONFIG: Record<MovementType, { label: string; cls: string; sign: "+" | "-" | "±" }> = {
  sync:       { label: "Sync",       cls: "bg-blue-500/15 text-blue-400 border-blue-500/30",      sign: "±" },
  reserve:    { label: "Reservado",  cls: "bg-amber-500/15 text-amber-400 border-amber-500/30",   sign: "-" },
  unreserve:  { label: "Liberado",   cls: "bg-sky-500/15 text-sky-400 border-sky-500/30",         sign: "+" },
  fulfill:    { label: "Despachado", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", sign: "-" },
  adjust:     { label: "Ajuste",     cls: "bg-purple-500/15 text-purple-400 border-purple-500/30",sign: "±" },
  return:     { label: "Devolución", cls: "bg-orange-500/15 text-orange-400 border-orange-500/30",sign: "+" },
};

function MovementBadge({ type }: { type: MovementType }) {
  const cfg = MOVEMENT_CONFIG[type] ?? MOVEMENT_CONFIG.adjust;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

export function StockMovementsTab({ isDark = true }: Props) {
  const dk = (d: string, l: string) => (isDark ? d : l);

  const [movements, setMovements]   = useState<StockMovement[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filterType, setFilterType] = useState<MovementType | "all">("all");
  const [limit, setLimit]           = useState(100);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchRecentMovements(
      limit,
      filterType !== "all" ? filterType : undefined
    );
    setMovements(data);
    setLoading(false);
  }, [limit, filterType]);

  useEffect(() => { load(); }, [load]);

  const deltaColor = (delta: number) => {
    if (delta > 0) return "text-emerald-400";
    if (delta < 0) return "text-red-400";
    return dk("text-gray-400", "text-[#737373]");
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className={`text-base font-bold ${dk("text-white", "text-[#171717]")}`}>Movimientos de Stock</h2>
          <p className="text-xs text-gray-500 mt-0.5">Auditoría completa · {movements.length} registros</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className={`border rounded-lg px-2 py-1.5 text-xs outline-none ${dk("bg-[#111] border-[#2a2a2a] text-gray-300", "bg-white border-[#e5e5e5] text-[#525252]")}`}
          >
            <option value="all">Todos los tipos</option>
            {(Object.keys(MOVEMENT_CONFIG) as MovementType[]).map((t) => (
              <option key={t} value={t}>{MOVEMENT_CONFIG[t].label}</option>
            ))}
          </select>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className={`border rounded-lg px-2 py-1.5 text-xs outline-none ${dk("bg-[#111] border-[#2a2a2a] text-gray-300", "bg-white border-[#e5e5e5] text-[#525252]")}`}
          >
            <option value={50}>Últimos 50</option>
            <option value={100}>Últimos 100</option>
            <option value={250}>Últimos 250</option>
            <option value={500}>Últimos 500</option>
          </select>
          <button
            onClick={load}
            className={`p-2 rounded-lg transition ${dk("text-gray-500 hover:text-white hover:bg-[#1c1c1c]", "text-[#737373] hover:text-[#171717] hover:bg-[#e8e8e8]")}`}
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {(Object.keys(MOVEMENT_CONFIG) as MovementType[]).map((t) => {
          const count = movements.filter((m) => m.movement_type === t).length;
          const cfg   = MOVEMENT_CONFIG[t];
          return (
            <button
              key={t}
              onClick={() => setFilterType(filterType === t ? "all" : t)}
              className={`border rounded-xl px-3 py-2.5 text-left transition ${
                filterType === t
                  ? `${cfg.cls} border-current`
                  : dk("border-[#1f1f1f] bg-[#111] hover:border-[#2e2e2e]", "border-[#e5e5e5] bg-white hover:border-[#d4d4d4]")
              }`}
            >
              <p className={`text-xs font-semibold ${dk("text-white", "text-[#171717]")}`}>{count}</p>
              <p className={`text-[10px] ${dk("text-gray-500", "text-[#737373]")}`}>{cfg.label}</p>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-1.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={`h-12 rounded-lg animate-pulse ${dk("bg-[#111]", "bg-white")}`} />
          ))}
        </div>
      ) : movements.length === 0 ? (
        <div className={`border rounded-xl py-16 text-center text-sm text-gray-500 ${dk("border-[#1f1f1f]", "border-[#e5e5e5]")}`}>
          Sin movimientos registrados.
        </div>
      ) : (
        <div className={`border rounded-xl overflow-hidden ${dk("border-[#1f1f1f]", "border-[#e5e5e5]")}`}>
          {/* Table header */}
          <div className={`grid grid-cols-[160px_1fr_90px_80px_80px_120px] gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-wider ${dk("bg-[#0a0a0a] text-[#525252]", "bg-[#f5f5f5] text-[#a3a3a3]")}`}>
            <span>Fecha</span>
            <span>Producto</span>
            <span>Tipo</span>
            <span className="text-right">Delta</span>
            <span className="text-right">Después</span>
            <span>Referencia</span>
          </div>

          {movements.map((m, idx) => {
            const product = (m as any).products;
            const productName = product?.name ?? `Prod #${m.product_id}`;

            return (
              <div
                key={m.id}
                className={`grid grid-cols-[160px_1fr_90px_80px_80px_120px] gap-2 items-center px-4 py-2.5 text-xs ${
                  idx % 2 === 0
                    ? dk("bg-[#0d0d0d]", "bg-[#fafafa]")
                    : dk("bg-[#111]", "bg-white")
                } ${idx > 0 ? `border-t ${dk("border-[#1a1a1a]", "border-[#f0f0f0]")}` : ""}`}
              >
                {/* Date */}
                <span className="text-[11px] text-gray-500 font-mono">
                  {new Date(m.created_at).toLocaleString("es-AR", {
                    day: "2-digit", month: "2-digit", year: "2-digit",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </span>

                {/* Product */}
                <div className="flex items-center gap-1.5 min-w-0">
                  <Package size={11} className="text-gray-500 shrink-0" />
                  <span className={`truncate ${dk("text-gray-300", "text-[#525252]")}`}>{productName}</span>
                  {product?.sku && (
                    <span className="text-[10px] text-gray-500 font-mono shrink-0">{product.sku}</span>
                  )}
                </div>

                {/* Type badge */}
                <MovementBadge type={m.movement_type} />

                {/* Delta */}
                <div className={`text-right font-bold font-mono ${deltaColor(m.quantity_delta)}`}>
                  {m.quantity_delta > 0 ? "+" : ""}{m.quantity_delta}
                </div>

                {/* After */}
                <div className={`text-right font-mono text-[11px] ${dk("text-gray-400", "text-[#737373]")}`}>
                  {m.stock_after ?? "—"}
                </div>

                {/* Reference */}
                <div className="min-w-0">
                  {m.reference_type && (
                    <span className={`text-[10px] truncate block ${dk("text-gray-500", "text-[#a3a3a3]")}`}>
                      {m.reference_type}
                      {m.reference_id ? ` #${String(m.reference_id).slice(-6)}` : ""}
                    </span>
                  )}
                  {m.notes && (
                    <span className={`text-[10px] truncate block italic ${dk("text-gray-600", "text-[#b4b4b4]")}`}>
                      {m.notes}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
