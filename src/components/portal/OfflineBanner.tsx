import { WifiOff } from "lucide-react";

import { useOnlineStatus } from "@/hooks/useOnlineStatus";

/**
 * Sticky top banner that appears whenever the browser reports `navigator.onLine === false`.
 *
 * Designed for portal users (especially sellers in the field). Communicates
 * exactly what still works without a connection: the cart, saved drafts and
 * recently-viewed products stay editable; everything else will retry on
 * reconnect.
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div className="sticky top-0 z-40 border-b border-amber-500/40 bg-amber-500/10 px-3 py-2 backdrop-blur">
      <div className="mx-auto flex max-w-[1440px] items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-300">
        <WifiOff size={14} className="shrink-0" />
        <span>
          Estás sin conexión. Tu carrito y borradores siguen guardados localmente; los cambios se enviarán cuando vuelva la red.
        </span>
      </div>
    </div>
  );
}
