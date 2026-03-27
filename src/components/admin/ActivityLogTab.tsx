import { useState, useEffect } from "react";
import { RefreshCw, Search, Activity } from "lucide-react";
import { fetchActivityLogs } from "@/lib/api/activityLog";
import type { ActivityLog, ActivityAction } from "@/models/activityLog";

const ACTION_LABELS: Record<ActivityAction, string> = {
  login:               "Inicio de sesión",
  logout:              "Cierre de sesión",
  search:              "Búsqueda",
  view_product:        "Vista producto",
  add_to_cart:         "Agregó al carrito",
  remove_from_cart:    "Quitó del carrito",
  place_order:         "Realizó pedido",
  order_status_change: "Cambio de estado",
  save_quote:          "Guardó cotización",
  load_quote:          "Cargó cotización",
  export_csv:          "Exportó CSV",
  export_pdf:          "Exportó PDF",
};

const ACTION_COLORS: Partial<Record<ActivityAction, string>> = {
  place_order:         "bg-green-500/15 text-green-400",
  order_status_change: "bg-blue-500/15 text-blue-400",
  add_to_cart:         "bg-blue-500/15 text-blue-400",
  search:              "bg-gray-500/15 text-gray-400",
  login:               "bg-teal-500/15 text-teal-400",
  logout:              "bg-orange-500/15 text-orange-400",
  export_csv:          "bg-purple-500/15 text-purple-400",
  export_pdf:          "bg-purple-500/15 text-purple-400",
};

interface Props { isDark?: boolean }

export function ActivityLogTab({ isDark = true }: Props) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const dk = (d: string, l: string) => isDark ? d : l;

  async function load() {
    setLoading(true);
    try {
      setLogs(await fetchActivityLogs({ limit: 200 }));
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = logs.filter((l) => {
    if (!filter) return true;
    const t = filter.toLowerCase();
    return (
      l.action.includes(t) ||
      ACTION_LABELS[l.action as ActivityAction]?.toLowerCase().includes(t) ||
      l.entity_type?.includes(t) ||
      l.entity_id?.includes(t)
    );
  });

  const bg = dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]");
  const th = `text-[10px] font-bold uppercase tracking-wide px-3 py-2 ${dk("text-[#525252] bg-[#0a0a0a]", "text-[#a3a3a3] bg-[#f5f5f5]")}`;

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className={`font-bold text-base ${dk("text-white", "text-[#171717]")}`}>Log de Actividad</h2>
          <p className={`text-xs ${dk("text-gray-500", "text-[#737373]")} mt-0.5`}>{filtered.length} eventos</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
            <input
              type="text"
              placeholder="Filtrar…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className={`pl-7 pr-3 py-2 text-xs border rounded-lg outline-none transition ${dk("bg-[#0d0d0d] border-[#222] text-white focus:border-[#2D9F6A]/50 placeholder:text-[#404040]", "bg-white border-[#e5e5e5] text-[#171717] focus:border-[#2D9F6A]/50 placeholder:text-[#c4c4c4]")}`}
            />
          </div>
          <button
            onClick={load}
            disabled={loading}
            className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition ${dk("border-[#2a2a2a] text-gray-400 hover:text-white hover:bg-[#1c1c1c]", "border-[#e5e5e5] text-[#737373] hover:bg-[#f5f5f5]")} disabled:opacity-40`}
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className={`text-center py-12 text-sm ${dk("text-gray-500", "text-[#a3a3a3]")}`}>Cargando…</div>
      ) : filtered.length === 0 ? (
        <div className={`text-center py-12 ${bg} border rounded-xl`}>
          <Activity size={28} className="mx-auto mb-2 opacity-20" />
          <p className={`text-sm ${dk("text-gray-500", "text-[#a3a3a3]")}`}>Sin actividad registrada.</p>
        </div>
      ) : (
        <div className={`rounded-xl border overflow-hidden ${dk("border-[#1f1f1f]", "border-[#e5e5e5]")}`}>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className={`${th} text-left`}>Acción</th>
                <th className={`${th} text-left hidden sm:table-cell`}>Entidad</th>
                <th className={`${th} text-left hidden md:table-cell`}>ID</th>
                <th className={`${th} text-right`}>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((log, i) => {
                const colorCls = ACTION_COLORS[log.action as ActivityAction] ?? dk("bg-gray-500/10 text-gray-400", "bg-gray-100 text-gray-600");
                const date = new Date(log.created_at);
                return (
                  <tr key={log.id} className={`border-t ${dk("border-[#1a1a1a]", "border-[#f0f0f0]")} ${i % 2 === 0 ? dk("bg-[#111]", "bg-white") : dk("bg-[#0d0d0d]", "bg-[#fafafa]")}`}>
                    <td className="px-3 py-2.5">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${colorCls}`}>
                        {ACTION_LABELS[log.action as ActivityAction] ?? log.action}
                      </span>
                    </td>
                    <td className={`hidden sm:table-cell px-3 py-2.5 text-xs ${dk("text-gray-500", "text-[#737373]")}`}>
                      {log.entity_type ?? "—"}
                    </td>
                    <td className={`hidden md:table-cell px-3 py-2.5 text-[11px] font-mono ${dk("text-gray-600", "text-[#a3a3a3]")}`}>
                      {log.entity_id ?? "—"}
                    </td>
                    <td className={`px-3 py-2.5 text-right text-[11px] ${dk("text-gray-600", "text-[#a3a3a3]")}`}>
                      {date.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
