import { memo, Suspense, useRef, type ReactNode } from "react";

interface KeepAliveTabProps {
  /** Whether this tab is currently the active one */
  active: boolean;
  /** Unique tab identifier — used for debugging */
  id: string;
  /**
   * If true, render the children only when active and unmount when not (legacy behaviour).
   * Default false: mount on first activation and keep alive afterwards (preserves state and
   * in-flight work like supplier API syncs).
   */
  disabled?: boolean;
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Keeps tab content mounted after first activation so that:
 *  - In-flight work (API syncs, uploads) does not get aborted when the user switches tabs.
 *  - Local state (filters, form inputs, scroll position) is preserved across tab changes.
 *
 * The first time a tab becomes active, its children render. From that point on, the children
 * stay in the React tree even when the tab is inactive — they are hidden with `display: none`
 * so they don't take visual space, but their state and effects persist.
 *
 * Memoised to avoid re-rendering inactive panes unnecessarily.
 */
export const KeepAliveTab = memo(function KeepAliveTab({
  active,
  id,
  disabled = false,
  fallback = <div className="p-8 text-center text-sm text-muted-foreground">Cargando...</div>,
  children,
}: KeepAliveTabProps) {
  const hasBeenActiveRef = useRef(false);
  if (active) hasBeenActiveRef.current = true;

  if (disabled) {
    return active ? <>{children}</> : null;
  }

  if (!hasBeenActiveRef.current) return null;

  return (
    <div data-keepalive-tab={id} hidden={!active} style={active ? undefined : { display: "none" }}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </div>
  );
});
