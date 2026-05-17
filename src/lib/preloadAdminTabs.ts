/**
 * Pre-warms the dynamic-import chunks for the most common admin tabs so the
 * user does not see a Suspense fallback the first time they click into one.
 *
 * Invoked from Admin.tsx in a `requestIdleCallback` (or setTimeout fallback).
 * Safe to call repeatedly: dynamic imports are cached by the bundler.
 */

type PreloadFn = () => Promise<unknown>;

const PRIORITY_TABS: PreloadFn[] = [
  () => import("@/components/admin/SalesDashboard"),
  () => import("@/components/admin/ClientCRM"),
  () => import("@/components/admin/OrderKanban"),
  () => import("@/components/admin/QuotesAdminTab"),
];

let started = false;

export function preloadCommonAdminTabs(): void {
  if (started || typeof window === "undefined") return;
  started = true;

  const schedule = (cb: () => void) => {
    const win = window as Window & { requestIdleCallback?: (callback: IdleRequestCallback) => number };
    if (typeof win.requestIdleCallback === "function") {
      win.requestIdleCallback(cb, { timeout: 4000 });
    } else {
      setTimeout(cb, 2500);
    }
  };

  schedule(() => {
    for (const loader of PRIORITY_TABS) {
      loader().catch(() => {
        // Swallow — a failed preload should never break the page; the lazy()
        // wrapper will retry when the tab is actually opened.
      });
    }
  });
}
