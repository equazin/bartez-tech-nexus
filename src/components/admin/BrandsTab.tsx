import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Brand } from "@/models/brand";
import { Plus, Pencil, Check, X, Tag, Loader2 } from "lucide-react";

function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface BrandRow extends Brand {
  product_count: number;
}

interface Props {
  isDark?: boolean;
}

export function BrandsTab({ isDark = true }: Props) {
  const dk = (d: string, l: string) => (isDark ? d : l);

  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", slug: "" });
  const [newForm, setNewForm] = useState({ name: "", slug: "" });
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function fetchBrands() {
    setLoading(true);
    const [{ data: brandsData }, { data: countData }] = await Promise.all([
      supabase.from("brands").select("*").order("name"),
      supabase.from("products").select("brand_id").not("brand_id", "is", null),
    ]);

    const countMap: Record<string, number> = {};
    (countData ?? []).forEach((p: { brand_id: string }) => {
      countMap[p.brand_id] = (countMap[p.brand_id] ?? 0) + 1;
    });

    setBrands(
      (brandsData ?? []).map((b: Brand) => ({
        ...b,
        product_count: countMap[b.id] ?? 0,
      }))
    );
    setLoading(false);
  }

  useEffect(() => {
    fetchBrands();
  }, []);

  function startEdit(brand: BrandRow) {
    setEditingId(brand.id);
    setEditForm({ name: brand.name, slug: brand.slug });
    setError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setError("");
  }

  async function handleSaveEdit(brand: BrandRow) {
    const name = editForm.name.trim();
    if (!name) { setError("El nombre es obligatorio."); return; }
    setSaving(true);
    setError("");
    const slug = editForm.slug.trim() || slugify(name);
    const { error: err } = await supabase
      .from("brands")
      .update({ name, slug })
      .eq("id", brand.id);
    if (err) { setError(err.message); setSaving(false); return; }
    // Sync brand_name in products if name changed
    if (name !== brand.name) {
      await supabase.from("products").update({ brand_name: name }).eq("brand_id", brand.id);
    }
    setEditingId(null);
    setSaving(false);
    fetchBrands();
  }

  async function handleCreate() {
    const name = newForm.name.trim();
    if (!name) { setError("El nombre es obligatorio."); return; }
    setSaving(true);
    setError("");
    const slug = newForm.slug.trim() || slugify(name);
    const { error: err } = await supabase.from("brands").insert({ name, slug });
    if (err) { setError(err.message); setSaving(false); return; }
    setNewForm({ name: "", slug: "" });
    setShowNew(false);
    setSaving(false);
    fetchBrands();
  }

  async function toggleActive(brand: BrandRow) {
    await supabase.from("brands").update({ active: !brand.active }).eq("id", brand.id);
    fetchBrands();
  }

  const inputCls = `w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-[#2D9F6A]/50 ${dk("", "!bg-white !border-[#d4d4d4] !text-[#171717]")}`;

  return (
    <div className="max-w-4xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-base font-bold ${dk("text-white", "text-[#171717]")}`}>
            Marcas
          </h2>
          <p className={`text-xs mt-0.5 ${dk("text-[#525252]", "text-[#737373]")}`}>
            {brands.length} marca{brands.length !== 1 ? "s" : ""} registrada{brands.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => { setShowNew(true); setError(""); }}
          className="flex items-center gap-2 px-4 py-2 bg-[#2D9F6A] hover:bg-[#25835A] text-white text-sm font-bold rounded-lg transition"
        >
          <Plus size={14} /> Nueva marca
        </button>
      </div>

      {/* New brand form */}
      {showNew && (
        <div className={`border rounded-xl p-4 space-y-3 ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
          <p className={`text-xs font-semibold ${dk("text-[#a3a3a3]", "text-[#525252]")}`}>Nueva marca</p>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[11px] text-gray-500 mb-1 block">Nombre *</label>
              <input
                value={newForm.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setNewForm((p) => ({ name, slug: slugify(name) }));
                }}
                placeholder="Ej: TP-Link"
                className={inputCls}
                autoFocus
              />
            </div>
            <div className="flex-1">
              <label className="text-[11px] text-gray-500 mb-1 block">Slug</label>
              <input
                value={newForm.slug}
                onChange={(e) => setNewForm((p) => ({ ...p, slug: e.target.value }))}
                placeholder="tp-link"
                className={`${inputCls} font-mono`}
              />
            </div>
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setShowNew(false); setNewForm({ name: "", slug: "" }); setError(""); }}
              className={`px-3 py-1.5 text-sm rounded-lg transition ${dk("text-gray-400 hover:text-white hover:bg-[#1c1c1c]", "text-[#737373] hover:text-[#171717] hover:bg-[#f5f5f5]")}`}
            >
              Cancelar
            </button>
            <button
              onClick={handleCreate}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-[#2D9F6A] hover:bg-[#25835A] text-white text-sm font-semibold rounded-lg transition disabled:opacity-50"
            >
              {saving && <Loader2 size={12} className="animate-spin" />}
              Crear
            </button>
          </div>
        </div>
      )}

      {/* Brands table */}
      <div className={`border rounded-xl overflow-hidden ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
        {loading ? (
          <div className="py-12 text-center text-gray-600 text-sm">Cargando marcas...</div>
        ) : brands.length === 0 ? (
          <div className="py-12 text-center text-gray-600 text-sm">
            <Tag size={28} className="mx-auto mb-2 opacity-20" />
            No hay marcas registradas
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className={`border-b ${dk("bg-[#0d0d0d] border-[#1a1a1a]", "bg-[#f5f5f5] border-[#e5e5e5]")}`}>
              <tr>
                <th className={`px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider ${dk("text-[#525252]", "text-[#737373]")}`}>
                  Nombre
                </th>
                <th className={`px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider ${dk("text-[#525252]", "text-[#737373]")}`}>
                  Slug
                </th>
                <th className={`px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider ${dk("text-[#525252]", "text-[#737373]")}`}>
                  Productos
                </th>
                <th className={`px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider ${dk("text-[#525252]", "text-[#737373]")}`}>
                  Estado
                </th>
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody>
              {brands.map((brand) => (
                <tr
                  key={brand.id}
                  className={`border-b last:border-b-0 ${dk("border-[#1a1a1a] hover:bg-[#0d0d0d]", "border-[#f0f0f0] hover:bg-[#fafafa]")}`}
                >
                  {editingId === brand.id ? (
                    <>
                      <td className="px-4 py-2">
                        <input
                          value={editForm.name}
                          onChange={(e) => {
                            const name = e.target.value;
                            setEditForm((p) => ({ name, slug: slugify(name) }));
                          }}
                          className={inputCls}
                          autoFocus
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          value={editForm.slug}
                          onChange={(e) => setEditForm((p) => ({ ...p, slug: e.target.value }))}
                          className={`${inputCls} font-mono`}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <span className={`text-xs font-medium ${dk("text-[#737373]", "text-[#a3a3a3]")}`}>
                          {brand.product_count}
                        </span>
                      </td>
                      <td className="px-4 py-2" />
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1 justify-end">
                          {error && editingId === brand.id && (
                            <span className="text-red-400 text-[11px] mr-1">{error}</span>
                          )}
                          <button
                            onClick={() => handleSaveEdit(brand)}
                            disabled={saving}
                            className="p-1.5 text-green-400 hover:text-green-300 transition disabled:opacity-50"
                            title="Guardar"
                          >
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                          </button>
                          <button
                            onClick={cancelEdit}
                            className={`p-1.5 transition ${dk("text-[#525252] hover:text-white", "text-[#a3a3a3] hover:text-[#171717]")}`}
                            title="Cancelar"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${dk("text-white", "text-[#171717]")}`}>
                            {brand.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-mono ${dk("text-[#525252]", "text-[#737373]")}`}>
                          {brand.slug}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          brand.product_count > 0
                            ? dk("bg-[#2D9F6A]/10 text-[#2D9F6A]", "bg-[#2D9F6A]/10 text-[#1a7a50]")
                            : dk("bg-[#1c1c1c] text-[#525252]", "bg-[#f0f0f0] text-[#a3a3a3]")
                        }`}>
                          {brand.product_count}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleActive(brand)}
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border transition ${
                            brand.active
                              ? "bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20"
                              : "bg-[#1c1c1c] text-[#525252] border-[#2a2a2a] hover:bg-[#222]"
                          }`}
                        >
                          {brand.active ? "Activa" : "Inactiva"}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => startEdit(brand)}
                            className={`p-1.5 rounded-lg transition ${dk("text-[#525252] hover:text-white hover:bg-[#1c1c1c]", "text-[#a3a3a3] hover:text-[#171717] hover:bg-[#f0f0f0]")}`}
                            title="Editar"
                          >
                            <Pencil size={13} />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
