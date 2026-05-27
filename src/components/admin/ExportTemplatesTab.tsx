import { useCallback, useEffect, useState } from "react";
import { Plus, Save, Trash2, ArrowUp, ArrowDown, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  AVAILABLE_COLUMN_KEYS,
  COLUMN_DEFAULT_LABELS,
  createExportTemplate,
  deleteExportTemplate,
  fetchAllExportTemplates,
  updateExportTemplate,
  type ExportColumnKey,
  type ExportTemplateColumn,
  type ExportTemplateFilters,
  type ExportTemplateFormat,
  type ExportTemplateInput,
  type ExportTemplateWithMeta,
} from "@/lib/exportTemplates";

const EMPTY_DRAFT: ExportTemplateInput = {
  slug: "",
  name: "",
  description: "",
  format: "csv",
  columns: [],
  filters: {},
  filename_pattern: "lista_precios_{date}",
  active: true,
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function ExportTemplatesTab() {
  const [templates, setTemplates] = useState<ExportTemplateWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ExportTemplateInput>(EMPTY_DRAFT);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ExportTemplateWithMeta | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchAllExportTemplates();
      setTemplates(list);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "No se pudo cargar la lista");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  function loadIntoDraft(template: ExportTemplateWithMeta) {
    setIsNew(false);
    setSelectedId(template.id);
    setDraft({
      slug: template.slug,
      name: template.name,
      description: template.description ?? "",
      format: template.format,
      columns: template.columns,
      filters: template.filters,
      filename_pattern: template.filename_pattern,
      active: template.active,
    });
  }

  function startNew() {
    setIsNew(true);
    setSelectedId(null);
    setDraft({ ...EMPTY_DRAFT });
  }

  function cancelEdit() {
    setIsNew(false);
    setSelectedId(null);
    setDraft(EMPTY_DRAFT);
  }

  async function handleSave() {
    if (!draft.name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    if (draft.columns.length === 0) {
      toast.error("Agregá al menos una columna");
      return;
    }
    const slug = draft.slug.trim() || slugify(draft.name);
    setSaving(true);
    try {
      if (isNew || !selectedId) {
        const created = await createExportTemplate({ ...draft, slug });
        toast.success("Plantilla creada");
        await reload();
        loadIntoDraft(created);
      } else {
        const updated = await updateExportTemplate(selectedId, { ...draft, slug });
        toast.success("Plantilla actualizada");
        await reload();
        loadIntoDraft(updated);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(template: ExportTemplateWithMeta) {
    try {
      await deleteExportTemplate(template.id);
      toast.success("Plantilla eliminada");
      if (selectedId === template.id) cancelEdit();
      await reload();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setConfirmDelete(null);
    }
  }

  function setColumn(index: number, patch: Partial<ExportTemplateColumn>) {
    setDraft((prev) => ({
      ...prev,
      columns: prev.columns.map((col, i) => (i === index ? { ...col, ...patch } : col)),
    }));
  }

  function addColumn(key: ExportColumnKey) {
    if (draft.columns.some((col) => col.key === key)) {
      toast.error("Esa columna ya está agregada");
      return;
    }
    setDraft((prev) => ({
      ...prev,
      columns: [...prev.columns, { key, label: COLUMN_DEFAULT_LABELS[key] }],
    }));
  }

  function removeColumn(index: number) {
    setDraft((prev) => ({ ...prev, columns: prev.columns.filter((_, i) => i !== index) }));
  }

  function moveColumn(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= draft.columns.length) return;
    setDraft((prev) => {
      const next = [...prev.columns];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return { ...prev, columns: next };
    });
  }

  function setFilter(key: keyof ExportTemplateFilters, value: boolean) {
    setDraft((prev) => ({
      ...prev,
      filters: { ...prev.filters, [key]: value || undefined },
    }));
  }

  const editing = isNew || selectedId !== null;
  const availableToAdd = AVAILABLE_COLUMN_KEYS.filter(
    (key) => !draft.columns.some((col) => col.key === key),
  );

  return (
    <div className="grid gap-4 md:grid-cols-[280px_1fr]">
      {/* List */}
      <aside className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Plantillas</h2>
          <Button size="sm" variant="outline" onClick={startNew} className="gap-1">
            <Plus size={13} /> Nueva
          </Button>
        </div>
        {loading ? (
          <p className="text-xs text-muted-foreground">Cargando…</p>
        ) : templates.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No hay plantillas. Creá la primera con el botón "Nueva".
          </p>
        ) : (
          <ul className="space-y-1">
            {templates.map((tpl) => (
              <li key={tpl.id}>
                <button
                  type="button"
                  onClick={() => loadIntoDraft(tpl)}
                  className={`w-full rounded-lg border p-2 text-left text-xs transition ${
                    selectedId === tpl.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{tpl.name}</span>
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">
                      {tpl.format}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="truncate">{tpl.slug}</span>
                    {!tpl.active && (
                      <span className="rounded bg-amber-500/20 px-1 py-0.5 text-amber-600">
                        inactiva
                      </span>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {/* Editor */}
      <section className="rounded-xl border border-border bg-card p-4">
        {!editing ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-center text-sm text-muted-foreground">
            <FileText size={28} className="text-muted-foreground/60" />
            <p>Seleccioná una plantilla o creá una nueva.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">
                {isNew ? "Nueva plantilla" : `Editando: ${draft.name || draft.slug}`}
              </h3>
              <div className="flex items-center gap-2">
                {!isNew && selectedId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const target = templates.find((t) => t.id === selectedId);
                      if (target) setConfirmDelete(target);
                    }}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 size={13} /> Eliminar
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={cancelEdit}>
                  <X size={13} /> Cerrar
                </Button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="tpl-name">Nombre</Label>
                <Input
                  id="tpl-name"
                  value={draft.name}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      name: e.target.value,
                      slug: !prev.slug || prev.slug === slugify(prev.name) ? slugify(e.target.value) : prev.slug,
                    }))
                  }
                  placeholder="Lista para Distribuidora X"
                />
              </div>
              <div>
                <Label htmlFor="tpl-slug">Slug</Label>
                <Input
                  id="tpl-slug"
                  value={draft.slug}
                  onChange={(e) => setDraft((prev) => ({ ...prev, slug: slugify(e.target.value) }))}
                  placeholder="lista_distribuidora_x"
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="tpl-desc">Descripción</Label>
                <Textarea
                  id="tpl-desc"
                  value={draft.description ?? ""}
                  onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  placeholder="Describe brevemente cuándo usar esta plantilla"
                />
              </div>
              <div>
                <Label htmlFor="tpl-format">Formato</Label>
                <select
                  id="tpl-format"
                  value={draft.format}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, format: e.target.value as ExportTemplateFormat }))
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="csv">CSV</option>
                  <option value="xlsx">Excel (XLSX)</option>
                </select>
              </div>
              <div>
                <Label htmlFor="tpl-pattern">Patrón de nombre</Label>
                <Input
                  id="tpl-pattern"
                  value={draft.filename_pattern}
                  onChange={(e) => setDraft((prev) => ({ ...prev, filename_pattern: e.target.value }))}
                  placeholder="lista_precios_{date}"
                />
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Placeholders: {"{date}"}, {"{client_name}"}
                </p>
              </div>
              <div className="flex items-center gap-2 pt-2 md:col-span-2">
                <Switch
                  id="tpl-active"
                  checked={draft.active ?? true}
                  onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, active: checked }))}
                />
                <Label htmlFor="tpl-active">Visible para clientes</Label>
              </div>
            </div>

            <div>
              <Label>Filtros</Label>
              <div className="mt-2 space-y-2 rounded-md border border-border p-3">
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={Boolean(draft.filters.drop_zero_stock)}
                    onChange={(e) => setFilter("drop_zero_stock", e.target.checked)}
                  />
                  Excluir productos con stock = 0
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={Boolean(draft.filters.drop_zero_price)}
                    onChange={(e) => setFilter("drop_zero_price", e.target.checked)}
                  />
                  Excluir productos con precio = 0
                </label>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label>Columnas ({draft.columns.length})</Label>
                <p className="text-[10px] text-muted-foreground">
                  Arrastrá con las flechas para reordenar
                </p>
              </div>
              <ul className="mt-2 space-y-1">
                {draft.columns.map((col, index) => (
                  <li
                    key={`${col.key}-${index}`}
                    className="flex items-center gap-2 rounded-md border border-border p-2"
                  >
                    <span className="w-32 truncate text-[11px] font-mono text-muted-foreground">
                      {col.key}
                    </span>
                    <Input
                      value={col.label}
                      onChange={(e) => setColumn(index, { label: e.target.value })}
                      className="flex-1 h-8 text-xs"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => moveColumn(index, -1)}
                      disabled={index === 0}
                      className="h-7 w-7"
                    >
                      <ArrowUp size={12} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => moveColumn(index, 1)}
                      disabled={index === draft.columns.length - 1}
                      className="h-7 w-7"
                    >
                      <ArrowDown size={12} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeColumn(index)}
                      className="h-7 w-7 text-destructive hover:text-destructive"
                    >
                      <Trash2 size={12} />
                    </Button>
                  </li>
                ))}
              </ul>
              {availableToAdd.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {availableToAdd.map((key) => (
                    <Button
                      key={key}
                      size="sm"
                      variant="outline"
                      onClick={() => addColumn(key)}
                      className="h-7 gap-1 text-xs"
                    >
                      <Plus size={11} /> {COLUMN_DEFAULT_LABELS[key]}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={cancelEdit} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving} className="gap-1">
                <Save size={13} /> {saving ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </div>
        )}
      </section>

      <AlertDialog open={confirmDelete !== null} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar plantilla?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La plantilla "{confirmDelete?.name}" dejará
              de estar disponible para los clientes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && void handleDelete(confirmDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
