import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  Image,
  Loader2,
  MessageCircle,
  Pencil,
  Plus,
  RefreshCcw,
  Trash2,
  X,
} from "lucide-react";
import type { Product } from "@/models/products";
import { useCurrency } from "@/context/CurrencyContext";
import type { PublicPosKitItem } from "@/lib/api/posProductsApi";
import {
  deleteAdminPublicPosKit,
  fetchAdminPublicPosKits,
  type AdminPublicPosKit,
  type AdminPublicPosKitInput,
  upsertAdminPublicPosKit,
} from "@/lib/api/publicPosKitsAdminApi";

interface Props {
  products: Product[];
  isDark?: boolean;
}

type KitForm = AdminPublicPosKitInput;

const EMPTY_ITEM: PublicPosKitItem = {
  sku: "",
  name: "",
  category: "Punto de Venta",
  quantity: 1,
};

const EMPTY_FORM: KitForm = {
  name: "",
  description: "",
  stock: 0,
  priceUsd: 0,
  image: null,
  badge: "",
  ctaLabel: "Comprar",
  whatsappMessage: "",
  barposIncluded: false,
  items: [{ ...EMPTY_ITEM }],
  active: true,
  sortOrder: 10,
};

function cloneForm(kit: AdminPublicPosKit): KitForm {
  return {
    id: kit.id,
    name: kit.name,
    description: kit.description,
    stock: kit.stock,
    priceUsd: kit.priceUsd,
    image: kit.image,
    badge: kit.badge,
    ctaLabel: kit.ctaLabel,
    whatsappMessage: kit.whatsappMessage,
    barposIncluded: kit.barposIncluded,
    items: kit.items.length > 0 ? kit.items : [{ ...EMPTY_ITEM }],
    active: kit.active,
    sortOrder: kit.sortOrder,
  };
}

function normalizeForm(form: KitForm): KitForm {
  return {
    ...form,
    name: form.name.trim(),
    description: form.description.trim(),
    stock: Math.max(0, Number(form.stock ?? 0)),
    priceUsd: Number(form.priceUsd ?? 0),
    image: form.image?.trim() || null,
    badge: form.badge?.trim() || null,
    ctaLabel: form.ctaLabel.trim() || "Comprar",
    whatsappMessage: form.whatsappMessage?.trim() || null,
    barposIncluded: form.barposIncluded,
    sortOrder: Number(form.sortOrder ?? 0),
    items: form.items
      .map((item) => ({
        sku: item.sku?.trim() || null,
        name: item.name.trim(),
        category: item.category.trim() || "Punto de Venta",
        quantity: Math.max(1, Number(item.quantity ?? 1)),
      }))
      .filter((item) => item.name.length > 0),
  };
}

function validateForm(form: KitForm): string | null {
  const clean = normalizeForm(form);
  if (!clean.name) return "El nombre del combo es obligatorio.";
  if (!Number.isFinite(clean.priceUsd) || clean.priceUsd <= 0) return "El precio USD debe ser mayor a cero.";
  if (clean.items.length === 0) return "Agrega al menos un item al combo.";
  return null;
}

