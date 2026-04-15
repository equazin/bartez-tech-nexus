import { useState, useEffect, useRef, KeyboardEvent } from "react";
import { isValidImageMime } from "@/lib/validateImageMime";
import { Product } from "@/models/products";
import { supabase } from "@/lib/supabase";
import { backend, hasBackendUrl } from "@/lib/api/backend";
import { storageUrl, PRODUCTS_BUCKET } from "@/lib/constants";
import {
  Upload, X, Plus,
  Star, Eye, AlertTriangle, Loader2,
  Tag, Cpu, Package, BarChart2, DollarSign, Settings2,
} from "lucide-react";
const DRAFT_KEY = "bartez_product_draft";

interface Category { id: number; name: string; parent_id: number | null; }
interface BrandOption { id: string; name: string; }
interface Spec { key: string; value: string; }
type FormTab = "informacion" | "precio" | "inventario" | "organizacion" | "marketing" | "avanzado";

function Toggle({ value, onChange, label, activeColor = "bg-green-500", isDark = true }: {
  value: boolean; onChange: (v: boolean) => void;
  label: string; activeColor?: string; isDark?: boolean;
}) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none">
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative w-10 h-5 rounded-full transition-colors ${value ? activeColor : (isDark ? "bg-[#333]" : "bg-[#ccc]")}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${value ? "left-5" : "left-0.5"}`} />
      </button>
      <span className={`text-sm ${isDark ? "text-gray-300" : "text-gray-600"}`}>{label}</span>
    </label>
  );
}

function loadDraft() {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); }
  catch { return null; }
}


export default function ProductForm({ onAdd, isDark = true, brands = [] }: { onAdd: (product: Product) => void; isDark?: boolean; brands?: BrandOption[] }) {
  const dk = (d: string, l: string) => isDark ? d : l;
  const INPUT = `w-full ${dk("bg-[#141414] border-[#2a2a2a] text-white placeholder:text-gray-600", "bg-white border-[#d4d4d4] text-[#171717] placeholder:text-gray-400")} border rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2D9F6A] transition`;
  const LABEL = `block text-xs font-medium ${dk("text-gray-400", "text-gray-600")} mb-1`;
  const SECTION = `${dk("bg-[#1a1a1a] border-[#242424]", "bg-[#f5f5f5] border-[#e5e5e5]")} border rounded-xl p-4 space-y-3`;
  const SECTION_TITLE = `flex items-center gap-2 text-xs font-semibold ${dk("text-gray-400", "text-gray-600")} uppercase tracking-wider mb-3`;
  const saved = loadDraft();
  const [activeTab, setActiveTab] = useState<FormTab>("informacion");

  /* ── form state (restored from draft if available) ────── */
  const [name, setName]                     = useState(saved?.name ?? "");
  const [sku, setSku]                       = useState(saved?.sku ?? "");
  const [shortDescription, setShortDescription] = useState(saved?.shortDescription ?? "");
  const [description, setDescription]      = useState(saved?.description ?? "");
  const [costPrice, setCostPrice]          = useState(saved?.costPrice ?? "");
  const [specialPrice, setSpecialPrice]    = useState(saved?.specialPrice ?? "");
  const [offerPercent, setOfferPercent]    = useState(saved?.offerPercent ?? "");
  const [ivaRate, setIvaRate]              = useState<"10.5" | "21">(saved?.ivaRate ?? "21");
  const [supplierId, setSupplierId]        = useState(saved?.supplierId ?? "");
  const [supplierMult, setSupplierMult]    = useState(saved?.supplierMult ?? "1");
  const [categoryId, setCategoryId]        = useState(saved?.categoryId ?? "");
  const [subcategoryId, setSubcategoryId] = useState(saved?.subcategoryId ?? "");
  const [brandId, setBrandId]             = useState(saved?.brandId ?? "");
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
  const [externalId, setExternalId]        = useState(saved?.externalId ?? "");
  const [apiAirEnabled, setApiAirEnabled]  = useState(saved?.apiAirEnabled ?? false);
  const [apiElitEnabled, setApiElitEnabled] = useState(saved?.apiElitEnabled ?? false);
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
  const computedOfferPrice = costPrice && offerPercent !== ""
    ? Number(costPrice) * (1 - Number(offerPercent) / 100)
    : null;
  const stockLow = stock !== "" && stockMin !== "" && Number(stock) < Number(stockMin);
  const baseCost = Number(costPrice || 0);
  const ivaPct = Number(ivaRate || 21);
  const salePrice = specialPrice ? Number(specialPrice) : baseCost * (1 + ivaPct / 100);
  const marginEstimated = salePrice > 0 ? ((salePrice - baseCost) / salePrice) * 100 : 0;

  /* ── load categories ──────────────────────────────────── */
  useEffect(() => {
    supabase.from("categories").select("*")
      .order("parent_id", { nullsFirst: true }).order("name")
      .then(({ data }) => { if (data) setCategories(data as Category[]); });
  }, []);

  /* ── persist draft to localStorage on every change ───── */
  useEffect(() => {
    const draft = {
      name, sku, shortDescription, description, costPrice, specialPrice, offerPercent, ivaRate, supplierId, supplierMult,
      categoryId, subcategoryId, brandId, stock, stockMin, active, featured, specs, tags,
      externalId, apiAirEnabled, apiElitEnabled,
    };

    // Only save if there's something meaningful
    if (Object.values(draft).some((v) => v !== "" && v !== "0" && v !== "1" && v !== true && !(Array.isArray(v) && v.length === 0))) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    }
  }, [name, sku, shortDescription, description, costPrice, specialPrice, offerPercent, ivaRate, supplierId, supplierMult,
      categoryId, subcategoryId, brandId, stock, stockMin, active, featured, specs, tags,
      externalId, apiAirEnabled, apiElitEnabled]);

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
  async function handleImageFile(file: File) {
    if (!(await isValidImageMime(file))) return;
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
    return storageUrl(PRODUCTS_BUCKET, path);
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

  function handleSpecialPriceChange(value: string) {
    setSpecialPrice(value);
    const base = Number(costPrice);
    const special = Number(value);
    if (!value || isNaN(base) || base <= 0 || isNaN(special) || special < 0) {
      setOfferPercent("");
      return;
    }
    const pct = ((base - special) / base) * 100;
    setOfferPercent(Math.max(0, Math.min(100, pct)).toFixed(2));
  }

  function handleOfferPercentChange(value: string) {
    setOfferPercent(value);
    const base = Number(costPrice);
    const pct = Number(value);
    if (!value || isNaN(base) || base <= 0 || isNaN(pct) || pct < 0) {
      setSpecialPrice("");
      return;
    }
    const normalized = Math.max(0, Math.min(100, pct));
    const offerValue = base * (1 - normalized / 100);
    setSpecialPrice(offerValue.toFixed(2));
  }

  function handleCostPriceChange(value: string) {
    setCostPrice(value);
    const base = Number(value);
    const pct = Number(offerPercent);
    if (!offerPercent || isNaN(base) || base <= 0 || isNaN(pct) || pct < 0) return;
    const normalized = Math.max(0, Math.min(100, pct));
    setSpecialPrice((base * (1 - normalized / 100)).toFixed(2));
  }

  /* ── validation ───────────────────────────────────────── */
  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!name.trim())                             e.name = "Nombre requerido";
    if (!sku.trim())                              e.sku  = "SKU requerido";
    if (errors.sku)                               e.sku  = errors.sku;
    const cp = Number(costPrice);
    if (!costPrice || isNaN(cp) || cp <= 0)       e.cost_price = "Precio debe ser > 0";
    if (specialPrice) {
      const sp = Number(specialPrice);
      if (isNaN(sp) || sp <= 0) e.special_price = "Precio especial inválido";
    }
    if (offerPercent) {
      const op = Number(offerPercent);
      if (isNaN(op) || op < 0 || op > 100) e.offer_percent = "Oferta % debe estar entre 0 y 100";
    }
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
    const normalizedSpecialPrice = specialPrice ? Number(specialPrice) : null;
    const normalizedOfferPercent = offerPercent ? Number(offerPercent) : null;

    const specsObj = specs.reduce<Record<string, string>>((acc, s) => {
      if (s.key.trim()) acc[s.key.trim()] = s.value;
      return acc;
    }, {});
    if (shortDescription.trim()) specsObj.short_description = shortDescription.trim();
    if (apiAirEnabled) specsObj.api_air_enabled = "true";
    if (apiElitEnabled) specsObj.api_elit_enabled = "true";

    const selectedBrand = brands.find((b) => b.id === brandId);
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
      iva_rate:            Number(ivaRate),
      special_price:       normalizedSpecialPrice && normalizedSpecialPrice > 0 ? normalizedSpecialPrice : null,
      offer_percent:       normalizedOfferPercent !== null && normalizedOfferPercent >= 0 ? normalizedOfferPercent : null,
      brand_id:            brandId || null,
      brand_name:          selectedBrand?.name ?? null,
      external_id:         externalId.trim() || null,
    };

    let created: Product;
    if (hasBackendUrl) {
      try {
        const row = await backend.products.create(payload as Record<string, unknown>);
        created = {
          ...payload,
          id: row.id,
          image: row.image ?? payload.image,
          cost_price: row.cost ?? Number(payload.cost_price),
          stock: row.stock,
          active: row.active,
        } as Product;
      } catch (err: unknown) {
        setSaving(false);
        setErrors({ _: err instanceof Error ? err.message : "Error al crear producto" });
        return;
      }
    } else {
      const { data, error: sbError } = await supabase
        .from("products").insert([payload]).select().single();
      setSaving(false);
      if (sbError) { setErrors({ _: sbError.message }); return; }
      created = data as Product;
    }

    setSaving(false);
    onAdd(created);
    resetForm();
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  }

  function resetForm() {
    localStorage.removeItem(DRAFT_KEY);
    setName(""); setSku(""); setShortDescription(""); setDescription(""); setCostPrice(""); setIvaRate("21");
    setSpecialPrice(""); setOfferPercent("");
    setSupplierId(""); setSupplierMult("1"); setCategoryId(""); setSubcategoryId(""); setBrandId("");
    setStock(""); setStockMin("0"); setActive(true); setFeatured(false);
    setSpecs([]); setTags([]); setTagInput(""); setImageFile(null); setImagePreview("");
    setExternalId(""); setApiAirEnabled(false); setApiElitEnabled(false);
    setErrors({});
    setActiveTab("informacion");
  }

  const tabs: Array<{ id: FormTab; label: string }> = [
    { id: "informacion", label: "Informacion" },
    { id: "precio", label: "Precio" },
    { id: "inventario", label: "Inventario" },
    { id: "organizacion", label: "Organizacion" },
    { id: "marketing", label: "Marketing" },
    { id: "avanzado", label: "Avanzado" },
  ];

  /* ── render ───────────────────────────────────────────── */
  return (
    <form onSubmit={handleSubmit} className={`space-y-4 ${dk("text-white", "text-[#171717]")}`}>
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

      <div className={`rounded-xl border p-1 ${dk("bg-[#111] border-[#1f1f1f]", "bg-[#fafafa] border-[#e5e5e5]")}`}>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-2.5 py-2 rounded-lg text-xs font-semibold transition ${
                activeTab === tab.id
                  ? "bg-[#2D9F6A] text-white"
                  : dk("text-gray-400 hover:text-white hover:bg-[#1d1d1d]", "text-[#525252] hover:text-[#171717] hover:bg-white")
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── A. Imagen ── */}
      {activeTab === "informacion" && (
      <>
      <div className={SECTION}>
        <p className={SECTION_TITLE}><Upload size={12} /> Imagen</p>
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleImageFile(f); }}
          className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed cursor-pointer transition h-40 ${
            dragging ? "border-[#2D9F6A] bg-[#2D9F6A]/5" : `${dk("border-[#2a2a2a] bg-[#141414]", "border-[#d4d4d4] bg-[#f9f9f9]")} hover:border-[#2D9F6A]/40`
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
          <label className={LABEL}>Descripcion corta</label>
          <input value={shortDescription} onChange={(e) => setShortDescription(e.target.value)}
            placeholder="Resumen breve del producto..."
            className={INPUT} />
        </div>
        <div>
          <label className={LABEL}>Descripcion completa</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
            placeholder="Caracteristicas principales del producto..."
            className={`${INPUT} resize-none`} />
        </div>
      </div>
      </>
      )}

      {/* ── C. Costo y Proveedor ── */}
      {activeTab === "precio" && (
      <div className={SECTION}>
        <p className={SECTION_TITLE}><DollarSign size={12} /> Costo y proveedor</p>
        <div className="grid md:grid-cols-3 xl:grid-cols-6 gap-3">
          <div>
            <label className={LABEL}>Costo base (ARS) *</label>
            <input type="number" min="0" step="0.01" value={costPrice}
              onChange={(e) => handleCostPriceChange(e.target.value)}
              placeholder="0.00"
              className={`${INPUT} ${errors.cost_price ? "border-red-500" : ""}`} />
            {errors.cost_price && <p className="text-red-400 text-xs mt-1">{errors.cost_price}</p>}
          </div>
          <div>
            <label className={LABEL}>IVA</label>
            <div className="flex gap-1.5">
              {(["10.5", "21"] as const).map((r) => (
                <button key={r} type="button" onClick={() => setIvaRate(r)}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold border transition ${
                    ivaRate === r
                      ? "bg-[#2D9F6A] border-[#2D9F6A] text-white"
                      : dk("bg-[#141414] border-[#2a2a2a] text-gray-400 hover:border-[#2D9F6A]/50",
                           "bg-[#f0f0f0] border-[#d4d4d4] text-gray-600 hover:border-[#2D9F6A]/50")
                  }`}>
                  {r}%
                </button>
              ))}
            </div>
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
          <div>
            <label className={LABEL}>Precio especial / oferta (ARS)</label>
            <input type="number" min="0" step="0.01" value={specialPrice}
              onChange={(e) => handleSpecialPriceChange(e.target.value)}
              placeholder="Opcional"
              className={`${INPUT} ${errors.special_price ? "border-red-500" : ""}`} />
            {errors.special_price && <p className="text-red-400 text-xs mt-1">{errors.special_price}</p>}
          </div>
          <div>
            <label className={LABEL}>Oferta % (bajar precio)</label>
            <input type="number" min="0" max="100" step="0.01" value={offerPercent}
              onChange={(e) => handleOfferPercentChange(e.target.value)}
              placeholder="Ej: 15"
              className={`${INPUT} ${errors.offer_percent ? "border-red-500" : ""}`} />
            {errors.offer_percent && <p className="text-red-400 text-xs mt-1">{errors.offer_percent}</p>}
          </div>
        </div>
        {computedOfferPrice !== null && !isNaN(computedOfferPrice) && (
          <p className={`text-xs ${dk("text-emerald-300", "text-emerald-700")}`}>
            Precio final con oferta: ${Math.max(0, computedOfferPrice).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        )}
        <div className={`grid grid-cols-2 gap-3 text-xs ${dk("text-gray-300", "text-[#525252]")}`}>
          <div className={`${dk("bg-[#111]", "bg-white")} rounded-lg border ${dk("border-[#262626]", "border-[#e5e5e5]")} px-3 py-2`}>
            Precio final: <span className="font-semibold">{salePrice > 0 ? `$${salePrice.toFixed(2)}` : "-"}</span>
          </div>
          <div className={`${dk("bg-[#111]", "bg-white")} rounded-lg border ${dk("border-[#262626]", "border-[#e5e5e5]")} px-3 py-2`}>
            Margen estimado: <span className="font-semibold">{marginEstimated.toFixed(2)}%</span>
          </div>
        </div>
        {/* Visual cost preview */}
        {adjustedCost && (
          <div className="flex items-center gap-3 bg-[#2D9F6A]/5 border border-[#2D9F6A]/20 rounded-lg px-3 py-2.5 text-xs">
            <BarChart2 size={14} className="text-[#2D9F6A] shrink-0" />
            <span className="text-gray-400">Costo base</span>
            <span className="font-mono text-white">${Number(costPrice).toLocaleString("es-AR")}</span>
            <span className="text-gray-600">�-{supplierMult}</span>
            <span className="text-gray-400">=</span>
            <span className="font-mono text-[#2D9F6A] font-bold">${Number(adjustedCost).toLocaleString("es-AR")}</span>
            <span className="text-gray-500 ml-auto">costo ajustado (referencia)</span>
          </div>
        )}
      </div>
      )}

      {/* ── D. Categorización ── */}
      {activeTab === "organizacion" && (
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
          {brands.length > 0 && (
            <div>
              <label className={LABEL}>Marca</label>
              <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className={INPUT}>
                <option value="">— Sin marca —</option>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
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
              className={`px-3 py-2 ${dk("bg-[#2a2a2a] text-gray-400 hover:text-white", "bg-[#e8e8e8] text-gray-500 hover:text-[#171717]")} text-xs rounded-lg transition`}>
              <X size={12} />
            </button>
          </div>
        )}
      </div>
      )}

      {/* ── E. Stock ── */}
      {activeTab === "inventario" && (
      <div className={SECTION}>
        <p className={SECTION_TITLE}><Package size={12} /> Stock</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Stock</label>
            <input type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)}
              placeholder="0"
              className={`${INPUT} ${stockLow ? "border-amber-500" : ""}`} />
          </div>
          <div>
            <label className={LABEL}>Stock minimo</label>
            <input type="number" min="0" value={stockMin} onChange={(e) => setStockMin(e.target.value)}
              placeholder="0"
              className={INPUT} />
          </div>
        </div>
        {stockLow && (
          <div className="flex items-center gap-2 text-amber-400 text-xs bg-amber-400/5 border border-amber-400/20 rounded-lg px-3 py-2">
            <AlertTriangle size={12} /> Estado automatico: stock actual ({stock}) por debajo del minimo ({stockMin})
          </div>
        )}
      </div>
      )}

      {/* ── F. Visibilidad ── */}
      {activeTab === "marketing" && (
      <>
      <div className={SECTION}>
        <p className={SECTION_TITLE}><Eye size={12} /> Visibilidad</p>
        <div className="flex flex-wrap gap-6">
          <Toggle value={active} onChange={setActive} label="Activo (visible en portal)" activeColor="bg-green-500" isDark={isDark} />
          <Toggle value={featured} onChange={setFeatured} label="Destacado" activeColor="bg-yellow-500" isDark={isDark} />
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
        <div className={`${INPUT} flex flex-wrap gap-1.5 min-h-[42px] h-auto cursor-text`}
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
            className={`flex-1 min-w-[120px] bg-transparent outline-none text-sm ${dk("text-white placeholder:text-gray-600", "text-[#171717] placeholder:text-gray-400")}`}
          />
        </div>
        <p className="text-[11px] text-gray-600">Enter, coma o Tab para agregar. Backspace para eliminar el último.</p>
      </div>
      </>
      )}

      {activeTab === "avanzado" && (
        <div className={SECTION}>
          <p className={SECTION_TITLE}><Settings2 size={12} /> Avanzado</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>External ID</label>
              <input value={externalId} onChange={(e) => setExternalId(e.target.value)} placeholder="ID externo del proveedor" className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Proveedor ID</label>
              <input type="number" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} placeholder="ID interno" className={INPUT} />
            </div>
          </div>
          <div className="flex flex-wrap gap-6 pt-1">
            <Toggle value={apiAirEnabled} onChange={setApiAirEnabled} label="Flag API AIR" activeColor="bg-blue-500" isDark={isDark} />
            <Toggle value={apiElitEnabled} onChange={setApiElitEnabled} label="Flag API ELIT" activeColor="bg-purple-500" isDark={isDark} />
            <Toggle value={active} onChange={setActive} label="Activo" activeColor="bg-green-500" isDark={isDark} />
          </div>
        </div>
      )}

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
          className={`text-sm text-gray-500 transition px-3 py-2 rounded-lg ${dk("hover:text-white hover:bg-[#2a2a2a]", "hover:text-[#171717] hover:bg-[#e8e8e8]")}`}>
          Limpiar formulario
        </button>
      </div>
    </form>
  );
}


