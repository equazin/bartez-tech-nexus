import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Product } from "@/models/products";
import { storageUrl, PRODUCTS_BUCKET } from "@/lib/constants";
import { X, Upload, Star, Tag, Loader2, RotateCcw } from "lucide-react";
import { isValidImageMime } from "@/lib/validateImageMime";

interface Category { id: number; name: string; parent_id: number | null; }
interface BrandOption { id: string; name: string; }
interface Props {
  product: Product & { featured?: boolean; tags?: string[]; active?: boolean };
  categories: Category[];
  brands?: BrandOption[];
  onSave: (updated: Product) => void;
  onClose: () => void;
}

export default function ProductEditModal({ product, categories, brands = [], onSave, onClose }: Props) {
  const [form, setForm] = useState({
    name:               product.name,
    name_custom:        (product as any).name_custom || "",
    sku:                product.sku || "",
    description:        product.description || "",
    cost_price:         String(product.cost_price),
    iva_rate:           String(product.iva_rate ?? 21),
    stock:              String(product.stock),
    category:           product.category || "",
    image:              product.image || "",
    featured:           product.featured ?? false,
    active:             (product as any).active !== false,
    tags:               (product.tags ?? []).join(", "),
    supplier_id:        String(product.supplier_id || ""),
    supplier_multiplier: String(product.supplier_multiplier || ""),
    brand_id:           (product as any).brand_id || "",
  });
  const [imageFile, setImageFile]   = useState<File | null>(null);
  const [imagePreview, setPreview]  = useState(product.image || "");
  const [dragging, setDragging]     = useState(false);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const rootCats = categories.filter((c) => c.parent_id === null);
  const subCats  = categories.filter((c) => c.parent_id !== null && rootCats.some((r) => r.name === form.category));

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function set(field: string, value: any) {
    setForm((p) => ({ ...p, [field]: value }));
  }

  async function handleImageFile(file: File) {
    if (!(await isValidImageMime(file))) return;
    setImageFile(file);
    setPreview(URL.createObjectURL(file));
  }

  async function uploadImage(file: File): Promise<string> {
    const ext  = file.name.split(".").pop();
    const path = `${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("products").upload(path, file, { upsert: true });
    if (error) throw error;
    return storageUrl(PRODUCTS_BUCKET, path);
  }

  async function handleSave() {
    setError("");
    if (!form.name.trim()) { setError("El nombre es obligatorio."); return; }
    const cost_price = Number(form.cost_price);
    if (isNaN(cost_price) || cost_price <= 0) { setError("Precio inválido."); return; }

    setSaving(true);
    let imageUrl = form.image;
    if (imageFile) {
      try { imageUrl = await uploadImage(imageFile); }
      catch (e: any) { setError("Error subiendo imagen: " + e.message); setSaving(false); return; }
    }

    const nameCustomVal = form.name_custom.trim() || null;
    const selectedBrand = brands.find((b) => b.id === form.brand_id);
    const payload = {
      name:               nameCustomVal ?? form.name.trim(),
      name_custom:        nameCustomVal,
      sku:                form.sku.trim() || null,
      description:        form.description,
      cost_price,
      iva_rate:           Number(form.iva_rate) || 21,
      stock:              Number(form.stock) || 0,
      category:           form.category || "General",
      image:              imageUrl || "/placeholder.png",
      featured:           form.featured,
      active:             form.active,
      tags:               form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      supplier_id:        form.supplier_id ? Number(form.supplier_id) : null,
      supplier_multiplier: form.supplier_multiplier ? Number(form.supplier_multiplier) : null,
      brand_id:           form.brand_id || null,
      brand_name:         selectedBrand?.name ?? null,
    };

    const { data, error: sbErr } = await supabase
      .from("products").update(payload).eq("id", product.id).select().single();

    setSaving(false);
    if (sbErr) { setError(sbErr.message); return; }
    onSave(data as Product);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}>
      <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a] shrink-0">
          <div>
            <h3 className="font-bold text-white text-base">Editar producto</h3>
            <p className="text-xs text-gray-500 mt-0.5">ID #{product.id} · {product.sku || "sin SKU"}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition"><X size={18} /></button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Image */}
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">Imagen</label>
            <div className="flex gap-4 items-start">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleImageFile(f); }}
                onClick={() => fileRef.current?.click()}
                className={`relative flex items-center justify-center rounded-xl border-2 border-dashed cursor-pointer transition h-28 w-28 shrink-0 ${
                  dragging ? "border-[#2D9F6A] bg-[#2D9F6A]/5" : "border-[#333] hover:border-[#2D9F6A]/50 bg-[#151515]"
                }`}>
                {imagePreview
                  ? <img src={imagePreview} className="h-full w-full object-contain rounded-xl p-1" />
                  : <Upload size={20} className="text-gray-600" />}
              </div>
              <div className="flex-1 space-y-2">
                <input ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { if (e.target.files?.[0]) handleImageFile(e.target.files[0]); }} />
                <input value={form.image} onChange={(e) => { set("image", e.target.value); setPreview(e.target.value); }}
                  placeholder="O pegá una URL de imagen"
                  className="w-full bg-[#232323] border border-[#333] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#2D9F6A]" />
                <p className="text-[11px] text-gray-600">Arrastrá una imagen o pegá URL · JPG, PNG, WEBP · máx 5MB</p>
              </div>
            </div>
          </div>

          {/* Name + SKU */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="text-xs text-gray-400 mb-1 block">Nombre *</label>
              <input value={form.name} onChange={(e) => set("name", e.target.value)}
                className="w-full bg-[#232323] border border-[#333] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#2D9F6A]" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">SKU</label>
              <input value={form.sku} onChange={(e) => set("sku", e.target.value)}
                className="w-full bg-[#232323] border border-[#333] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#2D9F6A] font-mono" />
            </div>
          </div>

          {/* Name custom override (solo productos importados) */}
          {(product as any).name_original && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-400 flex items-center gap-1.5">
                  Nombre personalizado
                  {form.name_custom && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400 border border-yellow-500/30">
                      modificado
                    </span>
                  )}
                </label>
                {form.name_custom && (
                  <button type="button"
                    onClick={() => set("name_custom", "")}
                    className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-red-400 transition">
                    <RotateCcw size={10} /> Resetear al original
                  </button>
                )}
              </div>
              <input
                value={form.name_custom}
                onChange={(e) => set("name_custom", e.target.value)}
                placeholder={(product as any).name_original}
                className="w-full bg-[#232323] border border-[#333] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-yellow-500/50 placeholder:text-gray-600"
              />
              <p className="text-[11px] text-gray-600 mt-1">
                Original: {(product as any).name_original}
              </p>
            </div>
          )}

          {/* Price + IVA + Stock + Category */}
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Precio costo *</label>
              <input type="number" min="0" value={form.cost_price} onChange={(e) => set("cost_price", e.target.value)}
                className="w-full bg-[#232323] border border-[#333] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#2D9F6A]" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">IVA</label>
              <div className="flex gap-1.5 h-[38px]">
                {(["10.5", "21"] as const).map((r) => (
                  <button key={r} type="button" onClick={() => set("iva_rate", r)}
                    className={`flex-1 rounded-lg text-xs font-bold border transition ${
                      form.iva_rate === r
                        ? "bg-[#2D9F6A] border-[#2D9F6A] text-white"
                        : "bg-[#232323] border-[#333] text-gray-400 hover:border-[#2D9F6A]/50"
                    }`}>
                    {r}%
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Stock</label>
              <input type="number" min="0" value={form.stock} onChange={(e) => set("stock", e.target.value)}
                className="w-full bg-[#232323] border border-[#333] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#2D9F6A]" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Categoría</label>
              <select value={form.category} onChange={(e) => set("category", e.target.value)}
                className="w-full bg-[#232323] border border-[#333] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#2D9F6A]">
                <option value="">— Sin categoría —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.parent_id !== null ? "  ↳ " : ""}{c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Brand */}
          {brands.length > 0 && (
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Marca</label>
              <select value={form.brand_id} onChange={(e) => set("brand_id", e.target.value)}
                className="w-full bg-[#232323] border border-[#333] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#2D9F6A]">
                <option value="">— Sin marca —</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Supplier */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">ID Proveedor</label>
              <input type="number" value={form.supplier_id} onChange={(e) => set("supplier_id", e.target.value)}
                placeholder="Opcional"
                className="w-full bg-[#232323] border border-[#333] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#2D9F6A]" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Multiplicador proveedor</label>
              <input type="number" step="0.01" value={form.supplier_multiplier} onChange={(e) => set("supplier_multiplier", e.target.value)}
                placeholder="Ej: 1.15"
                className="w-full bg-[#232323] border border-[#333] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#2D9F6A]" />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Descripción</label>
            <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3}
              className="w-full bg-[#232323] border border-[#333] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#2D9F6A] resize-none" />
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Tag size={11} /> Tags (separados por coma)</label>
            <input value={form.tags} onChange={(e) => set("tags", e.target.value)}
              placeholder="wifi, gigabit, rack, nuevo..."
              className="w-full bg-[#232323] border border-[#333] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#2D9F6A]" />
          </div>

          {/* Toggles */}
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <div onClick={() => set("featured", !form.featured)}
                className={`w-9 h-5 rounded-full transition ${form.featured ? "bg-yellow-500" : "bg-[#333]"} relative`}>
                <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${form.featured ? "left-4" : "left-0.5"}`} />
              </div>
              <span className="text-xs text-gray-400 flex items-center gap-1"><Star size={11} /> Destacado</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <div onClick={() => set("active", !form.active)}
                className={`w-9 h-5 rounded-full transition ${form.active ? "bg-green-500" : "bg-[#333]"} relative`}>
                <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${form.active ? "left-4" : "left-0.5"}`} />
              </div>
              <span className="text-xs text-gray-400">Activo</span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#2a2a2a] shrink-0 flex items-center justify-between gap-3">
          {error && <p className="text-red-400 text-xs flex-1">{error}</p>}
          <div className="flex gap-2 ml-auto">
            <button onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-[#2a2a2a] transition">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-[#2D9F6A] hover:bg-[#25835A] text-white text-sm font-bold rounded-lg transition disabled:opacity-50">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
