import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  Package, ChevronDown, ChevronUp, Plus, Pencil, Trash2,
  Save, X, Star, StarOff, AlertTriangle, Layers,
} from "lucide-react";

interface Props { isDark?: boolean }

interface ProductRow {
  id: number;
  name: string;
  sku: string;
  // from product_stock_summary view (left-joined)
  total_available: number | null;
  total_reserved: number | null;
  net_available: number | null;
  best_cost: number | null;
  supplier_count: number | null;
}

interface SupplierSource {
  id: string;
  product_id: number;
  supplier_id: string;
  supplier_name: string;
  cost_price: number;
  source_cost_price?: number | null;
  source_currency?: "USD" | "ARS" | null;
  source_exchange_rate?: number | null;
  stock_available: number;
  stock_reserved: number;
  price_multiplier: number;
  lead_time_days: number;
  is_preferred: boolean;
  active: boolean;
  external_id: string | null;
}

interface SupplierOption {
  id: string;
  name: string;
}

interface ProductBaseRow {
  id: number;
  name: string;
  sku: string;
}

interface ProductStockSummaryRow {
  product_id: number;
  total_available: number | null;
  total_reserved: number | null;
  net_available: number | null;
  best_cost: number | null;
  supplier_count: number | null;
}

interface ProductSupplierQueryRow extends Omit<SupplierSource, "supplier_name"> {
  suppliers?: { name: string } | null;
}

type EditableSupplierField = "cost_price" | "stock_available" | "price_multiplier" | "lead_time_days";

const EMPTY_FORM = {
  supplier_id: "",
  cost_price: 0,
  stock_available: 0,
  price_multiplier: 1.0,
  lead_time_days: 0,
  external_id: "",
};

