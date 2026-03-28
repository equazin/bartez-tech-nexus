import { useState, useEffect, useRef } from "react";
import { Bell, X, CheckCheck, ShoppingBag, FileText, Package, AlertTriangle, CreditCard } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  fetchNotifications,
  markNotificationsRead,
  markOneNotificationRead,
  type AppNotification,
} from "@/lib/api/clientDetail";

// ── Icon per notification type ─────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { icon: any; cls: string }> = {
  new_order:     { icon: ShoppingBag,   cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  order_status:  { icon: ShoppingBag,   cls: "text-blue-400 bg-blue-500/10 border-blue-500/30"         },
  invoice_overdue:{ icon: FileText,     cls: "text-red-400 bg-red-500/10 border-red-500/30"             },
  low_stock:     { icon: Package,       cls: "text-amber-400 bg-amber-500/10 border-amber-500/30"       },
  credit_alert:  { icon: CreditCard,    cls: "text-purple-400 bg-purple-500/10 border-purple-500/30"    },
  default:       { icon: AlertTriangle, cls: "text-gray-400 bg-gray-500/10 border-gray-500/30"          },
};

function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "ahora";
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  isDark?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NotificationBell({ isDark = true }: Props) {
  const dk = (d: string, l: string) => (isDark ? d : l);

  const [notifs,  setNotifs]  = useState<AppNotification[]>([]);
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const panelRef              = useRef<HTMLDivElement>(null);

  const unread = notifs.filter((n) => !n.read).length;

  async function load() {
    setLoading(true);
    try {
      const data = await fetchNotifications(30);
      setNotifs(data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  useEffect(() => {
    load();

    // Realtime subscription
    const channel = supabase
      .channel("notifications_bell")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          setNotifs((prev) => [payload.new as AppNotification, ...prev].slice(0, 50));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function handleMarkAll() {
    try {
      await markNotificationsRead();
      setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch { /* silent */ }
  }

  async function handleMarkOne(id: string) {
    await markOneNotificationRead(id);
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={`relative p-1.5 rounded-lg transition ${dk("text-[#525252] hover:text-white hover:bg-[#1c1c1c]","text-[#737373] hover:text-[#171717] hover:bg-[#e8e8e8]")}`}
        title="Notificaciones"
      >
        <Bell size={15} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-0.5 rounded-full bg-[#2D9F6A] text-white text-[9px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className={`absolute right-0 top-full mt-2 w-80 rounded-xl border shadow-2xl shadow-black/30 z-50 overflow-hidden ${dk("bg-[#111] border-[#1f1f1f]","bg-white border-[#e5e5e5]")}`}>
          {/* Header */}
          <div className={`flex items-center justify-between px-4 py-2.5 border-b ${dk("border-[#1a1a1a]","border-[#f0f0f0]")}`}>
            <div className="flex items-center gap-2">
              <Bell size={13} className="text-[#2D9F6A]" />
              <span className={`text-sm font-bold ${dk("text-white","text-[#171717]")}`}>Notificaciones</span>
              {unread > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#2D9F6A]/15 text-[#2D9F6A]">
                  {unread} nuevas
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  onClick={handleMarkAll}
                  className="flex items-center gap-1 text-[10px] text-[#2D9F6A] hover:text-[#25875a] font-medium"
                  title="Marcar todas como leídas"
                >
                  <CheckCheck size={12} /> Leer todas
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className={`p-1 rounded transition ${dk("text-[#444] hover:text-white","text-[#a3a3a3] hover:text-[#171717]")}`}
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {loading && (
              <div className="py-8 text-center text-xs text-[#525252]">Cargando…</div>
            )}
            {!loading && notifs.length === 0 && (
              <div className="py-10 flex flex-col items-center gap-2 text-[#525252]">
                <Bell size={22} className="opacity-20" />
                <p className="text-xs">Sin notificaciones</p>
              </div>
            )}
            {!loading && notifs.map((n) => {
              const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.default;
              const Ic  = cfg.icon;
              return (
                <div
                  key={n.id}
                  onClick={() => handleMarkOne(n.id)}
                  className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition border-b last:border-0 ${
                    dk("border-[#1a1a1a]","border-[#f0f0f0]")
                  } ${
                    !n.read
                      ? dk("bg-[#0e1a14] hover:bg-[#111e17]","bg-[#f0fff7] hover:bg-[#e6fff2]")
                      : dk("hover:bg-[#141414]","hover:bg-[#fafafa]")
                  }`}
                >
                  <div className={`mt-0.5 h-7 w-7 rounded-lg border flex items-center justify-center shrink-0 ${cfg.cls}`}>
                    <Ic size={13} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold leading-tight truncate ${dk("text-white","text-[#171717]")} ${!n.read ? "" : dk("text-[#a3a3a3]","text-[#525252]")}`}>
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="text-[10px] text-[#737373] mt-0.5 truncate">{n.body}</p>
                    )}
                    <p className="text-[9px] text-[#525252] mt-1">{fmtRelative(n.created_at)}</p>
                  </div>
                  {!n.read && (
                    <span className="h-2 w-2 rounded-full bg-[#2D9F6A] shrink-0 mt-1.5" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