function formatUsd(value: number): string {
  return `USD ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function PreviewCard({ form, formatARS }: { form: KitForm; formatARS: (value: number, from?: "USD" | "ARS") => string }) {
  const clean = normalizeForm(form);
  const priceUsd = Number.isFinite(clean.priceUsd) ? clean.priceUsd : 0;

  return (
    <div className="rounded-2xl border border-[#2D9F6A]/25 bg-white p-4 text-[#171717] shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        {clean.image ? (
          <img src={clean.image} alt="" className="h-16 w-16 rounded-xl border border-[#e5e5e5] object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-[#d8eee5] bg-[#f0faf5] text-[#2D9F6A]">
            <Image size={20} />
          </div>
        )}
        <div className="flex flex-col items-end gap-2">
          {clean.badge && (
            <span className="rounded-full border border-[#2D9F6A]/25 bg-[#2D9F6A]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-[#1a7a50]">
              {clean.badge}
            </span>
          )}
          <span className="rounded-full border border-[#2D9F6A]/25 bg-[#2D9F6A]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-[#1a7a50]">
            {clean.stock > 0 ? `${clean.stock} kits` : "Consultar stock"}
          </span>
        </div>
      </div>
      <h4 className="text-lg font-extrabold">{clean.name || "Nombre del combo"}</h4>
      <p className="mt-1 min-h-[38px] text-sm leading-relaxed text-[#667085]">
        {clean.description || "Descripcion comercial del combo publico."}
      </p>
      <div className="mt-4 space-y-2 rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-3">
        {clean.barposIncluded && (
          <div className="flex items-start gap-2 rounded-lg bg-[#2D9F6A]/10 px-2 py-1.5 text-xs text-[#1a7a50]">
            <Check size={13} className="mt-0.5 shrink-0" />
            <span className="font-semibold">Incluye BARpos configurado para operar</span>
          </div>
        )}
        {(clean.items.length > 0 ? clean.items : [{ ...EMPTY_ITEM, name: "Item del combo" }]).map((item, index) => (
          <div key={`${item.sku ?? item.name}-${index}`} className="flex items-start gap-2 text-xs">
            <Check size={13} className="mt-0.5 shrink-0 text-[#2D9F6A]" />
            <div className="min-w-0">
              <p className="truncate font-semibold">{item.name || "Item del combo"}</p>
              <p className="text-[10px] text-[#667085]">{item.sku || "SKU s/d"} - {item.category} x{item.quantity}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#667085]">Precio lista</p>
        <p className="mt-1 text-2xl font-extrabold text-[#2D9F6A]">{priceUsd > 0 ? formatARS(priceUsd, "USD") : "$ 0"}</p>
        <p className="text-xs font-semibold text-[#667085]">{formatUsd(priceUsd)} + IVA</p>
      </div>
      <button className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#2D9F6A] text-xs font-bold text-white">
        <MessageCircle size={14} />
        {clean.ctaLabel || "Comprar"}
      </button>
    </div>
  );
}

export function PosKitsTab({ isDark }: Props) {
  const dk = (d: string, l: string) => (isDark ? d : l);
  const { formatARS } = useCurrency();

  const [kits, setKits] = useState<AdminPublicPosKit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<KitForm>(EMPTY_FORM);

  const activeCount = useMemo(() => kits.filter((kit) => kit.active).length, [kits]);

  async function loadKits() {
    setLoading(true);
    setError(null);
    try {
      setKits(await fetchAdminPublicPosKits());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los combos publicos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadKits();
  }, []);

  function openCreate() {
    const maxOrder = kits.reduce((max, kit) => Math.max(max, kit.sortOrder), 0);
    setForm({ ...EMPTY_FORM, sortOrder: maxOrder + 10, items: [{ ...EMPTY_ITEM }] });
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(kit: AdminPublicPosKit) {
    setForm(cloneForm(kit));
    setEditingId(kit.id);
    setShowForm(true);
  }

  function duplicateKit(kit: AdminPublicPosKit) {
    setForm({
      ...cloneForm(kit),
      id: undefined,
      name: `${kit.name} copia`,
      sortOrder: kit.sortOrder + 1,
    });
    setEditingId(null);
    setShowForm(true);
  }

  function updateItem(index: number, patch: Partial<PublicPosKitItem>) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => (
        itemIndex === index ? { ...item, ...patch } : item
      )),
    }));
  }

  function addItem() {
    setForm((current) => ({ ...current, items: [...current.items, { ...EMPTY_ITEM }] }));
  }

  function removeItem(index: number) {
    setForm((current) => ({
      ...current,
      items: current.items.length === 1
        ? [{ ...EMPTY_ITEM }]
        : current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  async function saveKit() {
    const validation = validateForm(form);
    if (validation) {
      setError(validation);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const saved = await upsertAdminPublicPosKit(normalizeForm(form));
      setKits((current) => {
        const exists = current.some((kit) => kit.id === saved.id);
        const next = exists
          ? current.map((kit) => (kit.id === saved.id ? saved : kit))
          : [...current, saved];
        return next.sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "es-AR"));
      });
      setShowForm(false);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el combo.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteKit(id: string) {
    if (!window.confirm("Eliminar este combo publico?")) return;

    setError(null);
    try {
      await deleteAdminPublicPosKit(id);
      setKits((current) => current.filter((kit) => kit.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el combo.");
    }
  }

  async function toggleActive(kit: AdminPublicPosKit) {
    setError(null);
    try {
      const saved = await upsertAdminPublicPosKit({ ...cloneForm(kit), active: !kit.active });
      setKits((current) => current.map((item) => (item.id === saved.id ? saved : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar el estado.");
    }
  }

  const cardBase = `rounded-2xl border p-5 ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`;
  const inputCls = `w-full border rounded-lg px-3 py-2 text-sm outline-none transition ${dk(
    "bg-[#0d0d0d] border-[#262626] text-white focus:border-[#2D9F6A] placeholder:text-[#404040]",
    "bg-[#f9f9f9] border-[#d4d4d4] text-[#171717] focus:border-[#2D9F6A] placeholder:text-gray-400",
  )}`;
  const labelCls = `block text-xs font-semibold mb-1 ${dk("text-[#737373]", "text-[#525252]")}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={`text-xs ${dk("text-[#737373]", "text-[#737373]")}`}>
            {kits.length} combo{kits.length !== 1 ? "s" : ""} publico{kits.length !== 1 ? "s" : ""} configurado{kits.length !== 1 ? "s" : ""}
          </p>
          <p className="mt-0.5 text-[10px] text-gray-500">
            {activeCount} activo{activeCount !== 1 ? "s" : ""} visible{activeCount !== 1 ? "s" : ""} en /puntos-de-venta
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void loadKits()}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${dk("border-[#333] text-[#737373] hover:text-white", "border-[#d4d4d4] text-[#737373] hover:text-[#171717]")}`}
          >
            <RefreshCcw size={13} /> Actualizar
          </button>
          <button onClick={openCreate} className="flex items-center gap-1.5 rounded-lg bg-[#2D9F6A] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#25835A]">
            <Plus size={13} /> Nuevo combo
          </button>
        </div>
      </div>

      {error && (
        <div className={`rounded-xl border px-4 py-3 text-xs ${dk("border-red-500/30 bg-red-500/10 text-red-300", "border-red-200 bg-red-50 text-red-700")}`}>
          {error}
        </div>
      )}

      {loading ? (
        <div className={`flex items-center justify-center gap-2 rounded-xl border py-12 text-xs ${dk("border-[#1f1f1f] text-[#737373]", "border-[#e5e5e5] text-[#737373]")}`}>
          <Loader2 size={16} className="animate-spin" />
          Cargando combos publicos...
        </div>
      ) : kits.length === 0 ? (
        <div className={`flex flex-col items-center justify-center rounded-xl border py-16 ${dk("bg-[#0d0d0d] border-[#1f1f1f] text-[#525252]", "bg-[#f9f9f9] border-[#e5e5e5] text-[#a3a3a3]")}`}>
          <p className="text-sm font-semibold">Sin combos publicos</p>
          <p className="mt-1 text-xs">Crea las opciones que se muestran en /puntos-de-venta.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {kits.map((kit) => (
            <div key={kit.id} className={`${cardBase} space-y-4`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {kit.badge && (
                      <span className="rounded-full bg-[#2D9F6A]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#2D9F6A]">
                        {kit.badge}
                      </span>
                    )}
                    {kit.barposIncluded && (
                      <span className="rounded-full bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-bold text-violet-400">
                        BARpos incluido
                      </span>
                    )}
                    <h3 className={`truncate text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>{kit.name}</h3>
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${kit.active ? "bg-[#2D9F6A]/15 text-[#2D9F6A]" : dk("bg-[#222] text-[#525252]", "bg-[#f0f0f0] text-[#a3a3a3]")}`}>
                      {kit.active ? "Publicado" : "Oculto"}
                    </span>
                  </div>
                  <p className={`mt-1 line-clamp-2 text-xs ${dk("text-[#737373]", "text-[#737373]")}`}>{kit.description || "Sin descripcion"}</p>
                </div>
                <button
                  onClick={() => void toggleActive(kit)}
                  className={`shrink-0 rounded-lg border px-2 py-1 text-[10px] font-bold transition ${kit.active ? "border-[#2D9F6A]/30 text-[#2D9F6A]" : dk("border-[#333] text-[#737373]", "border-[#d4d4d4] text-[#737373]")}`}
                >
                  {kit.active ? "Activo" : "Inactivo"}
                </button>
              </div>

              {kit.image && (
                <img src={kit.image} alt="" className={`h-24 w-full rounded-xl border object-cover ${dk("border-[#1f1f1f]", "border-[#e5e5e5]")}`} />
              )}

              <div className={`rounded-xl border p-3 ${dk("border-[#1f1f1f] bg-[#0d0d0d]", "border-[#e5e5e5] bg-[#fafafa]")}`}>
                {kit.items.map((item, index) => (
                  <div key={`${kit.id}-${item.sku ?? item.name}-${index}`} className={`flex justify-between gap-3 py-1 text-xs ${dk("text-[#a3a3a3]", "text-[#525252]")}`}>
                    <span className="min-w-0 flex-1 truncate">{item.name}</span>
                    <span className="shrink-0 font-mono">x{item.quantity}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-gray-500">Precio publico</p>
                  <p className={`font-mono text-lg font-extrabold ${dk("text-white", "text-[#171717]")}`}>{formatUsd(kit.priceUsd)}</p>
                  <p className="text-[10px] text-gray-500">Stock visible: {kit.stock} kits</p>
                </div>
                <p className="text-[10px] text-gray-500">Orden {kit.sortOrder}</p>
              </div>

              <div className={`flex items-center gap-1 border-t pt-3 ${dk("border-[#1a1a1a]", "border-[#f0f0f0]")}`}>
                <button onClick={() => openEdit(kit)} className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-500 transition hover:text-[#2D9F6A]">
                  <Pencil size={12} /> Editar
                </button>
                <button onClick={() => duplicateKit(kit)} className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-500 transition hover:text-[#2D9F6A]">
                  <Copy size={12} /> Duplicar
                </button>
                <button onClick={() => void deleteKit(kit.id)} className="ml-auto flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-500 transition hover:text-red-400">
                  <Trash2 size={12} /> Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className={`max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border p-6 shadow-2xl ${dk("bg-[#0d0d0d] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
            <div className="mb-5 flex items-center justify-between">
              <h3 className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>
                {editingId ? "Editar combo publico" : "Nuevo combo publico"}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-gray-500 transition hover:text-gray-300">
                <X size={16} />
              </button>
            </div>

            <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
              <div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelCls}>Nombre *</label>
                    <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className={inputCls} placeholder="Comercio Esencial" />
                  </div>
                  <div>
                    <label className={labelCls}>Precio publico USD *</label>
                    <input type="number" min={0} step="0.01" value={form.priceUsd || ""} onChange={(event) => setForm((current) => ({ ...current, priceUsd: Number(event.target.value) }))} className={inputCls} placeholder="775" />
                  </div>
                  <div>
                    <label className={labelCls}>Stock visible</label>
                    <input type="number" min={0} value={form.stock} onChange={(event) => setForm((current) => ({ ...current, stock: Number(event.target.value) }))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Orden</label>
                    <input type="number" value={form.sortOrder} onChange={(event) => setForm((current) => ({ ...current, sortOrder: Number(event.target.value) }))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Badge comercial</label>
                    <input value={form.badge ?? ""} onChange={(event) => setForm((current) => ({ ...current, badge: event.target.value }))} className={inputCls} placeholder="Ideal kioscos" />
                  </div>
                  <div>
                    <label className={labelCls}>Texto del CTA</label>
                    <input value={form.ctaLabel} onChange={(event) => setForm((current) => ({ ...current, ctaLabel: event.target.value }))} className={inputCls} placeholder="Comprar" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>URL de imagen</label>
                    <input value={form.image ?? ""} onChange={(event) => setForm((current) => ({ ...current, image: event.target.value }))} className={inputCls} placeholder="https://..." />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Descripcion</label>
                    <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className={`${inputCls} min-h-[76px] resize-y`} placeholder="Terminal, impresora y lector..." />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Mensaje WhatsApp personalizado</label>
                    <textarea value={form.whatsappMessage ?? ""} onChange={(event) => setForm((current) => ({ ...current, whatsappMessage: event.target.value }))} className={`${inputCls} min-h-[70px] resize-y`} placeholder="Hola, quiero consultar el combo Comercio Esencial para mi kiosco." />
                  </div>
                  <div className="flex items-center gap-2 sm:col-span-2">
                    <input id="public-pos-kit-active" type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} className="accent-[#2D9F6A]" />
                    <label htmlFor="public-pos-kit-active" className={`text-xs font-semibold ${dk("text-[#a3a3a3]", "text-[#525252]")}`}>
                      Publicar en /puntos-de-venta
                    </label>
                  </div>
                  <div className="flex items-center gap-2 sm:col-span-2">
                    <input
                      id="public-pos-kit-barpos"
                      type="checkbox"
                      checked={form.barposIncluded}
                      onChange={(event) => setForm((current) => ({ ...current, barposIncluded: event.target.checked }))}
                      className="accent-[#2D9F6A]"
                    />
                    <label htmlFor="public-pos-kit-barpos" className={`text-xs font-semibold ${dk("text-[#a3a3a3]", "text-[#525252]")}`}>
                      Incluye BARpos en este kit
                    </label>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between">
                    <label className={labelCls}>Items del combo *</label>
                    <button onClick={addItem} className="flex items-center gap-1 rounded-lg border border-[#2D9F6A]/30 px-2 py-1 text-xs font-semibold text-[#2D9F6A]">
                      <Plus size={12} /> Agregar item
                    </button>
                  </div>

                  <div className="space-y-2">
                    {form.items.map((item, index) => (
                      <div key={index} className={`grid gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_1fr_110px_40px] ${dk("border-[#1f1f1f] bg-[#101010]", "border-[#e5e5e5] bg-[#fafafa]")}`}>
                        <input value={item.name} onChange={(event) => updateItem(index, { name: event.target.value })} className={inputCls} placeholder="Nombre del item" />
                        <input value={item.sku ?? ""} onChange={(event) => updateItem(index, { sku: event.target.value })} className={inputCls} placeholder="SKU visible" />
                        <input type="number" min={1} value={item.quantity} onChange={(event) => updateItem(index, { quantity: Number(event.target.value) })} className={inputCls} placeholder="Cant." />
                        <button onClick={() => removeItem(index)} className={`rounded-lg border text-gray-500 transition hover:text-red-400 ${dk("border-[#333]", "border-[#d4d4d4]")}`}>
                          <Trash2 size={13} className="mx-auto" />
                        </button>
                        <input value={item.category} onChange={(event) => updateItem(index, { category: event.target.value })} className={`${inputCls} sm:col-span-4`} placeholder="Categoria visible" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <aside>
                <p className={`mb-2 text-xs font-bold ${dk("text-[#a3a3a3]", "text-[#525252]")}`}>Preview publico</p>
                <PreviewCard form={form} formatARS={formatARS} />
              </aside>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className={`rounded-lg border px-4 py-2 text-xs transition ${dk("border-[#333] text-[#737373] hover:text-white", "border-[#d4d4d4] text-[#737373] hover:text-[#171717]")}`}>
                Cancelar
              </button>
              <button onClick={() => void saveKit()} disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-[#2D9F6A] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#25835A] disabled:opacity-50">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                Guardar combo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
