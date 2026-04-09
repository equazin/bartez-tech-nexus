import { ChevronRight, LayoutDashboard, Package, ClipboardList, Users, DollarSign, Settings2, Megaphone } from "lucide-react";
import { NAV_MODULES, type Tab, type ModuleId, type NavItem } from "./adminNavConfig";

interface AdminSidebarProps {
  activeTab: Tab;
  activeModule: ModuleId;
  badges: Partial<Record<Tab, number>>;
  isDark: boolean;
  collapsed: boolean;
  mobile?: boolean;
  onNavigateTab: (tab: Tab) => void;
  onNavigateModule: (moduleId: ModuleId) => void;
  onToggleCollapse: () => void;
  canSeeItem: (item: NavItem) => boolean;
}

const WORKSPACE_ITEMS: Array<{
  id: string;
  label: string;
  module: ModuleId;
  tab: Tab;
  icon: typeof LayoutDashboard;
}> = [
  { id: "dashboard", label: "Dashboard", module: "top", tab: "dashboard", icon: LayoutDashboard },
  { id: "sales", label: "Ventas", module: "pedidos", tab: "quotes_admin", icon: ClipboardList },
  { id: "clients", label: "Clientes 360", module: "clientes", tab: "clients", icon: Users },
  { id: "products", label: "Catalogo", module: "catalogo", tab: "products", icon: Package },
  { id: "sellers", label: "Vendedores", module: "vendedores", tab: "seller_mode", icon: DollarSign },
  { id: "marketing", label: "Marketing", module: "marketing", tab: "marketing", icon: Megaphone },
  { id: "settings", label: "Operaciones", module: "configuracion", tab: "suppliers", icon: Settings2 },
];

export function AdminSidebar({
  activeTab,
  activeModule,
  badges,
  collapsed,
  mobile = false,
  onNavigateTab,
  onNavigateModule,
  onToggleCollapse,
  canSeeItem,
}: AdminSidebarProps) {
  const activeGroup = NAV_MODULES.find((m) => m.id === activeModule);
  const visibleItems = activeGroup ? activeGroup.items.filter(canSeeItem) : [];

  return (
    <div className="flex h-full flex-col bg-card/65">
      <div className="border-b border-border/70 px-3 py-4">
        <div className={`flex items-center gap-3 ${collapsed && !mobile ? "justify-center" : ""}`}>
          <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-gradient-primary shadow-lg shadow-primary/15">
            <img src="/icon.png" alt="Bartez" className="h-6 w-6 object-contain brightness-0 invert" />
          </div>
          {(!collapsed || mobile) && (
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground">Bartez Admin</p>
              <p className="text-[11px] text-muted-foreground">Centro operativo comercial</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        <div className="space-y-5">
          <section className="space-y-2">
            {(!collapsed || mobile) && <p className="px-2 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Workspace</p>}
            <div className="space-y-1">
              {WORKSPACE_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeModule === item.module || activeTab === item.tab;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onNavigateModule(item.module);
                      onNavigateTab(item.tab);
                    }}
                    title={collapsed && !mobile ? item.label : undefined}
                    className={`relative flex w-full items-center gap-3 rounded-[20px] px-3 py-2.5 text-sm transition ${active ? "bg-accent text-foreground shadow-sm" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${active ? "bg-white/85 text-primary" : "bg-surface text-muted-foreground"}`}>
                      <Icon size={16} />
                    </span>
                    {(!collapsed || mobile) && <span className="truncate text-left font-medium">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-2 border-t border-border/60 pt-4">
            {(!collapsed || mobile) && (
              <div className="flex items-center justify-between px-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">{activeGroup?.label || "Modulo"}</p>
                <ChevronRight size={12} className="text-muted-foreground" />
              </div>
            )}
            {(collapsed && !mobile) && activeGroup && (
              <div className="flex justify-center pb-1" title={activeGroup.label}>
                <span className="rounded-lg bg-primary/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.15em] text-primary/80 text-center leading-tight max-w-[60px] break-words text-wrap">
                  {activeGroup.label}
                </span>
              </div>
            )}
            <div className="space-y-1">
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                const badge = badges[item.id];

                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigateTab(item.id)}
                    title={collapsed && !mobile ? item.label : undefined}
                    className={`relative flex w-full items-center gap-3 rounded-[18px] px-3 py-2.5 text-sm transition ${active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
                  >
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${active ? "bg-white/20 text-primary-foreground" : "bg-surface text-muted-foreground"}`}>
                      <Icon size={14} />
                    </span>

                    {(!collapsed || mobile) && (
                      <>
                        <span className="flex-1 truncate text-left font-medium">{item.label}</span>
                        {badge !== undefined && badge > 0 ? (
                          <span className={`min-w-5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? "bg-white/20 text-primary-foreground" : "bg-card text-muted-foreground"}`}>
                            {badge}
                          </span>
                        ) : null}
                      </>
                    )}

                    {collapsed && !mobile && badge !== undefined && badge > 0 ? (
                      <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-primary" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      {!mobile ? (
        <div className="border-t border-border/70 px-2 py-3">
          <button
            onClick={onToggleCollapse}
            className="flex w-full items-center justify-center rounded-[18px] bg-surface px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            title={collapsed ? "Expandir menu" : "Colapsar menu"}
          >
            {collapsed ? "Expandir" : "Colapsar"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
