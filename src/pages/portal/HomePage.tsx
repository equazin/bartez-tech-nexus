import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useImpersonate } from "@/context/ImpersonateContext";
import { useOrders } from "@/hooks/useOrders";
import { useBusinessAlerts } from "@/hooks/useBusinessAlerts";
import { useClientKpis } from "@/hooks/useClientKpis";
import { useProducts } from "@/hooks/useProducts";
import { usePricing } from "@/hooks/usePricing";
import { HomeHero } from "@/components/portal/home/HomeHero";
import { MetricsRow } from "@/components/portal/home/MetricsRow";
import { QuickActions } from "@/components/portal/home/QuickActions";
import { ForYouSection } from "@/components/portal/home/ForYouSection";
import { ActivityFeed } from "@/components/portal/home/ActivityFeed";
import { AlertsInbox } from "@/components/portal/home/AlertsInbox";
import { RepeatOrderButton } from "@/components/portal/orders/RepeatOrderButton";
import { Separator } from "@/components/ui/separator";

export default function HomePage() {
  const navigate = useNavigate();
  const { profile: authProfile } = useAuth();
  const { activeProfile } = useImpersonate();
  const profile = activeProfile ?? authProfile;
  const clientId = profile?.id ?? "";
  const { computePrice } = usePricing(profile);

  const { orders, loading: ordersLoading } = useOrders();
  const { alerts, loading: alertsLoading, dismiss } = useBusinessAlerts(clientId);
  const { kpis, loading: kpisLoading } = useClientKpis(clientId);
  const { products: featuredProducts, loading: featuredLoading } = useProducts({
    isFeatured: true,
    pageSize: 6,
  });

  // Most recent completed order for "reagregar" CTA
  const lastOrder = orders
    .filter((o) => o.status === "delivered" || o.status === "shipped")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

  if (!profile) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-3 sm:space-y-6 sm:p-4 md:p-6">
      {/* Greeting */}
      <HomeHero profile={profile} />

      {/* Alerts */}
      <AlertsInbox alerts={alerts} loading={alertsLoading} onDismiss={dismiss} />

      {/* KPI metrics */}
      <MetricsRow
        kpis={kpis}
        loading={kpisLoading}
        creditLimit={profile.credit_limit}
        onNavigate={navigate}
      />

      <Separator />

      {/* Quick actions */}
      <QuickActions onNavigate={navigate} />

      {/* Last order repeat CTA */}
      {lastOrder && (
        <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              Último pedido: {lastOrder.order_number ?? `#${lastOrder.id}`}
            </p>
            <p className="text-xs text-muted-foreground">
              {lastOrder.products.length} producto{lastOrder.products.length !== 1 ? "s" : ""}
              {" · "}
              {new Date(lastOrder.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}
            </p>
          </div>
          <RepeatOrderButton order={lastOrder} clientId={clientId} onDone={() => navigate("/cart")} />
        </div>
      )}

      <Separator />

      {/* Featured products */}
      <ForYouSection products={featuredProducts} loading={featuredLoading} getPrice={computePrice} />

      <Separator />

      {/* Recent activity */}
      <ActivityFeed orders={orders} loading={ordersLoading} onNavigate={navigate} />
    </div>
  );
}
