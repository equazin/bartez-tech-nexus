import { useCallback, useEffect, useState } from "react";
import { Bell, Loader2 } from "lucide-react";
import { SurfaceCard } from "@/components/ui/surface-card";
import { supabase } from "@/lib/supabase";

type Channel = "email" | "whatsapp";
type NotifEvent = "order_status" | "quote_ready" | "invoice_due" | "stock_restock";

interface PrefRow {
  id?: string;
  profile_id: string;
  event: NotifEvent;
  channel: Channel;
  enabled: boolean;
}

interface NotificationPreferencesProps {
  profileId: string;
}

const EVENTS: Array<{
  key: NotifEvent;
  label: string;
  channels: Channel[];
}> = [
  { key: "order_status", label: "Cambio de estado de pedido", channels: ["email", "whatsapp"] },
  { key: "quote_ready", label: "Cotización lista para revisar", channels: ["email"] },
  { key: "invoice_due", label: "Factura próxima a vencer", channels: ["email"] },
  { key: "stock_restock", label: "Producto favorito volvió a stock", channels: ["email"] },
];

const CHANNEL_LABEL: Record<Channel, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
};

const ALL_CHANNELS: Channel[] = ["email", "whatsapp"];

type PrefsMap = Map<string, boolean>;

function prefKey(event: NotifEvent, channel: Channel): string {
  return `${event}:${channel}`;
}

function buildDefaultPrefs(): PrefsMap {
  const map = new Map<string, boolean>();
  for (const ev of EVENTS) {
    for (const ch of ev.channels) {
      map.set(prefKey(ev.key, ch), true);
    }
  }
  return map;
}

export function NotificationPreferences({ profileId }: NotificationPreferencesProps) {
  const [prefs, setPrefs] = useState<PrefsMap>(buildDefaultPrefs());
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadPrefs = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from("notification_preferences")
        .select("event, channel, enabled")
        .eq("profile_id", profileId);

      if (fetchError) throw fetchError;

      const fresh = buildDefaultPrefs();
      if (data) {
        for (const row of data as PrefRow[]) {
          const key = prefKey(row.event as NotifEvent, row.channel as Channel);
          fresh.set(key, row.enabled);
        }
      }
      setPrefs(fresh);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las preferencias.");
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    void loadPrefs();
  }, [loadPrefs]);

  async function handleToggle(event: NotifEvent, channel: Channel) {
    const key = prefKey(event, channel);
    const current = prefs.get(key) ?? true;
    const next = !current;

    // Optimistic update
    setPrefs((prev) => new Map(prev).set(key, next));
    setToggling(key);
    setError("");

    try {
      const { error: upsertError } = await supabase
        .from("notification_preferences")
        .upsert(
          { profile_id: profileId, event, channel, enabled: next },
          { onConflict: "profile_id,event,channel" }
        );
      if (upsertError) throw upsertError;
    } catch (err) {
      // Revert on failure
      setPrefs((prev) => new Map(prev).set(key, current));
      setError(err instanceof Error ? err.message : "No se pudo guardar la preferencia.");
    } finally {
      setToggling(null);
    }
  }

  function isApplicable(event: NotifEvent, channel: Channel): boolean {
    return EVENTS.find((e) => e.key === event)?.channels.includes(channel) ?? false;
  }

  const activeChannels = ALL_CHANNELS.filter((ch) =>
    EVENTS.some((ev) => ev.channels.includes(ch))
  );

  return (
    <SurfaceCard tone="default" padding="md" className="space-y-4">
      <div className="flex items-center gap-2">
        <Bell size={15} className="text-primary" />
        <h3 className="text-sm font-bold text-foreground">Notificaciones</h3>
      </div>

      <p className="text-xs text-muted-foreground">
        Activá o desactivá cada canal por evento. Los cambios se guardan automáticamente.
      </p>

      {error && (
        <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 size={16} className="animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="pb-2 pr-4 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Evento
                </th>
                {activeChannels.map((ch) => (
                  <th
                    key={ch}
                    className="pb-2 px-4 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    {CHANNEL_LABEL[ch]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {EVENTS.map((ev) => {
                return (
                  <tr key={ev.key}>
                    <td className="py-3 pr-4 text-xs text-foreground">{ev.label}</td>
                    {activeChannels.map((ch) => {
                      const key = prefKey(ev.key, ch);
                      const applicable = isApplicable(ev.key, ch);
                      const enabled = prefs.get(key) ?? true;
                      const isTogglingThis = toggling === key;

                      return (
                        <td key={ch} className="py-3 px-4 text-center">
                          {applicable ? (
                            <button
                              type="button"
                              onClick={() => handleToggle(ev.key, ch)}
                              disabled={isTogglingThis}
                              aria-label={`${enabled ? "Desactivar" : "Activar"} ${ev.label} por ${CHANNEL_LABEL[ch]}`}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-60 ${
                                enabled ? "bg-primary" : "bg-muted"
                              }`}
                            >
                              {isTogglingThis ? (
                                <Loader2
                                  size={10}
                                  className="absolute left-1/2 -translate-x-1/2 animate-spin text-white"
                                />
                              ) : (
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                                    enabled ? "translate-x-6" : "translate-x-1"
                                  }`}
                                />
                              )}
                            </button>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/40">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SurfaceCard>
  );
}
