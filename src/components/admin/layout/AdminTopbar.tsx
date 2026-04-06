import { Sun, Moon, LogOut, RefreshCw, LayoutDashboard, Bell, Search, UserCircle2, TrendingUp, Pencil } from "lucide-react";
import { AdminSearch } from "@/components/admin/AdminSearch";
import { NotificationBell } from "@/components/admin/NotificationBell";
import { getModuleLabel, getTabLabel, type Tab, type ModuleId, type NavItem } from "./adminNavConfig";
import type { ExchangeRate } from "@/context/CurrencyContext";

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
  exchangeRate: ExchangeRate;
  isFetchingRate: boolean;
  onRefreshRate: () => void;
  onManualRateUpdate: () => void;
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
  exchangeRate,
  isFetchingRate,
  onRefreshRate,
  onManualRateUpdate,
  onNavigateTab,
  onToggleMobileSidebar,
  onToggleTheme,
  onRefresh,
  onLogout,
  onSetCurrency,
}: AdminTopbarProps) {
  const ageMs = Date.now() - new Date(exchangeRate.updatedAt).getTime();
  const ageMin = Math.floor(ageMs / 60000);
  const ageLabel =
    ageMin < 2 ? "Ahora" : ageMin < 60 ? `hace ${ageMin}m` : `hace ${Math.floor(ageMin / 60)}h`;

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
          <img src="/android-chrome-512x512.png" alt="Bartez" className="h-14 w-14 shrink-0 rounded-2xl object-contain" />
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
          {/* Exchange rate chip */}
          <div className="hidden items-center gap-2 rounded-[24px] border border-border/70 bg-surface px-3 py-1.5 text-xs lg:flex">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <TrendingUp size={11} />
            </div>
            <div className="leading-none">
              <div className="flex items-center gap-1.5">
                <p className="font-semibold text-foreground">
                  $ {exchangeRate.rate.toLocaleString("es-AR")}
                </p>
                <button
                  type="button"
                  onClick={onManualRateUpdate}
                  className="rounded p-0.5 text-muted-foreground transition hover:bg-muted hover:text-primary"
                  title="Editar valor manualmente"
                >
                  <Pencil size={10} />
                </button>
              </div>
              <p className="mt-0.5 text-[9px] text-muted-foreground uppercase tracking-tight">
                {exchangeRate.source === "api" ? `OFICIAL (${ageLabel})` : "Manual (Custom)"}
              </p>
            </div>
            <button
              type="button"
              onClick={onRefreshRate}
              disabled={isFetchingRate}
              className="ml-1 rounded-lg p-1 text-muted-foreground transition hover:bg-card hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
              title="Cargar cotización oficial automatica"
            >
              <RefreshCw size={11} className={isFetchingRate ? "animate-spin" : ""} />
            </button>
          </div>

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

          <button onClick={onRefresh} className="dashboard-pill hidden sm:inline-flex" title="Refrescar datos del módulo actual">
            <RefreshCw size={12} /> <span className="hidden xl:inline">Refrescar</span>
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
