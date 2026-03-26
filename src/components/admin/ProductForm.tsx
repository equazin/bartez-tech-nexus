import { useState, useEffect, useRef, KeyboardEvent } from "react";
import { Product } from "@/models/products";
import { supabase } from "@/lib/supabase";
import {
  Upload, X, Plus, ChevronDown, ChevronUp,
  Star, Eye, EyeOff, AlertTriangle, Loader2,
  Tag, Cpu, Package, BarChart2, DollarSign,
} from "lucide-react";

const SUPABASE_URL = "https://mfetwdftkiqydbwiqyfi.supabase.co";
const DRAFT_KEY = "bartez_product_draft";

interface Category { id: number; name: string; parent_id: number | null; }
interface Spec { key: string; value: string; }

const INPUT =
  "w-full bg-[#141414] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#2D9F6A] transition placeholder:text-gray-600";
const LABEL = "block text-xs font-medium text-gray-400 mb-1";
const SECTION = "bg-[#1a1a1a] border border-[#242424] rounded-xl p-4 space-y-3";
const SECTION_TITLE = "flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3";

function Toggle({ value, onChange, label, activeColor = "bg-green-500" }: {
  value: boolean; onChange: (v: boolean) => void;
  label: string; activeColor?: string;
}) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none">
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative w-10 h-5 rounded-full transition-colors ${value ? activeColor : "bg-[#333]"}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${value ? "left-5" : "left-0.5"}`} />
      </button>
      <span className="text-sm text-gray-300">{label}</span>
    </label>
  );
}

function loadDraft() {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); }
  catch { return null; }
}

export default function ProductForm({ onAdd }: { onAdd: (product: Product) => void }) {
  const saved = loadDraft();

  /* ── form state (restored from draft if available) ────── */
  const [name, setName]                     = useState(saved?.name ?? "");
  const [sku, setSku]                       = useState(saved?.sku ?? "");
  const [description, setDescription]      = useState(saved?.description ?? "");
  const [costPrice, setCostPrice]          = useState(saved?.costPrice ?? "");
  const [supplierId, setSupplierId]        = useState(saved?.supplierId ?? "");
  const [supplierMult, setSupplierMult]    = useState(saved?.supplierMult ?? "1");
  const [categoryId, setCategoryId]        = useState(saved?.categoryId ?? "");
  const [subcategoryId, setSubcategoryId] = useState(saved?.subcategoryId ?? "");
  const [newCatName, setNewCatName]        = useState("");
  const [addingCat, setAddingCat]          = useState(false);
  const [stock, setStock]                  = useState(saved?.stock ?? "");
  const [stockMin, setStockMin]            = useState(saved?.stockMin ?? "0");
  const [active, setActive]                = useState(saved?.active ?? true);
  const [featured, setFeatured]            = useState(saved?.featured ?? false);
  const [specs, setSpecs]                  = useState<Spec[]>(saved?.specs ?? []);
  const [tags, setTags]                    = useState<string[]>(saved?.tags ?? []);
  const [tagInput, setTagInput]            = useState("");
  const [imageFile, setImageFile]          = useState<File | null>(null);
  const [imagePreview, setImagePreview]    = useState("");
  const [hasDraft]                         = useState(() => !!saved && Object.values(saved).some(Boolean));

  /* ── ui state ─────────────────────────────────────────── */
  const [categories, setCategories] = useState<Category[]>([]);
  const [dragging, setDragging]     = useState(false);
  const [errors, setErrors]         = useState<Record<string, string>>({});
  const [saving, setSaving]         = useState(false);
  const [success, setSuccess]       = useState(false);
  const [skuChecking, setSkuChecking] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const skuTimer = useRef<ReturnType<typeof setTimeout>>();

  /* ── derived ──────────────────────────────────────────── */
  const rootCats = categories.filter((c) => c.parent_id === null);
  const subCats  = categories.filter((c) => c.parent_id === Number(categoryId));
  const adjustedCost = costPrice && supplierMult
    ? (Number(costPrice) * Number(supplierMult)).toFixed(2)
    : null;
  const stockLow = stock !== "" && stockMin !== "" && Number(stock) < Number(stockMin);

  /* ── load categories ──────────────────────────────────── */
  useEffect(() => {
    supabase.from("categories").select("*")
      .order("parent_id", { nullsFirst: true }).order("name")
      .then(({ data }) => { if (data) setCategories(data as Category[]); });
  }, []);

  /* ── persist draft to localStorage on every change ───── */
  useEffect(() => {
    const draft = { name, sku, description, costPrice, supplierId, supplierMult,
      categoryId, subcategoryId, stock, stockMin, active, featured, specs, tags };
    // Only save if there's something meaningful
    if (Object.values(draft).some((v) => v !== "" && v !== "0" && v !== "1" && v !== true && !(Array.isArray(v) && v.length === 0))) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    }
  }, [name, sku, description, costPrice, supplierId, supplierMult,
      categoryId, subcategoryId, stock, stockMin, active, featured, specs, tags]);

  /* ── sku uniqueness debounce ──────────────────────────── */
  useEffect(() => {
    if (!sku.trim()) return;
    clearTimeout(skuTimer.current);
    setSkuChecking(true);
    skuTimer.current = setTimeout(async () => {
      const { count } = await supabase
        .from("products").select("id", { count: "exact", head: true })
        .eq("sku", sku.trim());
      setSkuChecking(false);
      setErrors((p) => ({
        ...p,
        sku: count && count > 0 ? "SKU ya existe" : "",
      }));
    }, 500);
    return () => clearTimeout(skuTimer.current);
  }, [sku]);

  /* ── image helpers ────────────────────────────────────── */
  function handleImageFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) {
      setErrors((p) => ({ ...p, image: "Imagen debe ser menor a 5MB" }));
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setErrors((p) => ({ ...p, image: "" }));
  }

  async function uploadImage(file: File): Promise<string> {
    const ext  = file.name.split(".").pop();
    const path = `${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("products").upload(path, file, { upsert: true });
    if (error) throw error;
    return `${SUPABASE_URL}/storage/v1/object/public/products/${path}`;
  }

  /* ── specs ────────────────────────────────────────────── */
  function addSpec() { setSpecs((p) => [...p, { key: "", value: "" }]); }
  function setSpecField(i: number, field: keyof Spec, val: string) {
    setSpecs((p) => p.map((s, idx) => idx === i ? { ...s, [field]: val } : s));
  }
  function removeSpec(i: number) { setSpecs((p) => p.filter((_, idx) => idx !== i)); }

  /* ── tags ─────────────────────────────────────────────── */
  function addTag(raw: string) {
    const t = raw.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags((p) => [...p, t]);
    setTagInput("");
  }
  function handleTagKey(e: KeyboardEvent<HTMLInputElement>) {
    if (["Enter", ",", "Tab"].includes(e.key)) {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === "Backspace" && !tagInput) {
      setTags((p) => p.slice(0, -1));
    }
  }

  /* ── add category inline ──────────────────────────────── */
  async function handleAddCategory() {
    const n = newCatName.trim();
    if (!n) return;
    const { data, error } = await supabase
      .from("categories").insert([{ name: n, parent_id: null }]).select().single();
    if (!error && data) {
      setCategories((p) => [...p, data as Category]);
      setCategoryId(String(data.id));
    }
    setNewCatName("");
    setAddingCat(false);
  }

  /* ── validation ───────────────────────────────────────── */
  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!name.trim())                             e.name = "Nombre requerido";
    if (!sku.trim())                              e.sku  = "SKU requerido";
    if (errors.sku)                               e.sku  = errors.sku;
    const cp = Number(costPrice);
    if (!costPrice || isNaN(cp) || cp <= 0)       e.cost_price = "Precio debe ser > 0";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  /* ── submit ───────────────────────────────────────────── */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    let imageUrl = "/placeholder.png";
    if (imageFile) {
      try { imageUrl = await uploadImage(imageFile); }
      catch (err: any) { setErrors((p) => ({ ...p, image: "Error subiendo imagen: " + err.message })); setSaving(false); return; }
    }

    const selectedCat = categories.find((c) => c.id === Number(categoryId));
    const selectedSub = categories.find((c) => c.id === Number(subcategoryId));
    const categoryName = selectedSub?.name ?? selectedCat?.name ?? "General";

    const specsObj = specs.reduce<Record<string, string>>((acc, s) => {
      if (s.key.trim()) acc[s.key.trim()] = s.value;
      return acc;
    }, {});

    const payload = {
      name:                name.trim(),
      sku:                 sku.trim(),
      description,
      image:               imageUrl,
      cost_price:          Number(costPrice),
      supplier_id:         supplierId ? Number(supplierId) : null,
      supplier_multiplier: supplierMult ? Number(supplierMult) : 1,
      category:            categoryName,
      stock:               Number(stock) || 0,
      stock_min:           Number(stockMin) || 0,
      active,
      featured,
      specs:               specsObj,
      tags,
    };

    const { data, error: sbError } = await supabase
      .from("products").insert([payload]).select().single();

    setSaving(false);
    if (sbError) { setErrors({ _: sbError.message }); return; }

    onAdd(data as Product);
    resetForm();
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  }

  function resetForm() {
    localStorage.removeItem(DRAFT_KEY);
    setName(""); setSku(""); setDescription(""); setCostPrice("");
    setSupplierId(""); setSupplierMult("1"); setCategoryId(""); setSubcategoryId("");
    setStock(""); setStockMin("0"); setActive(true); setFeatured(false);
    setSpecs([]); setTags([]); setTagInput(""); setImageFile(null); setImagePreview("");
    setErrors({});
  }

  /* ── render ───────────────────────────────────────────── */
  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-white">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-base">Nuevo producto</h3>
          {hasDraft && (
            <span className="text-[10px] text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full font-medium">
              Borrador restaurado
            </span>
          )}
        </div>
        {success && (
          <span className="text-xs text-green-400 bg-green-400/10 border border-green-400/20 px-3 py-1 rounded-full">
            Producto guardado
          </span>
        )}
      </div>

      {/* ── A. Imagen ── */}
      <div className={SECTION}>
        <p className={SECTION_TITLE}><Upload size={12} /> Imagen</p>
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleImageFile(f); }}
          className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed cursor-pointer transition h-40 ${
            dragging ? "border-[#2D9F6A] bg-[#2D9F6A]/5" : "border-[#2a2a2a] hover:border-[#2D9F6A]/40 bg-[#141414]"
          }`}
        >
          {imagePreview ? (
            <>
              <img src={imagePreview} className="h-full w-full object-contain rounded-xl p-2" />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setImageFile(null); setImagePreview(""); }}
                className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 text-white rounded-full p-1 transition"
              >
                <X size={12} />
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 text-gray-600">
              <Upload size={28} />
              <span className="text-xs text-center">Arrastrá una imagen o hacé click<br />JPG, PNG, WEBP · máx. 5 MB</span>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { if (e.target.files?.[0]) handleImageFile(e.target.files[0]); }} />
        {errors.image && <p className="text-red-400 text-xs">{errors.image}</p>}
      </div>

      {/* ── B. Datos principales ── */}
      <div className={SECTION}>
        <p className={SECTION_TITLE}><Package size={12} /> Datos principales</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Nombre *</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="ej. Switch PoE 24 Puertos"
              className={`${INPUT} ${errors.name ? "border-red-500" : ""}`} />
            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
          </div>
          <div>
            <label className={LABEL}>SKU *</label>
            <div className="relative">
              <input value={sku} onChange={(e) => setSku(e.target.value.toUpperCase())}
                placeholder="ej. NET-SW24-POE"
                className={`${INPUT} font-mono pr-8 ${errors.sku ? "border-red-500" : ""}`} />
              {skuChecking && <Loader2 size={12} className="absolute right-2 top-2.5 animate-spin text-gray-500" />}
            </div>
            {errors.sku && <p className="text-red-400 text-xs mt-1">{errors.sku}</p>}
          </div>
        </div>
        <div>
          <label className={LABEL}>Descripción</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
            placeholder="Características principales del producto..."
            className={`${INPUT} resize-none`} />
        </div>
      </div>

      {/* ── C. Costo y Proveedor ── */}
      <div className={SECTION}>
        <p className={SECTION_TITLE}><DollarSign size={12} /> Costo y proveedor</p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={LABEL}>Costo base (ARS) *</label>
            <input type="number" min="0" step="0.01" value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
              placeholder="0.00"
              className={`${INPUT} ${errors.cost_price ? "border-red-500" : ""}`} />
            {errors.cost_price && <p className="text-red-400 text-xs mt-1">{errors.cost_price}</p>}
          </div>
          <div>
            <label className={LABEL}>ID Proveedor</label>
            <input type="number" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}
              placeholder="Opcional"
              className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Multiplicador</label>
            <input type="number" step="0.01" min="0.01" value={supplierMult}
              onChange={(e) => setSupplierMult(e.target.value)}
              placeholder="1.00"
              className={INPUT} />
          </div>
        </div>
        {/* Visual cost preview */}
        {adjustedCost && (
          <div className="flex items-center gap-3 bg-[#2D9F6A]/5 border border-[#2D9F6A]/20 rounded-lg px-3 py-2.5 text-xs">
            <BarChart2 size={14} className="text-[#2D9F6A] shrink-0" />
            <span className="text-gray-400">Costo base</span>
            <span className="font-mono text-white">${Number(costPrice).toLocaleString("es-AR")}</span>
            <span className="text-gray-600">×{supplierMult}</span>
            <span className="text-gray-400">=</span>
            <span className="font-mono text-[#2D9F6A] font-bold">${Number(adjustedCost).toLocaleString("es-AR")}</span>
            <span className="text-gray-500 ml-auto">costo ajustado (referencia)</span>
          </div>
        )}
      </div>

      {/* ── D. Categorización ── */}
      <div className={SECTION}>
        <p className={SECTION_TITLE}><Tag size={12} /> Categorización</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Categoría</label>
            <select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setSubcategoryId(""); }}
              className={INPUT}>
              <option value="">— Sin categoría —</option>
              {rootCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {subCats.length > 0 && (
            <div>
              <label className={LABEL}>Subcategoría</label>
              <select value={subcategoryId} onChange={(e) => setSubcategoryId(e.target.value)}
                className={INPUT}>
                <option value="">— General —</option>
                {subCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
        </div>
        {/* Add new category inline */}
        {!addingCat ? (
          <button type="button" onClick={() => setAddingCat(true)}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#2D9F6A] transition">
            <Plus size={12} /> Crear nueva categoría
          </button>
        ) : (
          <div className="flex gap-2">
            <input value={newCatName} onChange={(e) => setNewCatName(e.target.value)}
              placeholder="Nombre de categoría"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddCategory(); } }}
              className={`${INPUT} flex-1`} />
            <button type="button" onClick={handleAddCategory}
              className="px-3 py-2 bg-[#2D9F6A] hover:bg-[#25835A] text-white text-xs rounded-lg transition">
              Crear
            </button>
            <button type="button" onClick={() => { setAddingCat(false); setNewCatName(""); }}
              className="px-3 py-2 bg-[#2a2a2a] text-gray-400 hover:text-white text-xs rounded-lg transition">
              <X size={12} />
            </button>
          </div>
        )}
      </div>

      {/* ── E. Stock ── */}
      <div className={SECTION}>
        <p className={SECTION_TITLE}><Package size={12} /> Stock</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Cantidad</label>
            <input type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)}
              placeholder="0"
              className={`${INPUT} ${stockLow ? "border-amber-500" : ""}`} />
          </div>
          <div>
            <label className={LABEL}>Stock mínimo</label>
            <input type="number" min="0" value={stockMin} onChange={(e) => setStockMin(e.target.value)}
              placeholder="0"
              className={INPUT} />
          </div>
        </div>
        {stockLow && (
          <div className="flex items-center gap-2 text-amber-400 text-xs bg-amber-400/5 border border-amber-400/20 rounded-lg px-3 py-2">
            <AlertTriangle size={12} /> Stock actual ({stock}) está por debajo del mínimo ({stockMin})
          </div>
        )}
      </div>

      {/* ── F. Visibilidad ── */}
      <div className={SECTION}>
        <p className={SECTION_TITLE}><Eye size={12} /> Visibilidad</p>
        <div className="flex flex-wrap gap-6">
          <Toggle value={active} onChange={setActive} label="Activo (visible en portal)" activeColor="bg-green-500" />
          <Toggle value={featured} onChange={setFeatured} label="Destacado" activeColor="bg-yellow-500" />
        </div>
      </div>

      {/* ── G. Specs técnicas ── */}
      <div className={SECTION}>
        <div className="flex items-center justify-between mb-3">
          <p className={`${SECTION_TITLE} mb-0`}><Cpu size={12} /> Especificaciones técnicas</p>
          <button type="button" onClick={addSpec}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#2D9F6A] transition">
            <Plus size={12} /> Agregar campo
          </button>
        </div>
        {specs.length === 0 ? (
          <p className="text-xs text-gray-600 italic">Sin especificaciones. Hacé click en "Agregar campo".</p>
        ) : (
          <div className="space-y-2">
            {specs.map((s, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <input value={s.key} onChange={(e) => setSpecField(i, "key", e.target.value)}
                  placeholder="ej. CPU" className={INPUT} />
                <input value={s.value} onChange={(e) => setSpecField(i, "value", e.target.value)}
                  placeholder="ej. i7-13700" className={INPUT} />
                <button type="button" onClick={() => removeSpec(i)}
                  className="p-2 text-gray-600 hover:text-red-400 transition">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── H. Tags ── */}
      <div className={SECTION}>
        <p className={SECTION_TITLE}><Tag size={12} /> Tags</p>
        <div className={`${INPUT} flex flex-wrap gap-1.5 min-h-[42px] cursor-text`}
          onClick={() => document.getElementById("tag-input")?.focus()}>
          {tags.map((t) => (
            <span key={t} className="flex items-center gap-1 bg-[#2D9F6A]/15 text-[#2D9F6A] text-xs px-2 py-0.5 rounded-full border border-[#2D9F6A]/30">
              {t}
              <button type="button" onClick={() => setTags((p) => p.filter((x) => x !== t))}
                className="hover:text-white transition"><X size={10} /></button>
            </span>
          ))}
          <input
            id="tag-input"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKey}
            onBlur={() => { if (tagInput) addTag(tagInput); }}
            placeholder={tags.length === 0 ? "wifi, gigabit, rack... (Enter para agregar)" : ""}
            className="flex-1 min-w-[120px] bg-transparent outline-none text-sm text-white placeholder:text-gray-600"
          />
        </div>
        <p className="text-[11px] text-gray-600">Enter, coma o Tab para agregar. Backspace para eliminar el último.</p>
      </div>

      {/* ── Errors ── */}
      {errors._ && <p className="text-red-400 text-sm bg-red-400/5 border border-red-400/20 rounded-lg px-3 py-2">{errors._}</p>}

      {/* ── Actions ── */}
      <div className="flex items-center gap-3 pt-1">
        <button type="submit" disabled={saving || !!errors.sku}
          className="flex items-center gap-2 bg-[#2D9F6A] hover:bg-[#25835A] disabled:opacity-50 text-white font-semibold text-sm px-5 py-2.5 rounded-lg transition">
          {saving && <Loader2 size={14} className="animate-spin" />}
          {saving ? "Guardando..." : "Guardar producto"}
        </button>
        <button type="button" onClick={resetForm}
          className="text-sm text-gray-500 hover:text-white transition px-3 py-2 rounded-lg hover:bg-[#2a2a2a]">
          Limpiar formulario
        </button>
      </div>
    </form>
  );
}
