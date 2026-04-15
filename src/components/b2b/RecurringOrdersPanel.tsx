import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Play, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { useRecurringOrders, type RecurringOrderDraft } from "@/hooks/useRecurringOrders";
import { formatRecurringFrequency } from "@/lib/recurringOrders";
import type { Product } from "@/models/products";

interface DraftItem {
  product_id: number;
  quantity: number;
}

export interface RecurringOrdersPanelProps {
  userId: string;
  companyId?: string | null;
  products: Product[];
  onGoToOrders?: () => void;
}

function toLocalDateTimeInput(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function buildInitialDraft(products: Product[]): RecurringOrderDraft {
  const firstProductId = products[0]?.id ?? 0;
  const nextRun = new Date();
  nextRun.setDate(nextRun.getDate() + 1);
  nextRun.setHours(8, 0, 0, 0);

  return {
    name: "",
    items: firstProductId ? [{ product_id: firstProductId, quantity: 1 }] : [],
    frequency: "monthly",
    custom_days: 30,
    next_run_at: nextRun.toISOString(),
    mode: "confirm",
    active: true,
  };
}

export function RecurringOrdersPanel({
  userId,
  companyId,
  products,
  onGoToOrders,
}: RecurringOrdersPanelProps) {
  const {
    recurringOrders,
    loading,
    createRecurringOrder,
    updateRecurringOrder,
    deleteRecurringOrder,
    toggleRecurringOrder,
    executeNow,
  } = useRecurringOrders({ userId, companyId });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<RecurringOrderDraft>(() => buildInitialDraft(products));

  const editingTemplate = useMemo(
    () => recurringOrders.find((item) => item.id === editingId) ?? null,
    [editingId, recurringOrders],
  );

  useEffect(() => {
    if (!editingTemplate) return;

    setDraft({
      name: editingTemplate.name,
      items: editingTemplate.items,
      frequency: editingTemplate.frequency,
      custom_days: editingTemplate.custom_days,
      next_run_at: editingTemplate.next_run_at,
      mode: editingTemplate.mode,
      active: editingTemplate.active,
    });
  }, [editingTemplate]);

  useEffect(() => {
    if (editingId || products.length === 0) return;
    setDraft((current) => (current.items.length > 0 ? current : buildInitialDraft(products)));
  }, [editingId, products]);

  function resetDraft() {
    setEditingId(null);
    setDraft(buildInitialDraft(products));
  }

  function updateDraftItem(index: number, patch: Partial<DraftItem>) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    }));
  }

  async function handleSave() {
    if (!draft.name.trim()) {
      toast.error("Defini un nombre para la plantilla.");
      return;
    }

    if (draft.items.length === 0) {
      toast.error("Agrega al menos un producto.");
      return;
    }

    const payload: RecurringOrderDraft = {
      ...draft,
      next_run_at: new Date(draft.next_run_at).toISOString(),
      items: draft.items.filter((item) => item.product_id > 0 && item.quantity > 0),
    };

    const result = editingId
      ? await updateRecurringOrder(editingId, payload)
      : await createRecurringOrder(payload);

    if (!result) {
      toast.error("No se pudo guardar la plantilla.");
      return;
    }

    toast.success(editingId ? "Plantilla actualizada." : "Plantilla creada.");
    resetDraft();
  }

  async function handleExecuteNow(id: string) {
    const result = await executeNow(id);
    if (!result) {
      toast.error("No se pudo ejecutar la plantilla.");
      return;
    }

    toast.success(
      result.order_number
        ? `Pedido ${result.order_number} generado correctamente.`
        : "Pedido recurrente generado correctamente.",
    );
    onGoToOrders?.();
  }

  async function handleDelete(id: string) {
    await deleteRecurringOrder(id);
    if (editingId === id) resetDraft();
    toast.success("Plantilla eliminada.");
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Sprint 3"
        title="Reposicion automatica"
        description="Crea plantillas para reponer stock operativo sin volver a armar el pedido cada vez."
        actions={
          <Button variant="outline" onClick={resetDraft}>
            <RotateCcw size={14} />
            Nueva plantilla
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <SurfaceCard padding="md" className="space-y-4 rounded-[24px] border-border/70">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Plantillas activas
              </p>
              <h3 className="mt-1 text-lg font-semibold text-foreground">Ordenes recurrentes</h3>
            </div>
            <Badge variant="outline">{recurringOrders.length}</Badge>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-24 animate-pulse rounded-2xl border border-border/70 bg-surface/60" />
              ))}
            </div>
          ) : recurringOrders.length === 0 ? (
            <EmptyState
              className="rounded-[22px]"
              title="Sin reposicion automatica"
              description="Crea una primera plantilla para reponer consumos recurrentes o compras operativas."
            />
          ) : (
            <div className="space-y-3">
              {recurringOrders.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => setEditingId(template.id)}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                    editingId === template.id
                      ? "border-primary/30 bg-primary/5"
                      : "border-border/70 bg-card hover:bg-surface/60"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{template.name}</p>
                        <Badge variant={template.active ? "success" : "outline"}>
                          {template.active ? "Activa" : "Pausada"}
                        </Badge>
                        <Badge variant="outline">{formatRecurringFrequency(template.frequency, template.custom_days)}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {template.items.length} SKU
                        {template.mode === "auto" ? " · Pedido automatico" : " · Requiere confirmacion"}
                      </p>
                      <p className="mt-1 inline-flex items-center gap-2 text-xs text-muted-foreground">
                        <CalendarClock size={13} />
                        Proximo run: {new Date(template.next_run_at).toLocaleString("es-AR")}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={(event) => {
                          event.stopPropagation();
                          void toggleRecurringOrder(template.id, !template.active);
                        }}
                      >
                        {template.active ? "Pausar" : "Activar"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleExecuteNow(template.id);
                        }}
                      >
                        <Play size={13} />
                        Ejecutar ahora
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleDelete(template.id);
                        }}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </SurfaceCard>

        <SurfaceCard padding="md" className="space-y-4 rounded-[24px] border-border/70">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {editingId ? "Editar" : "Nueva"}
            </p>
            <h3 className="mt-1 text-lg font-semibold text-foreground">
              {editingId ? "Editar plantilla" : "Crear plantilla recurrente"}
            </h3>
          </div>

          <label className="space-y-1.5">
            <span className="text-xs text-muted-foreground">Nombre</span>
            <input
              value={draft.name}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              className="h-10 w-full rounded-xl border border-border/70 bg-card px-3 text-sm outline-none"
              placeholder="Ej: Reposicion mensual sucursal centro"
            />
          </label>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Items</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    items: [...current.items, { product_id: products[0]?.id ?? 0, quantity: 1 }],
                  }))
                }
              >
                Agregar item
              </Button>
            </div>

            <div className="space-y-2">
              {draft.items.map((item, index) => (
                <div key={`${item.product_id}-${index}`} className="grid gap-2 rounded-2xl border border-border/70 bg-surface/40 p-3">
                  <select
                    value={item.product_id}
                    onChange={(event) => updateDraftItem(index, { product_id: Number(event.target.value) })}
                    className="h-10 rounded-xl border border-border/70 bg-card px-3 text-sm outline-none"
                  >
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} ({product.sku || product.category})
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(event) => updateDraftItem(index, { quantity: Math.max(1, Number(event.target.value) || 1) })}
                      className="h-10 w-28 rounded-xl border border-border/70 bg-card px-3 text-sm outline-none"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          items: current.items.filter((_, itemIndex) => itemIndex !== index),
                        }))
                      }
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs text-muted-foreground">Frecuencia</span>
              <select
                value={draft.frequency}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    frequency: event.target.value as RecurringOrderDraft["frequency"],
                  }))
                }
                className="h-10 rounded-xl border border-border/70 bg-card px-3 text-sm outline-none"
              >
                <option value="weekly">Semanal</option>
                <option value="biweekly">Quincenal</option>
                <option value="monthly">Mensual</option>
                <option value="custom">Personalizada</option>
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="text-xs text-muted-foreground">Modo</span>
              <select
                value={draft.mode}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    mode: event.target.value as RecurringOrderDraft["mode"],
                  }))
                }
                className="h-10 rounded-xl border border-border/70 bg-card px-3 text-sm outline-none"
              >
                <option value="confirm">Pedir confirmacion</option>
                <option value="auto">Crear automaticamente</option>
              </select>
            </label>
          </div>

          {draft.frequency === "custom" ? (
            <label className="space-y-1.5">
              <span className="text-xs text-muted-foreground">Cada cuantos dias</span>
              <input
                type="number"
                min={1}
                value={draft.custom_days ?? 30}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    custom_days: Math.max(1, Number(event.target.value) || 1),
                  }))
                }
                className="h-10 w-full rounded-xl border border-border/70 bg-card px-3 text-sm outline-none"
              />
            </label>
          ) : null}

          <label className="space-y-1.5">
            <span className="text-xs text-muted-foreground">Primer run</span>
            <input
              type="datetime-local"
              value={toLocalDateTimeInput(draft.next_run_at)}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  next_run_at: new Date(event.target.value).toISOString(),
                }))
              }
              className="h-10 w-full rounded-xl border border-border/70 bg-card px-3 text-sm outline-none"
            />
          </label>

          <div className="flex flex-wrap justify-end gap-2">
            {editingId ? (
              <Button type="button" variant="outline" onClick={resetDraft}>
                Cancelar
              </Button>
            ) : null}
            <Button type="button" onClick={() => void handleSave()}>
              {editingId ? "Guardar cambios" : "Crear plantilla"}
            </Button>
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}
