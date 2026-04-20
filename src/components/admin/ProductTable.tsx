import { useState, useMemo, useRef, useEffect } from "react";
import { useCurrency } from "@/context/CurrencyContext";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { backend, hasBackendUrl } from "@/lib/api/backend";
import { toggleSetValue } from "@/lib/toggleSet";
import { Product } from "@/models/products";
import ProductEditModal from "./ProductEditModal";
import {
  Search, ArrowUpDown, ArrowUp, ArrowDown,
  Pencil, Copy, Trash2, Star, AlertTriangle, ChevronDown, RefreshCw,
  X,
} from "lucide-react";

interface Category { id: number; name: string; parent_id: number | null; }
interface BrandOption { id: string; name: string; }
interface Props {
  products: Product[];
  categories: Category[];
  brands?: BrandOption[];
  apiSourcesByProductId?: Record<number, Array<"AIR" | "ELIT" | "INVID">>;
  isDark?: boolean;
  onRefresh: () => void;
}

type SortField = "name" | "cost_price" | "stock" | "category";
type SortDir   = "asc" | "desc";
type Filter    = "all" | "active" | "inactive" | "low_stock" | "featured";
type DuplicateGroupType = "sku" | "name" | "similar";
const POS_FILTER_VALUE = "__pos__";

interface DuplicateGroup {
  id: string;
  type: DuplicateGroupType;
  key: string;
  title: string;
  reason: string;
  confidence: number;
  products: Product[];
}

