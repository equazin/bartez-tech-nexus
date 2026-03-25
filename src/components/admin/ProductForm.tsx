import { useState } from "react";
import { Product } from "@/models/products";
import { supabase } from "@/lib/supabase";

export default function ProductForm({ onAdd }: { onAdd: (product: Product) => void }) {
  const [form, setForm] = useState({
    name: "", description: "", image: "",
    cost_price: "", category: "", stock: "", sku: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("El nombre es requerido"); return; }
    const cost_price = Number(form.cost_price);
    if (isNaN(cost_price) || cost_price <= 0) { setError("El precio debe ser mayor a 0"); return; }

    setSaving(true);
    setError("");

    const { data, error: sbError } = await supabase
      .from("products")
      .insert([{
        name: form.name.trim(),
        description: form.description,
        image: form.image.trim() || "/placeholder.png",
        cost_price,
        category: form.category || "General",
        stock: Number(form.stock) || 0,
        sku: form.sku || null,
        active: true,
      }])
      .select()
      .single();

    setSaving(false);

    if (sbError) { setError(sbError.message); return; }

    onAdd(data as Product);
    setForm({ name: "", description: "", image: "", cost_price: "", category: "", stock: "", sku: "" });
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <h3 className="font-semibold text-base">Agregar producto</h3>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Nombre *</label>
          <input name="name" value={form.name} onChange={handleChange} required
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">SKU</label>
          <input name="sku" value={form.sku} onChange={handleChange}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Precio costo *</label>
          <input name="cost_price" value={form.cost_price} onChange={handleChange} required type="number" min="0"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Categoría</label>
          <input name="category" value={form.category} onChange={handleChange} placeholder="General"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Stock</label>
          <input name="stock" value={form.stock} onChange={handleChange} type="number" min="0"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">URL imagen</label>
          <input name="image" value={form.image} onChange={handleChange} placeholder="https://..."
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Descripción</label>
        <textarea name="description" value={form.description} onChange={handleChange} rows={2}
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary resize-none" />
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}
      {success && <p className="text-green-500 text-sm">Producto guardado correctamente.</p>}

      <button type="submit" disabled={saving}
        className="bg-primary text-primary-foreground font-semibold text-sm px-5 py-2 rounded-lg disabled:opacity-50 transition hover:opacity-90">
        {saving ? "Guardando..." : "Guardar producto"}
      </button>
    </form>
  );
}
