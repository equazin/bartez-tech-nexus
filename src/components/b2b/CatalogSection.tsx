import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Loader2, Package, Search, Star, Truck, X } from "lucide-react";

import type { Product } from "@/models/products";
import type { PriceResult } from "@/hooks/usePricing";
import { ProductItem } from "@/components/b2b/ProductItem";
import { ProductTable } from "@/components/b2b/ProductTable";
import { VirtualizedProductList } from "@/components/b2b/VirtualizedProductList";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export type ViewMode = "grid" | "list" | "table";
export type CatalogContext = "default" | "featured" | "pos";

type AdvancedFilterKey = "brands" | "ram" | "storage" | "hz" | "panel";
type AdvancedFiltersState = Record<AdvancedFilterKey, string[]>;
type DerivedProductFilters = Record<Exclude<AdvancedFilterKey, "brands">, string[]> & { brand: string };

const ADVANCED_FILTERS_KEY = "b2b_catalog_advanced_filters";
const EMPTY_ADVANCED_FILTERS: AdvancedFiltersState = {
  brands: [],
  ram: [],
  storage: [],
  hz: [],
  panel: [],
};

const CATALOG_CONTEXTS: { id: CatalogContext; label: string; icon: typeof Package }[] = [
  { id: "default", label: "Catalogo general", icon: Package },
  { id: "featured", label: "Destacados", icon: Star },
  { id: "pos", label: "Punto de venta", icon: Truck },
];

const PANEL_VALUES = ["IPS", "TN", "VA", "OLED", "QLED", "MINI LED"];

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeCompact(value: unknown): string {
  return normalizeText(value).replace(/[^a-z0-9]+/g, " ").trim();
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => {
    const aNum = Number.parseFloat(a);
    const bNum = Number.parseFloat(b);
    if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) return aNum - bNum;
    return a.localeCompare(b, "es-AR");
  });
}

function parseStoredFilters(): AdvancedFiltersState {
  if (typeof window === "undefined") return EMPTY_ADVANCED_FILTERS;
  try {
    const raw = window.localStorage.getItem(ADVANCED_FILTERS_KEY);
    if (!raw) return EMPTY_ADVANCED_FILTERS;
    const parsed = JSON.parse(raw) as Partial<AdvancedFiltersState>;
    return {
      brands: Array.isArray(parsed.brands) ? parsed.brands.filter(Boolean) : [],
      ram: Array.isArray(parsed.ram) ? parsed.ram.filter(Boolean) : [],
      storage: Array.isArray(parsed.storage) ? parsed.storage.filter(Boolean) : [],
      hz: Array.isArray(parsed.hz) ? parsed.hz.filter(Boolean) : [],
      panel: Array.isArray(parsed.panel) ? parsed.panel.filter(Boolean) : [],
    };
  } catch {
    return EMPTY_ADVANCED_FILTERS;
  }
}

function formatSpecValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function collectSpecTexts(product: Product): string[] {
  const entries = Object.entries(product.specs ?? {});
  const texts = entries.flatMap(([key, value]) => [key, formatSpecValue(value)]);
  texts.push(product.name, product.description ?? "", product.category ?? "", product.brand_name ?? "");
  return texts.filter(Boolean);
}

function extractByRegex(text: string, regex: RegExp, formatter?: (match: RegExpExecArray) => string): string[] {
  const matches: string[] = [];
  const normalized = normalizeCompact(text);
  const globalRegex = new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : `${regex.flags}g`);
  let found = globalRegex.exec(normalized);
  while (found) {
    matches.push(formatter ? formatter(found) : found[0].toUpperCase());
    found = globalRegex.exec(normalized);
  }
  return matches;
}

