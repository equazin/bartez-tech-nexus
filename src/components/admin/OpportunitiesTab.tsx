import { useMemo, useState } from "react";
import type { Product } from "@/models/products";
import { Flame, Plus, Search, GripVertical, Eye, Sparkles } from "lucide-react";
import ProductEditModal from "@/components/admin/ProductEditModal";

type OpportunitiesFilter = "all" | "active" | "expired" | "high_margin" | "low_stock";
type OrderMode = "manual" | "margin_desc" | "stock_asc";

type OpportunityItem = {
  product_id: number;
  active: boolean;
  priority: number;
  discount_pct: number;
  expires_at?: string;
};

type OpportunityRules = {
  min_margin_pct: number;
  max_stock: number;
  require_discount_active: boolean;
};

type Props = {
  products: Product[];
  categories: Array<{ id: number; name: string; parent_id: number | null }>;
  brands?: Array<{ id: string; name: string }>;
  onRefreshProducts?: () => void;
  isDark?: boolean;
  canEdit?: boolean;
};

const STORAGE_KEY = "admin_opportunities_v1";
const RULES_KEY = "admin_opportunities_rules_v1";

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function loadOpportunities(): OpportunityItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OpportunityItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => Number.isFinite(item.product_id))
      .map((item, idx) => ({
        product_id: Number(item.product_id),
        active: item.active !== false,
        priority: Number.isFinite(item.priority) ? item.priority : idx + 1,
        discount_pct: Number.isFinite(item.discount_pct) ? item.discount_pct : 0,
        expires_at: item.expires_at || "",
      }));
  } catch {
    return [];
  }
}

function loadRules(): OpportunityRules {
  try {
    const raw = localStorage.getItem(RULES_KEY);
    if (!raw) return { min_margin_pct: 18, max_stock: 6, require_discount_active: false };
    const parsed = JSON.parse(raw) as Partial<OpportunityRules>;
    return {
      min_margin_pct: Number.isFinite(parsed.min_margin_pct) ? Number(parsed.min_margin_pct) : 18,
      max_stock: Number.isFinite(parsed.max_stock) ? Number(parsed.max_stock) : 6,
      require_discount_active: Boolean(parsed.require_discount_active),
    };
  } catch {
    return { min_margin_pct: 18, max_stock: 6, require_discount_active: false };
  }
}

function formatDateValue(value?: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-AR");
}

