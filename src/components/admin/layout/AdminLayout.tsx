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
  activeTab: Tab;
  activeModule: ModuleId;
  badges: Partial<Record<Tab, number>>;
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  isDark: boolean;
  currency: "USD" | "ARS";
  currentUserLabel?: string;
  searchData: SearchData;
  exchangeRate: any;
  isFetchingRate: boolean;
  onRefreshRate: () => void;
  canSeeItem: (item: NavItem) => boolean;
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
  currentUserLabel,
  searchData,
  exchangeRate,
  isFetchingRate,
  onRefreshRate,
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
  return (
    <div className="dashboard-stage min-h-screen bg-background px-3 py-3 md:px-4 md:py-4">
      <div className="dashboard-canvas flex min-h-[calc(100vh-1.5rem)] flex-col overflow-hidden">
        <div className="sticky top-0 z-30">
          <AdminTopbar
            activeTab={activeTab}
            activeModule={activeModule}
            currentUserLabel={currentUserLabel}
            isDark={isDark}
            currency={currency}
            searchData={searchData}
            exchangeRate={exchangeRate}
            isFetchingRate={isFetchingRate}
            onRefreshRate={onRefreshRate}
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

        <div className="flex flex-1 overflow-hidden">
          {mobileSidebarOpen && (
            <div
              className="fixed inset-0 z-20 bg-black/30 backdrop-blur-sm md:hidden"
              onClick={onToggleMobileSidebar}
            />
          )}

          <aside
            className={`hidden shrink-0 overflow-hidden border-r border-border/70 bg-card/65 transition-all duration-200 md:flex md:flex-col ${sidebarCollapsed ? "w-[82px]" : "w-[286px]"}`}
          >
            <AdminSidebar
              activeTab={activeTab}
              activeModule={activeModule}
              badges={badges}
              isDark={isDark}
              collapsed={sidebarCollapsed}
              onNavigateTab={onNavigateTab}
              onNavigateModule={onNavigateModule}
              onToggleCollapse={onToggleSidebar}
              canSeeItem={canSeeItem}
            />
          </aside>

          <aside
            className={`fixed left-0 top-0 z-30 flex h-full w-[286px] flex-col border-r border-border/70 bg-card/95 transition-transform duration-200 md:hidden ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
          >
            <AdminSidebar
              activeTab={activeTab}
              activeModule={activeModule}
              badges={badges}
              isDark={isDark}
              collapsed={false}
              mobile
              onNavigateTab={(tab) => {
                onNavigateTab(tab);
                onToggleMobileSidebar();
              }}
              onNavigateModule={onNavigateModule}
              onToggleCollapse={onToggleSidebar}
              canSeeItem={canSeeItem}
            />
          </aside>

          <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-transparent px-4 py-5 md:px-6 md:py-6 lg:px-7 lg:py-7">
            <div className="mx-auto flex w-full max-w-[1760px] flex-col gap-6">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
