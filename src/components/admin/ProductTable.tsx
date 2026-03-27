import { useState, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Product } from "@/models/products";
import ProductEditModal from "./ProductEditModal";
import {
  Search, ArrowUpDown, ArrowUp, ArrowDown,
  Pencil, Copy, Trash2, Star, AlertTriangle, ChevronDown,
} from "lucide-react";

interface Category { id: number; name: string; parent_id: number | null; }
interface Props {
  products: Product[];
  categories: Category[];
  isDark?: boolean;
  onRefresh: () => void;
}

type SortField = "name" | "cost_price" | "stock" | "category";
type SortDir   = "asc" | "desc";
type Filter    = "all" | "active" | "inactive" | "low_stock" | "featured";

function SortIcon({ field, active, dir }: { field: string; active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown size={12} className="text-gray-600" />;
  return dir === "asc" ? <ArrowUp size={12} className="text-[#2D9F6A]" /> : <ArrowDown size={12} className="text-[#2D9F6A]" />;
}

export default function ProductTable({ products, categories, isDark = true, onRefresh }: Props) {
  const dk = (d: string, l: string) => isDark ? d : l;
  const [search,       setSearch]       = useState("");
  const [filterCat,    setFilterCat]    = useState("all");
  const [filterStatus, setFilterStatus] = useState<Filter>("all");
  const [sortField,    setSortField]    = useState<SortField>("name");
  const [sortDir,      setSortDir]      = useState<SortDir>("asc");
  const [selected,     setSelected]     = useState<Set<number>>(new Set());
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  // Inline cell edit
  const [inlineCell,  setInlineCell]  = useState<{ id: number; field: "cost_price" | "stock" } | null>(null);
  const [inlineValue, setInlineValue] = useState("");
  const inlineRef = useRef<HTMLInputElement>(null);

  // Bulk action dropdown
  const [bulkOpen, setBulkOpen] = useState(false);

  // ── Filtering & sorting ──────────────────────────────────────
  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return products
      .filter((p) => {
        if (term && !p.name.toLowerCase().includes(term) && !p.sku?.toLowerCase().includes(term)) return false;
        if (filterCat !== "all" && p.category !== filterCat) return false;
        const active = (p as any).active !== false;
        if (filterStatus === "active"    && !active)                       return false;
        if (filterStatus === "inactive"  && active)                        return false;
        if (filterStatus === "low_stock" && p.stock > 3)                   return false;
        if (filterStatus === "featured"  && !(p as any).featured)         return false;
        return true;
      })
      .sort((a, b) => {
        let va: any = a[sortField];
        let vb: any = b[sortField];
        if (typeof va === "string") va = va.toLowerCase();
        if (typeof vb === "string") vb = vb.toLowerCase();
        if (va < vb) return sortDir === "asc" ? -1 : 1;
        if (va > vb) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
  }, [products, search, filterCat, filterStatus, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const rootCats = categories.filter((c) => c.parent_id === null);

  // Reset page when filters change
  useMemo(() => { setPage(1); }, [search, filterCat, filterStatus, sortField, sortDir]);

  // ── Sort toggle ──────────────────────────────────────────────
  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  }

  // ── Selection ────────────────────────────────────────────────
  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((p) => p.id)));
  }
  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── Inline editing ───────────────────────────────────────────
  function startInline(p: Product, field: "cost_price" | "stock") {
    setInlineCell({ id: p.id, field });
    setInlineValue(String(p[field]));
    setTimeout(() => inlineRef.current?.select(), 50);
  }

  async function commitInline() {
    if (!inlineCell) return;
    const val = Number(inlineValue);
    if (isNaN(val) || val < 0) { setInlineCell(null); return; }
    await supabase.from("products").update({ [inlineCell.field]: val }).eq("id", inlineCell.id);
    setInlineCell(null);
    onRefresh();
  }

  // ── Actions ──────────────────────────────────────────────────
  async function toggleActive(p: Product) {
    await supabase.from("products").update({ active: !(p as any).active }).eq("id", p.id);
    onRefresh();
  }

  async function toggleFeatured(p: Product) {
    await supabase.from("products").update({ featured: !(p as any).featured }).eq("id", p.id);
    onRefresh();
  }

  async function duplicate(p: Product) {
    const { id, ...rest } = p as any;
    await supabase.from("products").insert({ ...rest, name: `${p.name} (copia)`, sku: p.sku ? `${p.sku}-copia` : null });
    onRefresh();
  }

  async function deleteProduct(id: number) {
    if (!confirm("¿Eliminar este producto?")) return;
    await supabase.from("products").delete().eq("id", id);
    onRefresh();
  }

  // ── Bulk actions ─────────────────────────────────────────────
  async function bulkDelete() {
    if (!confirm(`¿Eliminar ${selected.size} productos?`)) return;
    await supabase.from("products").delete().in("id", Array.from(selected));
    setSelected(new Set());
    onRefresh();
    setBulkOpen(false);
  }

  async function bulkSetActive(active: boolean) {
    await supabase.from("products").update({ active }).in("id", Array.from(selected));
    setSelected(new Set());
    onRefresh();
    setBulkOpen(false);
  }

  const colHeader = (label: string, field: SortField) => (
    <th className="px-3 py-3 text-left cursor-pointer select-none group" onClick={() => toggleSort(field)}>
      <div className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 uppercase tracking-wider group-hover:text-gray-300 transition">
        {label} <SortIcon field={field} active={sortField === field} dir={sortDir} />
      </div>
    </th>
  );

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o SKU..."
            className={`w-full border rounded-lg pl-8 pr-3 py-2 text-sm outline-none focus:border-[#2D9F6A]/50 placeholder:text-gray-500 ${dk("bg-[#232323] border-[#2a2a2a] text-white", "bg-white border-[#d4d4d4] text-[#171717]")}`} />
        </div>

        {/* Category filter */}
        <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}
          className={`border rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2D9F6A]/50 ${dk("bg-[#232323] border-[#2a2a2a] text-white", "bg-white border-[#d4d4d4] text-[#171717]")}`}>
          <option value="all">Todas las categorías</option>
          {rootCats.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>

        {/* Status filter */}
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as Filter)}
          className={`border rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2D9F6A]/50 ${dk("bg-[#232323] border-[#2a2a2a] text-white", "bg-white border-[#d4d4d4] text-[#171717]")}`}>
          <option value="all">Todos</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
          <option value="low_stock">Stock bajo (≤3)</option>
          <option value="featured">Destacados</option>
        </select>

        {/* Results count */}
        <span className="text-xs text-gray-500 ml-auto">
          {filtered.length} de {products.length} productos
        </span>

        {/* Bulk actions */}
        {selected.size > 0 && (
          <div className="relative">
            <button onClick={() => setBulkOpen((o) => !o)}
              className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg transition border ${dk("bg-[#2a2a2a] hover:bg-[#333] text-white border-[#333]", "bg-[#f0f0f0] hover:bg-[#e8e8e8] text-[#171717] border-[#d4d4d4]")}`}>
              {selected.size} seleccionados <ChevronDown size={13} />
            </button>
            {bulkOpen && (
              <div className={`absolute right-0 top-full mt-1 w-48 border rounded-xl shadow-xl z-20 py-1 ${dk("bg-[#1e1e1e] border-[#2a2a2a]", "bg-white border-[#e5e5e5]")}`}>
                <button onClick={() => bulkSetActive(true)}  className={`w-full text-left px-4 py-2 text-sm text-green-400 ${dk("hover:bg-[#2a2a2a]", "hover:bg-[#f5f5f5]")}`}>✓ Activar</button>
                <button onClick={() => bulkSetActive(false)} className={`w-full text-left px-4 py-2 text-sm text-yellow-400 ${dk("hover:bg-[#2a2a2a]", "hover:bg-[#f5f5f5]")}`}>✗ Desactivar</button>
                <div className={`border-t my-1 ${dk("border-[#2a2a2a]", "border-[#e5e5e5]")}`} />
                <button onClick={bulkDelete} className={`w-full text-left px-4 py-2 text-sm text-red-400 ${dk("hover:bg-[#2a2a2a]", "hover:bg-[#f5f5f5]")}`}>🗑 Eliminar selección</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className={`border rounded-xl overflow-hidden ${dk("bg-[#232323] border-[#2a2a2a]", "bg-white border-[#e5e5e5]")}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className={`border-b ${dk("bg-[#1a1a1a] border-[#2a2a2a]", "bg-[#f5f5f5] border-[#e5e5e5]")}`}>
              <tr>
                <th className="px-3 py-3 w-8">
                  <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={toggleAll}
                    className="accent-[#2D9F6A] w-3.5 h-3.5 cursor-pointer" />
                </th>
                <th className="px-3 py-3 w-12" />
                {colHeader("Nombre", "name")}
                <th className="px-3 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">SKU</th>
                {colHeader("Categoría", "category")}
                {colHeader("Precio costo", "cost_price")}
                <th className="px-3 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">P.+IVA</th>
                {colHeader("Stock", "stock")}
                <th className="px-3 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-3 py-3 w-28" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-16 text-gray-500 text-sm">
                    No se encontraron productos
                  </td>
                </tr>
              ) : paginated.map((p) => {
                const active   = (p as any).active !== false;
                const featured = (p as any).featured === true;
                const lowStock = p.stock <= 3 && p.stock > 0;
                const noStock  = p.stock === 0;
                const isSelected = selected.has(p.id);

                return (
                  <tr key={p.id}
                    className={`border-t transition ${dk("border-[#2a2a2a]", "border-[#f0f0f0]")} ${isSelected ? "bg-[#2D9F6A]/5" : dk("hover:bg-[#2a2a2a]/40", "hover:bg-[#fafafa]")} ${!active ? "opacity-50" : ""}`}>

                    {/* Checkbox */}
                    <td className="px-3 py-3">
                      <input type="checkbox" checked={isSelected} onChange={() => toggleOne(p.id)}
                        className="accent-[#2D9F6A] w-3.5 h-3.5 cursor-pointer" />
                    </td>

                    {/* Thumb */}
                    <td className="px-3 py-3">
                      <img src={p.image || "/placeholder.png"} alt=""
                        className="h-9 w-9 object-contain rounded-lg bg-[#151515] p-0.5" />
                    </td>

                    {/* Name */}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        {featured && <Star size={11} className="text-yellow-400 shrink-0" fill="currentColor" />}
                        <span className={`font-medium line-clamp-1 ${dk("text-white", "text-[#171717]")}`}>
                          {(p as any).name_custom?.trim() || p.name}
                        </span>
                        {(p as any).name_custom?.trim() && (
                          <span title={`Original: ${(p as any).name_original ?? p.name}`}
                            className="shrink-0 text-[9px] font-bold px-1 py-0.5 rounded bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">
                            custom
                          </span>
                        )}
                      </div>
                      {(p as any).tags?.length > 0 && (
                        <div className="flex gap-1 mt-0.5 flex-wrap">
                          {(p as any).tags.slice(0, 3).map((t: string) => (
                            <span key={t} className={`text-[10px] ${dk("bg-[#1a1a1a]", "bg-[#f0f0f0]")} text-gray-500 px-1.5 rounded`}>{t}</span>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* SKU */}
                    <td className="px-3 py-3 text-xs text-gray-500 font-mono">{p.sku || "—"}</td>

                    {/* Category */}
                    <td className="px-3 py-3 text-xs text-gray-400">{p.category}</td>

                    {/* Price — inline editable */}
                    <td className="px-3 py-3"
                      onDoubleClick={() => startInline(p, "cost_price")}>
                      {inlineCell?.id === p.id && inlineCell.field === "cost_price" ? (
                        <input ref={inlineRef} type="number" value={inlineValue}
                          onChange={(e) => setInlineValue(e.target.value)}
                          onBlur={commitInline}
                          onKeyDown={(e) => { if (e.key === "Enter") commitInline(); if (e.key === "Escape") setInlineCell(null); }}
                          className={`w-24 border border-[#2D9F6A] rounded px-2 py-0.5 text-sm outline-none ${dk("bg-[#181818] text-white", "bg-white text-[#171717]")}`} />
                      ) : (
                        <div>
                          <span className={`font-medium cursor-pointer hover:text-[#2D9F6A] transition ${dk("text-white", "text-[#171717]")}`} title="Doble click para editar">
                            ${p.cost_price.toLocaleString()}
                          </span>
                          <span className={`ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                            (p as any).iva_rate === 10.5
                              ? "text-blue-400 bg-blue-400/10 border-blue-400/20"
                              : "text-[#2D9F6A] bg-[#2D9F6A]/10 border-[#2D9F6A]/20"
                          }`}>
                            IVA {(p as any).iva_rate ?? 21}%
                          </span>
                        </div>
                      )}
                    </td>

                    {/* P.+IVA */}
                    <td className="px-3 py-3">
                      <span className={`text-sm tabular-nums ${dk("text-gray-400", "text-[#525252]")}`}>
                        ${(p.cost_price * (1 + ((p as any).iva_rate ?? 21) / 100)).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                      </span>
                    </td>

                    {/* Stock — inline editable */}
                    <td className="px-3 py-3"
                      onDoubleClick={() => startInline(p, "stock")}>
                      {inlineCell?.id === p.id && inlineCell.field === "stock" ? (
                        <input ref={inlineRef} type="number" value={inlineValue}
                          onChange={(e) => setInlineValue(e.target.value)}
                          onBlur={commitInline}
                          onKeyDown={(e) => { if (e.key === "Enter") commitInline(); if (e.key === "Escape") setInlineCell(null); }}
                          className={`w-16 border border-[#2D9F6A] rounded px-2 py-0.5 text-sm outline-none ${dk("bg-[#181818] text-white", "bg-white text-[#171717]")}`} />
                      ) : (
                        <span className={`font-semibold text-sm cursor-pointer transition flex items-center gap-1 ${
                          noStock ? "text-red-400" : lowStock ? "text-yellow-400" : "text-green-400 hover:text-green-300"
                        }`} title="Doble click para editar">
                          {(lowStock || noStock) && <AlertTriangle size={11} />}
                          {p.stock}u
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-3 py-3">
                      <button onClick={() => toggleActive(p)}
                        className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border transition ${
                          active
                            ? "bg-green-500/15 text-green-400 border-green-500/30 hover:bg-red-500/15 hover:text-red-400 hover:border-red-500/30"
                            : "bg-red-500/15 text-red-400 border-red-500/30 hover:bg-green-500/15 hover:text-green-400 hover:border-green-500/30"
                        }`}>
                        {active ? "Activo" : "Inactivo"}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => toggleFeatured(p)} title={featured ? "Quitar destacado" : "Destacar"}
                          className={`p-1.5 rounded-lg transition ${featured ? "text-yellow-400 hover:bg-yellow-500/10" : "text-gray-600 hover:text-yellow-400 hover:bg-yellow-500/10"}`}>
                          <Star size={13} fill={featured ? "currentColor" : "none"} />
                        </button>
                        <button onClick={() => setEditingProduct(p)} title="Editar"
                          className={`p-1.5 rounded-lg text-gray-500 transition ${dk("hover:text-white hover:bg-[#333]", "hover:text-[#171717] hover:bg-[#e8e8e8]")}`}>
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => duplicate(p)} title="Duplicar"
                          className="p-1.5 rounded-lg text-gray-500 hover:text-[#2D9F6A] hover:bg-[#2D9F6A]/10 transition">
                          <Copy size={13} />
                        </button>
                        <button onClick={() => deleteProduct(p.id)} title="Eliminar"
                          className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-gray-500">
            Página {page} de {totalPages} · {filtered.length} productos
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className={`px-3 py-1.5 text-xs rounded-lg border transition disabled:opacity-30 ${dk("border-[#2a2a2a] text-gray-400 hover:text-white hover:bg-[#1c1c1c]", "border-[#e5e5e5] text-[#737373] hover:bg-[#f5f5f5]")}`}
            >
              ← Ant.
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className={`px-3 py-1.5 text-xs rounded-lg border transition disabled:opacity-30 ${dk("border-[#2a2a2a] text-gray-400 hover:text-white hover:bg-[#1c1c1c]", "border-[#e5e5e5] text-[#737373] hover:bg-[#f5f5f5]")}`}
            >
              Sig. →
            </button>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingProduct && (
        <ProductEditModal
          product={editingProduct}
          categories={categories}
          onSave={(updated) => { onRefresh(); }}
          onClose={() => setEditingProduct(null)}
        />
      )}
    </>
  );
}
