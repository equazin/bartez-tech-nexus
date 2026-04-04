import { type ReactNode } from "react";
import { AdminTopbar } from "./AdminTopbar";
import { AdminSidebar } from "./AdminSidebar";
import { type Tab, type ModuleId, type NavItem } from "./adminNavConfig";

interface SearchData {
  products: Array<{ id: number; name: string; sku?: string; category?: string }>;
  clients: Array<{ id: string; company_name?: string; contact_name?: string; email?: string }>;
  orders: Array<{ id: string | number; client_id: string; order_number?: string; numero_remito?: string; total: number; status: string }>;
  invoices: Array<{ id: string; invoice_number: string; client_id: string; status: string; total: number }>;
  quotes: Array<{ id: number; client_id: string; status: string; total: number }>;
  payments: Array<{ id: string; client_id: string; descripcion?: string; reference_id?: string; monto: number; tipo: string }>;
}

interface AdminLayoutProps {
  children: ReactNode;

  // Nav state
  activeTab: Tab;
  activeModule: ModuleId;
  badges: Partial<Record<Tab, number>>;

  // Sidebar state
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;

  // Theme
  isDark: boolean;

  // Currency
  currency: "USD" | "ARS";

  // Search data
  searchData: SearchData;

  // Permissions
  canSeeItem: (item: NavItem) => boolean;

  // Actions
  onNavigateTab: (tab: Tab) => void;
  onNavigateModule: (moduleId: ModuleId) => void;
  onToggleSidebar: () => void;
  onToggleMobileSidebar: () => void;
  onToggleTheme: () => void;
  onRefresh: () => void;
  onLogout: () => void;
  onSetCurrency: (c: "USD" | "ARS") => void;
}

export function AdminLayout({
  children,
  activeTab,
  activeModule,
  badges,
  sidebarCollapsed,
  mobileSidebarOpen,
  isDark,
  currency,
  searchData,
  canSeeItem,
  onNavigateTab,
  onNavigateModule,
  onToggleSidebar,
  onToggleMobileSidebar,
  onToggleTheme,
  onRefresh,
  onLogout,
  onSetCurrency,
}: AdminLayoutProps) {
  const dk = (d: string, l: string) => (isDark ? d : l);

  return (
    <div className={`flex min-h-screen flex-col ${dk("bg-[#0a0a0a]", "bg-[#f0f0f0]")}`}>

      {/* ── Topbar + Module nav (sticky) ─────────────────────────────────────── */}
      <div className="sticky top-0 z-30">
        <AdminTopbar
          activeTab={activeTab}
          activeModule={activeModule}
          isDark={isDark}
          currency={currency}
          searchData={searchData}
          canSeeItem={canSeeItem}
          onNavigateTab={onNavigateTab}
          onNavigateModule={onNavigateModule}
          onToggleMobileSidebar={onToggleMobileSidebar}
          onToggleTheme={onToggleTheme}
          onRefresh={onRefresh}
          onLogout={onLogout}
          onSetCurrency={onSetCurrency}
        />
      </div>

      {/* ── Body: sidebar + content ──────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Mobile overlay */}
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-20 md:hidden"
            onClick={onToggleMobileSidebar}
          />
        )}

        {/* Desktop sidebar (sticky) */}
        <aside
          className={`
            hidden md:flex flex-col shrink-0 border-r overflow-hidden transition-all duration-200
            sticky top-[var(--topbar-height,88px)] h-[calc(100vh-var(--topbar-height,88px))]
            ${sidebarCollapsed ? "w-[52px]" : "w-[200px]"}
            ${dk("bg-[#0d0d0d] border-[#1a1a1a]", "bg-white border-[#e5e5e5]")}
          `}
        >
          <AdminSidebar
            activeTab={activeTab}
            activeModule={activeModule}
            badges={badges}
            isDark={isDark}
            collapsed={sidebarCollapsed}
            onNavigateTab={onNavigateTab}
            onToggleCollapse={onToggleSidebar}
            canSeeItem={canSeeItem}
          />
        </aside>

        {/* Mobile drawer */}
        <aside
          className={`
            fixed left-0 top-0 h-full w-[220px] z-30 md:hidden flex flex-col border-r
            transition-transform duration-200
            ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"}
            ${dk("bg-[#0d0d0d] border-[#1a1a1a]", "bg-white border-[#e5e5e5]")}
          `}
        >
          <div className={`flex items-center gap-2 px-4 py-3 border-b ${dk("border-[#1a1a1a]", "border-[#e5e5e5]")}`}>
            <img src="/icon.png" alt="Bartez" className="h-7 w-7 object-contain" />
            <div>
              <span className={`font-bold text-sm leading-none ${dk("text-white", "text-[#171717]")}`}>Admin</span>
              <span className="block text-[10px] text-[#2D9F6A]">Bartez</span>
            </div>
          </div>
          <AdminSidebar
            activeTab={activeTab}
            activeModule={activeModule}
            badges={badges}
            isDark={isDark}
            collapsed={false}
            mobile
            onNavigateTab={(tab) => { onNavigateTab(tab); onToggleMobileSidebar(); }}
            onToggleCollapse={onToggleSidebar}
            canSeeItem={canSeeItem}
          />
        </aside>

        {/* Main content (scrollable independently) */}
        <main className="flex-1 p-4 md:p-5 overflow-y-auto min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