export function OpportunitiesTab({
  products,
  categories,
  brands = [],
  onRefreshProducts,
  isDark = true,
  canEdit = true,
}: Props) {
  const dk = (d: string, l: string) => (isDark ? d : l);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<OpportunitiesFilter>("all");
  const [orderMode, setOrderMode] = useState<OrderMode>("manual");
  const [showPicker, setShowPicker] = useState(false);
  const [draggingProductId, setDraggingProductId] = useState<number | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [rules, setRules] = useState<OpportunityRules>(() => loadRules());
  const [items, setItems] = useState<OpportunityItem[]>(() => loadOpportunities());

  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products]
  );

  const marginForProduct = (product: Product, discountPct = 0) => {
    const base = Number(product.cost_price || 0);
    if (!Number.isFinite(base) || base <= 0) return 0;
    const listPrice = product.special_price != null ? Number(product.special_price) : base * 1.25;
    const discountedPrice = listPrice * (1 - Math.max(0, Math.min(100, discountPct)) / 100);
    if (discountedPrice <= 0) return 0;
    return ((discountedPrice - base) / discountedPrice) * 100;
  };

  const saveItems = (next: OpportunityItem[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setItems(next);
  };

  const saveRules = (next: OpportunityRules) => {
    localStorage.setItem(RULES_KEY, JSON.stringify(next));
    setRules(next);
  };

  const opportunities = useMemo(() => {
    const now = Date.now();
    const term = normalizeText(search);

    const withProducts = items
      .map((item) => ({ item, product: productById.get(item.product_id) }))
      .filter((row): row is { item: OpportunityItem; product: Product } => Boolean(row.product));

    const sorted = [...withProducts].sort((a, b) => {
      if (orderMode === "margin_desc") {
        return marginForProduct(b.product, b.item.discount_pct) - marginForProduct(a.product, a.item.discount_pct);
      }
      if (orderMode === "stock_asc") {
        return (a.product.stock ?? 0) - (b.product.stock ?? 0);
      }
      return a.item.priority - b.item.priority;
    });

    return sorted.filter(({ item, product }) => {
      const bag = normalizeText([product.name, product.sku, product.category].join(" "));
      if (term && !bag.includes(term)) return false;

      const expired = Boolean(item.expires_at) && new Date(item.expires_at as string).getTime() < now;
      const lowStock = (product.stock ?? 0) <= 3;
      const margin = marginForProduct(product, item.discount_pct);

      if (filter === "active" && !item.active) return false;
      if (filter === "expired" && !expired) return false;
      if (filter === "high_margin" && margin < 20) return false;
      if (filter === "low_stock" && !lowStock) return false;
      return true;
    });
  }, [items, productById, search, filter, orderMode]);

  const availableForPicker = useMemo(() => {
    const current = new Set(items.map((item) => item.product_id));
    const term = normalizeText(search);
    return products.filter((product) => {
      if (current.has(product.id)) return false;
      if (!term) return true;
      return normalizeText([product.name, product.sku, product.category].join(" ")).includes(term);
    });
  }, [items, products, search]);

  function addOpportunity(productId: number) {
    if (!canEdit) return;
    if (items.some((item) => item.product_id === productId)) return;
    const next = [
      ...items,
      {
        product_id: productId,
        active: true,
        priority: items.length + 1,
        discount_pct: 0,
        expires_at: "",
      },
    ];
    saveItems(next);
  }

  function updateItem(productId: number, patch: Partial<OpportunityItem>) {
    if (!canEdit) return;
    const next = items.map((item) => (item.product_id === productId ? { ...item, ...patch } : item));
    saveItems(next);
  }

  function removeItem(productId: number) {
    if (!canEdit) return;
    const next = items
      .filter((item) => item.product_id !== productId)
      .map((item, idx) => ({ ...item, priority: idx + 1 }));
    saveItems(next);
  }

  function handleDragMove(sourceId: number, targetId: number) {
    if (!canEdit || sourceId === targetId) return;
    const copy = [...items];
    const sourceIdx = copy.findIndex((item) => item.product_id === sourceId);
    const targetIdx = copy.findIndex((item) => item.product_id === targetId);
    if (sourceIdx < 0 || targetIdx < 0) return;
    const [moved] = copy.splice(sourceIdx, 1);
    copy.splice(targetIdx, 0, moved);
    saveItems(copy.map((item, idx) => ({ ...item, priority: idx + 1 })));
  }

  function generateAutomaticOpportunities() {
    if (!canEdit) return;
    const candidates = products.filter((product) => {
      const discountActive = (product.offer_percent ?? 0) > 0 || (product.special_price ?? 0) > 0;
      if (rules.require_discount_active && !discountActive) return false;
      const margin = marginForProduct(product, Number(product.offer_percent ?? 0));
      return margin >= rules.min_margin_pct && (product.stock ?? 0) <= rules.max_stock;
    });

    const next = candidates
      .slice(0, 40)
      .sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0))
      .map((product, idx) => ({
        product_id: product.id,
        active: true,
        priority: idx + 1,
        discount_pct: Number(product.offer_percent ?? 0),
        expires_at: "",
      }));
    saveItems(next);
  }

  return (
    <div className="space-y-4">
      <div className={`rounded-xl border p-4 ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar oportunidades..."
              className={`w-full rounded-lg border py-2 pl-8 pr-3 text-sm outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-[#f7f7f7] border-[#d4d4d4] text-[#171717]")}`}
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as OpportunitiesFilter)}
            className={`rounded-lg border px-3 py-2 text-sm outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-[#f7f7f7] border-[#d4d4d4] text-[#171717]")}`}
          >
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="expired">Vencidos</option>
            <option value="high_margin">Alto margen</option>
            <option value="low_stock">Bajo stock</option>
          </select>
          <select
            value={orderMode}
            onChange={(e) => setOrderMode(e.target.value as OrderMode)}
            className={`rounded-lg border px-3 py-2 text-sm outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-[#f7f7f7] border-[#d4d4d4] text-[#171717]")}`}
          >
            <option value="manual">Orden manual</option>
            <option value="margin_desc">Automático: margen</option>
            <option value="stock_asc">Automático: stock</option>
          </select>
          <button
            onClick={() => window.open("/b2b-portal?context=oportunidades", "_blank")}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition ${dk("border-[#2a2a2a] text-gray-300 hover:bg-[#1b1b1b]", "border-[#d4d4d4] text-[#525252] hover:bg-[#f5f5f5]")}`}
          >
            <Eye size={12} /> Ver como cliente
          </button>
          <button
            onClick={() => setShowPicker((v) => !v)}
            disabled={!canEdit}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#2D9F6A] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#25835A] disabled:opacity-50"
          >
            <Plus size={12} /> Agregar producto
          </button>
        </div>

        {showPicker && (
          <div className={`mt-3 rounded-lg border p-3 ${dk("border-[#262626] bg-[#0d0d0d]", "border-[#e5e5e5] bg-[#fafafa]")}`}>
            <p className={`mb-2 text-xs font-semibold ${dk("text-gray-400", "text-[#737373]")}`}>Selector de productos</p>
            <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto md:grid-cols-2">
              {availableForPicker.slice(0, 80).map((product) => (
                <button
                  key={product.id}
                  onClick={() => addOpportunity(product.id)}
                  disabled={!canEdit}
                  className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition ${dk("border-[#2a2a2a] hover:bg-[#1a1a1a]", "border-[#e5e5e5] hover:bg-white")}`}
                >
                  <img src={product.image || "/placeholder.png"} alt={product.name} className="h-9 w-9 rounded object-cover" loading="lazy" />
                  <span className="line-clamp-2">{product.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className={`rounded-xl border p-4 ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
        <div className="mb-3 flex items-center gap-2">
          <Sparkles size={14} className="text-[#2D9F6A]" />
          <p className={`text-sm font-semibold ${dk("text-white", "text-[#171717]")}`}>Automatización de oportunidades</p>
          <span className={`ml-auto text-xs ${dk("text-gray-500", "text-[#737373]")}`}>{items.length} productos</span>
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
          <label className="text-xs">
            <span className={`mb-1 block ${dk("text-gray-400", "text-[#737373]")}`}>Margen &gt; %</span>
            <input
              type="number"
              value={rules.min_margin_pct}
              onChange={(e) => saveRules({ ...rules, min_margin_pct: Number(e.target.value) || 0 })}
              disabled={!canEdit}
              className={`w-full rounded-lg border px-2.5 py-2 ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-[#f7f7f7] border-[#d4d4d4] text-[#171717]")}`}
            />
          </label>
          <label className="text-xs">
            <span className={`mb-1 block ${dk("text-gray-400", "text-[#737373]")}`}>Stock &lt;=</span>
            <input
              type="number"
              value={rules.max_stock}
              onChange={(e) => saveRules({ ...rules, max_stock: Number(e.target.value) || 0 })}
              disabled={!canEdit}
              className={`w-full rounded-lg border px-2.5 py-2 ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-[#f7f7f7] border-[#d4d4d4] text-[#171717]")}`}
            />
          </label>
          <label className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${dk("border-[#262626] text-gray-300", "border-[#d4d4d4] text-[#525252]")}`}>
            <input
              type="checkbox"
              checked={rules.require_discount_active}
              onChange={(e) => saveRules({ ...rules, require_discount_active: e.target.checked })}
              disabled={!canEdit}
              className="accent-[#2D9F6A]"
            />
            descuento activo
          </label>
          <button
            onClick={generateAutomaticOpportunities}
            disabled={!canEdit}
            className="rounded-lg bg-[#2D9F6A] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#25835A] disabled:opacity-50"
          >
            Generar oportunidades automáticas
          </button>
        </div>
      </div>

      <div className={`overflow-hidden rounded-xl border ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
        <div className={`grid grid-cols-[28px_1.4fr_.8fr_.6fr_.6fr_.7fr_.8fr_.8fr_.9fr] gap-2 px-3 py-2 text-[11px] font-semibold uppercase ${dk("bg-[#0d0d0d] text-gray-500", "bg-[#f7f7f7] text-[#737373]")}`}>
          <span />
          <span>Producto</span>
          <span>Precio</span>
          <span>Margen</span>
          <span>Stock</span>
          <span>Estado</span>
          <span>Prioridad</span>
          <span>Fecha fin</span>
          <span />
        </div>
        <div className="max-h-[58vh] overflow-y-auto">
          {opportunities.map(({ item, product }) => {
            const margin = marginForProduct(product, item.discount_pct);
            const price = (product.special_price != null ? Number(product.special_price) : product.cost_price * 1.25) * (1 - item.discount_pct / 100);
            const expiringSoon = item.expires_at && new Date(item.expires_at).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;
            const expired = item.expires_at && new Date(item.expires_at).getTime() < Date.now();
            const lowStock = (product.stock ?? 0) <= 3;
            return (
              <div
                key={item.product_id}
                draggable={canEdit}
                onDragStart={() => setDraggingProductId(item.product_id)}
                onDragOver={(event) => {
                  if (!canEdit || draggingProductId == null) return;
                  event.preventDefault();
                }}
                onDrop={() => {
                  if (draggingProductId == null) return;
                  handleDragMove(draggingProductId, item.product_id);
                  setDraggingProductId(null);
                }}
                className={`grid grid-cols-[28px_1.4fr_.8fr_.6fr_.6fr_.7fr_.8fr_.8fr_.9fr] items-center gap-2 border-t px-3 py-2 text-xs ${dk("border-[#1f1f1f] hover:bg-[#151515]", "border-[#efefef] hover:bg-[#fafafa]")}`}
              >
                <GripVertical size={14} className={dk("text-gray-500", "text-[#a3a3a3]")} />
                <div className="flex min-w-0 items-center gap-2">
                  <img src={product.image || "/placeholder.png"} alt={product.name} className="h-8 w-8 rounded object-cover" loading="lazy" />
                  <div className="min-w-0">
                    <p className={`truncate font-semibold ${dk("text-white", "text-[#171717]")}`}>{product.name}</p>
                    <div className="flex flex-wrap gap-1">
                      <span className="rounded-full bg-orange-500/10 px-1.5 py-0.5 text-[10px] text-orange-400">🔥 Destacado</span>
                      {expiringSoon && !expired && <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-500">⏳ Por vencer</span>}
                      {lowStock && <span className="rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-400">📉 Bajo stock</span>}
                    </div>
                  </div>
                </div>
                <span className={dk("text-white", "text-[#171717]")}>${price.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</span>
                <span className={margin >= 20 ? "text-emerald-500 font-semibold" : dk("text-gray-400", "text-[#737373]")}>{margin.toFixed(1)}%</span>
                <span className={lowStock ? "text-red-400 font-semibold" : dk("text-gray-300", "text-[#525252]")}>{product.stock ?? 0}</span>
                <label className="inline-flex items-center gap-1.5">
                  <input type="checkbox" checked={item.active} onChange={(e) => updateItem(item.product_id, { active: e.target.checked })} disabled={!canEdit} className="accent-[#2D9F6A]" />
                  <span>{item.active ? "Activo" : "Inactivo"}</span>
                </label>
                <input
                  type="number"
                  min={1}
                  value={item.priority}
                  onChange={(e) => updateItem(item.product_id, { priority: Number(e.target.value) || 1 })}
                  disabled={!canEdit}
                  className={`w-16 rounded border px-2 py-1 ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-[#f7f7f7] border-[#d4d4d4] text-[#171717]")}`}
                />
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={item.expires_at || ""}
                    onChange={(e) => updateItem(item.product_id, { expires_at: e.target.value })}
                    disabled={!canEdit}
                    className={`rounded border px-2 py-1 ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-[#f7f7f7] border-[#d4d4d4] text-[#171717]")}`}
                  />
                  <span className={`text-[10px] ${dk("text-gray-500", "text-[#a3a3a3]")}`}>{formatDateValue(item.expires_at)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={item.discount_pct}
                    onChange={(e) => updateItem(item.product_id, { discount_pct: Number(e.target.value) || 0 })}
                    disabled={!canEdit}
                    title="Descuento"
                    className={`w-14 rounded border px-2 py-1 ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-[#f7f7f7] border-[#d4d4d4] text-[#171717]")}`}
                  />
                  <button
                    onClick={() => removeItem(item.product_id)}
                    disabled={!canEdit}
                    className="rounded border border-red-500/40 px-2 py-1 text-[10px] text-red-400 disabled:opacity-50"
                  >
                    Quitar
                  </button>
                  <button
                    onClick={() => setEditingProduct(product)}
                    disabled={!canEdit}
                    className="rounded border border-[#2D9F6A]/40 px-2 py-1 text-[10px] text-[#2D9F6A] disabled:opacity-50"
                  >
                    Editar
                  </button>
                </div>
              </div>
            );
          })}
          {opportunities.length === 0 && (
            <div className={`px-4 py-8 text-center text-sm ${dk("text-gray-500", "text-[#737373]")}`}>
              No hay oportunidades con los filtros actuales.
            </div>
          )}
        </div>
      </div>

      {editingProduct && (
        <ProductEditModal
          product={editingProduct}
          categories={categories}
          brands={brands}
          onSave={() => {
            onRefreshProducts?.();
          }}
          onClose={() => setEditingProduct(null)}
        />
      )}
    </div>
  );
}
