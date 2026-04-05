import { Sun, Moon, LogOut, RefreshCw, LayoutDashboard, Bell, Search, UserCircle2 } from "lucide-react";
import { AdminSearch } from "@/components/admin/AdminSearch";
import { NotificationBell } from "@/components/admin/NotificationBell";
import { getModuleLabel, getTabLabel, type Tab, type ModuleId, type NavItem } from "./adminNavConfig";

interface SearchData {
  products: Array<{ id: number; name: string; sku?: string; category?: string }>;
  clients: Array<{ id: string; company_name?: string; contact_name?: string; email?: string }>;
  orders: Array<{ id: string | number; client_id: string; order_number?: string; numero_remito?: string; total: number; status: string }>;
  invoices: Array<{ id: string; invoice_number: string; client_id: string; status: string; total: number }>;
  quotes: Array<{ id: number; client_id: string; status: string; total: number }>;
  payments: Array<{ id: string; client_id: string; descripcion?: string; reference_id?: string; monto: number; tipo: string }>;
}

interface AdminTopbarProps {
  activeTab: Tab;
  activeModule: ModuleId;
  currentUserLabel?: string;
  isDark: boolean;
  currency: "USD" | "ARS";
  searchData: SearchData;
  canSeeItem: (item: NavItem) => boolean;
  onNavigateTab: (tab: Tab) => void;
  onNavigateModule: (moduleId: ModuleId) => void;
  onToggleMobileSidebar: () => void;
  onToggleTheme: () => void;
  onRefresh: () => void;
  onLogout: () => void;
  onSetCurrency: (c: "USD" | "ARS") => void;
}

export function AdminTopbar({
  activeTab,
  activeModule,
  currentUserLabel,
  isDark,
  currency,
  searchData,
  onNavigateTab,
  onToggleMobileSidebar,
  onToggleTheme,
  onRefresh,
  onLogout,
  onSetCurrency,
}: AdminTopbarProps) {
  return (
    <header className="border-b border-border/70 bg-card/88 px-3 py-3 backdrop-blur md:px-5">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileSidebar}
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border/70 bg-surface text-muted-foreground transition hover:bg-secondary hover:text-foreground md:hidden"
        >
          <LayoutDashboard size={16} />
        </button>

        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-gradient-primary shadow-lg shadow-primary/15">
            <img src="/icon.png" alt="Bartez" className="h-6 w-6 object-contain" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-bold text-foreground md:text-[15px]">Panel Admin</span>
              <span className="hidden text-xs text-muted-foreground md:inline">/ {getModuleLabel(activeModule)}</span>
              <span className="hidden text-xs text-muted-foreground lg:inline">/ {getTabLabel(activeTab)}</span>
            </div>
            <p className="text-[11px] text-primary">Bartez Tecnologia</p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden items-center rounded-full border border-border/70 bg-surface p-1 sm:flex">
            {(["USD", "ARS"] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => onSetCurrency(opt)}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${currency === opt ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-card hover:text-foreground"}`}
                title={`Ver importes en ${opt}`}
              >
                {opt}
              </button>
            ))}
          </div>

          <div className="hidden xl:block">
            <AdminSearch
              isDark={isDark}
              products={searchData.products}
              clients={searchData.clients}
              orders={searchData.orders}
              invoices={searchData.invoices}
              quotes={searchData.quotes}
              payments={searchData.payments}
              onNavigate={(tab) => onNavigateTab(tab as Tab)}
            />
          </div>

          <button onClick={onRefresh} className="dashboard-pill hidden sm:inline-flex">
            <RefreshCw size={12} /> Actualizar
          </button>

          <button className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border/70 bg-surface text-muted-foreground transition hover:bg-secondary hover:text-foreground sm:hidden">
            <Search size={15} />
          </button>

          <div className="hidden md:block">
            <NotificationBell isDark={isDark} />
          </div>
          <button className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border/70 bg-surface text-muted-foreground transition hover:bg-secondary hover:text-foreground md:hidden">
            <Bell size={15} />
          </button>

          <button
            onClick={onToggleTheme}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border/70 bg-surface text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            title={isDark ? "Tema claro" : "Tema oscuro"}
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          <div className="hidden items-center gap-3 rounded-[22px] border border-border/70 bg-surface px-3 py-2 md:flex">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <UserCircle2 size={18} />
            </div>
            <div className="min-w-0">
              <p className="max-w-[160px] truncate text-xs font-semibold text-foreground">{currentUserLabel || "Administrador"}</p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Admin</p>
            </div>
          </div>

          <button onClick={onLogout} className="dashboard-pill">
            <LogOut size={12} /> <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </div>
    </header>
  );
}
