import { useAuth } from "@/context/AuthContext";
import { useImpersonate } from "@/context/ImpersonateContext";
import { useClientKpis } from "@/hooks/useClientKpis";
import { MetricCard } from "@/components/ui/metric-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CreditCard, AlertTriangle, CheckCircle } from "lucide-react";

function formatARS(n: number): string {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}

export default function CreditPage() {
  const { profile: authProfile } = useAuth();
  const { activeProfile } = useImpersonate();
  const profile = activeProfile ?? authProfile;
  const clientId = profile?.id;

  const { kpis, loading } = useClientKpis(clientId);

  const creditLimit = profile?.credit_limit ?? 0;
  const creditUsed  = profile?.credit_used  ?? 0;
  const creditAvailable = Math.max(0, creditLimit - creditUsed);
  const usedPct = kpis.credit_used_pct;

  const statusTone = usedPct >= 90 ? "danger" : usedPct >= 70 ? "warning" : "success";
  const statusLabel = usedPct >= 90 ? "Límite casi alcanzado" : usedPct >= 70 ? "Uso elevado" : "Disponible";

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Crédito</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Estado de tu línea de crédito</p>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {[1,2,3].map((i) => <Skeleton key={i} className="h-24 rounded-[22px]" />)}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <MetricCard
              label="Límite de crédito"
              value={creditLimit > 0 ? formatARS(creditLimit) : "Sin límite"}
              icon={<CreditCard className="h-4 w-4" />}
            />
            <MetricCard
              label="Crédito usado"
              value={formatARS(creditUsed)}
              detail={`${usedPct}% del límite`}
              icon={<AlertTriangle className="h-4 w-4" />}
            />
            <MetricCard
              label="Disponible"
              value={formatARS(creditAvailable)}
              icon={<CheckCircle className="h-4 w-4" />}
            />
          </div>

          {creditLimit > 0 && (
            <div className="mt-6 rounded-xl border bg-card p-4">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium">Utilización</span>
                <Badge
                  variant={statusTone === "danger" ? "destructive" : "outline"}
                  className={statusTone === "warning" ? "border-warning text-warning" : statusTone === "success" ? "border-success text-success" : ""}
                >
                  {statusLabel}
                </Badge>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${
                    statusTone === "danger" ? "bg-danger" :
                    statusTone === "warning" ? "bg-warning" : "bg-success"
                  }`}
                  style={{ width: `${Math.min(usedPct, 100)}%` }}
                />
              </div>
              <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
                <span>$0</span>
                <span>{formatARS(creditLimit)}</span>
              </div>
            </div>
          )}

          {creditLimit === 0 && (
            <p className="mt-6 text-sm text-muted-foreground">
              No tenés una línea de crédito configurada. Contactá a tu vendedor para habilitarla.
            </p>
          )}
        </>
      )}
    </div>
  );
}
