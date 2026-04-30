import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useImpersonate } from "@/context/ImpersonateContext";
import { useClientReports } from "@/hooks/useClientReports";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MonthlyTrend } from "@/components/portal/reports/MonthlyTrend";
import { PurchasesByCategory } from "@/components/portal/reports/PurchasesByCategory";
import { TopProducts } from "@/components/portal/reports/TopProducts";

export default function ReportsPage() {
  const { profile: authProfile } = useAuth();
  const { activeProfile } = useImpersonate();
  const profile = activeProfile ?? authProfile;
  const clientId = profile?.id;

  const [months, setMonths] = useState(12);
  const { byCategory, topProducts, monthlyTrend, loading } = useClientReports(clientId, months);

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Reportes de compras</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Análisis de tu historial de pedidos</p>
        </div>
        <Select
          value={String(months)}
          onValueChange={(v) => setMonths(Number(v))}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3">Últimos 3 meses</SelectItem>
            <SelectItem value="6">Últimos 6 meses</SelectItem>
            <SelectItem value="12">Último año</SelectItem>
            <SelectItem value="24">Últimos 2 años</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Monthly trend */}
        <div className="rounded-xl border bg-card p-4 lg:col-span-2">
          <p className="mb-4 text-sm font-semibold">Compras por mes</p>
          <MonthlyTrend data={monthlyTrend} loading={loading} />
        </div>

        {/* By category */}
        <div className="rounded-xl border bg-card p-4">
          <p className="mb-4 text-sm font-semibold">Por categoría</p>
          <PurchasesByCategory data={byCategory} loading={loading} />
        </div>

        {/* Top products */}
        <div className="rounded-xl border bg-card p-4">
          <p className="mb-4 text-sm font-semibold">Productos más comprados</p>
          <TopProducts data={topProducts} loading={loading} />
        </div>
      </div>
    </div>
  );
}
