import { Loader2, RefreshCw, WifiOff } from "lucide-react";

import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useSyncQueue } from "@/hooks/useSyncQueue";

/**
 * Sticky top banner that appears whenever the browser reports
 * `navigator.onLine === false` or when there are queued offline actions
 * waiting to sync. Designed for portal users (field sellers).
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  const { count, draining, drain } = useSyncQueue();

  if (online && count === 0) return null;

  if (!online) {
    return (
      <div className="sticky top-0 z-40 border-b border-amber-500/40 bg-amber-500/10 px-3 py-2 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-300">
          <WifiOff size={14} className="shrink-0" />
          <span>
            Estás sin conexión. Tu carrito y borradores siguen guardados;
            {count > 0 ? ` ${count} acción${count === 1 ? "" : "es"} pendiente${count === 1 ? "" : "s"} de sincronizar.` : " todo se enviará al volver la red."}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="sticky top-0 z-40 border-b border-blue-500/40 bg-blue-500/10 px-3 py-2 backdrop-blur">
      <div className="mx-auto flex max-w-[1440px] items-center gap-2 text-xs font-medium text-blue-700 dark:text-blue-300">
        {draining ? (
          <Loader2 size={14} className="shrink-0 animate-spin" />
        ) : (
          <RefreshCw size={14} className="shrink-0" />
        )}
        <span className="flex-1">
          {draining
            ? `Sincronizando ${count} acción${count === 1 ? "" : "es"} pendiente${count === 1 ? "" : "s"}…`
            : `${count} acción${count === 1 ? "" : "es"} pendiente${count === 1 ? "" : "s"} de sincronizar.`}
        </span>
        {!draining && (
          <button
            type="button"
            onClick={() => void drain()}
            className="rounded-md border border-blue-500/40 px-2 py-0.5 text-[11px] hover:bg-blue-500/20"
          >
            Reintentar
          </button>
        )}
      </div>
    </div>
  );
}
