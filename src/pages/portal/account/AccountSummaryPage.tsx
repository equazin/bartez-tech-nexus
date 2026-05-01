import { useMemo, type ReactNode } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  CreditCard,
  Receipt,
  ShoppingCart,
  FileText,
  ArrowRight,
  AlertTriangle,
  Sparkles,
  Repeat,
  ListChecks,
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { useImpersonate } from "@/context/ImpersonateContext";
import { useCurrency } from "@/context/CurrencyContext";
import { useClientKpis } from "@/hooks/useClientKpis";
import { useOrders } from "@/hooks/useOrders";
import { useClientDocuments } from "@/hooks/useClientDocuments";

import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { StatusDot } from "@/components/ui/status-dot";

const PARTNER_LEVEL_LABEL: Record<string, string> = {
  cliente: "Cliente",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
};

const PARTNER_LEVEL_TONE: Record<string, "neutral" | "info" | "success" | "warning"> = {
  cliente: "neutral",
  silver: "neutral",
  gold: "warning",
  platinum: "info",
};

function formatRelativeDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

export default function AccountSummaryPage() {
  const navigate = useNavigate();
  const { profile: authProfile } = useAuth();
  const { activeProfile } = useImpersonate();
  const profile = activeProfile ?? authProfile;
  const { formatPrice } = useCurrency();

  const clientId = profile?.id;
  const { kpis, loading: kpisLoading } = useClientKpis(clientId);
  const { orders, loading: ordersLoading } = useOrders();
  const { documents, loading: docsLoading } = useClientDocuments(clientId);

  const creditLimit = profile?.credit_limit ?? 0;
  const creditUsed = profile?.credit_used ?? 0;
  const creditAvailable = Math.max(0, creditLimit - creditUsed);
  const creditUsedPct = creditLimit > 0 ? Math.min(100, Math.round((creditUsed / creditLimit) * 100)) : 0;

  const partnerLevelKey = (profile?.partner_level ?? "cliente").toLowerCase();
  const partnerLevelLabel = PARTNER_LEVEL_LABEL[partnerLevelKey] ?? "Cliente";
  const partnerLevelTone = PARTNER_LEVEL_TONE[partnerLevelKey] ?? "neutral";

  const totalInProcess = useMemo(
    () =>
      orders
        .filter((o) => ["pending", "approved", "preparing", "shipped"].includes(o.status ?? ""))
        .reduce((sum, o) => sum + (Number(o.total) || 0), 0),
    [orders],
  );

  const pendingInvoices = useMemo(() => {
    const now = Date.now();
    return documents
      .filter((d) => d.kind === "invoice" && d.status !== "paid" && d.status !== "cancelled")
      .slice(0, 3)
      .map((d) => {
        const ageDays = Math.floor((now - new Date(d.created_at).getTime()) / (1000 * 60 * 60 * 24));
        return { ...d, ageDays };
      });
  }, [documents]);

  const recentActivity = useMemo(() => {
    return orders
      .slice(0, 5)
      .map((o) => ({
        id: o.id,
        title: `Pedido ${o.order_number ?? `#${o.id}`}`,
        status: o.status ?? "—",
        date: o.created_at,
        total: Number(o.total) || 0,
      }));
  }, [orders]);

  if (!profile) return null;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 p-4 md:p-6">
      <PageHeader
        eyebrow="Mi cuenta"
        title={`Hola, ${profile.contact_name ?? profile.company_name ?? "Cliente"}`}
        description="Resumen de tu actividad, crédito y documentos."
        actions={
          <Badge
            variant="outline"
            className={`gap-1.5 ${
              partnerLevelTone === "info"
                ? "border-info text-info"
                : partnerLevelTone === "warning"
                  ? "border-warning text-warning"
                  : "border-border text-foreground"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Nivel {partnerLevelLabel}
          </Badge>
        }
      />

      {/* KPIs */}
      {kpisLoading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-[22px]" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <button type="button" onClick={() => navigate("/portal/cuenta/credito")} className="text-left">
            <MetricCard
              label="Crédito disponible"
              value={creditLimit > 0 ? formatPrice(creditAvailable, "ARS") : "Sin límite"}
              detail={creditLimit > 0 ? `${creditUsedPct}% utilizado` : "Configurá con tu vendedor"}
              trend={creditUsedPct > 80 ? "⚠ Alto" : undefined}
              icon={<CreditCard className="h-4 w-4" />}
            />
          </button>

          <button type="button" onClick={() => navigate("/portal/pedidos")} className="text-left">
            <MetricCard
              label="Pedidos activos"
              value={String(kpis.orders_in_progress)}
              detail={totalInProcess > 0 ? `${formatPrice(totalInProcess, "ARS")} en curso` : "sin pedidos abiertos"}
              icon={<ShoppingCart className="h-4 w-4" />}
            />
          </button>

          <button type="button" onClick={() => navigate("/portal/cotizaciones")} className="text-left">
            <MetricCard
              label="Cotizaciones"
              value={String(kpis.quotes_pending)}
              detail="esperando tu OK"
              icon={<FileText className="h-4 w-4" />}
            />
          </button>

          <button type="button" onClick={() => navigate("/portal/cuenta/documentos")} className="text-left">
            <MetricCard
              label="Última factura"
              value={formatRelativeDate(kpis.last_invoice_at)}
              detail="en documentos"
              icon={<Receipt className="h-4 w-4" />}
            />
          </button>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Facturas pendientes de pago */}
        <SurfaceCard tone="default" padding="md" className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="portal-h3">Facturas pendientes</h2>
            <Link
              to="/portal/cuenta/documentos"
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"
            >
              Ver todas
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {docsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
            </div>
          ) : pendingInvoices.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/30 px-3 py-6 text-center text-sm text-muted-foreground">
              No tenés facturas pendientes de pago.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {pendingInvoices.map((d) => {
                const tone: "danger" | "warning" | "success" =
                  d.ageDays > 30 ? "danger" : d.ageDays > 14 ? "warning" : "success";
                return (
                  <Link
                    key={d.id}
                    to="/portal/cuenta/documentos"
                    className="-mx-1 flex items-center justify-between gap-3 rounded px-1 py-2.5 hover:bg-muted/40"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <StatusDot tone={tone} size="md" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{d.number ?? "Factura"}</p>
                        <p className="text-xs text-muted-foreground">
                          Emitida hace {d.ageDays} {d.ageDays === 1 ? "día" : "días"}
                        </p>
                      </div>
                    </div>
                    <span className="portal-tabular shrink-0 text-sm font-semibold">
                      {formatPrice(Number(d.amount) || 0, (d.currency as "USD" | "ARS") ?? "ARS")}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </SurfaceCard>

        {/* Atajos */}
        <SurfaceCard tone="subtle" padding="md" className="space-y-3">
          <h2 className="portal-h3">Atajos</h2>
          <div className="space-y-2">
            <ShortcutLink to="/portal/cuenta/documentos" icon={<Receipt className="h-4 w-4" />} label="Ver documentos" />
            <ShortcutLink to="/portal/pedidos" icon={<ShoppingCart className="h-4 w-4" />} label="Pedidos en curso" />
            <ShortcutLink to="/portal/cuenta/listas" icon={<ListChecks className="h-4 w-4" />} label="Mis listas" />
            <ShortcutLink to="/portal/cuenta/reposicion" icon={<Repeat className="h-4 w-4" />} label="Reposición auto." />
          </div>
        </SurfaceCard>
      </div>

      {/* Actividad reciente */}
      <SurfaceCard tone="default" padding="md" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="portal-h3">Actividad reciente</h2>
          <Link
            to="/portal/pedidos"
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"
          >
            Ver pedidos
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {ordersLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
          </div>
        ) : recentActivity.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/30 px-3 py-6 text-center text-sm text-muted-foreground">
            Aún no tenés actividad. Empezá explorando el catálogo.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {recentActivity.map((a) => (
              <div key={String(a.id)} className="flex items-center justify-between py-2.5 text-sm">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <StatusDot
                    tone={
                      a.status === "delivered"
                        ? "success"
                        : a.status === "rejected"
                          ? "danger"
                          : a.status === "pending_approval"
                            ? "warning"
                            : "info"
                    }
                  />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{a.title}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {a.status.replace(/_/g, " ")} · {formatRelativeDate(a.date)}
                    </p>
                  </div>
                </div>
                <span className="portal-tabular shrink-0 font-semibold">
                  {formatPrice(a.total, "ARS")}
                </span>
              </div>
            ))}
          </div>
        )}
      </SurfaceCard>

      {/* Lealtad widget (compacto) */}
      <SurfaceCard tone="subtle" padding="md">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="portal-micro">PROGRAMA DE FIDELIDAD</p>
            <h3 className="portal-h3 mt-1">Nivel actual: {partnerLevelLabel}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {partnerLevelKey === "platinum"
                ? "Estás en el nivel más alto. Disfrutá de todos los beneficios desbloqueados."
                : "Sumá pedidos para desbloquear mejores condiciones comerciales."}
            </p>
          </div>
          {creditUsedPct > 80 && (
            <div className="inline-flex items-center gap-1.5 rounded-md bg-warning-soft px-2.5 py-1 text-xs font-semibold text-warning">
              <AlertTriangle className="h-3.5 w-3.5" />
              Crédito alto
            </div>
          )}
        </div>
      </SurfaceCard>
    </div>
  );
}

function ShortcutLink({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between rounded-lg border bg-card px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground"
    >
      <span className="inline-flex items-center gap-2">
        {icon}
        {label}
      </span>
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}
