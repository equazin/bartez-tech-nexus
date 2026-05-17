import { ProjectsPanel } from "@/components/b2b/ProjectsPanel";
import { useAuth } from "@/context/AuthContext";
import { useImpersonate } from "@/context/ImpersonateContext";
import { useOrders } from "@/hooks/useOrders";
import { useQuotes } from "@/hooks/useQuotes";

export function PortalProjectsSection() {
  const { profile: authProfile } = useAuth();
  const { activeProfile } = useImpersonate();
  const profile = activeProfile ?? authProfile;
  const userId = profile?.id ?? "guest";

  const { orders } = useOrders();
  const { quotes } = useQuotes(userId);

  return <ProjectsPanel orders={orders} quotes={quotes} profileId={userId} />;
}