export function StockTab({ isDark = true }: Props) {
  const dk = (d: string, l: string) => (isDark ? d : l);

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [sources, setSources] = useState<Record<number, SupplierSource[]>>({});
  const [loadingSources, setLoadingSources] = useState<number | null>(null);
  const [supplierOptions, setSupplierOptions] = useState<SupplierOption[]>([]);

  // inline edit state
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<SupplierSource>>({});

  // add form state
  const [showAddForm, setShowAddForm] = useState<number | null>(null);
  const [addForm, setAddForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("products")
      .select("id, name, sku")
      .eq("active", true)
      .order("name")
      .limit(500);

    if (!data) { setLoading(false); return; }

    const productRows = data as ProductBaseRow[];
    const productIds = productRows.map((p) => p.id);
    const { data: sumData } = await supabase
      .from("product_stock_summary")
      .select("*")
      .in("product_id", productIds);

    const sumMap: Record<number, ProductStockSummaryRow> = {};
    (sumData as ProductStockSummaryRow[] | null ?? []).forEach((s) => { sumMap[s.product_id] = s; });

    setProducts(
      productRows.map((p) => ({
        ...p,
        total_available: sumMap[p.id]?.total_available ?? null,
        total_reserved:  sumMap[p.id]?.total_reserved  ?? null,
        net_available:   sumMap[p.id]?.net_available   ?? null,
        best_cost:       sumMap[p.id]?.best_cost        ?? null,
        supplier_count:  sumMap[p.id]?.supplier_count   ?? null,
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  useEffect(() => {
    supabase.from("suppliers").select("id, name").eq("active", true).order("name")
      .then(({ data }) => setSupplierOptions((data ?? []) as SupplierOption[]));
  }, []);

  async function toggleExpand(productId: number) {
    if (expandedId === productId) { setExpandedId(null); return; }
    setExpandedId(productId);
    if (sources[productId]) return;
    setLoadingSources(productId);
    const { data } = await supabase
      .from("product_suppliers")
      .select("*, suppliers(name)")
      .eq("product_id", productId)
      .order("is_preferred", { ascending: false })
      .order("cost_price", { ascending: true });
    setSources((prev) => ({
      ...prev,
      [productId]: ((data as ProductSupplierQueryRow[] | null) ?? []).map((r) => ({
        ...r,
        supplier_name: r.suppliers?.name ?? "—",
      })),
    }));
    setLoadingSources(null);
  }

  async function refreshSources(productId: number) {
    const { data } = await supabase
      .from("product_suppliers")
      .select("*, suppliers(name)")
      .eq("product_id", productId)
      .order("is_preferred", { ascending: false })
      .order("cost_price", { ascending: true });
    setSources((prev) => ({
      ...prev,
      [productId]: ((data as ProductSupplierQueryRow[] | null) ?? []).map((r) => ({
        ...r,
        supplier_name: r.suppliers?.name ?? "—",
      })),
    }));
    fetchProducts();
  }

  async function setPreferred(sourceId: string, productId: number) {
    await supabase.from("product_suppliers").update({ is_preferred: false }).eq("product_id", productId);
    await supabase.from("product_suppliers").update({ is_preferred: true }).eq("id", sourceId);
    refreshSources(productId);
  }

  async function saveEdit(sourceId: string, productId: number) {
    setSaving(true);
    await supabase.from("product_suppliers").update({
      cost_price:       editForm.cost_price,
      stock_available:  editForm.stock_available,
      price_multiplier: editForm.price_multiplier,
      lead_time_days:   editForm.lead_time_days,
      external_id:      editForm.external_id || null,
    }).eq("id", sourceId);
    setEditingRow(null);
    setSaving(false);
    refreshSources(productId);
  }

  async function removeSource(sourceId: string, productId: number) {
    if (!confirm("¿Eliminar este proveedor del producto?")) return;
    await supabase.from("product_suppliers").delete().eq("id", sourceId);
    refreshSources(productId);
  }

  async function addSource(productId: number) {
    if (!addForm.supplier_id) return;
    setSaving(true);
    await supabase.from("product_suppliers").insert({
      product_id:       productId,
      supplier_id:      addForm.supplier_id,
      cost_price:       Number(addForm.cost_price),
      stock_available:  Number(addForm.stock_available),
      price_multiplier: Number(addForm.price_multiplier),
      lead_time_days:   Number(addForm.lead_time_days),
      external_id:      addForm.external_id || null,
    });
    setAddForm(EMPTY_FORM);
    setShowAddForm(null);
    setSaving(false);
    refreshSources(productId);
  }

  const filtered = products.filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase())
  );

  const stockBadge = (net: number | null) => {
    if (net === null) return <span className="text-[11px] text-gray-500">Sin stock</span>;
    if (net <= 0)     return <span className="text-[11px] font-semibold text-red-400">Agotado</span>;
    if (net <= 3)     return <span className="text-[11px] font-semibold text-yellow-400">{net} bajo</span>;
    return <span className="text-[11px] font-semibold text-emerald-400">{net} disp.</span>;
  };

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-base font-bold ${dk("text-white", "text-[#171717]")}`}>Gestión de Stock</h2>
          <p className="text-xs text-gray-500 mt-0.5">Stock por proveedor · multi-supplier</p>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar producto o SKU…"
          className={`border rounded-lg px-3 py-2 text-xs outline-none w-56 transition ${dk("bg-[#111] border-[#2a2a2a] text-gray-300 placeholder:text-[#444] focus:border-[#3a3a3a]", "bg-white border-[#e5e5e5] text-[#525252] placeholder:text-[#b4b4b4] focus:border-[#d4d4d4]")}`}
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`h-14 rounded-xl animate-pulse ${dk("bg-[#111]", "bg-white")}`} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500 text-sm">
          {search ? "Sin resultados." : "No hay productos."}
        </div>
      ) : (
        <div className={`border rounded-xl overflow-hidden ${dk("border-[#1f1f1f]", "border-[#e5e5e5]")}`}>
          {filtered.map((product, idx) => {
            const isExpanded = expandedId === product.id;
            const productSources = sources[product.id] ?? [];

            return (
              <div key={product.id} className={idx > 0 ? `border-t ${dk("border-[#1a1a1a]", "border-[#f0f0f0]")}` : ""}>
                {/* Product row */}
                <div
                  onClick={() => toggleExpand(product.id)}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition ${dk("hover:bg-[#111]", "hover:bg-[#fafafa]")} ${isExpanded ? dk("bg-[#111]", "bg-[#fafafa]") : ""}`}
                >
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${dk("bg-[#1a1a1a]", "bg-[#f0f0f0]")}`}>
                    <Package size={14} className="text-[#2D9F6A]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold truncate ${dk("text-white", "text-[#171717]")}`}>{product.name}</p>
                    <p className="text-[10px] text-gray-500 font-mono">{product.sku}</p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    {product.supplier_count !== null && (
                      <div className="flex items-center gap-1">
                        <Layers size={11} className="text-gray-500" />
                        <span className="text-[11px] text-gray-500">{product.supplier_count} prov.</span>
                      </div>
                    )}
                    {product.net_available !== null && product.net_available <= 3 && (
                      <AlertTriangle size={12} className="text-yellow-400" />
                    )}
                    <div className="w-20 text-right">{stockBadge(product.net_available)}</div>
                    {isExpanded ? (
                      <ChevronUp size={14} className="text-gray-500" />
                    ) : (
                      <ChevronDown size={14} className="text-gray-500" />
                    )}
                  </div>
                </div>

                {/* Expanded supplier sources */}
                {isExpanded && (
                  <div className={`border-t px-4 py-3 space-y-3 ${dk("border-[#1a1a1a] bg-[#080808]", "border-[#f0f0f0] bg-[#fafafa]")}`}>
                    {loadingSources === product.id ? (
                      <div className="text-xs text-gray-500 py-2">Cargando fuentes…</div>
                    ) : productSources.length === 0 ? (
                      <div className="text-xs text-gray-500 py-2">Sin proveedores asignados.</div>
                    ) : (
                      <div className="space-y-2">
                        {/* Table header */}
                        <div className="grid grid-cols-[1fr_110px_80px_80px_70px_70px_90px] gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 pb-1">
                          <span>Proveedor</span>
                          <span>Costo</span>
                          <span>Stock</span>
                          <span>Reservado</span>
                          <span>Mult.</span>
                          <span>Plazo</span>
                          <span className="text-right">Acciones</span>
                        </div>

                        {productSources.map((src) => (
                          <div key={src.id} className={`rounded-lg border px-3 py-2 ${dk("border-[#1f1f1f] bg-[#111]", "border-[#e5e5e5] bg-white")} ${src.is_preferred ? dk("border-[#2D9F6A]/40", "border-[#2D9F6A]/30") : ""}`}>
                            {editingRow === src.id ? (
                              // Edit mode
                              <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                  {([
                                    { label: "Costo", key: "cost_price", type: "number" },
                                    { label: "Stock disponible", key: "stock_available", type: "number" },
                                    { label: "Multiplicador", key: "price_multiplier", type: "number" },
                                    { label: "Plazo (días)", key: "lead_time_days", type: "number" },
                                  ] as const satisfies ReadonlyArray<{ label: string; key: EditableSupplierField; type: string }>).map(({ label, key, type }) => (
                                    <div key={key}>
                                      <label className={`text-[10px] mb-0.5 block ${dk("text-gray-500", "text-[#737373]")}`}>{label}</label>
                                      <input
                                        type={type}
                                        value={editForm[key] ?? ""}
                                        onChange={(e) => setEditForm((p) => ({ ...p, [key]: Number(e.target.value) }))}
                                        className={`w-full border rounded px-2 py-1 text-xs outline-none ${dk("bg-[#0d0d0d] border-[#2a2a2a] text-white", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717]")}`}
                                      />
                                    </div>
                                  ))}
                                  <div className="col-span-2">
                                    <label className={`text-[10px] mb-0.5 block ${dk("text-gray-500", "text-[#737373]")}`}>Código externo</label>
                                    <input
                                      value={editForm.external_id ?? ""}
                                      onChange={(e) => setEditForm((p) => ({ ...p, external_id: e.target.value }))}
                                      className={`w-full border rounded px-2 py-1 text-xs outline-none ${dk("bg-[#0d0d0d] border-[#2a2a2a] text-white", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717]")}`}
                                    />
                                  </div>
                                </div>
                                <div className="flex gap-2 justify-end">
                                  <button onClick={() => setEditingRow(null)} className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1 transition">
                                    <X size={12} />
                                  </button>
                                  <button
                                    onClick={() => saveEdit(src.id, product.id)}
                                    disabled={saving}
                                    className="flex items-center gap-1 text-xs bg-[#2D9F6A] hover:bg-[#25875a] text-white px-3 py-1 rounded-lg transition"
                                  >
                                    <Save size={11} /> Guardar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              // View mode
                              <div className="grid grid-cols-[1fr_110px_80px_80px_70px_70px_90px] gap-2 items-center">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {src.is_preferred && <Star size={11} className="text-[#2D9F6A] shrink-0" />}
                                  <span className={`text-xs truncate ${dk("text-gray-300", "text-[#525252]")}`}>{src.supplier_name}</span>
                                  {!src.active && <span className="text-[10px] text-red-400 shrink-0">(inactivo)</span>}
                                </div>
                                <div className={`text-xs font-mono ${dk("text-gray-300", "text-[#525252]")}`}>
                                  <p>${src.cost_price.toLocaleString("es-AR")} USD</p>
                                  {src.source_cost_price != null && (
                                    <p className={`text-[10px] ${dk("text-gray-500", "text-[#737373]")}`}>
                                      Fuente: {src.source_currency ?? "USD"} {src.source_cost_price.toLocaleString("es-AR")}
                                    </p>
                                  )}
                                </div>
                                <span className={`text-xs font-mono ${dk("text-gray-300", "text-[#525252]")}`}>{src.stock_available}</span>
                                <span className={`text-xs font-mono ${dk("text-gray-300", "text-[#525252]")}`}>{src.stock_reserved}</span>
                                <span className={`text-xs font-mono ${dk("text-gray-400", "text-[#737373]")}`}>×{src.price_multiplier}</span>
                                <span className={`text-xs ${dk("text-gray-400", "text-[#737373]")}`}>{src.lead_time_days}d</span>
                                <div className="flex items-center gap-1.5 justify-end">
                                  {!src.is_preferred && (
                                    <button
                                      onClick={() => setPreferred(src.id, product.id)}
                                      title="Marcar como preferido"
                                      className="text-gray-500 hover:text-[#2D9F6A] transition"
                                    >
                                      <StarOff size={12} />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => { setEditingRow(src.id); setEditForm(src); }}
                                    className="text-gray-500 hover:text-blue-400 transition"
                                  >
                                    <Pencil size={12} />
                                  </button>
                                  <button
                                    onClick={() => removeSource(src.id, product.id)}
                                    className="text-gray-500 hover:text-red-400 transition"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add supplier form */}
                    {showAddForm === product.id ? (
                      <div className={`border rounded-lg px-3 py-3 space-y-2 ${dk("border-[#2a2a2a] bg-[#111]", "border-[#e5e5e5] bg-white")}`}>
                        <p className={`text-xs font-semibold ${dk("text-white", "text-[#171717]")}`}>Agregar proveedor</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="col-span-2">
                            <label className={`text-[10px] mb-0.5 block ${dk("text-gray-500", "text-[#737373]")}`}>Proveedor *</label>
                            <select
                              value={addForm.supplier_id}
                              onChange={(e) => setAddForm((p) => ({ ...p, supplier_id: e.target.value }))}
                              className={`w-full border rounded px-2 py-1.5 text-xs outline-none ${dk("bg-[#0d0d0d] border-[#2a2a2a] text-white", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717]")}`}
                            >
                              <option value="">Seleccionar…</option>
                              {supplierOptions.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                          </div>
                          {([
                            { label: "Costo", key: "cost_price" },
                            { label: "Stock disponible", key: "stock_available" },
                            { label: "Multiplicador", key: "price_multiplier" },
                            { label: "Plazo (días)", key: "lead_time_days" },
                          ] as const satisfies ReadonlyArray<{ label: string; key: keyof typeof EMPTY_FORM }>).map(({ label, key }) => (
                            <div key={key}>
                              <label className={`text-[10px] mb-0.5 block ${dk("text-gray-500", "text-[#737373]")}`}>{label}</label>
                              <input
                                type="number"
                                value={addForm[key]}
                                onChange={(e) => setAddForm((p) => ({ ...p, [key]: Number(e.target.value) }))}
                                className={`w-full border rounded px-2 py-1 text-xs outline-none ${dk("bg-[#0d0d0d] border-[#2a2a2a] text-white", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717]")}`}
                              />
                            </div>
                          ))}
                          <div className="col-span-2">
                            <label className={`text-[10px] mb-0.5 block ${dk("text-gray-500", "text-[#737373]")}`}>Código externo (SKU proveedor)</label>
                            <input
                              value={addForm.external_id}
                              onChange={(e) => setAddForm((p) => ({ ...p, external_id: e.target.value }))}
                              className={`w-full border rounded px-2 py-1 text-xs outline-none ${dk("bg-[#0d0d0d] border-[#2a2a2a] text-white", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717]")}`}
                              placeholder="SKU-123"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setShowAddForm(null)} className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1 transition">
                            Cancelar
                          </button>
                          <button
                            onClick={() => addSource(product.id)}
                            disabled={saving || !addForm.supplier_id}
                            className="flex items-center gap-1 text-xs bg-[#2D9F6A] hover:bg-[#25875a] disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition"
                          >
                            <Plus size={11} /> Agregar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setShowAddForm(product.id); setAddForm(EMPTY_FORM); }}
                        className={`flex items-center gap-1.5 text-xs transition px-3 py-1.5 rounded-lg border ${dk("border-[#2a2a2a] text-gray-500 hover:text-white hover:border-[#3a3a3a]", "border-[#e5e5e5] text-[#737373] hover:text-[#171717] hover:border-[#d4d4d4]")}`}
                      >
                        <Plus size={12} /> Agregar proveedor
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