function deriveProductFilters(product: Product): DerivedProductFilters {
  const specEntries = Object.entries(product.specs ?? {}).map(([key, value]) => ({
    key: normalizeCompact(key),
    raw: formatSpecValue(value),
    normalized: normalizeCompact(value),
  }));
  const allTexts = collectSpecTexts(product);

  const ramValues = new Set<string>();
  const storageValues = new Set<string>();
  const hzValues = new Set<string>();
  const panelValues = new Set<string>();

  specEntries.forEach(({ key, normalized }) => {
    if (/(^| )(ram|memoria|memory)( |$)/.test(key)) {
      extractByRegex(normalized, /(4|8|12|16|24|32|48|64|96|128)\s?(gb|tb)/gi, (match) => `${match[1]} ${match[2].toUpperCase()}`).forEach((value) => ramValues.add(value));
    }

    if (/(storage|almacen|capacity|capacidad|ssd|hdd|disk|disco)/.test(key)) {
      extractByRegex(normalized, /(64|128|240|250|256|480|500|512|960|1000|1024|2000|2048)\s?(gb|tb)/gi, (match) => `${match[1]} ${match[2].toUpperCase()}`).forEach((value) => storageValues.add(value));
    }

    if (/(hz|refresh|frecuencia)/.test(key)) {
      extractByRegex(normalized, /(60|75|90|100|120|144|165|180|200|240|360)\s?hz/gi, (match) => `${match[1]} Hz`).forEach((value) => hzValues.add(value));
    }

    PANEL_VALUES.forEach((panel) => {
      if (normalized.includes(panel.toLowerCase().replace(/\s+/g, " "))) panelValues.add(panel);
    });
  });

  allTexts.forEach((text) => {
    extractByRegex(text, /(4|8|12|16|24|32|48|64|96|128)\s?gb/gi, (match) => `${match[1]} GB`).forEach((value) => ramValues.add(value));
    extractByRegex(text, /(64|128|240|250|256|480|500|512|960|1000|1024|2000|2048)\s?(gb|tb)/gi, (match) => `${match[1]} ${match[2].toUpperCase()}`).forEach((value) => storageValues.add(value));
    extractByRegex(text, /(60|75|90|100|120|144|165|180|200|240|360)\s?hz/gi, (match) => `${match[1]} Hz`).forEach((value) => hzValues.add(value));
    const normalized = normalizeCompact(text);
    PANEL_VALUES.forEach((panel) => {
      if (normalized.includes(panel.toLowerCase().replace(/\s+/g, " "))) panelValues.add(panel);
    });
  });

  return {
    brand: String(product.brand_id ?? product.brand_name ?? ""),
    ram: uniqueSorted(Array.from(ramValues)),
    storage: uniqueSorted(Array.from(storageValues)),
    hz: uniqueSorted(Array.from(hzValues)),
    panel: uniqueSorted(Array.from(panelValues)),
  };
}

interface AdvancedFilterDropdownProps {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}

