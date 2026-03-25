import { useState, useEffect, useRef } from "react";
import { Product } from "@/models/products";
import { supabase } from "@/lib/supabase";
import { Upload, X, ImageIcon } from "lucide-react";

const SUPABASE_URL = "https://mfetwdftkiqydbwiqyfi.supabase.co";

interface Category { id: number; name: string; parent_id: number | null; }

export default function ProductForm({ onAdd }: { onAdd: (product: Product) => void }) {
  const [form, setForm] = useState({
    name: "", description: "", image: "",
    cost_price: "", category_id: "", subcategory_id: "", stock: "", sku: "",
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from("categories").select("*").order("parent_id", { nullsFirst: true }).order("name")
      .then(({ data }) => { if (data) setCategories(data as Category[]); });
  }, []);

  const rootCategories = categories.filter((c) => c.parent_id === null);
  const subcategories = categories.filter((c) => c.parent_id === Number(form.category_id));

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value, ...(name === "category_id" ? { subcategory_id: "" } : {}) }));
  }

  function handleImageFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleImageFile(file);
  }

  async function uploadImage(file: File): Promise<string> {
    const ext = file.name.split(".").pop();
    const path = `${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("products").upload(path, file, { upsert: true });
    if (error) throw error;
    return `${SUPABASE_URL}/storage/v1/object/public/products/${path}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("El nombre es requerido"); return; }
    const cost_price = Number(form.cost_price);
    if (isNaN(cost_price) || cost_price <= 0) { setError("El precio debe ser mayor a 0"); return; }

    setSaving(true);
    setError("");

    let imageUrl = form.image.trim() || "/placeholder.png";
    if (imageFile) {
      try { imageUrl = await uploadImage(imageFile); }
      catch (err: any) { setError("Error subiendo imagen: " + err.message); setSaving(false); return; }
    }

    const selectedCat = categories.find((c) => c.id === Number(form.category_id));
    const selectedSub = categories.find((c) => c.id === Number(form.subcategory_id));
    const categoryName = selectedSub?.name ?? selectedCat?.name ?? "General";

    const { data, error: sbError } = await supabase
      .from("products")
      .insert([{
        name: form.name.trim(),
        description: form.description,
        image: imageUrl,
        cost_price,
        category: categoryName,
        stock: Number(form.stock) || 0,
        sku: form.sku || null,
        active: true,
      }])
      .select()
      .single();

    setSaving(false);
    if (sbError) { setError(sbError.message); return; }

    onAdd(data as Product);
    setForm({ name: "", description: "", image: "", cost_price: "", category_id: "", subcategory_id: "", stock: "", sku: "" });
    setImageFile(null);
    setImagePreview("");
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <h3 className="font-semibold text-base text-white">Agregar producto</h3>

      {/* Imagen drag & drop */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">Imagen</label>
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed cursor-pointer transition h-36 ${
            dragging ? "border-[#FF6A00] bg-[#FF6A00]/5" : "border-[#333] hover:border-[#FF6A00]/50 bg-[#1a1a1a]"
          }`}
        >
          {imagePreview ? (
            <>
              <img src={imagePreview} className="h-full w-full object-contain rounded-xl p-2" />
              <button type="button" onClick={(e) => { e.stopPropagation(); setImageFile(null); setImagePreview(""); }}
                className="absolute top-2 right-2 bg-red-500/80 text-white rounded-full p-0.5 hover:bg-red-500 transition">
                <X size={12} />
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 text-gray-500">
              <Upload size={24} />
              <span className="text-xs text-center">Arrastrá una imagen o hacé click<br/>JPG, PNG, WEBP — máx. 5MB</span>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { if (e.target.files?.[0]) handleImageFile(e.target.files[0]); }} />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Nombre *</label>
          <input name="name" value={form.name} onChange={handleChange} required
            className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#FF6A00]" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">SKU</label>
          <input name="sku" value={form.sku} onChange={handleChange}
            className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#FF6A00]" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Precio costo *</label>
          <input name="cost_price" value={form.cost_price} onChange={handleChange} required type="number" min="0"
            className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#FF6A00]" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Stock</label>
          <input name="stock" value={form.stock} onChange={handleChange} type="number" min="0"
            className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#FF6A00]" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Categoría</label>
          <select name="category_id" value={form.category_id} onChange={handleChange}
            className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#FF6A00]">
            <option value="">— Seleccioná —</option>
            {rootCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {subcategories.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Subcategoría</label>
            <select name="subcategory_id" value={form.subcategory_id} onChange={handleChange}
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#FF6A00]">
              <option value="">— Todas —</option>
              {subcategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">Descripción</label>
        <textarea name="description" value={form.description} onChange={handleChange} rows={2}
          className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#FF6A00] resize-none" />
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {success && <p className="text-green-400 text-sm">Producto guardado correctamente.</p>}

      <button type="submit" disabled={saving}
        className="bg-[#FF6A00] hover:bg-[#FF8C1A] text-white font-semibold text-sm px-5 py-2 rounded-lg disabled:opacity-50 transition">
        {saving ? "Guardando..." : "Guardar producto"}
      </button>
    </form>
  );
}