function SortIcon({ field, active, dir }: { field: string; active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown size={12} className="text-muted-foreground" />;
  return dir === "asc" ? <ArrowUp size={12} className="text-primary" /> : <ArrowDown size={12} className="text-primary" />;
}

function normalizeForMatch(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ");
}

function normalizeCompact(value: string | null | undefined): string {
  return normalizeForMatch(value).replace(/\s+/g, "");
}

function isPosCategoryName(value: string | null | undefined): boolean {
  const normalized = normalizeForMatch(value);
  return normalized.includes("punto de venta") || /\bpos\b/.test(normalized);
}

function getDisplayName(product: Product): string {
  return product.name_custom?.trim() || product.name_original?.trim() || product.name || "";
}

function getProductSpecsObject(product: Product): Record<string, unknown> {
  const raw = product.specs as unknown;
  if (!raw) return {};
  if (typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

function readProductSpec(product: Product, key: string): string {
  const value = getProductSpecsObject(product)[key];
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeApiSupplierLabel(value: string | null | undefined): "AIR" | "ELIT" | "INVID" | null {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return null;
  if (raw.includes("air")) return "AIR";
  if (raw.includes("elit")) return "ELIT";
  if (raw.includes("invid")) return "INVID";
  return null;
}

function inferApiSuppliers(
  product: Product,
  explicitSources: Array<"AIR" | "ELIT" | "INVID"> = []
): Array<"AIR" | "ELIT" | "INVID"> {
  const found = new Set<"AIR" | "ELIT" | "INVID">();
  explicitSources.forEach((source) => found.add(source));

  const fromSyncSupplier = normalizeApiSupplierLabel(readProductSpec(product, "sync_supplier"));
  if (fromSyncSupplier) found.add(fromSyncSupplier);

  const fromPreferredName = normalizeApiSupplierLabel(readProductSpec(product, "preferred_supplier_name"));
  if (fromPreferredName) found.add(fromPreferredName);

  const fromSupplierName = normalizeApiSupplierLabel(product.supplier_name);
  if (fromSupplierName) found.add(fromSupplierName);

  const fromSupplierSource = normalizeApiSupplierLabel(readProductSpec(product, "supplier_source"));
  if (fromSupplierSource) found.add(fromSupplierSource);

  const specKeys = Object.keys(getProductSpecsObject(product));
  if (specKeys.some((key) => key.toLowerCase().startsWith("air_"))) found.add("AIR");
  if (specKeys.some((key) => key.toLowerCase().startsWith("elit_"))) found.add("ELIT");
  if (specKeys.some((key) => key.toLowerCase().startsWith("invid_"))) found.add("INVID");
  if (specKeys.some((key) => key.toLowerCase() === "lug_stock")) found.add("AIR");

  return Array.from(found);
}

function tokenizeForMatch(value: string): string[] {
  const stopWords = new Set([
    "con", "para", "por", "del", "de", "the", "and",
    "producto", "notebook", "laptop", "pc", "cpu", "ssd", "hdd", "disco",
  ]);
  return normalizeForMatch(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !stopWords.has(token));
}

function buildDuplicateGroups(products: Product[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const seenFingerprints = new Set<string>();

  const addGroup = (
    type: DuplicateGroupType,
    key: string,
    title: string,
    reason: string,
    confidence: number,
    sourceProducts: Product[]
  ) => {
    const unique = Array.from(new Map(sourceProducts.map((p) => [p.id, p])).values());
    if (unique.length < 2) return;
    const fingerprint = unique.map((p) => p.id).sort((a, b) => a - b).join(",");
    if (!fingerprint || seenFingerprints.has(`${type}:${fingerprint}`)) return;
    seenFingerprints.add(`${type}:${fingerprint}`);
    groups.push({
      id: `${type}:${key}:${fingerprint}`,
      type,
      key,
      title,
      reason,
      confidence,
      products: unique.sort((a, b) => a.id - b.id),
    });
  };

  const skuMap = new Map<string, Product[]>();
  const nameMap = new Map<string, Product[]>();
  const similarMap = new Map<string, Product[]>();

  for (const product of products) {
    const sku = normalizeCompact(product.sku);
    if (sku) {
      const list = skuMap.get(sku) ?? [];
      list.push(product);
      skuMap.set(sku, list);
    }

    const normalizedName = normalizeForMatch(getDisplayName(product));
    if (normalizedName) {
      const list = nameMap.get(normalizedName) ?? [];
      list.push(product);
      nameMap.set(normalizedName, list);
    }

    const tokens = tokenizeForMatch(getDisplayName(product));
    if (tokens.length >= 2) {
      const signature = [
        normalizeCompact(product.brand_name || ""),
        normalizeForMatch(product.category || "").split(" ")[0],
        tokens.slice(0, 4).join(" "),
      ].join("|");
      const list = similarMap.get(signature) ?? [];
      list.push(product);
      similarMap.set(signature, list);
    }
  }

  for (const [sku, list] of skuMap.entries()) {
    if (list.length > 1) {
      addGroup("sku", sku, `SKU repetido: ${sku}`, "Mismo SKU en varios productos", 1, list);
    }
  }

  for (const [nameKey, list] of nameMap.entries()) {
    if (list.length > 1) {
      addGroup("name", nameKey, "Titulo exacto repetido", "Mismo titulo normalizado", 0.95, list);
    }
  }

  for (const [signature, list] of similarMap.entries()) {
    if (list.length > 1) {
      addGroup("similar", signature, "Titulos muy parecidos", "Coincidencia por tokens, marca/categoria", 0.7, list);
    }
  }

  return groups.sort((a, b) => {
    if (a.type !== b.type) {
      const order: Record<DuplicateGroupType, number> = { sku: 0, name: 1, similar: 2 };
      return order[a.type] - order[b.type];
    }
    if (a.products.length !== b.products.length) return b.products.length - a.products.length;
    return b.confidence - a.confidence;
  });
}

export default function ProductTable({
  products,
  categories,
  brands = [],
  apiSourcesByProductId = {},
  isDark = true,
  onRefresh,
}: Props) {
  const { formatPrice } = useCurrency();
  const dk = (d: string, l: string) => isDark ? d : l;
  const [search,       setSearch]       = useState("");
  const [filterCat,    setFilterCat]    = useState("all");
  const [filterBrand,  setFilterBrand]  = useState("all");
  const [filterStatus, setFilterStatus] = useState<Filter>("all");
  const [sortField,    setSortField]    = useState<SortField>("name");
  const [sortDir,      setSortDir]      = useState<SortDir>("asc");
  const [selected,     setSelected]     = useState<Set<number>>(new Set());
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 40;

  // Inline cell edit
  const [inlineCell,  setInlineCell]  = useState<{ id: number; field: "cost_price" | "stock" } | null>(null);
  const [inlineValue, setInlineValue] = useState("");
  const inlineRef = useRef<HTMLInputElement>(null);

  // Bulk action dropdown
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkBrand, setBulkBrand] = useState("");
  const [duplicatesOpen, setDuplicatesOpen] = useState(false);
  const [analyzingDuplicates, setAnalyzingDuplicates] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [duplicateFilter, setDuplicateFilter] = useState<DuplicateGroupType | "all">("all");
  const [duplicateSearch, setDuplicateSearch] = useState("");

  const rootCats = categories.filter((c) => c.parent_id === null);
  const allCategoryNames = useMemo(() => {
    const names = new Set<string>();
    categories.forEach((c) => {
      const name = c.name?.trim();
      if (name) names.add(name);
    });
    products.forEach((p) => {
      const name = p.category?.trim();
      if (name) names.add(name);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, "es"));
  }, [categories, products]);

  // Build set of category names that match the selected filter:
  // if a root cat is selected, include its children too
  const matchingCatNames = useMemo(() => {
    if (filterCat === "all" || filterCat === POS_FILTER_VALUE) return null;
    const sel = categories.find((c) => c.name === filterCat);
    if (!sel) return new Set([filterCat.toLowerCase()]);
    const names = new Set<string>([sel.name.toLowerCase()]);
    categories
      .filter((c) => c.parent_id === sel.id)
      .forEach((c) => names.add(c.name.toLowerCase()));
    return names;
  }, [filterCat, categories]);

  const posCategoryNames = useMemo(() => {
    if (categories.length === 0) return new Set<string>();
    const byId = new Map(categories.map((cat) => [cat.id, cat]));
    const roots = categories.filter((cat) => isPosCategoryName(cat.name));
    const out = new Set<string>();

    for (const root of roots) {
      const stack = [root.id];
      while (stack.length > 0) {
        const currentId = stack.pop()!;
        const current = byId.get(currentId);
        if (!current) continue;
        out.add(normalizeForMatch(current.name));
        for (const child of categories) {
          if (child.parent_id === currentId) stack.push(child.id);
        }
      }
    }
    return out;
  }, [categories]);

  function isPosProductMatch(product: Product): boolean {
    const categoryName = normalizeForMatch(product.category);
    if (!categoryName) return false;
    if (posCategoryNames.size > 0) return posCategoryNames.has(categoryName);
    return isPosCategoryName(product.category);
  }

  // ── Filtering & sorting ──────────────────────────────────────
  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    const posFilterEnabled = filterCat === POS_FILTER_VALUE;
    return products
      .filter((p) => {
        if (term && !p.name.toLowerCase().includes(term) && !p.sku?.toLowerCase().includes(term)) return false;
        if (posFilterEnabled && !isPosProductMatch(p)) return false;
        if (matchingCatNames && !matchingCatNames.has((p.category ?? "").toLowerCase())) return false;
        if (filterBrand !== "all" && p.brand_id !== filterBrand) return false;
        const active = p.active !== false;
        if (filterStatus === "active"    && !active)                       return false;
        if (filterStatus === "inactive"  && active)                        return false;
        if (filterStatus === "low_stock" && p.stock > 3)                   return false;
        if (filterStatus === "featured"  && !p.featured)                   return false;
        return true;
      })
      .sort((a, b) => {
        let va: string | number = a[sortField];
        let vb: string | number = b[sortField];
        if (typeof va === "string") va = va.toLowerCase();
        if (typeof vb === "string") vb = vb.toLowerCase();
        if (va < vb) return sortDir === "asc" ? -1 : 1;
        if (va > vb) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
  }, [products, search, filterCat, matchingCatNames, filterBrand, filterStatus, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const allVisibleSelected = paginated.length > 0 && paginated.every((product) => selected.has(product.id));

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, filterCat, filterBrand, filterStatus, sortField, sortDir]);

  useEffect(() => {
    if (!duplicatesOpen) return;
    setDuplicateGroups(buildDuplicateGroups(products));
  }, [products, duplicatesOpen]);

  const visibleDuplicateGroups = useMemo(() => {
    const q = duplicateSearch.trim().toLowerCase();
    return duplicateGroups.filter((group) => {
      if (duplicateFilter !== "all" && group.type !== duplicateFilter) return false;
      if (!q) return true;
      const haystack = [
        group.title,
        group.reason,
        ...group.products.map((p) => `${p.id} ${getDisplayName(p)} ${p.sku || ""} ${p.category || ""}`),
      ].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [duplicateGroups, duplicateFilter, duplicateSearch]);

  const duplicateCounters = useMemo(() => {
    return {
      all: duplicateGroups.length,
      sku: duplicateGroups.filter((g) => g.type === "sku").length,
      name: duplicateGroups.filter((g) => g.type === "name").length,
      similar: duplicateGroups.filter((g) => g.type === "similar").length,
    };
  }, [duplicateGroups]);

  async function openDuplicateAnalyzer() {
    setAnalyzingDuplicates(true);
    setDuplicateSearch("");
    setDuplicateFilter("all");
    await new Promise((resolve) => setTimeout(resolve, 10));
    setDuplicateGroups(buildDuplicateGroups(products));
    setDuplicatesOpen(true);
    setAnalyzingDuplicates(false);
  }

  // ── Sort toggle ──────────────────────────────────────────────
  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  }

  // ── Selection ────────────────────────────────────────────────
  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);

      if (allVisibleSelected) {
        paginated.forEach((product) => next.delete(product.id));
      } else {
        paginated.forEach((product) => next.add(product.id));
      }

      return next;
    });
  }
  function toggleOne(id: number) {
    setSelected((prev) => toggleSetValue(prev, id));
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
    if (hasBackendUrl) {
      if (inlineCell.field === "stock") {
        const product = products.find((p) => p.id === inlineCell.id);
        const delta = val - (product?.stock ?? 0);
        if (delta !== 0) {
          await backend.products.adjustStock(inlineCell.id, { delta });
        }
      } else {
        await backend.products.update(inlineCell.id, { [inlineCell.field]: val });
      }
    } else {
      await supabase.from("products").update({ [inlineCell.field]: val }).eq("id", inlineCell.id);
    }
    setInlineCell(null);
    onRefresh();
  }

  // ── Actions ──────────────────────────────────────────────────
  async function toggleActive(p: Product) {
    if (hasBackendUrl) {
      await backend.products.update(p.id, { active: !p.active });
    } else {
      await supabase.from("products").update({ active: !p.active }).eq("id", p.id);
    }
    onRefresh();
  }

  async function toggleFeatured(p: Product) {
    if (hasBackendUrl) {
      await backend.products.update(p.id, { featured: !p.featured });
    } else {
      await supabase.from("products").update({ featured: !p.featured }).eq("id", p.id);
    }
    onRefresh();
  }

  async function duplicate(p: Product) {
    const { id: _id, ...rest } = p;
    await supabase.from("products").insert({ ...rest, name: `${p.name} (copia)`, sku: p.sku ? `${p.sku}-copia` : null });
    onRefresh();
  }

  async function deleteProduct(id: number) {
    if (!confirm("¿Eliminar este producto?")) return;
    await supabase.from("products").delete().eq("id", id);
    onRefresh();
  }

  // ── Bulk actions ─────────────────────────────────────────────
  async function keepOnlyProduct(group: DuplicateGroup, keepId: number) {
    const toDelete = group.products.map((p) => p.id).filter((id) => id !== keepId);
    if (toDelete.length === 0) return;
    if (!confirm(`Se eliminaran ${toDelete.length} productos de este grupo. Continuar?`)) return;
    const { error } = await supabase.from("products").delete().in("id", toDelete);
    if (error) return;
    setDuplicateGroups((prev) =>
      prev
        .map((g) => ({ ...g, products: g.products.filter((p) => !toDelete.includes(p.id)) }))
        .filter((g) => g.products.length > 1)
    );
    onRefresh();
  }

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

  async function bulkSetCategory() {
    const category = bulkCategory.trim();
    if (!category || selected.size === 0) return;
    await supabase.from("products").update({ category }).in("id", Array.from(selected));
    setSelected(new Set());
    setBulkCategory("");
    onRefresh();
    setBulkOpen(false);
  }

  async function bulkSetBrand() {
    if (!bulkBrand || selected.size === 0) return;
    
    // Find the brand object to get the name for denormalization
    const selectedBrand = brands.find((b) => String(b.id) === String(bulkBrand));
    if (!selectedBrand) {
      toast.error("No se pudo encontrar la marca seleccionada en la lista local.");
      return;
    }

    const { error } = await supabase
      .from("products")
      .update({ 
        brand_id: bulkBrand,
        brand_name: selectedBrand.name 
      })
      .in("id", Array.from(selected));

    if (error) {
      console.error("Error updating brands:", error);
      toast.error("Error al actualizar las marcas: " + error.message);
      return;
    }

    toast.success(`${selected.size} productos actualizados a la marca ${selectedBrand.name}`);
    setSelected(new Set());
    setBulkBrand("");
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
      <div className="relative z-30 flex flex-wrap items-center gap-2 mb-3">
        {/* Search */}
        <div className="relative w-[320px] min-w-[320px] shrink-0">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o SKU..."
            className={`w-full border rounded-lg pl-8 pr-3 py-2 text-sm outline-none focus:border-[#2D9F6A]/50 placeholder:text-gray-500 ${dk("bg-[#232323] border-[#2a2a2a] text-white", "bg-white border-[#d4d4d4] text-[#171717]")}`} />
        </div>

        {/* Category filter */}
        <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}
          className={`border rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2D9F6A]/50 ${dk("bg-[#232323] border-[#2a2a2a] text-white", "bg-white border-[#d4d4d4] text-[#171717]")}`}>
          <option value="all">Todas las categorías</option>
          <option value={POS_FILTER_VALUE}>Punto de Venta (POS)</option>
          {rootCats.map((root) => [
            <option key={root.id} value={root.name}>{root.name}</option>,
            ...categories
              .filter((c) => c.parent_id === root.id)
              .map((c) => <option key={c.id} value={c.name}>{"  · "}{c.name}</option>),
          ])}
        </select>

        {/* Brand filter */}
        {brands.length > 0 && (
          <select value={filterBrand} onChange={(e) => setFilterBrand(e.target.value)}
            className={`border rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2D9F6A]/50 ${dk("bg-[#232323] border-[#2a2a2a] text-white", "bg-white border-[#d4d4d4] text-[#171717]")}`}>
            <option value="all">Todas las marcas</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}

        {/* Status filter */}
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as Filter)}
          className={`border rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2D9F6A]/50 ${dk("bg-[#232323] border-[#2a2a2a] text-white", "bg-white border-[#d4d4d4] text-[#171717]")}`}>
          <option value="all">Todos</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
          <option value="low_stock">Stock bajo (≤3)</option>
          <option value="featured">Destacados</option>
        </select>

        <div className="ml-auto flex items-center gap-2">
          {/* Results count */}
          <span className="text-xs text-gray-500 whitespace-nowrap">
            {filtered.length} de {products.length} productos
          </span>

        <button
          onClick={() => { void openDuplicateAnalyzer(); }}
          disabled={analyzingDuplicates}
          className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg transition border disabled:opacity-50 ${
            dk("bg-[#232323] hover:bg-[#2b2b2b] text-white border-[#333]", "bg-white hover:bg-[#f5f5f5] text-[#171717] border-[#d4d4d4]")
          }`}
          title="Busca productos con SKU duplicado, titulo igual o titulo similar"
        >
          {analyzingDuplicates ? <RefreshCw size={13} className="animate-spin" /> : <AlertTriangle size={13} />}
          {analyzingDuplicates ? "Analizando..." : "Analizar duplicados"}
        </button>

        {/* Bulk actions */}
        {selected.size > 0 && (
          <div className="relative z-[70] shrink-0">
            <button onClick={() => setBulkOpen((o) => !o)}
              className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg transition border ${dk("bg-[#2a2a2a] hover:bg-[#333] text-white border-[#333]", "bg-[#f0f0f0] hover:bg-[#e8e8e8] text-[#171717] border-[#d4d4d4]")}`}>
              {selected.size} seleccionados <ChevronDown size={13} />
            </button>
            {bulkOpen && (
              <div className={`absolute right-0 top-full mt-1 w-72 max-h-[65vh] overflow-y-auto overscroll-contain border rounded-xl shadow-2xl z-[90] py-1 ${dk("bg-[#1e1e1e] border-[#2a2a2a]", "bg-white border-[#e5e5e5]")}`}>
                <div className="px-3 py-2">
                  <label className="block text-[11px] text-gray-500 mb-1">Categoria masiva</label>
                  <div className="flex flex-col gap-2">
                    <div className={`w-full border rounded-lg overflow-hidden ${dk("bg-[#232323] border-[#2a2a2a]", "bg-white border-[#d4d4d4]")}`}>
                      <div className={`max-h-40 overflow-y-auto ${dk("divide-[#2a2a2a]", "divide-[#efefef]")}`}>
                        <button
                          type="button"
                          onClick={() => setBulkCategory("")}
                          className={`w-full text-left px-2.5 py-1.5 text-xs border-b ${dk("border-[#2a2a2a] text-gray-300 hover:bg-[#2a2a2a]", "border-[#efefef] text-[#525252] hover:bg-[#f8f8f8]")} ${bulkCategory === "" ? dk("bg-[#2D9F6A]/20 text-white", "bg-[#e8f5ee] text-[#1f7a53]") : ""}`}
                        >
                          Seleccionar categoria...
                        </button>
                        {allCategoryNames.map((name) => (
                          <button
                            key={name}
                            type="button"
                            onClick={() => setBulkCategory(name)}
                            className={`w-full text-left px-2.5 py-1.5 text-xs ${dk("text-gray-200 hover:bg-[#2a2a2a]", "text-[#171717] hover:bg-[#f8f8f8]")} ${bulkCategory === name ? dk("bg-[#2D9F6A]/20 text-white", "bg-[#e8f5ee] text-[#1f7a53]") : ""}`}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={bulkSetCategory}
                        disabled={!bulkCategory.trim()}
                        className="w-full px-2.5 py-2 text-xs rounded-lg bg-[#2D9F6A] text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Aplicar Cat.
                      </button>
                      <button
                        onClick={bulkDelete}
                        className="w-full px-2.5 py-2 text-xs rounded-lg bg-red-500/90 hover:bg-red-500 text-white font-semibold transition"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>

                <div className={`border-t my-1 ${dk("border-[#2a2a2a]", "border-[#e5e5e5]")}`} />

                <div className="px-3 py-2">
                  <label className="block text-[11px] text-gray-500 mb-1">Marca masiva</label>
                  <div className="flex flex-col gap-2">
                    <select
                      value={bulkBrand}
                      onChange={(e) => setBulkBrand(e.target.value)}
                      className={`w-full text-xs px-2.5 py-2 border rounded-lg outline-none focus:border-[#2D9F6A]/50 ${dk("bg-[#232323] border-[#2a2a2a] text-white", "bg-white border-[#d4d4d4] text-[#171717]")}`}
                    >
                      <option value="">Seleccionar marca...</option>
                      {brands.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={bulkSetBrand}
                      disabled={!bulkBrand}
                      className="w-full px-2.5 py-2 text-xs rounded-lg bg-[#2D9F6A] text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Aplicar Marca
                    </button>
                  </div>
                </div>
                <div className={`border-t my-1 ${dk("border-[#2a2a2a]", "border-[#e5e5e5]")}`} />
                <button onClick={() => bulkSetActive(true)}  className={`w-full text-left px-4 py-2 text-sm text-green-400 ${dk("hover:bg-[#2a2a2a]", "hover:bg-[#f5f5f5]")}`}>✓ Activar</button>
                <button onClick={() => bulkSetActive(false)} className={`w-full text-left px-4 py-2 text-sm text-yellow-400 ${dk("hover:bg-[#2a2a2a]", "hover:bg-[#f5f5f5]")}`}>✗ Desactivar</button>
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      {/* Table */}
      <div className={`relative z-0 border rounded-xl overflow-hidden ${dk("bg-[#232323] border-[#2a2a2a]", "bg-white border-[#e5e5e5]")}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className={`border-b ${dk("bg-[#1a1a1a] border-[#2a2a2a]", "bg-[#f5f5f5] border-[#e5e5e5]")}`}>
              <tr>
                <th className="px-3 py-3 w-8">
                  <input type="checkbox" checked={allVisibleSelected}
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
                const active   = p.active !== false;
                const featured = p.featured === true;
                const lowStock = p.stock <= 3 && p.stock > 0;
                const noStock  = p.stock === 0;
                const isSelected = selected.has(p.id);
                const apiSuppliers = inferApiSuppliers(p, apiSourcesByProductId[p.id] ?? []);

                return (
                  <tr key={p.id}
                    className={`border-t transition ${dk("border-[#2a2a2a]", "border-[#f0f0f0]")} ${isSelected ? "bg-[#2D9F6A]/5" : noStock ? dk("bg-red-900/8 hover:bg-red-900/12", "bg-red-50/60 hover:bg-red-50") : lowStock ? dk("bg-amber-900/6 hover:bg-amber-900/10", "bg-amber-50/50 hover:bg-amber-50") : dk("hover:bg-[#2a2a2a]/40", "hover:bg-[#fafafa]")} ${!active ? "opacity-50" : ""}`}>

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
                          {p.name_custom?.trim() || p.name}
                        </span>
                        {p.name_custom?.trim() && (
                          <span title={`Original: ${p.name_original ?? p.name}`}
                            className="shrink-0 text-[9px] font-bold px-1 py-0.5 rounded bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">
                            custom
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1 mt-0.5 flex-wrap">
                        {p.brand_name && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            {p.brand_name}
                          </span>
                        )}
                        {p.tags?.slice(0, 2).map((t) => (
                          <span key={t} className={`text-[10px] ${dk("bg-[#1a1a1a]", "bg-[#f0f0f0]")} text-gray-500 px-1.5 rounded`}>{t}</span>
                        ))}
                      </div>
                    </td>

                    {/* SKU */}
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-gray-500 font-mono">{p.sku || "—"}</span>
                        {apiSuppliers.map((source) => (
                          <span
                            key={`${p.id}-${source}`}
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold w-fit ${
                              source === "AIR"
                                ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/25"
                                : source === "ELIT"
                                  ? "bg-orange-500/15 text-orange-500 border border-orange-500/25"
                                  : "bg-sky-400/15 text-sky-400 border border-sky-400/25"
                            }`}
                          >
                            API {source}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-3 py-3 text-xs text-gray-400">
                      <div className="inline-flex items-center gap-1.5">
                        <span>{p.category}</span>
                        {isPosProductMatch(p) && (
                          <span className="inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-400">
                            POS
                          </span>
                        )}
                      </div>
                    </td>

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
                            {formatPrice(p.cost_price)}
                          </span>
                          <span className={`ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                            p.iva_rate === 10.5
                              ? "text-blue-400 bg-blue-400/10 border-blue-400/20"
                              : "text-[#2D9F6A] bg-[#2D9F6A]/10 border-[#2D9F6A]/20"
                          }`}>
                            IVA {p.iva_rate ?? 21}%
                          </span>
                        </div>
                      )}
                    </td>

                    {/* P.+IVA */}
                    <td className="px-3 py-3">
                      <span className={`text-sm tabular-nums ${dk("text-gray-400", "text-[#525252]")}`}>
                        {formatPrice(p.cost_price * (1 + (p.iva_rate ?? 21) / 100))}
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

      {duplicatesOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm p-4 flex items-center justify-center"
          onClick={() => setDuplicatesOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-6xl max-h-[88vh] rounded-2xl border flex flex-col overflow-hidden ${dk("bg-[#101010] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}
          >
            <div className={`px-5 py-4 border-b ${dk("border-[#1f1f1f]", "border-[#e5e5e5]")}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className={`font-bold text-base ${dk("text-white", "text-[#171717]")}`}>Analisis de duplicados y similares</h3>
                  <p className={`text-xs mt-0.5 ${dk("text-gray-500", "text-[#737373]")}`}>
                    Revisa coincidencias por SKU, titulo exacto y titulo similar para decidir si editar, duplicar o eliminar.
                  </p>
                </div>
                <button
                  onClick={() => setDuplicatesOpen(false)}
                  className={`p-1.5 rounded-lg transition ${dk("text-gray-500 hover:text-white hover:bg-[#1e1e1e]", "text-[#737373] hover:text-[#171717] hover:bg-[#f5f5f5]")}`}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  onClick={() => setDuplicateFilter("all")}
                  className={`text-xs px-3 py-1.5 rounded-full border transition ${
                    duplicateFilter === "all"
                      ? "bg-[#2D9F6A] text-white border-[#2D9F6A]"
                      : dk("border-[#2a2a2a] text-gray-400 hover:bg-[#1b1b1b]", "border-[#d4d4d4] text-[#737373] hover:bg-[#f5f5f5]")
                  }`}
                >
                  Todos ({duplicateCounters.all})
                </button>
                <button
                  onClick={() => setDuplicateFilter("sku")}
                  className={`text-xs px-3 py-1.5 rounded-full border transition ${
                    duplicateFilter === "sku"
                      ? "bg-[#2D9F6A] text-white border-[#2D9F6A]"
                      : dk("border-[#2a2a2a] text-gray-400 hover:bg-[#1b1b1b]", "border-[#d4d4d4] text-[#737373] hover:bg-[#f5f5f5]")
                  }`}
                >
                  SKU ({duplicateCounters.sku})
                </button>
                <button
                  onClick={() => setDuplicateFilter("name")}
                  className={`text-xs px-3 py-1.5 rounded-full border transition ${
                    duplicateFilter === "name"
                      ? "bg-[#2D9F6A] text-white border-[#2D9F6A]"
                      : dk("border-[#2a2a2a] text-gray-400 hover:bg-[#1b1b1b]", "border-[#d4d4d4] text-[#737373] hover:bg-[#f5f5f5]")
                  }`}
                >
                  Titulo exacto ({duplicateCounters.name})
                </button>
                <button
                  onClick={() => setDuplicateFilter("similar")}
                  className={`text-xs px-3 py-1.5 rounded-full border transition ${
                    duplicateFilter === "similar"
                      ? "bg-[#2D9F6A] text-white border-[#2D9F6A]"
                      : dk("border-[#2a2a2a] text-gray-400 hover:bg-[#1b1b1b]", "border-[#d4d4d4] text-[#737373] hover:bg-[#f5f5f5]")
                  }`}
                >
                  Similares ({duplicateCounters.similar})
                </button>

                <div className="ml-auto min-w-[240px]">
                  <input
                    value={duplicateSearch}
                    onChange={(e) => setDuplicateSearch(e.target.value)}
                    placeholder="Buscar en coincidencias..."
                    className={`w-full border rounded-lg px-3 py-1.5 text-xs outline-none ${
                      dk("bg-[#141414] border-[#2a2a2a] text-gray-200", "bg-white border-[#d4d4d4] text-[#171717]")
                    }`}
                  />
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-auto px-5 py-4 space-y-3">
              {visibleDuplicateGroups.length === 0 ? (
                <div className={`rounded-xl border px-4 py-8 text-center text-sm ${dk("border-[#1f1f1f] text-gray-500", "border-[#e5e5e5] text-[#737373]")}`}>
                  No se encontraron coincidencias con los filtros actuales.
                </div>
              ) : (
                visibleDuplicateGroups.map((group) => (
                  <div key={group.id} className={`rounded-xl border ${dk("border-[#1f1f1f] bg-[#0f0f0f]", "border-[#e8e8e8] bg-[#fcfcfc]")}`}>
                    <div className={`px-4 py-3 border-b flex items-center justify-between gap-2 ${dk("border-[#1f1f1f]", "border-[#e8e8e8]")}`}>
                      <div>
                        <p className={`font-semibold text-sm ${dk("text-white", "text-[#171717]")}`}>{group.title}</p>
                        <p className={`text-xs ${dk("text-gray-500", "text-[#737373]")}`}>
                          {group.reason} - {group.products.length} productos - confianza {(group.confidence * 100).toFixed(0)}%
                        </p>
                      </div>
                    </div>

                    <div className="divide-y divide-[#1f1f1f]/40">
                      {group.products.map((product) => (
                        <div key={product.id} className="px-4 py-3 flex flex-wrap items-center gap-2">
                          <div className="min-w-[300px] flex-1">
                            <p className={`text-sm font-medium ${dk("text-white", "text-[#171717]")}`}>
                              #{product.id} - {getDisplayName(product)}
                            </p>
                            <p className={`text-xs ${dk("text-gray-500", "text-[#737373]")}`}>
                              SKU: {product.sku || "sin-sku"} - Cat: {product.category || "sin categoria"} - {formatPrice(product.cost_price)} - Stock {product.stock}
                            </p>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setDuplicatesOpen(false);
                                setEditingProduct(product);
                              }}
                              className={`text-xs px-2.5 py-1.5 rounded-lg border transition ${dk("border-[#2a2a2a] text-gray-300 hover:bg-[#1b1b1b]", "border-[#d4d4d4] text-[#525252] hover:bg-[#f5f5f5]")}`}
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => { void duplicate(product); }}
                              className={`text-xs px-2.5 py-1.5 rounded-lg border transition ${dk("border-[#2a2a2a] text-[#2D9F6A] hover:bg-[#2D9F6A]/10", "border-[#d4d4d4] text-[#2D9F6A] hover:bg-[#eef9f3]")}`}
                            >
                              Duplicar
                            </button>
                            <button
                              onClick={() => { void deleteProduct(product.id); }}
                              className={`text-xs px-2.5 py-1.5 rounded-lg border transition ${dk("border-red-500/40 text-red-400 hover:bg-red-500/10", "border-red-200 text-red-600 hover:bg-red-50")}`}
                            >
                              Eliminar
                            </button>
                            <button
                              onClick={() => { void keepOnlyProduct(group, product.id); }}
                              className={`text-xs px-2.5 py-1.5 rounded-lg border transition ${dk("border-amber-500/40 text-amber-300 hover:bg-amber-500/10", "border-amber-200 text-amber-700 hover:bg-amber-50")}`}
                              title="Conserva este y elimina el resto del grupo"
                            >
                              Conservar este
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingProduct && (
        <ProductEditModal
          product={editingProduct}
          categories={categories}
          brands={brands}
          onSave={(updated) => { onRefresh(); }}
          onClose={() => setEditingProduct(null)}
        />
      )}
    </>
  );
}