function AdvancedFilterDropdown({ label, options, selected, onToggle }: AdvancedFilterDropdownProps) {
  const [query, setQuery] = useState("");
  const visibleOptions = useMemo(() => {
    const needle = normalizeCompact(query);
    if (!needle) return options;
    return options.filter((option) => normalizeCompact(option).includes(needle));
  }, [options, query]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="toolbar" size="sm" className="h-9 rounded-xl px-3 text-xs font-semibold text-foreground">
          {label}
          {selected.length > 0 ? <Badge variant="muted" className="rounded-full">{selected.length}</Badge> : null}
          <ChevronDown size={13} className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[260px] rounded-2xl border border-border/70 bg-card p-3 shadow-xl">
        <div className="space-y-3">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Buscar ${label.toLowerCase()}`}
            className="h-9 rounded-xl border-border/70 bg-background text-sm"
          />

          <ScrollArea className="h-64 rounded-xl border border-border/60 bg-background/70">
            <div className="space-y-1 p-2">
              {visibleOptions.map((option) => {
                const checked = selected.includes(option);
                return (
                  <label key={option} className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 text-sm transition hover:bg-secondary/70">
                    <Checkbox checked={checked} onCheckedChange={() => onToggle(option)} />
                    <span className="min-w-0 flex-1 truncate text-foreground">{option}</span>
                  </label>
                );
              })}
              {visibleOptions.length === 0 ? <p className="px-2 py-6 text-center text-sm text-muted-foreground">Sin coincidencias.</p> : null}
            </div>
          </ScrollArea>

          {selected.length > 0 ? (
            <Button type="button" variant="ghost" size="sm" className="h-8 w-full rounded-xl text-xs" onClick={() => selected.forEach((option) => onToggle(option))}>
              Limpiar seleccion
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export interface CatalogSectionProps {
  displayProducts: Product[];
  products: Product[];
  productsLoading: boolean;
  totalCount: number;
  hasMore: boolean;
  loadMore: () => void;
  search: string;
  hasActiveFilters: boolean;
  clearFilters: () => void;
  viewMode: ViewMode;
  handleViewModeChange: (mode: ViewMode) => void;
  catalogContext: CatalogContext;
  setCatalogContext: (ctx: CatalogContext) => void;
  cart: Record<number, number>;
  computePrice: (p: Product, qty: number) => PriceResult;
  formatPrice: (n: number) => string;
  productMargins: Record<number, number>;
  globalMargin: number;
  onRemoveFromCart: (p: Product) => void;
  handleSmartAddToCart: (product: Product, qty: number) => void;
  handleToggleFavorite: (id: number) => void;
  toggleCompare: (id: number) => void;
  setSelectedProduct: (p: Product | null) => void;
  isPosProduct: (p: Product) => boolean;
  favoriteProductIds: number[];
  compareList: number[];
  addedIds: Set<number>;
  purchaseHistory: Record<number, number>;
  latestPurchaseUnitPrice: Record<number, number>;
}

export function CatalogSection({
  displayProducts,
  products,
  productsLoading,
  totalCount,
  hasMore,
  loadMore,
  search,
  hasActiveFilters,
  clearFilters,
  viewMode,
  handleViewModeChange,
  catalogContext,
  setCatalogContext,
  cart,
  computePrice,
  formatPrice,
  productMargins,
  globalMargin,
  onRemoveFromCart,
  handleSmartAddToCart,
  handleToggleFavorite,
  toggleCompare,
  setSelectedProduct,
  isPosProduct,
  favoriteProductIds,
  compareList,
  addedIds,
  purchaseHistory,
  latestPurchaseUnitPrice,
}: CatalogSectionProps) {
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFiltersState>(parseStoredFilters);

  useEffect(() => {
    window.localStorage.setItem(ADVANCED_FILTERS_KEY, JSON.stringify(advancedFilters));
  }, [advancedFilters]);

  const derivedFiltersByProduct = useMemo(() => {
    const entries = displayProducts.map((product) => [product.id, deriveProductFilters(product)] as const);
    return new Map(entries);
  }, [displayProducts]);

  const brandOptions = useMemo(
    () => uniqueSorted(displayProducts.map((product) => String(product.brand_name ?? "")).filter(Boolean)),
    [displayProducts],
  );
  const ramOptions = useMemo(() => uniqueSorted(displayProducts.flatMap((product) => derivedFiltersByProduct.get(product.id)?.ram ?? [])), [displayProducts, derivedFiltersByProduct]);
  const storageOptions = useMemo(() => uniqueSorted(displayProducts.flatMap((product) => derivedFiltersByProduct.get(product.id)?.storage ?? [])), [displayProducts, derivedFiltersByProduct]);
  const hzOptions = useMemo(() => uniqueSorted(displayProducts.flatMap((product) => derivedFiltersByProduct.get(product.id)?.hz ?? [])), [displayProducts, derivedFiltersByProduct]);
  const panelOptions = useMemo(() => uniqueSorted(displayProducts.flatMap((product) => derivedFiltersByProduct.get(product.id)?.panel ?? [])), [displayProducts, derivedFiltersByProduct]);

  const toggleAdvancedFilter = (key: AdvancedFilterKey, value: string) => {
    setAdvancedFilters((current) => ({
      ...current,
      [key]: current[key].includes(value) ? current[key].filter((item) => item !== value) : [...current[key], value],
    }));
  };

  const clearAdvancedFilters = () => setAdvancedFilters(EMPTY_ADVANCED_FILTERS);

  // Intersect persisted selections with currently available options — no useEffect needed
  const effectiveFilters = useMemo(() => ({
    brands: advancedFilters.brands.filter((item) => brandOptions.includes(item)),
    ram: advancedFilters.ram.filter((item) => ramOptions.includes(item)),
    storage: advancedFilters.storage.filter((item) => storageOptions.includes(item)),
    hz: advancedFilters.hz.filter((item) => hzOptions.includes(item)),
    panel: advancedFilters.panel.filter((item) => panelOptions.includes(item)),
  }), [advancedFilters, brandOptions, ramOptions, storageOptions, hzOptions, panelOptions]);

  const hasAdvancedFilters = Object.values(effectiveFilters).some((values) => values.length > 0);

  const filteredProducts = useMemo(
    () =>
      displayProducts.filter((product) => {
        const derived = derivedFiltersByProduct.get(product.id);
        const brandName = String(product.brand_name ?? "");

        if (effectiveFilters.brands.length > 0 && !effectiveFilters.brands.includes(brandName)) return false;
        if (effectiveFilters.ram.length > 0 && !effectiveFilters.ram.some((value) => derived?.ram.includes(value))) return false;
        if (effectiveFilters.storage.length > 0 && !effectiveFilters.storage.some((value) => derived?.storage.includes(value))) return false;
        if (effectiveFilters.hz.length > 0 && !effectiveFilters.hz.some((value) => derived?.hz.includes(value))) return false;
        if (effectiveFilters.panel.length > 0 && !effectiveFilters.panel.some((value) => derived?.panel.includes(value))) return false;

        return true;
      }),
    [effectiveFilters, derivedFiltersByProduct, displayProducts],
  );

  const resultsLabel = `${filteredProducts.length}${totalCount > 0 ? ` de ${totalCount}` : ""} productos`;

  return (
    <>
      <div className="mb-4 space-y-4">
        <div className="rounded-[24px] border border-border/70 bg-card/85 p-4 shadow-sm">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Compra mayorista</p>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {CATALOG_CONTEXTS.map(({ id, label, icon: Icon }) => {
                const isActive = catalogContext === id;
                return (
                  <Button
                    key={id}
                    size="sm"
                    variant={isActive ? "soft" : "ghost"}
                    className="rounded-full border border-border/70"
                    onClick={() => setCatalogContext(id)}
                  >
                    <Icon size={14} />
                    {label}
                  </Button>
                );
              })}

              {(brandOptions.length > 0 || ramOptions.length > 0 || storageOptions.length > 0 || hzOptions.length > 0 || panelOptions.length > 0) && (
                <div className="h-5 w-px bg-border/70" />
              )}

              {brandOptions.length > 0 ? <AdvancedFilterDropdown label="Marca" options={brandOptions} selected={effectiveFilters.brands} onToggle={(value) => toggleAdvancedFilter("brands", value)} /> : null}
              {ramOptions.length > 0 ? <AdvancedFilterDropdown label="RAM" options={ramOptions} selected={effectiveFilters.ram} onToggle={(value) => toggleAdvancedFilter("ram", value)} /> : null}
              {storageOptions.length > 0 ? <AdvancedFilterDropdown label="Almacenamiento" options={storageOptions} selected={effectiveFilters.storage} onToggle={(value) => toggleAdvancedFilter("storage", value)} /> : null}
              {hzOptions.length > 0 ? <AdvancedFilterDropdown label="Hz" options={hzOptions} selected={effectiveFilters.hz} onToggle={(value) => toggleAdvancedFilter("hz", value)} /> : null}
              {panelOptions.length > 0 ? <AdvancedFilterDropdown label="Panel" options={panelOptions} selected={effectiveFilters.panel} onToggle={(value) => toggleAdvancedFilter("panel", value)} /> : null}
              {hasAdvancedFilters ? (
                <Button type="button" variant="ghost" size="sm" className="h-9 rounded-xl px-3 text-xs" onClick={clearAdvancedFilters}>
                  <X size={13} />
                  Limpiar avanzados
                </Button>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background p-1 md:hidden">
                {(["list", "grid", "table"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => handleViewModeChange(mode)}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-semibold transition",
                      viewMode === mode ? "bg-primary/10 text-primary" : "text-muted-foreground",
                    )}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>

              {!productsLoading ? (
                <div className="rounded-2xl border border-border/70 bg-background px-3 py-2 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{resultsLabel}</span>
                  {search ? (
                    <> para <span className="font-semibold text-foreground">&quot;{search}&quot;</span></>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {productsLoading ? (
        viewMode === "list" || viewMode === "table" ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="animate-pulse rounded-xl border border-border/70 bg-card px-4 py-3">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 shrink-0 rounded-xl bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-2/3 rounded bg-muted" />
                    <div className="h-2.5 w-1/3 rounded bg-muted" />
                  </div>
                  <div className="h-10 w-44 rounded-xl bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 2xl:grid-cols-5">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="animate-pulse rounded-[22px] border border-border/70 bg-card p-3">
                <div className="mb-3 h-28 w-full rounded-lg bg-muted" />
                <div className="mb-2 h-3.5 w-3/4 rounded bg-muted" />
                <div className="mb-3 h-2.5 w-1/2 rounded bg-muted" />
                <div className="h-10 w-full rounded-xl bg-muted" />
              </div>
            ))}
          </div>
        )
      ) : filteredProducts.length === 0 ? (
        <EmptyState
          title="No se encontraron productos"
          description={search || hasActiveFilters || hasAdvancedFilters ? "Revisa la busqueda o resetea los filtros." : undefined}
          icon={<Search size={20} />}
          actionLabel={search || hasActiveFilters || hasAdvancedFilters ? "Limpiar filtros" : undefined}
          onAction={() => {
            clearFilters();
            clearAdvancedFilters();
          }}
          className="py-16"
        />
      ) : viewMode === "list" ? (
        filteredProducts.length <= 80 ? (
          <div className="flex flex-col gap-2">
            {filteredProducts.map((product) => {
              const price = computePrice(product, Math.max(cart[product.id] || 0, 1));
              return (
                <ProductItem
                  key={product.id}
                  product={product}
                  viewMode="list"
                  inCart={cart[product.id] || 0}
                  isFavorite={favoriteProductIds.includes(product.id)}
                  isCompared={compareList.includes(product.id)}
                  finalPrice={price.unitPrice}
                  formatPrice={formatPrice}
                  onAddQty={handleSmartAddToCart}
                  onRemoveFromCart={onRemoveFromCart}
                  onToggleFavorite={handleToggleFavorite}
                  onToggleCompare={toggleCompare}
                  onSelect={setSelectedProduct}
                  isPosProduct={isPosProduct}
                  wasAdded={addedIds.has(product.id)}
                  purchaseHistoryCount={purchaseHistory[product.id]}
                  lastPurchaseUnitPriceDelta={
                    latestPurchaseUnitPrice[product.id]
                      ? ((price.unitPrice - latestPurchaseUnitPrice[product.id]) / latestPurchaseUnitPrice[product.id]) * 100
                      : 0
                  }
                />
              );
            })}
          </div>
        ) : (
          <VirtualizedProductList
            products={filteredProducts}
            cart={cart}
            favoriteProductIds={favoriteProductIds}
            compareList={compareList}
            addedIds={addedIds}
            purchaseHistory={purchaseHistory}
            latestPurchaseUnitPrice={latestPurchaseUnitPrice}
            computePrice={computePrice}
            formatPrice={formatPrice}
            handleAddQty={handleSmartAddToCart}
            onRemoveFromCart={onRemoveFromCart}
            handleToggleFavorite={handleToggleFavorite}
            toggleCompare={toggleCompare}
            setSelectedProduct={setSelectedProduct}
            isPosProduct={isPosProduct}
            hasMore={hasMore}
            onLoadMore={loadMore}
          />
        )
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 2xl:grid-cols-5">
          {filteredProducts.map((product) => {
            const price = computePrice(product, Math.max(cart[product.id] || 0, 1));
            return (
              <div key={product.id} style={{ contentVisibility: "auto", containIntrinsicSize: "0 240px" }}>
                <ProductItem
                  product={product}
                  viewMode="grid"
                  inCart={cart[product.id] || 0}
                  isFavorite={favoriteProductIds.includes(product.id)}
                  isCompared={compareList.includes(product.id)}
                  finalPrice={price.unitPrice}
                  formatPrice={formatPrice}
                  onAddQty={handleSmartAddToCart}
                  onRemoveFromCart={onRemoveFromCart}
                  onToggleFavorite={handleToggleFavorite}
                  onToggleCompare={toggleCompare}
                  onSelect={setSelectedProduct}
                  isPosProduct={isPosProduct}
                  wasAdded={addedIds.has(product.id)}
                  purchaseHistoryCount={purchaseHistory[product.id]}
                  lastPurchaseUnitPriceDelta={
                    latestPurchaseUnitPrice[product.id]
                      ? ((price.unitPrice - latestPurchaseUnitPrice[product.id]) / latestPurchaseUnitPrice[product.id]) * 100
                      : 0
                  }
                />
              </div>
            );
          })}
        </div>
      ) : (
        <ProductTable
          products={filteredProducts}
          cart={cart}
          favoriteProductIds={favoriteProductIds}
          productMargins={productMargins}
          globalMargin={globalMargin}
          latestPurchaseUnitPrice={latestPurchaseUnitPrice}
          formatPrice={formatPrice}
          onAddQty={handleSmartAddToCart}
          onRemoveFromCart={onRemoveFromCart}
          onSelect={setSelectedProduct}
          isPosProduct={isPosProduct}
          addedIds={addedIds}
          getUnitPrice={(product, qty) => computePrice(product, qty).unitPrice}
        />
      )}

      {hasMore && !productsLoading && viewMode !== "list" && filteredProducts.length > 0 ? (
        <div className="mb-12 mt-8 flex justify-center">
          <Button variant="outline" size="lg" className="rounded-xl px-8" onClick={loadMore}>
            Ver mas productos
          </Button>
        </div>
      ) : null}

      {productsLoading && products.length > 0 ? (
        <div className="mb-12 mt-6 flex justify-center">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Loader2 size={14} className="animate-spin text-primary" />
            Cargando mas...
          </div>
        </div>
      ) : null}
    </>
  );
}
