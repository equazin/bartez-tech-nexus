import { RmaPanel } from "@/components/b2b/RmaPanel";
import { useAuth } from "@/context/AuthContext";
import { useImpersonate } from "@/context/ImpersonateContext";
import { useOrders } from "@/hooks/useOrders";

export function PortalRmaSection() {
  const { profile: authProfile } = useAuth();
  const { activeProfile } = useImpersonate();
  const profile = activeProfile ?? authProfile;
  const { orders } = useOrders();

  if (!profile) return null;
  return <RmaPanel clientId={profile.id} orders={orders} />;
}
