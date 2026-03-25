import { useState, useEffect } from "react";
import { Product } from "@/models/products";
import { addProduct } from "@/store/productStore";
import { getStoredSuppliers } from "@/store/supplierStore";

export default function ProductForm({ onAdd }: { onAdd: (product: Product) => void }) {
  const [form, setForm] = useState({
    name: "",
    description: "",
    image: "",
    cost_price: "",
    category: "",
    stock: "",
    supplier_id: "",
    sku: "",
  });
  const [error, setError] = useState("");
  const [suppliers, setSuppliers] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    const all = getStoredSuppliers();
    setSuppliers(all.map(s => ({ id: s.id, name: s.name })));
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }
    const cost_price = Number(form.cost_price);
    if (isNaN(cost_price)) {
      setError("Cost price must be a number");
      return;
    }
    if (!form.supplier_id) {
      setError("Supplier is required");
      return;
    }
    const product: Product = {
      id: Date.now(),
      name: form.name.trim(),
      description: form.description,
      image: form.image.trim() || "/placeholder.png",
      cost_price,
      category: form.category,
      stock: Number(form.stock) || 0,
      supplier_id: Number(form.supplier_id),
      supplier_multiplier: 1,
      sku: form.sku,
    };
    addProduct(product);
    onAdd(product);
    setForm({ name: "", description: "", image: "", cost_price: "", category: "", stock: "", supplier_id: "", sku: "" });
    setError("");
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <label className="block text-sm font-medium">Name *</label>
        <input name="name" value={form.name} onChange={handleChange} className="input" required />
      </div>
      <div>
        <label className="block text-sm font-medium">Description</label>
        <textarea name="description" value={form.description} onChange={handleChange} className="input" />
      </div>
      <div>
        <label className="block text-sm font-medium">Image URL</label>
        <input name="image" value={form.image} onChange={handleChange} className="input" placeholder="https://..." />
      </div>
      <div>
        <label className="block text-sm font-medium">Cost Price *</label>
        <input name="cost_price" value={form.cost_price} onChange={handleChange} className="input" required type="number" min="0" />
      </div>
      <div>
        <label className="block text-sm font-medium">Category</label>
        <input name="category" value={form.category} onChange={handleChange} className="input" />
      </div>
      <div>
        <label className="block text-sm font-medium">Stock</label>
        <input name="stock" value={form.stock} onChange={handleChange} className="input" type="number" min="0" />
      </div>
      <div>
        <label className="block text-sm font-medium">SKU</label>
        <input name="sku" value={form.sku} onChange={handleChange} className="input" />
      </div>
      <div>
        <label className="block text-sm font-medium">Supplier *</label>
        {suppliers.length === 0 ? (
          <div className="text-destructive text-sm">No suppliers found. Please create a supplier first.</div>
        ) : (
          <select name="supplier_id" value={form.supplier_id} onChange={handleChange} className="input" required>
            <option value="">Select supplier</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
      </div>
      {error && <div className="text-destructive text-sm">{error}</div>}
      <button type="submit" className="btn btn-primary" disabled={suppliers.length === 0}>Save Product</button>
    </form>
  );
}
