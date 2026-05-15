import { useMemo, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";

import { AppShell } from "@/components/portal/AppShell";
import { CommandPalette } from "@/components/portal/CommandPalette";
import { PendingApprovalBanner } from "@/components/portal/PendingApprovalBanner";
import { TopBar } from "@/components/portal/TopBar";
import { useAuth } from "@/context/AuthContext";
import { useImpersonate } from "@/context/ImpersonateContext";
import { useBusinessAlerts } from "@/hooks/useBusinessAlerts";
import { useSharedCartState } from "@/hooks/useSharedCartState";

/**
 * PortalRoot wraps every /portal/* sub-route with the new shell:
 * sidebar (SidebarNav) + topbar (TopBar) + command palette + cart entry point.
 *
 * The actual section content is rendered through <Outlet /> by each child route
 * (HomePage, CatalogPage, OrdersPage, etc.) which in turn renders the existing
 * <B2BPortal chrome="shell" forcedTab="..." />.
 */
function PortalRoot() {
  const navigate = useNavigate();
  const { profile: authProfile } = useAuth();
  const { activeProfile } = useImpersonate();
  const profile = activeProfile ?? authProfile;

  const userId = profile?.id ?? "";
  const { cart } = useSharedCartState(userId);
  const cartCount = useMemo(
    () => Object.values(cart).reduce((sum, q) => sum + (Number(q) || 0), 0),
    [cart],
  );

  const { alerts } = useBusinessAlerts(userId);
  const alertCount = alerts?.length ?? 0;

  const creditTotal = profile?.credit_limit ?? undefined;
  const creditAvailable =
    typeof creditTotal === "number" && creditTotal > 0 ? creditTotal : undefined;
  // NOTE: `creditUsed` is computed inside B2BPortal from open orders. For the topbar
  // chip we surface only the limit until we hoist that into a shared hook (Sprint 4).

  const [cmdOpen, setCmdOpen] = useState(false);

  return (
    <AppShell
      role={profile?.b2b_role ?? profile?.role ?? undefined}
      topBar={
        <TopBar
          cartCount={cartCount}
          alertCount={alertCount}
          creditAvailable={creditAvailable}
          creditTotal={creditTotal}
          canAccessAdmin={authProfile?.role === "admin"}
          onOpenCart={() => navigate("/cart")}
          onOpenCommand={() => setCmdOpen(true)}
        />
      }
      banner={<PendingApprovalBanner role={profile?.b2b_role ?? profile?.role} />}
    >
      <Outlet />
      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
    </AppShell>
  );
}

export default PortalRoot;
