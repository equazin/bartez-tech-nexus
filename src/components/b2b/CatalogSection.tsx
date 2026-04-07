import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownAZ, ChevronDown, Loader2, Package, Search, Star, Truck, X, LayoutGrid, ChevronRight,
  Cpu, Zap, HardDrive, Monitor, Globe, Gamepad2, Box, Mouse, Headphones, Printer, Smartphone, Server, Camera, Speaker, HardDrive as Disc,
  Share2, MoreHorizontal, Grid
} from "lucide-react";

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
export type SortOption = "price_asc" | "price_desc" | "name_asc" | "name_desc" | "brand_asc" | "brand_desc" | "stock_asc" | "stock_desc";

type AdvancedFilterKey = "brands";
type AdvancedFiltersState = Record<AdvancedFilterKey, string[]>;

const ADVANCED_FILTERS_KEY = "b2b_catalog_advanced_filters";
const EMPTY_ADVANCED_FILTERS: AdvancedFiltersState = {
  brands: [],
};

const CATALOG_CONTEXTS: { id: CatalogContext; label: string; icon: typeof Package }[] = [
  { id: "default", label: "Catalogo general", icon: Package },
  { id: "featured", label: "Destacados", icon: Star },
  { id: "pos", label: "Punto de venta", icon: Truck },
];

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

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeCompact(value: unknown): string {
  return normalizeText(value).replace(/[^a-z0-9]+/g, " ").trim();
}

