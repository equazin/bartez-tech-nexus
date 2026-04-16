import { useState, useEffect, useCallback } from "react";
import {
  Plus, Pencil, Trash2, ChevronRight, Layers, ArrowLeft,
  Check, X, GripVertical, Package, Loader2, Power,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import type { Product } from "@/models/products";
import type { Bundle, BundleSlot, BundleSlotOption } from "@/models/bundle";
import {
  fetchAllBundles, fetchBundleSlots, fetchSlotOptions,
  createBundle, updateBundle, deleteBundle,
  createSlot, updateSlot, deleteSlot,
  createSlotOption, updateSlotOption, deleteSlotOption,
} from "@/lib/api/bundleApi";
import { getBundleDefaultPrice } from "@/lib/bundlePricing";
import { fetchActiveBundles } from "@/lib/api/bundleApi";

// ── Types ────────────────────────────────────────────────────────────────────

type View = "list" | "edit_bundle" | "edit_slots" | "edit_options";

interface SlotWithOptions extends BundleSlot {
  options: (BundleSlotOption & { productName?: string })[];
}

interface Props {
  products: Product[];
  isDark?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BundlesAdminTab({ products, isDark = true }: Props) {
  const dk = (d: string, l: string) => (isDark ? d : l);

  const [view, setView] = useState<View>("list");
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);

  // bundle editor
  const [editingBundle, setEditingBundle] = useState<Bundle | null>(null);
  const [bundleForm, setBundleForm] = useState({
    title: "", description: "", discount_pct: 0, allows_customization: true, active: true,
  });
  const [saving, setSaving] = useState(false);

  // slot editor
  const [editingSlots, setEditingSlots] = useState<SlotWithOptions[]>([]);
  const [activeBundle, setActiveBundle] = useState<Bundle | null>(null);
  const [slotForm, setSlotForm] = useState({ label: "", required: true, client_configurable: false });
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);

  // option editor
  const [activeSlot, setActiveSlot] = useState<SlotWithOptions | null>(null);
  const [productSearch, setProductSearch] = useState("");

  const loadBundles = useCallback(async () => {
    setLoading(true);
    try {
      setBundles(await fetchAllBundles());
    } catch {
      toast.error("No se pudo cargar los bundles.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadBundles(); }, [loadBundles]);

  // ── Bundle CRUD ──────────────────────────────────────────────────────────

  function openCreateBundle() {
    setEditingBundle(null);
    setBundleForm({ title: "", description: "", discount_pct: 0, allows_customization: true, active: true });
    setView("edit_bundle");
  }

  function openEditBundle(bundle: Bundle) {
    setEditingBundle(bundle);
    setBundleForm({
      title: bundle.title,
      description: bundle.description ?? "",
      discount_pct: bundle.discount_pct,
      allows_customization: bundle.allows_customization,
      active: bundle.active,
    });
    setView("edit_bundle");
  }

  async function handleSaveBundle() {
    if (!bundleForm.title.trim()) { toast.error("El título es obligatorio."); return; }
    setSaving(true);
    try {
      const payload = {
        title: bundleForm.title.trim(),
        description: bundleForm.description.trim() || null,
        discount_pct: Number(bundleForm.discount_pct),
        allows_customization: bundleForm.allows_customization,
        active: bundleForm.active,
      };
      if (editingBundle) {
        await updateBundle(editingBundle.id, payload);
        toast.success("Bundle actualizado.");
      } else {
        await createBundle(payload);
        toast.success("Bundle creado.");
      }
      await loadBundles();
      setView("list");
    } catch {
      toast.error("No se pudo guardar el bundle.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(bundle: Bundle) {
    try {
      await updateBundle(bundle.id, { active: !bundle.active });
      await loadBundles();
    } catch {
      toast.error("No se pudo cambiar el estado.");
    }
  }

  async function handleDeleteBundle(bundle: Bundle) {
    if (!confirm(`¿Eliminar el bundle "${bundle.title}"? Esta acción es irreversible.`)) return;
    try {
      await deleteBundle(bundle.id);
      toast.success("Bundle eliminado.");
      await loadBundles();
    } catch {
      toast.error("No se pudo eliminar el bundle.");
    }
  }

  // ── Slot management ─────────────────────────────────────────────────────

  async function openSlotsEditor(bundle: Bundle) {
    setActiveBundle(bundle);
    setEditingSlotId(null);
    setSlotForm({ label: "", required: true, client_configurable: false });
    try {
      const slots = await fetchBundleSlots(bundle.id);
      const withOpts = await Promise.all(
        slots.map(async (s) => {
          const opts = await fetchSlotOptions(s.id);
          return {
            ...s,
            options: opts.map((o) => ({
              ...o,
              productName: products.find((p) => p.id === o.product_id)?.name,
            })),
          };
        })
      );
      setEditingSlots(withOpts);
    } catch {
      toast.error("No se pudo cargar los slots.");
    }
    setView("edit_slots");
  }

  async function handleAddSlot() {
    if (!slotForm.label.trim() || !activeBundle) return;
    try {
      const created = await createSlot({
        bundle_id: activeBundle.id,
        label: slotForm.label.trim(),
        category_id: null,
        required: slotForm.required,
        client_configurable: slotForm.client_configurable,
        sort_order: editingSlots.length,
      });
      setEditingSlots((prev) => [...prev, { ...created, options: [] }]);
      setSlotForm({ label: "", required: true, client_configurable: false });
      toast.success("Slot agregado.");
    } catch {
      toast.error("No se pudo agregar el slot.");
    }
  }

  async function handleDeleteSlot(slotId: string) {
    if (!confirm("¿Eliminar este slot y todas sus opciones?")) return;
    try {
      await deleteSlot(slotId);
      setEditingSlots((prev) => prev.filter((s) => s.id !== slotId));
      toast.success("Slot eliminado.");
    } catch {
      toast.error("No se pudo eliminar el slot.");
    }
  }

  async function handleToggleSlotField(
    slotId: string,
    field: "required" | "client_configurable",
    value: boolean
  ) {
    await updateSlot(slotId, { [field]: value });
    setEditingSlots((prev) =>
      prev.map((s) => (s.id === slotId ? { ...s, [field]: value } : s))
    );
  }

  // ── Option management ────────────────────────────────────────────────────

  function openOptionsEditor(slot: SlotWithOptions) {
    setActiveSlot(slot);
    setProductSearch("");
    setView("edit_options");
  }

  async function handleAddOption(productId: number) {
    if (!activeSlot) return;
    if (activeSlot.options.some((o) => o.product_id === productId)) {
      toast.error("Ese producto ya está en este slot.");
      return;
    }
    try {
      const isFirst = activeSlot.options.length === 0;
      const created = await createSlotOption({
        slot_id: activeSlot.id,
        product_id: productId,
        is_default: isFirst,
        sort_order: activeSlot.options.length,
      });
      const product = products.find((p) => p.id === productId);
      const newOpt = { ...created, productName: product?.name };
      setActiveSlot((prev) => prev ? { ...prev, options: [...prev.options, newOpt] } : prev);
      setEditingSlots((prev) =>
        prev.map((s) => s.id === activeSlot.id ? { ...s, options: [...s.options, newOpt] } : s)
      );
      toast.success("Opción agregada.");
    } catch {
      toast.error("No se pudo agregar la opción.");
    }
  }

  async function handleSetDefault(optId: string, productId: number) {
    if (!activeSlot) return;
    try {
      // Clear all defaults then set the new one
      await Promise.all(activeSlot.options.map((o) => updateSlotOption(o.id, { is_default: false })));
      await updateSlotOption(optId, { is_default: true });
      setActiveSlot((prev) =>
        prev ? {
          ...prev,
          options: prev.options.map((o) => ({ ...o, is_default: o.id === optId })),
        } : prev
      );
      toast.success("Opción default actualizada.");
    } catch {
      toast.error("No se pudo actualizar el default.");
    }
  }

  async function handleDeleteOption(optId: string) {
    if (!activeSlot) return;
    try {
      await deleteSlotOption(optId);
      setActiveSlot((prev) =>
        prev ? { ...prev, options: prev.options.filter((o) => o.id !== optId) } : prev
      );
      setEditingSlots((prev) =>
        prev.map((s) =>
          s.id === activeSlot.id
            ? { ...s, options: s.options.filter((o) => o.id !== optId) }
            : s
        )
      );
      toast.success("Opción eliminada.");
    } catch {
      toast.error("No se pudo eliminar la opción.");
    }
  }

  const filteredProducts = products.filter((p) => {
    if (!productSearch.trim()) return true;
    const q = productSearch.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q);
  }).slice(0, 30);

  // ── Render ────────────────────────────────────────────────────────────────

  const inputCls = `text-sm rounded-lg border ${dk("bg-[#1a1a1a] border-[#2a2a2a] text-white", "bg-white border-gray-200 text-gray-900")}`;
  const cardCls = `rounded-xl border p-4 ${dk("bg-[#141414] border-[#222]", "bg-white border-gray-200")}`;

  // ── View: List ──────────────────────────────────────────────────────────

  if (view === "list") {
    return (
      <div className="space-y-4 max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className={`text-lg font-semibold ${dk("text-white", "text-gray-900")}`}>
              Bundles / Kits
            </h2>
            <p className={`text-xs mt-0.5 ${dk("text-gray-400", "text-gray-500")}`}>
              Conjuntos de productos prearmados con descuento configurable.
            </p>
          </div>
          <Button onClick={openCreateBundle} size="sm" className="gap-1.5">
            <Plus size={14} /> Nuevo bundle
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-muted-foreground" size={24} />
          </div>
        ) : bundles.length === 0 ? (
          <div className={`${cardCls} text-center py-10`}>
            <Layers size={32} className="mx-auto mb-2 text-muted-foreground opacity-40" />
            <p className={`text-sm ${dk("text-gray-400", "text-gray-500")}`}>
              No hay bundles creados.
            </p>
            <Button onClick={openCreateBundle} size="sm" variant="outline" className="mt-4 gap-1.5">
              <Plus size={13} /> Crear primer bundle
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {bundles.map((bundle) => (
              <div key={bundle.id} className={`${cardCls} flex items-center gap-3`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium text-sm truncate ${dk("text-white", "text-gray-900")}`}>
                      {bundle.title}
                    </span>
                    {!bundle.active && (
                      <Badge variant="secondary" className="text-[10px] py-0">Inactivo</Badge>
                    )}
                    {bundle.discount_pct > 0 && (
                      <Badge variant="outline" className="text-[10px] py-0 text-green-500 border-green-500/40">
                        -{bundle.discount_pct}%
                      </Badge>
                    )}
                  </div>
                  {bundle.description && (
                    <p className={`text-xs truncate mt-0.5 ${dk("text-gray-400", "text-gray-500")}`}>
                      {bundle.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="sm" variant="ghost"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => openSlotsEditor(bundle)}
                  >
                    <Layers size={13} /> Slots
                    <ChevronRight size={12} className="opacity-40" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditBundle(bundle)}>
                    <Pencil size={13} />
                  </Button>
                  <Button
                    size="icon" variant="ghost" className="h-8 w-8"
                    onClick={() => handleToggleActive(bundle)}
                    title={bundle.active ? "Desactivar" : "Activar"}
                  >
                    <Power size={13} className={bundle.active ? "text-green-500" : "text-muted-foreground"} />
                  </Button>
                  <Button
                    size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-400"
                    onClick={() => handleDeleteBundle(bundle)}
                  >
                    <Trash2 size={13} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── View: Edit Bundle ───────────────────────────────────────────────────

  if (view === "edit_bundle") {
    return (
      <div className="space-y-5 max-w-xl">
        <button
          onClick={() => setView("list")}
          className={`flex items-center gap-1.5 text-xs ${dk("text-gray-400 hover:text-white", "text-gray-500 hover:text-gray-900")}`}
        >
          <ArrowLeft size={13} /> Volver a la lista
        </button>
        <h2 className={`text-lg font-semibold ${dk("text-white", "text-gray-900")}`}>
          {editingBundle ? "Editar bundle" : "Nuevo bundle"}
        </h2>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Título *</Label>
            <Input
              className={inputCls}
              value={bundleForm.title}
              onChange={(e) => setBundleForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="PC Gamer Entrada, Kit Oficina Pro..."
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Descripción</Label>
            <Textarea
              className={inputCls}
              value={bundleForm.description}
              onChange={(e) => setBundleForm((p) => ({ ...p, description: e.target.value }))}
              rows={2}
              placeholder="Descripción visible para el cliente..."
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Descuento (%)</Label>
            <Input
              className={inputCls}
              type="number"
              min={0} max={100} step={0.5}
              value={bundleForm.discount_pct}
              onChange={(e) => setBundleForm((p) => ({ ...p, discount_pct: Number(e.target.value) }))}
            />
          </div>
          <div className="flex items-center gap-4 pt-1">
            <div className="flex items-center gap-2">
              <Switch
                checked={bundleForm.allows_customization}
                onCheckedChange={(v) => setBundleForm((p) => ({ ...p, allows_customization: v }))}
              />
              <Label className="text-xs cursor-pointer">Permite personalización</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={bundleForm.active}
                onCheckedChange={(v) => setBundleForm((p) => ({ ...p, active: v }))}
              />
              <Label className="text-xs cursor-pointer">Activo</Label>
            </div>
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <Button onClick={handleSaveBundle} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Guardar
          </Button>
          <Button variant="ghost" onClick={() => setView("list")}>Cancelar</Button>
        </div>
      </div>
    );
  }

  // ── View: Edit Slots ────────────────────────────────────────────────────

  if (view === "edit_slots" && activeBundle) {
    return (
      <div className="space-y-4 max-w-3xl">
        <button
          onClick={() => setView("list")}
          className={`flex items-center gap-1.5 text-xs ${dk("text-gray-400 hover:text-white", "text-gray-500 hover:text-gray-900")}`}
        >
          <ArrowLeft size={13} /> Volver a la lista
        </button>
        <div>
          <h2 className={`text-lg font-semibold ${dk("text-white", "text-gray-900")}`}>
            Slots — {activeBundle.title}
          </h2>
          <p className={`text-xs mt-0.5 ${dk("text-gray-400", "text-gray-500")}`}>
            Definí los componentes del kit. Cada slot puede tener múltiples opciones.
          </p>
        </div>

        {/* Slot list */}
        {editingSlots.length === 0 ? (
          <p className={`text-sm ${dk("text-gray-400", "text-gray-500")}`}>No hay slots aún.</p>
        ) : (
          <div className="space-y-2">
            {editingSlots.map((slot) => (
              <div key={slot.id} className={`${cardCls} flex items-center gap-3`}>
                <GripVertical size={14} className="text-muted-foreground opacity-30 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className={`text-sm font-medium ${dk("text-white", "text-gray-900")}`}>
                    {slot.label}
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] ${dk("text-gray-400", "text-gray-500")}`}>
                      {slot.options.length} opción{slot.options.length !== 1 ? "es" : ""}
                    </span>
                    {slot.required && <Badge variant="outline" className="text-[10px] py-0">Requerido</Badge>}
                    {slot.client_configurable && <Badge variant="outline" className="text-[10px] py-0 text-blue-400 border-blue-400/40">Configurable</Badge>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <div className="flex items-center gap-1.5 mr-2">
                    <Switch
                      checked={slot.required}
                      onCheckedChange={(v) => handleToggleSlotField(slot.id, "required", v)}
                    />
                    <span className="text-[10px] text-muted-foreground">Req.</span>
                    <Switch
                      checked={slot.client_configurable}
                      onCheckedChange={(v) => handleToggleSlotField(slot.id, "client_configurable", v)}
                    />
                    <span className="text-[10px] text-muted-foreground">Config.</span>
                  </div>
                  <Button
                    size="sm" variant="ghost" className="h-8 gap-1 text-xs"
                    onClick={() => openOptionsEditor(slot)}
                  >
                    <Package size={12} /> Opciones
                    <ChevronRight size={11} className="opacity-40" />
                  </Button>
                  <Button
                    size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-400"
                    onClick={() => handleDeleteSlot(slot.id)}
                  >
                    <Trash2 size={13} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add slot form */}
        <div className={`${cardCls} space-y-3`}>
          <p className={`text-xs font-semibold ${dk("text-gray-300", "text-gray-700")}`}>Agregar slot</p>
          <div className="flex gap-2">
            <Input
              className={`${inputCls} flex-1`}
              placeholder="Ej: Procesador, RAM, Almacenamiento..."
              value={slotForm.label}
              onChange={(e) => setSlotForm((p) => ({ ...p, label: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddSlot(); }}
            />
            <Button onClick={handleAddSlot} size="sm" className="gap-1.5 shrink-0">
              <Plus size={13} /> Agregar
            </Button>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                checked={slotForm.required}
                onCheckedChange={(v) => setSlotForm((p) => ({ ...p, required: v }))}
              />
              <Label className="text-xs cursor-pointer">Requerido</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={slotForm.client_configurable}
                onCheckedChange={(v) => setSlotForm((p) => ({ ...p, client_configurable: v }))}
              />
              <Label className="text-xs cursor-pointer">Configurable por cliente</Label>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── View: Edit Options ──────────────────────────────────────────────────

  if (view === "edit_options" && activeSlot && activeBundle) {
    return (
      <div className="space-y-4 max-w-3xl">
        <button
          onClick={() => setView("edit_slots")}
          className={`flex items-center gap-1.5 text-xs ${dk("text-gray-400 hover:text-white", "text-gray-500 hover:text-gray-900")}`}
        >
          <ArrowLeft size={13} /> Volver a slots de {activeBundle.title}
        </button>
        <div>
          <h2 className={`text-lg font-semibold ${dk("text-white", "text-gray-900")}`}>
            Opciones — {activeSlot.label}
          </h2>
          <p className={`text-xs mt-0.5 ${dk("text-gray-400", "text-gray-500")}`}>
            Definí qué productos del catálogo están disponibles en este slot.
          </p>
        </div>

        {/* Current options */}
        {activeSlot.options.length > 0 && (
          <div className="space-y-1.5">
            <p className={`text-xs font-semibold ${dk("text-gray-400", "text-gray-600")}`}>
              Opciones actuales
            </p>
            {activeSlot.options.map((opt) => {
              const product = products.find((p) => p.id === opt.product_id);
              return (
                <div key={opt.id} className={`${cardCls} flex items-center gap-3 py-2.5`}>
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm ${dk("text-white", "text-gray-900")}`}>
                      {product?.name ?? opt.productName ?? `Producto #${opt.product_id}`}
                    </span>
                    {product?.sku && (
                      <span className={`ml-2 text-[10px] ${dk("text-gray-400", "text-gray-500")}`}>
                        SKU: {product.sku}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {opt.is_default && (
                      <Badge className="text-[10px] py-0 bg-green-500/10 text-green-500 border-green-500/30">
                        Default
                      </Badge>
                    )}
                    {!opt.is_default && (
                      <Button
                        size="sm" variant="ghost" className="h-7 text-xs"
                        onClick={() => handleSetDefault(opt.id, opt.product_id)}
                      >
                        <Check size={11} className="mr-1" /> Hacer default
                      </Button>
                    )}
                    <Button
                      size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-400"
                      onClick={() => handleDeleteOption(opt.id)}
                    >
                      <X size={12} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Product search to add */}
        <div className={`${cardCls} space-y-3`}>
          <p className={`text-xs font-semibold ${dk("text-gray-300", "text-gray-700")}`}>
            Buscar producto para agregar
          </p>
          <Input
            className={inputCls}
            placeholder="Nombre o SKU..."
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
          />
          {productSearch.trim() && (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {filteredProducts.length === 0 ? (
                <p className={`text-xs text-center py-4 ${dk("text-gray-400", "text-gray-500")}`}>
                  Sin resultados.
                </p>
              ) : (
                filteredProducts.map((p) => {
                  const alreadyAdded = activeSlot.options.some((o) => o.product_id === p.id);
                  return (
                    <button
                      key={p.id}
                      disabled={alreadyAdded}
                      onClick={() => handleAddOption(p.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs transition
                        ${alreadyAdded
                          ? dk("text-gray-600 cursor-not-allowed", "text-gray-300 cursor-not-allowed")
                          : dk("hover:bg-[#1f1f1f] text-gray-200", "hover:bg-gray-50 text-gray-800")
                        }`}
                    >
                      <span className="truncate">{p.name}</span>
                      <span className="ml-2 shrink-0 opacity-50">{p.sku}</span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
