import { useCallback, useEffect, useMemo, useState } from "react";
import { Cpu, Layers3, Save, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { supabase } from "@/lib/supabase";
import type { PriceResult } from "@/hooks/usePricing";
import type { Product } from "@/models/products";

interface ProductConfigurationComponent {
  category: string;
  product_id: number;
  quantity: number;
  required: boolean;
}

interface ProductConfigurationRow {
  id: string;
  name: string;
  base_product_id: number | null;
  components: ProductConfigurationComponent[];
  is_template: boolean;
  profile_id: string | null;
  created_at: string;
}

interface ProductConfiguratorProps {
  profileId?: string | null;
  products: Product[];
  computePrice: (product: Product, quantity: number) => PriceResult;
  formatPrice: (value: number) => string;
  onAddToCart: (product: Product, quantity: number) => void;
}

const STEP_LABELS = [
  "1. Base",
  "2. Componentes",
  "3. Resumen",
] as const;

function buildEmptyComponent(products: Product[]): ProductConfigurationComponent {
  return {
    category: products[0]?.category ?? "Componente",
    product_id: products[0]?.id ?? 0,
    quantity: 1,
    required: true,
  };
}

function normalizeComponents(value: unknown): ProductConfigurationComponent[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const raw = entry as Partial<ProductConfigurationComponent>;
      return {
        category: String(raw.category ?? "Componente").trim() || "Componente",
        product_id: Number(raw.product_id),
        quantity: Math.max(1, Number(raw.quantity) || 1),
        required: raw.required !== false,
      };
    })
    .filter((entry): entry is ProductConfigurationComponent => Boolean(entry) && entry.product_id > 0);
}

