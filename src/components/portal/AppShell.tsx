import * as React from "react";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

import { SidebarNav } from "./SidebarNav";

const SIDEBAR_STORAGE_KEY = "bartez_portal_sidebar_collapsed";

interface AppShellProps {
  /** Top bar element (already includes search, currency, cart, profile) */
  topBar: React.ReactNode;
  /** Optional element below the topbar (banners, alerts) */
  banner?: React.ReactNode;
  /** Main content */
  children: React.ReactNode;
  /** Optional aside (e.g. cart sheet portal target) */
  aside?: React.ReactNode;
  /** Active user role — passed to SidebarNav for role-based items */
  role?: string;
}

interface AppShellContextValue {
  collapsed: boolean;
  setCollapsed: (next: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (next: boolean) => void;
  toggleSidebar: () => void;
}

const AppShellContext = React.createContext<AppShellContextValue | null>(null);

export function useAppShell(): AppShellContextValue {
  const ctx = React.useContext(AppShellContext);
  if (!ctx) throw new Error("useAppShell must be used inside AppShell");
  return ctx;
}

function readCollapsedFromStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function AppShell({ topBar, banner, children, aside, role }: AppShellProps) {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsedState] = React.useState<boolean>(() => readCollapsedFromStorage());
  const [mobileOpen, setMobileOpen] = React.useState<boolean>(false);

  const setCollapsed = React.useCallback((next: boolean) => {
    setCollapsedState(next);
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0");
    } catch {
      // ignore quota errors
    }
  }, []);

  const toggleSidebar = React.useCallback(() => {
    if (isMobile) setMobileOpen((prev) => !prev);
    else setCollapsed(!collapsed);
  }, [collapsed, isMobile, setCollapsed]);

  const ctxValue = React.useMemo<AppShellContextValue>(
    () => ({ collapsed, setCollapsed, mobileOpen, setMobileOpen, toggleSidebar }),
    [collapsed, setCollapsed, mobileOpen, toggleSidebar],
  );

  return (
    <AppShellContext.Provider value={ctxValue}>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        {/* Desktop sidebar */}
        <aside
          className={cn(
            "sticky top-0 hidden h-screen shrink-0 border-r border-border/70 bg-surface-1 transition-[width] md:flex md:flex-col",
            collapsed ? "w-[68px]" : "w-60",
          )}
          aria-label="Portal sidebar"
        >
          <div className="flex h-14 items-center gap-2 border-b border-border/70 px-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-brand-foreground font-display text-[14px] font-bold">
              B
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="font-display text-[14px] font-semibold leading-[16px] text-foreground">Bartez</span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">B2B Portal</span>
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            <SidebarNav collapsed={collapsed} role={role} />
          </div>
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="border-t border-border/70 px-3 py-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            {collapsed ? "→" : "← Colapsar"}
          </button>
        </aside>

        {/* Mobile sidebar drawer */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-72 border-r border-border/70 bg-surface-1 p-0">
            <div className="flex h-14 items-center gap-2 border-b border-border/70 px-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-brand-foreground font-display text-[14px] font-bold">
                B
              </div>
              <div className="flex flex-col">
                <span className="font-display text-[14px] font-semibold leading-[16px] text-foreground">Bartez</span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">B2B Portal</span>
              </div>
            </div>
            <SidebarNav role={role} onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          {topBar}
          {banner}
          <main className="flex-1 overflow-y-auto bg-background">
            <div className="mx-auto w-full max-w-[1440px] px-4 py-5 md:px-6 md:py-6">{children}</div>
          </main>
        </div>

        {aside}
      </div>
    </AppShellContext.Provider>
  );
}

export { AppShell };
