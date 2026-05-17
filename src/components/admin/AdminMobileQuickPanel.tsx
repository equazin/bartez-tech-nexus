import { ClipboardList, FileText, MessageSquare, Search, ShoppingBag, Users } from "lucide-react";

import type { Tab } from "@/components/admin/layout/adminNavConfig";

interface OrderSummary {
  id: string | number;
  status: string;
  total: number;
  client_id: string;
  created_at: string;
  order_number?: string | null;
}

interface ClientSummary {
  id: string;
  company_name?: string;
  contact_name?: string;
  email?: string;
}

interface AdminMobileQuickPanelProps {
  orders: OrderSummary[];
  clients: ClientSummary[];
  pendingApprovals: number;
  pendingQuotes: number;
  onNavigateTab: (tab: Tab) => void;
  onOpenSearch?: () => void;
  formatPrice?: (value: number) => string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Compact "quick view" for admin staff opening the dashboard on a phone.
 * Shown only on screens narrower than `md` (Tailwind 768px). Surfaces the
 * four most-actioned items: pending approvals, today's orders, pending
 * quotes, total clients. Keeps full admin chrome above it intact.
 */
export function AdminMobileQuickPanel({
  orders,
  clients,
  pendingApprovals,
  pendingQuotes,
  onNavigateTab,
  onOpenSearch,
  formatPrice,
}: AdminMobileQuickPanelProps) {
  const now = Date.now();
  const recentOrders = orders.filter((o) => now - new Date(o.created_at).getTime() < DAY_MS);
  const recentRevenue = recentOrders.reduce((sum, o) => sum + (o.total ?? 0), 0);

  const tiles: Array<{
    label: string;
    value: string;
    helper?: string;
    icon: typeof ShoppingBag;
    tab: Tab;
    accent: string;
  }> = [
    {
      label: "Aprobaciones",
      value: String(pendingApprovals),
      helper: pendingApprovals === 1 ? "1 pendiente" : `${pendingApprovals} pendientes`,
      icon: ClipboardList,
      tab: "approvals",
      accent: "text-amber-500 bg-amber-500/10 border-amber-500/30",
    },
    {
      label: "Pedidos hoy",
      value: String(recentOrders.length),
      helper: formatPrice && recentRevenue > 0 ? formatPrice(recentRevenue) : undefined,
      icon: ShoppingBag,
      tab: "orders",
      accent: "text-emerald-500 bg-emerald-500/10 border-emerald-500/30",
    },
    {
      label: "Cotizaciones",
      value: String(pendingQuotes),
      helper: pendingQuotes === 1 ? "Por revisar" : "Por revisar",
      icon: MessageSquare,
      tab: "quotes_admin",
      accent: "text-blue-500 bg-blue-500/10 border-blue-500/30",
    },
    {
      label: "Clientes",
      value: String(clients.length),
      icon: Users,
      tab: "clients",
      accent: "text-purple-500 bg-purple-500/10 border-purple-500/30",
    },
  ];

  return (
    <div className="space-y-3 md:hidden">
      {onOpenSearch ? (
        <button
          type="button"
          onClick={onOpenSearch}
          className="flex w-full items-center gap-2 rounded-2xl border border-border/70 bg-card px-4 py-3 text-left text-sm text-muted-foreground shadow-sm"
        >
          <Search size={16} />
          Buscar pedido, cliente o factura…
        </button>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <button
              key={tile.label}
              type="button"
              onClick={() => onNavigateTab(tile.tab)}
              className="flex flex-col items-start gap-1 rounded-2xl border border-border/70 bg-card p-3 text-left transition active:scale-[0.98]"
            >
              <span className={`inline-flex h-7 w-7 items-center justify-center rounded-xl border ${tile.accent}`}>
                <Icon size={14} />
              </span>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{tile.label}</p>
              <p className="text-xl font-black leading-none text-foreground">{tile.value}</p>
              {tile.helper ? <p className="text-[11px] text-muted-foreground">{tile.helper}</p> : null}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onNavigateTab("kanban")}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border/70 bg-card px-3 py-2.5 text-xs font-semibold text-foreground transition active:scale-[0.98]"
        >
          <ClipboardList size={13} /> Kanban
        </button>
        <button
          type="button"
          onClick={() => onNavigateTab("documents")}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border/70 bg-card px-3 py-2.5 text-xs font-semibold text-foreground transition active:scale-[0.98]"
        >
          <FileText size={13} /> Documentos
        </button>
      </div>
    </div>
  );
}
