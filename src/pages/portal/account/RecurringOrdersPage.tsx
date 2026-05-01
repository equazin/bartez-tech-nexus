import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Repeat, Play, Trash2, Plus, AlertCircle } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { useImpersonate } from "@/context/ImpersonateContext";
import { useRecurringOrders } from "@/hooks/useRecurringOrders";
import { formatRecurringFrequency, type RecurringOrderTemplate } from "@/lib/recurringOrders";

import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/hooks/use-toast";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function RecurringOrdersPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile: authProfile } = useAuth();
  const { activeProfile } = useImpersonate();
  const profile = activeProfile ?? authProfile;
  const userId = profile?.id ?? "";

  const {
    recurringOrders,
    loading,
    deleteRecurringOrder,
    toggleRecurringOrder,
    executeNow,
  } = useRecurringOrders({ userId });

  const [executingId, setExecutingId] = useState<string | null>(null);

  async function handleExecute(template: RecurringOrderTemplate) {
    if (!window.confirm(`¿Ejecutar ahora "${template.name}"? Se creará un pedido con ${template.items.length} productos.`)) return;
    setExecutingId(template.id);
    const result = await executeNow(template.id);
    setExecutingId(null);
    if (!result) {
      toast({ title: "No se pudo crear el pedido", variant: "destructive" });
      return;
    }
    toast({ title: "Pedido creado", description: result.order_number ?? `#${result.id}` });
    navigate("/portal/pedidos");
  }

  async function handleDelete(template: RecurringOrderTemplate) {
    if (!window.confirm(`¿Eliminar la plantilla "${template.name}"?`)) return;
    await deleteRecurringOrder(template.id);
    toast({ title: "Plantilla eliminada" });
  }

  return (
    <div className="mx-auto w-full max-w-5xl p-4 md:p-6">
      <PageHeader
        eyebrow="Mi cuenta"
        title="Reposición automática"
        description="Plantillas que generan pedidos en la frecuencia que vos definas."
        actions={
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => navigate("/portal/cuenta/listas")}
          >
            <Plus className="h-4 w-4" />
            Crear desde lista
          </Button>
        }
      />

      <div className="mt-5">
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : recurringOrders.length === 0 ? (
          <EmptyState
            icon={<Repeat className="h-8 w-8" />}
            title="Sin reposiciones automáticas"
            description="Creá una plantilla con tus productos frecuentes y dejá que el portal arme los pedidos por vos."
            actionLabel="Empezar desde una lista"
            onAction={() => navigate("/portal/cuenta/listas")}
          />
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            <table className="w-full">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Plantilla</th>
                  <th className="px-4 py-2.5 text-left font-medium">Frecuencia</th>
                  <th className="px-4 py-2.5 text-left font-medium">Próxima</th>
                  <th className="px-4 py-2.5 text-left font-medium">Modo</th>
                  <th className="px-4 py-2.5 text-center font-medium">Activa</th>
                  <th className="px-4 py-2.5 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recurringOrders.map((tpl) => {
                  const itemCount = tpl.items.length;
                  return (
                    <tr key={tpl.id} className="text-sm">
                      <td className="px-4 py-3">
                        <div className="font-medium">{tpl.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {itemCount} {itemCount === 1 ? "producto" : "productos"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatRecurringFrequency(tpl.frequency, tpl.custom_days)}
                      </td>
                      <td className="px-4 py-3 portal-tabular">
                        {tpl.active ? formatDate(tpl.next_run_at) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {tpl.mode === "auto" ? (
                          <Badge variant="outline" className="border-success text-success">
                            Automático
                          </Badge>
                        ) : (
                          <Badge variant="outline">Confirma</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Switch
                          checked={tpl.active}
                          onCheckedChange={(v) => void toggleRecurringOrder(tpl.id, v)}
                          aria-label={tpl.active ? "Pausar" : "Activar"}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            disabled={executingId === tpl.id || itemCount === 0}
                            onClick={() => handleExecute(tpl)}
                          >
                            <Play className="h-3.5 w-3.5" />
                            Ejecutar
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDelete(tpl)}
                            aria-label="Eliminar"
                          >
                            <Trash2 className="h-4 w-4 text-danger" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {recurringOrders.length > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-info/40 bg-info-soft px-3 py-2 text-xs text-info">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <p>
            Las plantillas en modo <strong>automático</strong> generan el pedido sin tu intervención.
            Las que están en <strong>confirma</strong> te avisan por email para que aceptes o pospongas.
          </p>
        </div>
      )}
    </div>
  );
}
