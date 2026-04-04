import { NAV_MODULES, type Tab, type ModuleId, type NavItem } from "./adminNavConfig";

interface AdminSidebarProps {
  activeTab: Tab;
  activeModule: ModuleId;
  badges: Partial<Record<Tab, number>>;
  isDark: boolean;
  collapsed: boolean;
  mobile?: boolean;
  onNavigateTab: (tab: Tab) => void;
  onToggleCollapse: () => void;
  canSeeItem: (item: NavItem) => boolean;
}

export function AdminSidebar({
  activeTab,
  activeModule,
  badges,
  isDark,
  collapsed,
  mobile = false,
  onNavigateTab,
  onToggleCollapse,
  canSeeItem,
}: AdminSidebarProps) {
  const dk = (d: string, l: string) => (isDark ? d : l);

  const activeGroup = NAV_MODULES.find((m) => m.id === activeModule);
  const visibleItems = activeGroup ? activeGroup.items.filter(canSeeItem) : [];

  return (
    <div className="flex flex-col h-full">
      <nav className="flex-1 overflow-y-auto py-3 gap-0.5 flex flex-col px-2">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          const badge = badges[item.id];
          return (
            <button
              key={item.id}
              onClick={() => onNavigateTab(item.id)}
              title={collapsed && !mobile ? item.label : undefined}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition relative ${
                active
                  ? dk("bg-[#1a2e22] text-[#2D9F6A] font-semibold", "bg-[#f0faf5] text-[#1a7a50] font-semibold")
                  : dk("text-[#737373] hover:text-white hover:bg-[#181818]", "text-[#737373] hover:text-[#171717] hover:bg-[#f5f5f5]")
              }`}
            >
              <Icon size={14} className={active ? "text-[#2D9F6A]" : ""} />
              {(!collapsed || mobile) && (
                <>
                  <span className="flex-1 text-left truncate">{item.label}</span>
                  {badge !== undefined && badge > 0 && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                        item.id === "orders"
                          ? "bg-[#2D9F6A] text-white"
                          : dk("bg-[#222] text-[#525252]", "bg-[#e8e8e8] text-[#737373]")
                      }`}
                    >
                      {badge}
                    </span>
                  )}
                </>
              )}
              {collapsed && !mobile && badge !== undefined && badge > 0 && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#2D9F6A]" />
              )}
            </button>
          );
        })}
      </nav>

      {!mobile && (
        <button
          onClick={onToggleCollapse}
          className={`flex items-center justify-center py-3 border-t text-xs transition ${dk(
            "border-[#1a1a1a] text-[#444] hover:text-white hover:bg-[#141414]",
            "border-[#e5e5e5] text-[#c4c4c4] hover:text-[#171717] hover:bg-[#f5f5f5]",
          )}`}
          title={collapsed ? "Expandir menú" : "Colapsar menú"}
        >
          {collapsed ? "→" : "←"}
        </button>
      )}
    </div>
  );
}
