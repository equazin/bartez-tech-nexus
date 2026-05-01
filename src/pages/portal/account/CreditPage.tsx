import { useMemo, useState } from "react";
import { CreditCard, AlertTriangle, CheckCircle, Download, Filter } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { useImpersonate } from "@/context/ImpersonateContext";
import { useClientKpis } from "@/hooks/useClientKpis";
import { useAccountMovements } from "@/hooks/useAccountMovements";
import type { AccountMovement } from "@/lib/api/clientDetail";

import { MetricCard } from "@/components/ui/metric-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";

type MovementFilter = "all" | "factura" | "pago" | "nota_credito" | "ajuste";

const TYPE_LABEL: Record<AccountMovement["tipo"], string> = {
  factura: "Factura",
  pago: "Pago",
  nota_credito: "Nota crédito",
  ajuste: "Ajuste",
};

function formatARS(n: number): string {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

function downloadCsv(filename: string, rows: string[][]): void {
  const csv = rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function CreditPage() {
  const { profile: authProfile } = useAuth();
  const { activeProfile } = useImpersonate();
  const profile = activeProfile ?? authProfile;
  const clientId = profile?.id;

  const { kpis, loading: kpisLoading } = useClientKpis(clientId);
  const { movements, loading: movementsLoading } = useAccountMovements(clientId, 200);

  const [filter, setFilter] = useState<MovementFilter>("all");

  const creditLimit = profile?.credit_limit ?? 0;
  const creditUsed = profile?.credit_used ?? 0;
  const creditAvailable = Math.max(0, creditLimit - creditUsed);
  const usedPct = kpis.credit_used_pct;

  const statusTone: "danger" | "warning" | "success" =
    usedPct >= 90 ? "danger" : usedPct >= 70 ? "warning" : "success";
  const statusLabel = usedPct >= 90 ? "Límite casi alcanzado" : usedPct >= 70 ? "Uso elevado" : "Disponible";

  const filteredMovements = useMemo(
    () => (filter === "all" ? movements : movements.filter((m) => m.tipo === filter)),
    [movements, filter],
  );

  function handleExportCsv() {
    if (filteredMovements.length === 0) return;
    const rows = [
      ["Fecha", "Tipo", "Descripción", "Monto"],
      ...filteredMovements.map((m) => [
        formatDate(m.fecha),
        TYPE_LABEL[m.tipo],
        m.descripcion ?? "",
        String(m.monto),
      ]),
    ];
    downloadCsv(`movimientos_${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  return (
    <div className="mx-auto w-full max-w-5xl p-4 md:p-6 space-y-5">
      <PageHeader
        eyebrow="Mi cuenta"
        title="Crédito"
        description="Línea de crédito asignada y movimientos de cuenta corriente."
      />

      {/* KPIs */}
      {kpisLoading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-[22px]" />)}
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
            <SurfaceCard tone="default" padding="md" className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Utilización</span>
                <Badge
                  variant={statusTone === "danger" ? "destructive" : "outline"}
                  className={
                    statusTone === "warning"
                      ? "border-warning text-warning"
                      : statusTone === "success"
                        ? "border-success text-success"
                        : ""
                  }
                >
                  {statusLabel}
                </Badge>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${
                    statusTone === "danger" ? "bg-danger" : statusTone === "warning" ? "bg-warning" : "bg-success"
                  }`}
                  style={{ width: `${Math.min(usedPct, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>$0</span>
                <span>{formatARS(creditLimit)}</span>
              </div>
            </SurfaceCard>
          )}

          {creditLimit === 0 && (
            <p className="text-sm text-muted-foreground">
              No tenés una línea de crédito configurada. Contactá a tu vendedor para habilitarla.
            </p>
          )}
        </>
      )}

      {/* Movimientos */}
      <SurfaceCard tone="default" padding="md" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="portal-h3">Movimientos de cuenta corriente</h2>
            <p className="text-xs text-muted-foreground">Últimos 200 registros</p>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filter} onValueChange={(v) => setFilter(v as MovementFilter)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="factura">Facturas</SelectItem>
                <SelectItem value="pago">Pagos</SelectItem>
                <SelectItem value="nota_credito">Notas de crédito</SelectItem>
                <SelectItem value="ajuste">Ajustes</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleExportCsv}
              disabled={filteredMovements.length === 0}
            >
              <Download className="h-4 w-4" />
              Exportar
            </Button>
          </div>
        </div>

        {movementsLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 rounded" />)}
          </div>
        ) : filteredMovements.length === 0 ? (
          <EmptyState
            title="Sin movimientos"
            description={
              filter === "all"
                ? "Cuando se registren facturas, pagos o ajustes los vas a ver acá."
                : "No hay movimientos de este tipo en el rango cargado."
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Fecha</th>
                  <th className="px-3 py-2 text-left font-medium">Tipo</th>
                  <th className="px-3 py-2 text-left font-medium">Descripción</th>
                  <th className="px-3 py-2 text-right font-medium">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredMovements.map((m) => {
                  const isCredit = m.tipo === "pago" || m.tipo === "nota_credito";
                  return (
                    <tr key={m.id} className="text-sm hover:bg-muted/40">
                      <td className="px-3 py-2 portal-tabular text-muted-foreground">{formatDate(m.fecha)}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="text-xs">
                          {TYPE_LABEL[m.tipo]}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-foreground">{m.descripcion || "—"}</td>
                      <td
                        className={`px-3 py-2 text-right portal-tabular font-semibold ${
                          isCredit ? "text-success" : "text-foreground"
                        }`}
                      >
                        {isCredit ? "+" : "−"}
                        {formatARS(Math.abs(m.monto))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SurfaceCard>
    </div>
  );
}
