import { Sun, Moon, LogOut, RefreshCw, Ticket, LayoutDashboard } from "lucide-react";
import { AdminSearch } from "@/components/admin/AdminSearch";
import { NotificationBell } from "@/components/admin/NotificationBell";
import { NAV_MODULES, getTabLabel, type Tab, type ModuleId, type NavItem } from "./adminNavConfig";

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
  isDark,
  currency,
  searchData,
  canSeeItem,
  onNavigateTab,
  onNavigateModule,
  onToggleMobileSidebar,
  onToggleTheme,
  onRefresh,
  onLogout,
  onSetCurrency,
}: AdminTopbarProps) {
  const dk = (d: string, l: string) => (isDark ? d : l);

  return (
    <>
      {/* ── Top header row ───────────────────────────────────────────────────── */}
      <header
        className={`flex items-center gap-2 px-3 md:px-4 py-2.5 border-b z-30 relative ${dk(
          "bg-[#0d0d0d] border-[#1a1a1a]",
          "bg-white border-[#e5e5e5]",
        )}`}
      >
        {/* Mobile hamburger */}
        <button
          onClick={onToggleMobileSidebar}
          className={`md:hidden p-2 rounded-lg transition ${dk(
            "text-[#525252] hover:text-white hover:bg-[#1c1c1c]",
            "text-[#737373] hover:text-[#171717] hover:bg-[#e8e8e8]",
          )}`}
        >
          <LayoutDashboard size={16} />
        </button>

        {/* Logo */}
        <div className="flex items-center gap-2">
          <img src="/icon.png" alt="Bartez" className="h-7 w-7 object-contain" />
          <div className="hidden sm:block">
            <span className={`font-bold text-sm leading-none ${dk("text-white", "text-[#171717]")}`}>
              Panel Admin
            </span>
            <span className="block text-[10px] text-[#2D9F6A] leading-none mt-0.5">
              Bartez Tecnología
            </span>
          </div>
        </div>

        {/* Breadcrumb */}
        <span className={`text-xs font-semibold hidden md:block ml-2 ${dk("text-[#525252]", "text-[#a3a3a3]")}`}>
          / {getTabLabel(activeTab)}
        </span>

        <div className="ml-auto flex items-center gap-1.5">
          {/* Quick-access: Marketing */}
          <button
            onClick={() => onNavigateTab("marketing")}
            title="Marketing B2B"
            className={`hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition ${
              activeTab === "marketing"
                ? "bg-[#2D9F6A]/15 border-[#2D9F6A]/40 text-[#2D9F6A]"
                : dk(
                    "border-[#1f1f1f] text-[#525252] hover:text-white hover:bg-[#1c1c1c]",
                    "border-[#e5e5e5] text-[#737373] hover:text-[#171717] hover:bg-[#e8e8e8]",
                  )
            }`}
          >
            <Ticket size={12} />
            <span className="hidden lg:inline font-semibold">Marketing</span>
          </button>

          {/* Currency switcher */}
          <div
            className={`hidden sm:flex items-center rounded-lg border p-0.5 ${dk(
              "border-[#1f1f1f] bg-[#111]",
              "border-[#e5e5e5] bg-[#f8f8f8]",
            )}`}
          >
            {(["USD", "ARS"] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => onSetCurrency(opt)}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition ${
                  currency === opt
                    ? "bg-[#2D9F6A] text-white"
                    : dk(
                        "text-[#737373] hover:text-white hover:bg-[#1c1c1c]",
                        "text-[#737373] hover:text-[#171717] hover:bg-white",
                      )
                }`}
                title={`Ver importes en ${opt}`}
              >
                {opt}
              </button>
            ))}
          </div>

          {/* Search */}
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

          {/* Refresh */}
          <button
            onClick={onRefresh}
            className={`flex items-center gap-1.5 text-xs transition px-2.5 py-1.5 rounded-lg ${dk(
              "text-[#737373] hover:text-white hover:bg-[#1c1c1c]",
              "text-[#737373] hover:text-[#171717] hover:bg-[#e8e8e8]",
            )}`}
          >
            <RefreshCw size={12} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>

          <NotificationBell isDark={isDark} />

          {/* Theme toggle */}
          <button
            onClick={onToggleTheme}
            className={`p-1.5 rounded-lg transition ${dk(
              "text-[#525252] hover:text-white hover:bg-[#1c1c1c]",
              "text-[#737373] hover:text-[#171717] hover:bg-[#e8e8e8]",
            )}`}
            title={isDark ? "Tema claro" : "Tema oscuro"}
          >
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          {/* Logout */}
          <button
            onClick={onLogout}
            className={`flex items-center gap-1.5 text-xs transition px-2.5 py-1.5 rounded-lg ${dk(
              "text-[#737373] hover:text-white hover:bg-[#1c1c1c]",
              "text-[#737373] hover:text-[#171717] hover:bg-[#e8e8e8]",
            )}`}
          >
            <LogOut size={12} />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </header>

      {/* ── Module nav bar ───────────────────────────────────────────────────── */}
      <nav
        className={`hidden md:flex items-center gap-0.5 px-4 border-b ${dk(
          "bg-[#0d0d0d] border-[#1a1a1a]",
          "bg-white border-[#e5e5e5]",
        )}`}
      >
        {NAV_MODULES.map((mod) => {
          const GIcon = mod.icon;
          const label = mod.id === "top" ? "Dashboard" : mod.label;
          const isActive = activeModule === mod.id;
          const hasVisible = mod.items.some(canSeeItem);
          if (!hasVisible) return null;
          return (
            <button
              key={mod.id}
              onClick={() => {
                onNavigateModule(mod.id);
                if (mod.id === "top") onNavigateTab("dashboard");
              }}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition -mb-px ${
                isActive
                  ? "border-[#2D9F6A] text-[#2D9F6A]"
                  : dk(
                      "border-transparent text-[#737373] hover:text-white hover:border-[#333]",
                      "border-transparent text-[#737373] hover:text-[#171717] hover:border-[#ccc]",
                    )
              }`}
            >
              <GIcon size={13} />
              {label}
            </button>
          );
        })}
      </nav>
    </>
  );
}
