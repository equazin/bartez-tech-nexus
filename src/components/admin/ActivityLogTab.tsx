import { useState, useEffect, useMemo } from "react";
import { RefreshCw, Search, Activity } from "lucide-react";
import { fetchActivityLogs } from "@/lib/api/activityLog";
import type { ActivityLog, ActivityAction } from "@/models/activityLog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SurfaceCard } from "@/components/ui/surface-card";
import { cn } from "@/lib/utils";

const ACTION_LABELS: Record<ActivityAction, string> = {
  login: "Inicio de sesion",
  logout: "Cierre de sesion",
  search: "Busqueda",
  view_product: "Vista producto",
  add_to_cart: "Agrego al carrito",
  remove_from_cart: "Quito del carrito",
  place_order: "Realizo pedido",
  order_status_change: "Cambio de estado",
  save_quote: "Guardo cotizacion",
  load_quote: "Cargo cotizacion",
  export_csv: "Exporto CSV",
  export_pdf: "Exporto PDF",
};

const ACTION_COLORS: Partial<Record<ActivityAction, string>> = {
  place_order: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  order_status_change: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  add_to_cart: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  search: "bg-muted text-muted-foreground",
  login: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  logout: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  export_csv: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  export_pdf: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
};

interface Props { isDark?: boolean }

export function ActivityLogTab({ isDark: _isDark = true }: Props) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [filterAction, setFilterAction] = useState<ActivityAction | "all">("all");

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

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => logs.filter((log) => {
    if (filterAction !== "all" && log.action !== filterAction) return false;
    if (!filter) return true;
    const text = filter.toLowerCase();
    return (
      log.action.includes(text) ||
      ACTION_LABELS[log.action as ActivityAction]?.toLowerCase().includes(text) ||
      log.entity_type?.includes(text) ||
      log.entity_id?.includes(text)
    );
  }), [filter, filterAction, logs]);

  return (
    <div className="space-y-4">
      <SurfaceCard tone="default" padding="md" className="rounded-[24px] border-border/70">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Sistema</p>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Log de actividad</h2>
              <p className="text-sm text-muted-foreground">{filtered.length} eventos del comportamiento operativo y comercial.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterAction}
              onChange={(event) => setFilterAction(event.target.value as ActivityAction | "all")}
              className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground outline-none focus:border-primary/40"
            >
              <option value="all">Todas las acciones</option>
              {(Object.entries(ACTION_LABELS) as [ActivityAction, string][]).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <label className="relative block">
              <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Filtrar actividad"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                className="h-10 rounded-xl border border-border/70 bg-background pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40"
              />
            </label>
            <Button variant="toolbar" size="icon" className="h-10 w-10 rounded-xl" onClick={() => void load()} disabled={loading}>
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            </Button>
          </div>
        </div>
      </SurfaceCard>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-14 animate-pulse rounded-2xl bg-card" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState title="Sin actividad" description="No hay eventos registrados para los filtros actuales." icon={<Activity size={24} />} />
      ) : (
        <SurfaceCard tone="default" padding="none" className="overflow-hidden rounded-[24px] border-border/70">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-muted/50 text-left text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                <th className="px-4 py-3">Accion</th>
                <th className="hidden px-4 py-3 sm:table-cell">Entidad</th>
                <th className="hidden px-4 py-3 md:table-cell">ID</th>
                <th className="px-4 py-3 text-right">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((log, index) => {
                const colorClass = ACTION_COLORS[log.action as ActivityAction] ?? "bg-muted text-muted-foreground";
                const date = new Date(log.created_at);
                return (
                  <tr key={log.id} className={cn(index > 0 && "border-t border-border/70", index % 2 === 0 ? "bg-card" : "bg-secondary/20")}>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold", colorClass)}>
                        {ACTION_LABELS[log.action as ActivityAction] ?? log.action}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-muted-foreground sm:table-cell">{log.entity_type ?? "-"}</td>
                    <td className="hidden px-4 py-3 font-mono text-[11px] text-muted-foreground md:table-cell">{log.entity_id ?? "-"}</td>
                    <td className="px-4 py-3 text-right text-[11px] text-muted-foreground">
                      {date.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </SurfaceCard>
      )}
    </div>
  );
}
