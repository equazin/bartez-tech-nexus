import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { backend, hasBackendUrl } from "@/lib/api/backend";
import {
  AlertTriangle,
  Building,
  ChevronDown,
  ChevronUp,
  Layers,
  MapPin,
  Package,
  Pencil,
  Plus,
  Save,
  Star,
  StarOff,
  Trash2,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SurfaceCard } from "@/components/ui/surface-card";
import { cn } from "@/lib/utils";

interface Props {
  isDark?: boolean;
}

interface ProductRow {
  id: number;
  name: string;
  sku: string;
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
  price_multiplier: 1,
  lead_time_days: 0,
  external_id: "",
};

interface Warehouse {
  id: string;
  name: string;
  location: string;
}

interface WarehouseStock {
  warehouse_id: string;
  warehouse_name: string;
  stock: number;
  stock_reserved: number;
}

function StockBadge({ net }: { net: number | null }) {
  if (net === null) {
    return <Badge variant="outline">Sin stock</Badge>;
  }

  if (net <= 0) {
    return <Badge variant="outline" className="border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400">Agotado</Badge>;
  }

  if (net <= 3) {
    return (
      <Badge variant="outline" className="border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400">
        {net} bajo
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
      {net} disp.
    </Badge>
  );
}

export function StockTab({ isDark: _isDark = true }: Props) {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [sources, setSources] = useState<Record<number, SupplierSource[]>>({});
  const [loadingSources, setLoadingSources] = useState<number | null>(null);
  const [supplierOptions, setSupplierOptions] = useState<SupplierOption[]>([]);
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<SupplierSource>>({});
  const [showAddForm, setShowAddForm] = useState<number | null>(null);
  const [addForm, setAddForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<"suppliers" | "warehouses">("suppliers");
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [whStocks, setWhStocks] = useState<Record<number, WarehouseStock[]>>({});
  const [loadingWh, setLoadingWh] = useState<number | null>(null);
  const [adjustDelta, setAdjustDelta] = useState<Record<number, string>>({});
  const [adjustReason, setAdjustReason] = useState<Record<number, string>>({});
  const [adjustingId, setAdjustingId] = useState<number | null>(null);

  async function handleAdjustStock(productId: number) {
    const delta = Number(adjustDelta[productId] ?? "");
    if (!hasBackendUrl || isNaN(delta) || delta === 0) return;
    setAdjustingId(productId);
    try {
      await backend.products.adjustStock(productId, {
        delta,
        reason: adjustReason[productId]?.trim() || undefined,
      });
      setAdjustDelta((prev) => ({ ...prev, [productId]: "" }));
      setAdjustReason((prev) => ({ ...prev, [productId]: "" }));
      await fetchProducts();
    } finally {
      setAdjustingId(null);
    }
  }

  const fetchProducts = useCallback(async () => {
    setLoading(true);

    const { data } = await supabase.from("products").select("id, name, sku").eq("active", true).order("name").limit(500);

    if (!data) {
      setLoading(false);
      return;
    }

    const productRows = data as ProductBaseRow[];
    const productIds = productRows.map((product) => product.id);

    const { data: summaryData } = await supabase.from("product_stock_summary").select("*").in("product_id", productIds);

    const summaryMap: Record<number, ProductStockSummaryRow> = {};
    (summaryData as ProductStockSummaryRow[] | null | undefined)?.forEach((summary) => {
      summaryMap[summary.product_id] = summary;
    });

    setProducts(
      productRows.map((product) => ({
        ...product,
        total_available: summaryMap[product.id]?.total_available ?? null,
        total_reserved: summaryMap[product.id]?.total_reserved ?? null,
        net_available: summaryMap[product.id]?.net_available ?? null,
        best_cost: summaryMap[product.id]?.best_cost ?? null,
        supplier_count: summaryMap[product.id]?.supplier_count ?? null,
      })),
    );

    setLoading(false);
  }, []);

  const fetchSupplierSources = useCallback(async (productId: number) => {
    setLoadingSources(productId);

    const { data } = await supabase
      .from("product_suppliers")
      .select("*, suppliers(name)")
      .eq("product_id", productId)
      .order("is_preferred", { ascending: false })
      .order("cost_price", { ascending: true });

    setSources((prev) => ({
      ...prev,
      [productId]: ((data as ProductSupplierQueryRow[] | null) ?? []).map((row) => ({
        ...row,
        supplier_name: row.suppliers?.name ?? "-",
      })),
    }));

    setLoadingSources(null);
  }, []);

  const fetchWarehouseStock = useCallback(async (productId: number) => {
    setLoadingWh(productId);

    const { data } = await supabase.from("product_stocks").select("*, warehouses(name, location)").eq("product_id", productId);

    setWhStocks((prev) => ({
      ...prev,
      [productId]: ((data as Array<{ warehouse_id: string; stock: number; stock_reserved: number; warehouses?: { name?: string } | null }> | null) ?? []).map(
        (row) => ({
          warehouse_id: row.warehouse_id,
          warehouse_name: row.warehouses?.name || "Desconocido",
          stock: row.stock,
          stock_reserved: row.stock_reserved,
        }),
      ),
    }));

    setLoadingWh(null);
  }, []);

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    void supabase
      .from("suppliers")
      .select("id, name")
      .eq("active", true)
      .order("name")
      .then(({ data }) => setSupplierOptions((data ?? []) as SupplierOption[]));

    void supabase
      .from("warehouses")
      .select("id, name, location")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => setWarehouses((data ?? []) as Warehouse[]));
  }, []);

  useEffect(() => {
    if (!expandedId) {
      return;
    }

    if (viewMode === "suppliers" && !sources[expandedId]) {
      void fetchSupplierSources(expandedId);
    }

    if (viewMode === "warehouses" && !whStocks[expandedId]) {
      void fetchWarehouseStock(expandedId);
    }
  }, [expandedId, fetchSupplierSources, fetchWarehouseStock, sources, viewMode, whStocks]);

  async function toggleExpand(productId: number) {
    if (expandedId === productId) {
      setExpandedId(null);
      return;
    }

    setExpandedId(productId);
  }

  async function refreshSources(productId: number) {
    await fetchSupplierSources(productId);
    await fetchProducts();
  }

  async function setPreferred(sourceId: string, productId: number) {
    await supabase.from("product_suppliers").update({ is_preferred: false }).eq("product_id", productId);
    await supabase.from("product_suppliers").update({ is_preferred: true }).eq("id", sourceId);
    await refreshSources(productId);
  }

  async function saveEdit(sourceId: string, productId: number) {
    setSaving(true);

    await supabase
      .from("product_suppliers")
      .update({
        cost_price: editForm.cost_price,
        stock_available: editForm.stock_available,
        price_multiplier: editForm.price_multiplier,
        lead_time_days: editForm.lead_time_days,
        external_id: editForm.external_id || null,
      })
      .eq("id", sourceId);

    setEditingRow(null);
    setSaving(false);
    await refreshSources(productId);
  }

  async function removeSource(sourceId: string, productId: number) {
    if (!confirm("Eliminar este proveedor del producto?")) {
      return;
    }

    await supabase.from("product_suppliers").delete().eq("id", sourceId);
    await refreshSources(productId);
  }

  async function addSource(productId: number) {
    if (!addForm.supplier_id) {
      return;
    }

    setSaving(true);

    await supabase.from("product_suppliers").insert({
      product_id: productId,
      supplier_id: addForm.supplier_id,
      cost_price: Number(addForm.cost_price),
      stock_available: Number(addForm.stock_available),
      price_multiplier: Number(addForm.price_multiplier),
      lead_time_days: Number(addForm.lead_time_days),
      external_id: addForm.external_id || null,
    });

    setAddForm(EMPTY_FORM);
    setShowAddForm(null);
    setSaving(false);
    await refreshSources(productId);
  }

  const filteredProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          !search ||
          product.name.toLowerCase().includes(search.toLowerCase()) ||
          product.sku?.toLowerCase().includes(search.toLowerCase()),
      ),
    [products, search],
  );

  return (
    <div className="space-y-4">
      <SurfaceCard tone="default" padding="md" className="rounded-[24px] border-border/70">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Productos</p>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Gestion de stock</h2>
              <p className="text-sm text-muted-foreground">{products.length} productos ? {warehouses.length} depositos activos.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-2xl border border-border/70 bg-card p-1">
              <Button variant={viewMode === "suppliers" ? "soft" : "ghost"} size="sm" onClick={() => setViewMode("suppliers")}>
                Por proveedor
              </Button>
              <Button variant={viewMode === "warehouses" ? "soft" : "ghost"} size="sm" onClick={() => setViewMode("warehouses")}>
                Por deposito
              </Button>
            </div>

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar producto o SKU..."
              className="h-10 w-56 rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/40"
            />
          </div>
        </div>
      </SurfaceCard>

      {loading ? (

        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-14 animate-pulse rounded-2xl bg-card" />
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <EmptyState
          title={search ? "Sin resultados" : "Sin productos"}
          description={search ? "No hay coincidencias para la busqueda actual." : "No se encontraron productos activos para administrar stock."}
          icon={<Package size={22} />}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/70">
          {filteredProducts.map((product, index) => {
            const isExpanded = expandedId === product.id;
            const productSources = sources[product.id] ?? [];
            const warehouseStocks = whStocks[product.id] ?? [];

            return (
              <div key={product.id} className={cn(index > 0 && "border-t border-border/70")}>
                <button
                  type="button"
                  onClick={() => void toggleExpand(product.id)}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-3 text-left transition",
                    isExpanded ? "bg-secondary/60" : "bg-card hover:bg-secondary/50",
                  )}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
                    <Package size={14} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-foreground">{product.name}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">{product.sku}</p>
                  </div>

                  <div className="flex shrink-0 items-center gap-4">
                    {product.supplier_count !== null ? (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Layers size={11} />
                        <span className="text-[11px]">{product.supplier_count} prov.</span>
                      </div>
                    ) : null}

                    {product.net_available !== null && product.net_available <= 3 ? (
                      <AlertTriangle size={12} className="text-amber-500 dark:text-amber-400" />
                    ) : null}

                    <div className="w-24 text-right">
                      <StockBadge net={product.net_available} />
                    </div>

                    {isExpanded ? (
                      <ChevronUp size={14} className="text-muted-foreground" />
                    ) : (
                      <ChevronDown size={14} className="text-muted-foreground" />
                    )}
                  </div>
                </button>

                {isExpanded && viewMode === "suppliers" ? (
                  <div className="space-y-3 border-t border-border/70 bg-surface/60 px-4 py-3">
                    {/* Stock adjustment panel — only shown when backend is available */}
                    {hasBackendUrl && (
                      <div className="flex items-end gap-2 rounded-xl border border-border/70 bg-card px-3 py-2">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ajuste directo</p>
                          <input
                            type="number"
                            placeholder="Delta (ej. +10 o -5)"
                            value={adjustDelta[product.id] ?? ""}
                            onChange={(e) => setAdjustDelta((prev) => ({ ...prev, [product.id]: e.target.value }))}
                            className="h-8 w-28 rounded-lg border border-border/70 bg-background px-2 text-xs text-foreground outline-none focus:border-primary/40"
                          />
                        </div>
                        <div className="flex-1 space-y-1">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Motivo (opcional)</p>
                          <input
                            type="text"
                            placeholder="Ej. ajuste inventario"
                            value={adjustReason[product.id] ?? ""}
                            onChange={(e) => setAdjustReason((prev) => ({ ...prev, [product.id]: e.target.value }))}
                            className="h-8 w-full rounded-lg border border-border/70 bg-background px-2 text-xs text-foreground outline-none focus:border-primary/40"
                          />
                        </div>
                        <button
                          type="button"
                          disabled={adjustingId === product.id || !adjustDelta[product.id] || Number(adjustDelta[product.id]) === 0}
                          onClick={() => void handleAdjustStock(product.id)}
                          className="flex h-8 items-center gap-1 rounded-lg bg-primary/10 px-3 text-xs font-semibold text-primary transition hover:bg-primary/20 disabled:opacity-40"
                        >
                          <Save size={11} /> Aplicar
                        </button>
                      </div>
                    )}
                    {loadingSources === product.id ? (
                      <div className="text-xs text-muted-foreground">Cargando proveedores...</div>
                    ) : productSources.length === 0 ? (
                      <EmptyState
                        className="rounded-2xl py-10"
                        title="Sin proveedores asignados"
                        description="Agrega una fuente para habilitar costos, stock y prioridad comercial."
                        icon={<Layers size={20} />}
                      />
                    ) : (
                      <div className="space-y-2">
                        <div className="grid grid-cols-[1fr_110px_80px_80px_70px_70px_110px] gap-2 pb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                          <span>Proveedor</span>
                          <span>Costo</span>
                          <span>Stock</span>
                          <span>Reservado</span>
                          <span>Mult.</span>
                          <span>Plazo</span>
                          <span className="text-right">Acciones</span>
                        </div>

                        {productSources.map((source) => (
                          <SurfaceCard
                            key={source.id}
                            tone="subtle"
                            padding="sm"
                            className={cn(
                              "rounded-2xl border-border/70",
                              source.is_preferred && "border-primary/30 bg-primary/5",
                            )}
                          >
                            {editingRow === source.id ? (
                              <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-2">
                                  {(
                                    [
                                      { label: "Costo", key: "cost_price", type: "number" },
                                      { label: "Stock disponible", key: "stock_available", type: "number" },
                                      { label: "Multiplicador", key: "price_multiplier", type: "number" },
                                      { label: "Plazo (dias)", key: "lead_time_days", type: "number" },
                                    ] as const
                                  ).map(({ label, key, type }) => (
                                    <div key={key}>
                                      <label className="mb-1 block text-[10px] text-muted-foreground">{label}</label>
                                      <input
                                        type={type}
                                        value={editForm[key] ?? ""}
                                        onChange={(event) =>
                                          setEditForm((prev) => ({
                                            ...prev,
                                            [key]: Number(event.target.value),
                                          }))
                                        }
                                        className="w-full rounded-lg border border-border/70 bg-card px-2 py-1 text-xs text-foreground outline-none focus:border-primary/40"
                                      />
                                    </div>
                                  ))}

                                  <div className="col-span-2">
                                    <label className="mb-1 block text-[10px] text-muted-foreground">Codigo externo</label>
                                    <input
                                      value={editForm.external_id ?? ""}
                                      onChange={(event) =>
                                        setEditForm((prev) => ({
                                          ...prev,
                                          external_id: event.target.value,
                                        }))
                                      }
                                      className="w-full rounded-lg border border-border/70 bg-card px-2 py-1 text-xs text-foreground outline-none focus:border-primary/40"
                                    />
                                  </div>
                                </div>

                                <div className="flex justify-end gap-2">
                                  <Button variant="ghost" size="sm" onClick={() => setEditingRow(null)}>
                                    <X size={12} />
                                    Cancelar
                                  </Button>
                                  <Button size="sm" onClick={() => void saveEdit(source.id, product.id)} disabled={saving}>
                                    <Save size={12} />
                                    Guardar
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="grid grid-cols-[1fr_110px_80px_80px_70px_70px_110px] items-center gap-2">
                                <div className="flex min-w-0 items-center gap-1.5">
                                  {source.is_preferred ? <Star size={11} className="shrink-0 text-primary" /> : null}
                                  <span className="truncate text-xs text-foreground">{source.supplier_name}</span>
                                  {!source.active ? (
                                    <span className="shrink-0 text-[10px] text-destructive">(inactivo)</span>
                                  ) : null}
                                </div>

                                <div className="text-xs font-mono text-foreground">
                                  <p>${source.cost_price.toLocaleString("es-AR")} USD</p>
                                  {source.source_cost_price != null ? (
                                    <p className="text-[10px] text-muted-foreground">
                                      Fuente: {source.source_currency ?? "USD"} {source.source_cost_price.toLocaleString("es-AR")}
                                    </p>
                                  ) : null}
                                </div>

                                <span className="text-xs font-mono text-foreground">{source.stock_available}</span>
                                <span className="text-xs font-mono text-foreground">{source.stock_reserved}</span>
                                <span className="text-xs font-mono text-muted-foreground">x{source.price_multiplier}</span>
                                <span className="text-xs text-muted-foreground">{source.lead_time_days}d</span>

                                <div className="flex items-center justify-end gap-1">
                                  {!source.is_preferred ? (
                                    <Button variant="ghost" size="sm" title="Marcar como preferido" onClick={() => void setPreferred(source.id, product.id)}>
                                      <StarOff size={12} />
                                    </Button>
                                  ) : null}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setEditingRow(source.id);
                                      setEditForm(source);
                                    }}
                                  >
                                    <Pencil size={12} />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => void removeSource(source.id, product.id)}>
                                    <Trash2 size={12} />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </SurfaceCard>
                        ))}
                      </div>
                    )}

                    {showAddForm === product.id ? (
                      <SurfaceCard tone="subtle" padding="sm" className="space-y-3 rounded-2xl border-border/70">
                        <p className="text-xs font-semibold text-foreground">Agregar proveedor</p>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="col-span-2">
                            <label className="mb-1 block text-[10px] text-muted-foreground">Proveedor *</label>
                            <select
                              value={addForm.supplier_id}
                              onChange={(event) =>
                                setAddForm((prev) => ({
                                  ...prev,
                                  supplier_id: event.target.value,
                                }))
                              }
                              className="w-full rounded-lg border border-border/70 bg-card px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary/40"
                            >
                              <option value="">Seleccionar...</option>
                              {supplierOptions.map((supplier) => (
                                <option key={supplier.id} value={supplier.id}>
                                  {supplier.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {(
                            [
                              { label: "Costo", key: "cost_price" },
                              { label: "Stock disponible", key: "stock_available" },
                              { label: "Multiplicador", key: "price_multiplier" },
                              { label: "Plazo (dias)", key: "lead_time_days" },
                            ] as const
                          ).map(({ label, key }) => (
                            <div key={key}>
                              <label className="mb-1 block text-[10px] text-muted-foreground">{label}</label>
                              <input
                                type="number"
                                value={addForm[key]}
                                onChange={(event) =>
                                  setAddForm((prev) => ({
                                    ...prev,
                                    [key]: Number(event.target.value),
                                  }))
                                }
                                className="w-full rounded-lg border border-border/70 bg-card px-2 py-1 text-xs text-foreground outline-none focus:border-primary/40"
                              />
                            </div>
                          ))}

                          <div className="col-span-2">
                            <label className="mb-1 block text-[10px] text-muted-foreground">Codigo externo</label>
                            <input
                              value={addForm.external_id}
                              onChange={(event) =>
                                setAddForm((prev) => ({
                                  ...prev,
                                  external_id: event.target.value,
                                }))
                              }
                              placeholder="SKU-123"
                              className="w-full rounded-lg border border-border/70 bg-card px-2 py-1 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setShowAddForm(null)}>
                            Cancelar
                          </Button>
                          <Button size="sm" onClick={() => void addSource(product.id)} disabled={saving || !addForm.supplier_id}>
                            <Plus size={12} />
                            Agregar
                          </Button>
                        </div>
                      </SurfaceCard>
                    ) : (
                      <Button
                        variant="toolbar"
                        size="sm"
                        onClick={() => {
                          setShowAddForm(product.id);
                          setAddForm(EMPTY_FORM);
                        }}
                      >
                        <Plus size={12} />
                        Agregar proveedor
                      </Button>
                    )}
                  </div>
                ) : null}

                {isExpanded && viewMode === "warehouses" ? (
                  <div className="space-y-3 border-t border-border/70 bg-surface/60 px-4 py-3">
                    {loadingWh === product.id ? (
                      <div className="text-xs text-muted-foreground">Cargando depositos...</div>
                    ) : warehouseStocks.length === 0 ? (
                      <EmptyState
                        className="rounded-2xl py-10"
                        title="Sin stock en depositos"
                        description="El inventario fisico aparecera aqui cuando existan registros en product_stocks."
                        icon={<MapPin size={20} />}
                      />
                    ) : (
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {warehouseStocks.map((warehouse) => (
                          <SurfaceCard key={warehouse.warehouse_id} tone="subtle" padding="sm" className="rounded-2xl">
                            <div className="mb-3 flex items-center gap-2">
                              <Building size={12} className="text-primary" />
                              <span className="text-xs font-semibold text-foreground">{warehouse.warehouse_name}</span>
                            </div>

                            <div className="flex items-end justify-between gap-4">
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Disponible</p>
                                <p className="text-lg font-extrabold tabular-nums text-primary">{warehouse.stock}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Reservado</p>
                                <p
                                  className={cn(
                                    "text-sm font-bold tabular-nums",
                                    warehouse.stock_reserved > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
                                  )}
                                >
                                  {warehouse.stock_reserved}
                                </p>
                              </div>
                            </div>
                          </SurfaceCard>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