function uniqueSorted(values: (string | null | undefined)[]): string[] {
  return Array.from(new Set(values.filter(Boolean) as string[])).sort((a, b) => {
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
    };
  } catch {
    return EMPTY_ADVANCED_FILTERS;
  }
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
  page: number;
  setPage: (p: number) => void;
  categoryTree: { parents: { name: string; children: string[] }[]; leaves: string[] };
  categoryFilter: string;
  setCategoryFilter: (cat: string) => void;
  categoryCounts: Record<string, number>;
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
  page,
  setPage,
  categoryTree,
  categoryFilter,
  setCategoryFilter,
  categoryCounts,
}: CatalogSectionProps) {
  const [activeParentInMenu, setActiveParentInMenu] = useState<string | null>(null);

  useEffect(() => {
    if (categoryTree.parents.length > 0 && !activeParentInMenu) {
      setActiveParentInMenu(categoryTree.parents[0].name);
    }
  }, [categoryTree, activeParentInMenu]);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFiltersState>(parseStoredFilters);
  const [sortOption, setSortOption] = useState<SortOption>("name_asc");

  useEffect(() => {
    window.localStorage.setItem(ADVANCED_FILTERS_KEY, JSON.stringify(advancedFilters));
  }, [advancedFilters]);

  const brandOptions = useMemo(
    () => uniqueSorted(displayProducts.map((product) => product.brand_name)),
    [displayProducts],
  );

  const toggleAdvancedFilter = (key: AdvancedFilterKey, value: string) => {
    setAdvancedFilters((current) => ({
      ...current,
      [key]: current[key].includes(value) ? current[key].filter((item) => item !== value) : [...current[key], value],
    }));
  };

  const clearAdvancedFilters = () => setAdvancedFilters(EMPTY_ADVANCED_FILTERS);

  const effectiveFilters = useMemo(() => ({
    brands: advancedFilters.brands.filter((item) => brandOptions.includes(item)),
  }), [advancedFilters, brandOptions]);

  const hasAdvancedFilters = Object.values(effectiveFilters).some((values) => values.length > 0);

  const filteredProducts = useMemo(
    () =>
      [...displayProducts]
        .filter((product) => {
          if (effectiveFilters.brands.length > 0 && !effectiveFilters.brands.includes(product.brand_name ?? "")) return false;
          return true;
        })
        .sort((a, b) => {
          const priceA = computePrice(a, 1).unitPrice;
          const priceB = computePrice(b, 1).unitPrice;

          switch (sortOption) {
            case "price_asc": return priceA - priceB;
            case "price_desc": return priceB - priceA;
            case "name_asc": return (a.name ?? "").localeCompare(b.name ?? "", "es-AR");
            case "name_desc": return (b.name ?? "").localeCompare(a.name ?? "", "es-AR");
            case "brand_asc": return (a.brand_name ?? "").localeCompare(b.brand_name ?? "", "es-AR");
            case "brand_desc": return (b.brand_name ?? "").localeCompare(a.brand_name ?? "", "es-AR");
            case "stock_asc": return (a.stock ?? 0) - (b.stock ?? 0);
            case "stock_desc": return (b.stock ?? 0) - (a.stock ?? 0);
            default: return 0;
          }
        }),
    [effectiveFilters, displayProducts, sortOption, computePrice],
  );

  const resultsLabel = `${filteredProducts.length}${totalCount > 0 ? ` de ${totalCount}` : ""} productos`;

  return (
    <>
      <div className="mb-4 space-y-4">
        <div className="rounded-[24px] border border-border/70 bg-card/85 p-4 shadow-sm">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Compra mayorista</p>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <CategoryMegaMenu
                tree={categoryTree}
                current={categoryFilter}
                onSelect={setCategoryFilter}
                activeParent={activeParentInMenu}
                setActiveParent={setActiveParentInMenu}
                counts={categoryCounts}
              />

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

              {brandOptions.length > 0 ? <AdvancedFilterDropdown label="Marca" options={brandOptions} selected={effectiveFilters.brands} onToggle={(value) => toggleAdvancedFilter("brands", value)} /> : null}

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="toolbar" size="sm" className="h-9 rounded-xl px-3 text-xs font-semibold">
                    <ArrowDownAZ size={13} className="text-muted-foreground" />
                    Ordenar
                    <ChevronDown size={13} className="text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[180px] rounded-2xl p-1 shadow-xl">
                  <div className="grid gap-0.5">
                    {([
                      { id: "price_asc", label: "Menor precio" },
                      { id: "price_desc", label: "Mayor precio" },
                      { id: "name_asc", label: "Producto A-Z" },
                      { id: "name_desc", label: "Producto Z-A" },
                      { id: "brand_asc", label: "Marca A-Z" },
                      { id: "brand_desc", label: "Marca Z-A" },
                      { id: "stock_asc", label: "Menor Stock" },
                      { id: "stock_desc", label: "Mayor Stock" },
                    ] as const).map((opt) => (
                      <Button
                        key={opt.id}
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "justify-start rounded-xl px-3 text-xs font-medium",
                          sortOption === opt.id ? "bg-primary/10 text-primary" : "text-muted-foreground",
                        )}
                        onClick={() => setSortOption(opt.id)}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {hasAdvancedFilters ? (
                <Button type="button" variant="ghost" size="sm" className="h-9 rounded-xl px-3 text-xs" onClick={clearAdvancedFilters}>
                  <X size={13} />
                  Limpiar filtros
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
        filteredProducts.length <= 200 ? (
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
                  originalPrice={price.originalUnitPrice}
                  isOffer={price.isOffer}
                  offerPercent={price.calculatedOfferPercent}
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
                  originalPrice={price.originalUnitPrice}
                  isOffer={price.isOffer}
                  offerPercent={price.calculatedOfferPercent}
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
          getPriceInfo={computePrice}
        />
      )}

      {totalCount > 200 && !productsLoading && filteredProducts.length > 0 ? (
        <div className="mb-12 mt-8 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl px-4"
            disabled={page === 0}
            onClick={() => {
              setPage(page - 1);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            Anterior
          </Button>

          <div className="flex items-center gap-1.5 px-2 text-xs font-medium text-muted-foreground">
            Página <span className="text-foreground">{page + 1}</span> de {Math.ceil(totalCount / 200)}
          </div>

          <Button
            variant="outline"
            size="sm"
            className="rounded-xl px-4"
            disabled={(page + 1) * 200 >= totalCount}
            onClick={() => {
              setPage(page + 1);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            Siguiente
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

function CategoryMegaMenu({
  tree,
  current,
  onSelect,
  activeParent,
  setActiveParent,
  counts,
}: {
  tree: { parents: { name: string; children: string[] }[]; leaves: string[] };
  current: string;
  onSelect: (cat: string) => void;
  activeParent: string | null;
  setActiveParent: (val: string | null) => void;
  counts: Record<string, number>;
}) {
  const [open, setOpen] = useState(false);

  const getIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes("fuente") || n.includes("energia")) return <Zap size={16} />;
    if (n.includes("disco") || n.includes("almacenamiento") || n.includes("ssd") || n.includes("hdd")) return <HardDrive size={16} />;
    if (n.includes("monitor") || n.includes("pantalla")) return <Monitor size={16} />;
    if (n.includes("red") || n.includes("wifi") || n.includes("tp-link")) return <Globe size={16} />;
    if (n.includes("gamer") || n.includes("juego") || n.includes("gaming")) return <Gamepad2 size={16} />;
    if (n.includes("pc") || n.includes("computadora") || n.includes("cpu")) return <Cpu size={16} />;
    if (n.includes("periferico") || n.includes("funda") || n.includes("accesorio")) return <Mouse size={16} />;
    if (n.includes("impres") || n.includes("toner") || n.includes("cartucho")) return <Printer size={16} />;
    if (n.includes("celular") || n.includes("tablet") || n.includes("mobile")) return <Smartphone size={16} />;
    if (n.includes("server") || n.includes("rack") || n.includes("servidor")) return <Server size={16} />;
    if (n.includes("audio") || n.includes("parlante") || n.includes("sonido")) return <Speaker size={16} />;
    if (n.includes("auricular") || n.includes("headset")) return <Headphones size={16} />;
    return <Package size={16} />;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="toolbar"
          size="sm"
          className="group h-10 rounded-2xl px-4 text-[13px] font-bold shadow-sm transition-all hover:bg-orange-500 hover:text-white"
        >
          <LayoutGrid size={15} className="mr-1.5 transition-transform group-hover:rotate-90" />
          Categorías
          <ChevronDown size={14} className="ml-1 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[950px] max-w-[95vw] overflow-hidden rounded-[32px] p-0 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] border-none ring-1 ring-border/50"
      >
        <div className="flex bg-background h-[550px]">
          {/* Left panel (Sidebar) */}
          <div className="w-[260px] shrink-0 border-r border-border/10 bg-slate-50/50 dark:bg-slate-900/30 p-4 flex flex-col gap-1 overflow-y-auto">
            <div className="mb-4 px-3 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
              Navegación Premium
            </div>
            
            <button
              onClick={() => {
                onSelect("all");
                setOpen(false);
              }}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-[14px] font-bold transition-all h-[52px]",
                current === "all"
                  ? "bg-[#FF5500] text-white shadow-lg shadow-orange-500/30"
                  : "text-muted-foreground hover:bg-white dark:hover:bg-white/5 hover:text-foreground hover:shadow-sm"
              )}
            >
              <Grid size={18} />
              Todas las categorías
            </button>

            <div className="h-4" />

            {tree.parents.map((parent) => (
              <button
                key={parent.name}
                onMouseEnter={() => setActiveParent(parent.name)}
                onClick={() => {
                  onSelect(parent.name);
                  setOpen(false);
                }}
                className={cn(
                  "relative flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-[14px] font-bold transition-all h-[52px]",
                  activeParent === parent.name
                    ? "bg-white dark:bg-white/10 text-[#FF5500] shadow-md border border-orange-500/10"
                    : current === parent.name
                    ? "bg-orange-50 dark:bg-orange-950/20 text-orange-600"
                    : "text-muted-foreground hover:bg-white/60 dark:hover:bg-white/5 hover:text-foreground"
                )}
              >
                {activeParent === parent.name && (
                  <div className="absolute left-1.5 h-6 w-1 bg-[#FF5500] rounded-full" />
                )}
                <span className="shrink-0 opacity-80">{getIcon(parent.name)}</span>
                <span className="flex-1 truncate">{parent.name}</span>
                <ChevronRight
                  size={14}
                  className={cn("transition-transform opacity-20", activeParent === parent.name ? "opacity-60 translate-x-1" : "")}
                />
              </button>
            ))}

            {tree.leaves.length > 0 && (
              <div className="mt-4 flex flex-col gap-1 border-t border-border/10 pt-4">
                {tree.leaves.map((leaf) => (
                  <button
                    key={leaf}
                    onClick={() => {
                      onSelect(leaf);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-[14px] font-bold transition-all h-[52px]",
                      current === leaf ? "bg-orange-50 text-orange-600" : "text-muted-foreground hover:bg-white/60"
                    )}
                  >
                    <span className="opacity-60">{getIcon(leaf)}</span>
                    <span className="flex-1 truncate">{leaf}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right panel (Content) */}
          <div className="flex-1 bg-white dark:bg-background p-10 overflow-y-auto">
            {activeParent ? (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                {(() => {
                  const parent = tree.parents.find((p) => p.name === activeParent);
                  if (!parent) return null;

                  return (
                    <div className="space-y-10">
                      <div className="flex items-end justify-between border-b pb-6">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#FF5500]">
                            Portal B2B <span className="text-muted-foreground">/</span> {parent.name}
                          </div>
                          <h4 className="text-3xl font-black tracking-tighter text-foreground uppercase leading-none">
                            {parent.name}
                          </h4>
                        </div>
                        <div className="flex flex-col items-end justify-center">
                           <span className="text-xs font-semibold text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-full">
                             {counts[parent.name] || 0} productos
                           </span>
                        </div>
                      </div>

                      {parent.children.length > 0 ? (
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                          {parent.children.map((child) => (
                            <button
                                key={child}
                                onClick={() => {
                                  onSelect(child);
                                  setOpen(false);
                                }}
                                className="group relative flex flex-col items-start gap-4 rounded-[24px] border border-border/50 bg-white dark:bg-slate-900/40 p-6 text-left transition-all hover:scale-[1.03] hover:shadow-2xl hover:shadow-orange-500/10 hover:border-orange-500/20"
                            >
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 dark:bg-slate-800 text-muted-foreground group-hover:bg-[#FF5500] group-hover:text-white transition-all duration-300">
                                    {getIcon(child)}
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[15px] font-black text-foreground group-hover:text-[#FF5500] transition-colors leading-tight block">
                                        {child}
                                    </span>
                                    <span className="text-[11px] font-medium text-muted-foreground/60 group-hover:text-muted-foreground transition-colors uppercase tracking-wider">
                                        {counts[child] || 0} Variedades
                                    </span>
                                </div>
                                <div className="mt-2 flex items-center gap-1.5 text-[11px] font-black uppercase text-[#FF5500] opacity-0 group-hover:opacity-100 transition-all translate-x-[-10px] group-hover:translate-x-0 duration-300">
                                    Explorar <ChevronRight size={12} strokeWidth={3} />
                                </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="py-24 flex flex-col items-center justify-center text-center">
                            <div className="h-20 w-20 rounded-full bg-muted/20 flex items-center justify-center mb-6">
                                <Package size={40} className="text-muted-foreground/30" />
                            </div>
                            <h5 className="text-xl font-bold mb-2">Sin subcategorías específicas</h5>
                            <p className="text-sm text-muted-foreground font-medium max-w-[320px]">
                                Explora el catálogo general de {parent.name} haciendo clic en el título superior.
                            </p>
                            <Button variant="outline" className="mt-8 rounded-2xl px-8" onClick={() => { onSelect(parent.name); setOpen(false); }}>
                                Ver todo en {parent.name}
                            </Button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <LayoutGrid size={48} className="text-muted-foreground/10 mb-4" />
                <p className="text-lg font-bold text-muted-foreground/40">
                  Selecciona una categoría para explorar
                </p>
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
