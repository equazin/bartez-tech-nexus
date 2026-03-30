import { useState, useMemo } from "react";
import { Search, Tag, ToggleLeft, ToggleRight, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { Product, displayName } from "@/models/products";
import ProductEditModal from "@/components/admin/ProductEditModal";
import { PosSubcategory, PosProductEntry, posStorage } from "./types";

interface Category { id: number; name: string; parent_id: number | null; }
interface BrandOption { id: string; name: string; }

interface Props {
  products: Product[];
  categories: Category[];
  brands?: BrandOption[];
  onRefreshProducts: () => void;
  isDark?: boolean;
}

function normalizeName(v: string | null | undefined) {
  return String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function isPosRootCategory(name: string): boolean {
  const n = normalizeName(name);
  return n.includes("punto de venta") || /\bpos\b/.test(n);
}

/** Builds the set of all category names that belong to the POS tree (root + all descendants). */
function buildPosCategoryNames(categories: { id: number; name: string; parent_id: number | null }[]): Set<string> {
  const posRootIds = new Set(
    categories.filter((c) => isPosRootCategory(c.name)).map((c) => c.id)
  );
  // BFS to collect all descendant IDs
  const posIds = new Set(posRootIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const c of categories) {
      if (!posIds.has(c.id) && c.parent_id !== null && posIds.has(c.parent_id)) {
        posIds.add(c.id);
        changed = true;
      }
    }
  }
  return new Set(
    categories.filter((c) => posIds.has(c.id)).map((c) => normalizeName(c.name))
  );
}

export function PosProductsTab({ products, categories, brands, onRefreshProducts, isDark }: Props) {
  const dk = (d: string, l: string) => (isDark ? d : l);

  const [posEntries, setPosEntries] = useState<PosProductEntry[]>(() => posStorage.loadProducts());
  const subcats = useMemo(() => posStorage.loadSubcategories(), []);

  /** All category names in the POS tree (including subcategories from DB) */
  const posCategoryNames = useMemo(() => buildPosCategoryNames(categories), [categories]);

  const [filterSubcat, setFilterSubcat] = useState("all");
  const [filterStock,  setFilterStock]  = useState("all");
  const [search,       setSearch]       = useState("");
  const [editProduct,  setEditProduct]  = useState<Product | null>(null);
  const [showAll,      setShowAll]      = useState(false);

  const posIds = useMemo(() => new Set(posEntries.map((e) => e.productId)), [posEntries]);

  function getSubcatId(productId: number): string {
    return posEntries.find((e) => e.productId === productId)?.subcategoryId ?? "";
  }

  function togglePos(p: Product) {
    const next = posIds.has(p.id)
      ? posEntries.filter((e) => e.productId !== p.id)
      : [...posEntries, { productId: p.id, subcategoryId: "" }];
    setPosEntries(next);
    posStorage.saveProducts(next);
  }

  function setSubcat(productId: number, subcategoryId: string) {
    const next = posEntries.map((e) =>
      e.productId === productId ? { ...e, subcategoryId } : e
    );
    setPosEntries(next);
    posStorage.saveProducts(next);
  }

  function removeFromPos(productId: number) {
    const next = posEntries.filter((e) => e.productId !== productId);
    setPosEntries(next);
    posStorage.saveProducts(next);
  }

  const needle = search.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const visibleProducts = useMemo(() => {
    let list = showAll ? products : products.filter((p) => posIds.has(p.id) || posCategoryNames.has(normalizeName(p.category)));
    if (search) {
      list = list.filter((p) =>
        displayName(p).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(needle) ||
        (p.sku ?? "").toLowerCase().includes(needle)
      );
    }
    if (filterSubcat !== "all") {
      list = list.filter((p) => getSubcatId(p.id) === filterSubcat);
    }
    if (filterStock === "low")  list = list.filter((p) => (p.stock ?? 0) <= 3);
    if (filterStock === "zero") list = list.filter((p) => (p.stock ?? 0) === 0);
    return list;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, posIds, posEntries, search, filterSubcat, filterStock, showAll]);

  const posCount = products.filter((p) => posIds.has(p.id) || posCategoryNames.has(normalizeName(p.category))).length;

  const selectCls = `border rounded-lg px-2 py-1.5 text-xs outline-none ${dk(
    "bg-[#0d0d0d] border-[#262626] text-[#737373]",
    "bg-white border-[#e5e5e5] text-[#525252]"
  )}`;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className={`flex items-center gap-1.5 border rounded-lg px-2.5 py-1.5 flex-1 min-w-[180px] ${dk("bg-[#0d0d0d] border-[#262626]", "bg-white border-[#e5e5e5]")}`}>
          <Search size={13} className="text-gray-500 shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar nombre o SKU…"
            className={`flex-1 bg-transparent text-xs outline-none ${dk("text-white placeholder:text-[#404040]", "text-[#171717] placeholder:text-gray-400")}`}
          />
        </div>

        <select value={filterSubcat} onChange={(e) => setFilterSubcat(e.target.value)} className={selectCls}>
          <option value="all">Todas las subcategorías</option>
          {subcats.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <select value={filterStock} onChange={(e) => setFilterStock(e.target.value)} className={selectCls}>
          <option value="all">Stock: todos</option>
          <option value="low">Bajo stock (≤3)</option>
          <option value="zero">Sin stock</option>
        </select>

        <button
          onClick={() => setShowAll((v) => !v)}
          className={`text-xs px-3 py-1.5 rounded-lg border transition font-semibold ${
            showAll
              ? dk("bg-[#2D9F6A]/20 border-[#2D9F6A]/40 text-[#2D9F6A]", "bg-[#f0faf5] border-[#2D9F6A]/30 text-[#1a7a50]")
              : dk("bg-[#0d0d0d] border-[#262626] text-[#737373] hover:text-white", "bg-white border-[#e5e5e5] text-[#737373] hover:text-[#171717]")
          }`}
        >
          {showAll ? "Mostrando todos" : `POS (${posCount})`}
        </button>
      </div>

      {/* Table */}
      <div className={`rounded-xl border overflow-hidden ${dk("border-[#1f1f1f]", "border-[#e5e5e5]")}`}>
        {/* Header */}
        <div className={`grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-x-3 items-center px-4 py-2 text-[10px] font-bold uppercase tracking-widest ${dk("bg-[#0d0d0d] text-[#525252]", "bg-[#f5f5f5] text-[#a3a3a3]")}`}>
          <span>POS</span>
          <span>Producto</span>
          <span className="w-36">Subcategoría</span>
          <span className="w-16 text-right">Precio</span>
          <span className="w-14 text-right">Stock</span>
          <span className="w-16 text-right">Acciones</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-[#1a1a1a]">
          {visibleProducts.length === 0 && (
            <div className={`px-4 py-10 text-center text-xs ${dk("text-[#525252]", "text-[#a3a3a3]")}`}>
              {showAll ? "No hay productos que coincidan." : "No hay productos POS. Activá el toggle en cualquier producto."}
            </div>
          )}

          {visibleProducts.map((p) => {
            const isPOS    = posIds.has(p.id) || posCategoryNames.has(normalizeName(p.category));
            const stock    = p.stock ?? 0;
            const lowStock = stock <= 3;
            const name     = displayName(p);

            return (
              <div
                key={p.id}
                className={`grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-x-3 items-center px-4 py-2.5 transition ${dk("hover:bg-[#0f0f0f]", "hover:bg-[#fafafa]")}`}
              >
                {/* POS toggle */}
                <button onClick={() => togglePos(p)} title={isPOS ? "Quitar de POS" : "Marcar como POS"}>
                  {isPOS
                    ? <ToggleRight size={22} className="text-[#2D9F6A]" />
                    : <ToggleLeft  size={22} className="text-gray-600" />
                  }
                </button>

                {/* Name + SKU */}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    {p.image
                      ? <img src={p.image} alt="" className="h-7 w-7 rounded object-cover shrink-0" />
                      : <div className={`h-7 w-7 rounded shrink-0 ${dk("bg-[#1a1a1a]", "bg-[#f0f0f0]")}`} />
                    }
                    <div className="min-w-0">
                      <p className={`text-xs font-semibold truncate ${dk("text-white", "text-[#171717]")}`}>{name}</p>
                      {p.sku && <p className="text-[10px] text-gray-500">{p.sku}</p>}
                    </div>
                  </div>
                </div>

                {/* Subcategory select */}
                <select
                  value={getSubcatId(p.id)}
                  onChange={(e) => {
                    if (!isPOS) togglePos(p);
                    setSubcat(p.id, e.target.value);
                  }}
                  className={`w-36 border rounded-lg px-2 py-1 text-xs outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-[#737373]", "bg-white border-[#e5e5e5] text-[#525252]")}`}
                >
                  <option value="">Sin subcategoría</option>
                  {posStorage.loadSubcategories().map((s: PosSubcategory) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>

                {/* Price */}
                <span className={`w-16 text-right text-xs font-mono ${dk("text-white", "text-[#171717]")}`}>
                  ${p.cost_price.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                </span>

                {/* Stock */}
                <span className={`w-14 text-right text-xs font-semibold flex items-center justify-end gap-1 ${lowStock ? "text-amber-400" : dk("text-white", "text-[#171717]")}`}>
                  {lowStock && <AlertTriangle size={11} />}
                  {stock}u
                </span>

                {/* Actions */}
                <div className="w-16 flex items-center justify-end gap-1">
                  <button
                    onClick={() => setEditProduct(p)}
                    className="text-gray-500 hover:text-[#2D9F6A] transition p-1"
                    title="Editar"
                  >
                    <Pencil size={13} />
                  </button>
                  {isPOS && !posCategoryNames.has(normalizeName(p.category)) && (
                    <button
                      onClick={() => removeFromPos(p.id)}
                      className="text-gray-500 hover:text-red-400 transition p-1"
                      title="Quitar de POS"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                  {posCategoryNames.has(normalizeName(p.category)) && (
                    <Tag size={13} className="text-[#2D9F6A]" title="Categoría POS" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit modal */}
      {editProduct && (
        <ProductEditModal
          product={editProduct}
          categories={categories}
          brands={brands}
          onSave={(updated) => {
            setEditProduct(null);
            onRefreshProducts();
            void updated;
          }}
          onClose={() => setEditProduct(null)}
        />
      )}
    </div>
  );
}