export function ProductConfigurator({
  profileId,
  products,
  computePrice,
  formatPrice,
  onAddToCart,
}: ProductConfiguratorProps) {
  const [configurations, setConfigurations] = useState<ProductConfigurationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [baseProductId, setBaseProductId] = useState<number>(0);
  const [components, setComponents] = useState<ProductConfigurationComponent[]>(() =>
    products[0] ? [buildEmptyComponent(products)] : [],
  );

  const productsMap = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );

  const categoryOptions = useMemo(
    () => Array.from(new Set(products.map((product) => product.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, "es-AR")),
    [products],
  );

  const selectedConfiguration = useMemo(
    () => configurations.find((configuration) => configuration.id === selectedId) ?? null,
    [configurations, selectedId],
  );

  const isEditingOwnConfiguration = Boolean(
    selectedConfiguration &&
    !selectedConfiguration.is_template &&
    selectedConfiguration.profile_id === profileId,
  );

  const loadConfigurations = useCallback(async () => {
    if (!profileId) {
      setConfigurations([]);
      return;
    }

    setLoading(true);
    try {
      const [globalResult, ownResult] = await Promise.all([
        supabase
          .from("product_configurations")
          .select("*")
          .eq("is_template", true)
          .order("created_at", { ascending: false }),
        supabase
          .from("product_configurations")
          .select("*")
          .eq("profile_id", profileId)
          .order("created_at", { ascending: false }),
      ]);

      if (globalResult.error) throw globalResult.error;
      if (ownResult.error) throw ownResult.error;

      const merged = [
        ...((globalResult.data ?? []) as Array<Record<string, unknown>>),
        ...((ownResult.data ?? []) as Array<Record<string, unknown>>),
      ];

      const normalized = Array.from(new Map(merged.map((row) => [String(row.id), row])).values()).map((row) => ({
        id: String(row.id),
        name: String(row.name ?? "Configuracion"),
        base_product_id: row.base_product_id ? Number(row.base_product_id) : null,
        components: normalizeComponents(row.components),
        is_template: row.is_template === true,
        profile_id: typeof row.profile_id === "string" ? row.profile_id : null,
        created_at: String(row.created_at ?? new Date().toISOString()),
      })).sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());

      setConfigurations(normalized);
    } catch {
      setConfigurations([]);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    void loadConfigurations();
  }, [loadConfigurations]);

  useEffect(() => {
    if (!selectedConfiguration) return;

    setName(selectedConfiguration.name);
    setBaseProductId(selectedConfiguration.base_product_id ?? 0);
    setComponents(
      selectedConfiguration.components.length > 0
        ? selectedConfiguration.components
        : (products[0] ? [buildEmptyComponent(products)] : []),
    );
  }, [products, selectedConfiguration]);

  useEffect(() => {
    if (selectedId || products.length === 0) return;
    setComponents((current) => (current.length > 0 ? current : [buildEmptyComponent(products)]));
  }, [products, selectedId]);

  function resetEditor() {
    setSelectedId(null);
    setName("");
    setBaseProductId(0);
    setComponents(products[0] ? [buildEmptyComponent(products)] : []);
  }

  function updateComponent(index: number, patch: Partial<ProductConfigurationComponent>) {
    setComponents((current) =>
      current.map((component, componentIndex) =>
        componentIndex === index ? { ...component, ...patch } : component,
      ),
    );
  }

  const selectedItems = useMemo(() => {
    const baseProduct = baseProductId ? productsMap.get(baseProductId) ?? null : null;
    const componentRows = components
      .map((component) => ({
        ...component,
        product: productsMap.get(component.product_id) ?? null,
      }))
      .filter((component) => component.product);

    return {
      baseProduct,
      componentRows,
    };
  }, [baseProductId, components, productsMap]);

  const estimatedTotal = useMemo(() => {
    const baseTotal = selectedItems.baseProduct
      ? computePrice(selectedItems.baseProduct, 1).totalWithIVA
      : 0;

    const componentsTotal = selectedItems.componentRows.reduce((sum, component) => {
      return sum + computePrice(component.product!, component.quantity).totalWithIVA;
    }, 0);

    return baseTotal + componentsTotal;
  }, [computePrice, selectedItems]);

  async function handleSaveConfiguration() {
    if (!profileId) {
      toast.error("Necesitas una cuenta autenticada para guardar configuraciones.");
      return;
    }

    if (!name.trim()) {
      toast.error("Defini un nombre para la configuracion.");
      return;
    }

    const cleanComponents = components.filter((component) => component.product_id > 0 && component.quantity > 0);
    if (!baseProductId && cleanComponents.length === 0) {
      toast.error("Agrega un producto base o al menos un componente.");
      return;
    }

    const payload = {
      name: name.trim(),
      base_product_id: baseProductId || null,
      components: cleanComponents,
      is_template: false,
      profile_id: profileId,
    };

    if (isEditingOwnConfiguration && selectedConfiguration) {
      const { data, error } = await supabase
        .from("product_configurations")
        .update(payload)
        .eq("id", selectedConfiguration.id)
        .select("*")
        .single();

      if (error || !data) {
        toast.error("No se pudo actualizar la configuracion.");
        return;
      }

      const nextRow: ProductConfigurationRow = {
        id: String(data.id),
        name: String(data.name),
        base_product_id: data.base_product_id ? Number(data.base_product_id) : null,
        components: normalizeComponents(data.components),
        is_template: data.is_template === true,
        profile_id: typeof data.profile_id === "string" ? data.profile_id : null,
        created_at: String(data.created_at ?? new Date().toISOString()),
      };

      setConfigurations((current) => current.map((item) => (item.id === nextRow.id ? nextRow : item)));
      toast.success("Configuracion actualizada.");
      return;
    }

    const { data, error } = await supabase
      .from("product_configurations")
      .insert(payload)
      .select("*")
      .single();

    if (error || !data) {
      toast.error("No se pudo guardar la plantilla.");
      return;
    }

    const nextRow: ProductConfigurationRow = {
      id: String(data.id),
      name: String(data.name),
      base_product_id: data.base_product_id ? Number(data.base_product_id) : null,
      components: normalizeComponents(data.components),
      is_template: data.is_template === true,
      profile_id: typeof data.profile_id === "string" ? data.profile_id : null,
      created_at: String(data.created_at ?? new Date().toISOString()),
    };

    setConfigurations((current) => [nextRow, ...current]);
    setSelectedId(nextRow.id);
    toast.success("Plantilla guardada.");
  }

  async function handleDeleteConfiguration() {
    if (!selectedConfiguration || !isEditingOwnConfiguration) return;

    const { error } = await supabase
      .from("product_configurations")
      .delete()
      .eq("id", selectedConfiguration.id);

    if (error) {
      toast.error("No se pudo eliminar la plantilla.");
      return;
    }

    setConfigurations((current) => current.filter((item) => item.id !== selectedConfiguration.id));
    resetEditor();
    toast.success("Plantilla eliminada.");
  }

  function handleAddConfigurationToCart() {
    if (selectedItems.baseProduct) {
      onAddToCart(selectedItems.baseProduct, 1);
    }

    selectedItems.componentRows.forEach((component) => {
      onAddToCart(component.product!, component.quantity);
    });

    toast.success("Configuracion cargada al carrito.");
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Sprint 3"
        title="Configurador IT"
        description="Arma bundles tecnicos con equipo base, componentes y plantillas reutilizables para acelerar propuestas recurrentes."
        actions={
          <Button variant="outline" onClick={resetEditor}>
            <Layers3 size={14} />
            Nueva configuracion
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[0.86fr_1.14fr]">
        <SurfaceCard padding="md" className="space-y-4 rounded-[24px] border-border/70">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Plantillas
              </p>
              <h3 className="mt-1 text-lg font-semibold text-foreground">Guardadas y globales</h3>
            </div>
            <Badge variant="outline">{configurations.length}</Badge>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-20 animate-pulse rounded-2xl border border-border/70 bg-surface/60" />
              ))}
            </div>
          ) : configurations.length === 0 ? (
            <EmptyState
              className="rounded-[22px]"
              icon={<Cpu size={22} />}
              title="Sin configuraciones disponibles"
              description="Guarda tu primera plantilla para reusar configuraciones de equipos o bundles comerciales."
            />
          ) : (
            <div className="space-y-3">
              {configurations.map((configuration) => (
                <button
                  key={configuration.id}
                  type="button"
                  onClick={() => setSelectedId(configuration.id)}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                    configuration.id === selectedId
                      ? "border-primary/30 bg-primary/5"
                      : "border-border/70 bg-card hover:bg-surface/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{configuration.name}</p>
                        <Badge variant={configuration.is_template ? "outline" : "secondary"}>
                          {configuration.is_template ? "Bartez" : "Propia"}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {configuration.base_product_id ? "Con equipo base" : "Desde cero"} · {configuration.components.length} componentes
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(configuration.created_at).toLocaleDateString("es-AR")}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </SurfaceCard>

        <SurfaceCard padding="md" className="space-y-4 rounded-[24px] border-border/70">
          <div className="flex flex-wrap items-center gap-2">
            {STEP_LABELS.map((label, index) => (
              <Badge key={label} variant={index === 2 ? "secondary" : "outline"} className="rounded-full">
                {label}
              </Badge>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <label className="space-y-1.5">
                <span className="text-xs text-muted-foreground">Nombre de la configuracion</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="h-10 w-full rounded-xl border border-border/70 bg-card px-3 text-sm outline-none"
                  placeholder="Ej: Workstation diseño 32GB + SSD"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs text-muted-foreground">Equipo base</span>
                <select
                  value={baseProductId}
                  onChange={(event) => setBaseProductId(Number(event.target.value))}
                  className="h-10 w-full rounded-xl border border-border/70 bg-card px-3 text-sm outline-none"
                >
                  <option value={0}>Desde cero</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} ({product.sku || product.category})
                    </option>
                  ))}
                </select>
              </label>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">Componentes</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setComponents((current) => [...current, buildEmptyComponent(products)])
                    }
                  >
                    Agregar componente
                  </Button>
                </div>

                {components.length === 0 ? (
                  <EmptyState
                    className="rounded-[22px]"
                    title="Sin componentes"
                    description="Podes usar solo el equipo base o agregar componentes adicionales por categoria."
                  />
                ) : (
                  <div className="space-y-3">
                    {components.map((component, index) => (
                      <div
                        key={`${component.product_id}-${index}`}
                        className="grid gap-3 rounded-2xl border border-border/70 bg-surface/40 p-4"
                      >
                        <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)_96px]">
                          <label className="space-y-1.5">
                            <span className="text-xs text-muted-foreground">Categoria</span>
                            <input
                              list="configurator-categories"
                              value={component.category}
                              onChange={(event) => updateComponent(index, { category: event.target.value })}
                              className="h-10 w-full rounded-xl border border-border/70 bg-card px-3 text-sm outline-none"
                            />
                          </label>
                          <label className="space-y-1.5">
                            <span className="text-xs text-muted-foreground">Producto</span>
                            <select
                              value={component.product_id}
                              onChange={(event) => updateComponent(index, { product_id: Number(event.target.value) })}
                              className="h-10 w-full rounded-xl border border-border/70 bg-card px-3 text-sm outline-none"
                            >
                              {products.map((product) => (
                                <option key={product.id} value={product.id}>
                                  {product.name} ({product.sku || product.category})
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="space-y-1.5">
                            <span className="text-xs text-muted-foreground">Cantidad</span>
                            <input
                              type="number"
                              min={1}
                              value={component.quantity}
                              onChange={(event) =>
                                updateComponent(index, { quantity: Math.max(1, Number(event.target.value) || 1) })
                              }
                              className="h-10 w-full rounded-xl border border-border/70 bg-card px-3 text-sm outline-none"
                            />
                          </label>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={component.required}
                              onChange={(event) => updateComponent(index, { required: event.target.checked })}
                            />
                            Componente obligatorio
                          </label>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setComponents((current) => current.filter((_, componentIndex) => componentIndex !== index))
                            }
                          >
                            <Trash2 size={14} />
                            Quitar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <datalist id="configurator-categories">
                {categoryOptions.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </div>

            <div className="space-y-4">
              <SurfaceCard padding="sm" tone="subtle" className="space-y-3 rounded-[20px] border-border/70">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Resumen
                  </p>
                  <h3 className="mt-1 text-base font-semibold text-foreground">Costo estimado</h3>
                </div>

                {selectedItems.baseProduct ? (
                  <div className="rounded-2xl border border-border/70 bg-card px-3 py-3">
                    <p className="text-xs text-muted-foreground">Base</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{selectedItems.baseProduct.name}</p>
                    <p className="mt-1 text-sm text-primary">{formatPrice(computePrice(selectedItems.baseProduct, 1).totalWithIVA)}</p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-card px-3 py-3 text-sm text-muted-foreground">
                    Configuracion sin equipo base.
                  </div>
                )}

                <div className="space-y-2">
                  {selectedItems.componentRows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin componentes extra.</p>
                  ) : (
                    selectedItems.componentRows.map((component, index) => (
                      <div key={`${component.product_id}-${index}`} className="rounded-2xl border border-border/70 bg-card px-3 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs text-muted-foreground">{component.category}</p>
                            <p className="mt-1 text-sm font-semibold text-foreground">{component.product?.name}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {component.quantity} u. · {component.required ? "Obligatorio" : "Opcional"}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-primary">
                            {component.product ? formatPrice(computePrice(component.product, component.quantity).totalWithIVA) : "-"}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Total estimado
                  </p>
                  <p className="mt-2 text-2xl font-black text-primary">{formatPrice(estimatedTotal)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Calculado con las condiciones comerciales activas del cliente.
                  </p>
                </div>
              </SurfaceCard>

              <div className="flex flex-wrap gap-2">
                <Button onClick={handleAddConfigurationToCart}>
                  <ShoppingCart size={14} />
                  Agregar configuracion al carrito
                </Button>
                <Button variant="outline" onClick={() => void handleSaveConfiguration()}>
                  <Save size={14} />
                  Guardar como plantilla
                </Button>
                {isEditingOwnConfiguration ? (
                  <Button variant="ghost" onClick={() => void handleDeleteConfiguration()}>
                    <Trash2 size={14} />
                    Eliminar
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}
