import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownAZ, ChevronDown, Loader2, Package, Search, Star, Truck, X, LayoutGrid, ChevronRight,
  Cpu, Zap, HardDrive, Monitor, Globe, Gamepad2, Box, Mouse, Headphones, Printer, Smartphone, Server, Camera, Speaker,
  Share2, MoreHorizontal, Grid, ArrowRight
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

type AdvancedFilterKey = "brands" | "ram" | "storage" | "refreshRate" | "screen";
type AdvancedFiltersState = Record<AdvancedFilterKey, string[]>;

const ADVANCED_FILTERS_KEY = "b2b_catalog_advanced_filters";
const EMPTY_ADVANCED_FILTERS: AdvancedFiltersState = {
  brands: [],
  ram: [],
  storage: [],
  refreshRate: [],
  screen: [],
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

function readSpecValue(product: Product, matches: string[]) {
  const entries = Object.entries(product.specs ?? {});
  const entry = entries.find(([key]) => {
    const normalizedKey = normalizeCompact(key);
    return matches.some((match) => normalizedKey.includes(match));
  });

  if (!entry) return null;

  const rawValue = String(entry[1] ?? "").trim();
  if (!rawValue) return null;
  return rawValue;
}

function buildTechOptions(products: Product[], key: Exclude<AdvancedFilterKey, "brands">) {
  const matchMap: Record<Exclude<AdvancedFilterKey, "brands">, string[]> = {
    ram: ["ram", "memoria"],
    storage: ["ssd", "hdd", "almacenamiento", "storage", "disco"],
    refreshRate: ["hz", "refresh"],
    screen: ["pulgadas", "pantalla", "screen", "display"],
  };

  return uniqueSorted(products.map((product) => readSpecValue(product, matchMap[key])));
}

function matchesTechFilter(product: Product, key: Exclude<AdvancedFilterKey, "brands">, selectedValues: string[]) {
  if (selectedValues.length === 0) return true;
  const matchMap: Record<Exclude<AdvancedFilterKey, "brands">, string[]> = {
    ram: ["ram", "memoria"],
    storage: ["ssd", "hdd", "almacenamiento", "storage", "disco"],
    refreshRate: ["hz", "refresh"],
    screen: ["pulgadas", "pantalla", "screen", "display"],
  };

  const value = readSpecValue(product, matchMap[key]);
  return value ? selectedValues.includes(value) : false;
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
      refreshRate: Array.isArray(parsed.refreshRate) ? parsed.refreshRate.filter(Boolean) : [],
      screen: Array.isArray(parsed.screen) ? parsed.screen.filter(Boolean) : [],
    };
  } catch {
    return EMPTY_ADVANCED_FILTERS;
  }
}

function SidebarFilterAccordion({ label, options, selected, onToggle }: AdvancedFilterDropdownProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(true);

  const visibleOptions = useMemo(() => {
    const needle = normalizeCompact(query);
    if (!needle) return options;
    return options.filter((option) => normalizeCompact(option).includes(needle));
  }, [options, query]);

  return (
    <div className="border border-border/70 bg-card/60 overflow-hidden flex flex-col rounded-[16px]">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-4 py-3.5 bg-transparent hover:bg-secondary/40 transition-colors"
      >
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2">
           {selected.length > 0 && <Badge variant="default" className="h-5 rounded-full px-1.5 text-[10px] bg-primary text-primary-foreground">{selected.length}</Badge>}
           <ChevronDown size={14} className={cn("text-muted-foreground transition-transform", isOpen && "rotate-180")} />
        </div>
      </button>
      
      {isOpen && (
        <div className="p-3 border-t border-border/50 bg-background/40 space-y-3">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Buscar...`}
            className="h-8 rounded-xl border-border/70 bg-background text-xs"
          />

          <ScrollArea className="h-48 rounded-xl border border-border/60 bg-background/60">
            <div className="space-y-0.5 p-1.5">
              {visibleOptions.map((option) => {
                const checked = selected.includes(option);
                return (
                  <label key={option} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-xs transition hover:bg-secondary/60">
                    <Checkbox checked={checked} onCheckedChange={() => onToggle(option)} className="h-4 w-4 rounded-sm border-border/70" />
                    <span className="min-w-0 flex-1 truncate text-foreground font-medium">{option}</span>
                  </label>
                );
              })}
              {visibleOptions.length === 0 ? <p className="px-2 py-4 text-center text-[11px] text-muted-foreground">Sin coincidencias.</p> : null}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
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
  page: number;
  setPage: (p: number) => void;
  categoryTree: { 
    parents: { 
      id: number; 
      name: string; 
      slug?: string | null; 
      children: { 
        id: number; 
        name: string; 
        slug?: string | null; 
        children: { id: number; name: string; slug?: string | null }[] 
      }[] 
    }[]; 
    leaves: { id: number; name: string; slug?: string | null }[] 
  };
  categoryFilter: string;
  setCategoryFilter: (cat: string) => void;
  subCategoryFilters: string[];
  setSubCategoryFilters: (vals: string[]) => void;
  activeCategoryChildren: { id: number; name: string; slug?: string | null }[];
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
  subCategoryFilters,
  setSubCategoryFilters,
  activeCategoryChildren,
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
  const ramOptions = useMemo(() => buildTechOptions(displayProducts, "ram"), [displayProducts]);
  const storageOptions = useMemo(() => buildTechOptions(displayProducts, "storage"), [displayProducts]);
  const refreshRateOptions = useMemo(() => buildTechOptions(displayProducts, "refreshRate"), [displayProducts]);
  const screenOptions = useMemo(() => buildTechOptions(displayProducts, "screen"), [displayProducts]);

  const toggleAdvancedFilter = (key: AdvancedFilterKey, value: string) => {
    setAdvancedFilters((current) => ({
      ...current,
      [key]: current[key].includes(value) ? current[key].filter((item) => item !== value) : [...current[key], value],
    }));
  };

  const clearAdvancedFilters = () => setAdvancedFilters(EMPTY_ADVANCED_FILTERS);

  const effectiveFilters = useMemo(() => ({
    brands: advancedFilters.brands.filter((item) => brandOptions.includes(item)),
    ram: advancedFilters.ram.filter((item) => ramOptions.includes(item)),
    storage: advancedFilters.storage.filter((item) => storageOptions.includes(item)),
    refreshRate: advancedFilters.refreshRate.filter((item) => refreshRateOptions.includes(item)),
    screen: advancedFilters.screen.filter((item) => screenOptions.includes(item)),
  }), [advancedFilters, brandOptions, ramOptions, refreshRateOptions, screenOptions, storageOptions]);

  const hasAdvancedFilters = Object.values(effectiveFilters).some((values) => values.length > 0);

  const filteredProducts = useMemo(
    () =>
      [...displayProducts]
        .filter((product) => {
          if (effectiveFilters.brands.length > 0 && !effectiveFilters.brands.includes(product.brand_name ?? "")) return false;
          if (!matchesTechFilter(product, "ram", effectiveFilters.ram)) return false;
          if (!matchesTechFilter(product, "storage", effectiveFilters.storage)) return false;
          if (!matchesTechFilter(product, "refreshRate", effectiveFilters.refreshRate)) return false;
          if (!matchesTechFilter(product, "screen", effectiveFilters.screen)) return false;
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
    <div className="flex flex-col lg:flex-row gap-5 items-start">
      {/* SIDEBAR PANEL */}
      <aside className="w-full lg:w-[250px] xl:w-[260px] shrink-0 lg:sticky lg:top-4 grid gap-4 overflow-y-auto max-h-[calc(100vh-6rem)] custom-scrollbar pr-1">
        {(hasActiveFilters || hasAdvancedFilters) && (
          <Button type="button" variant="outline" className="justify-start gap-2 rounded-2xl bg-card text-xs h-10 border-border/70" onClick={() => { clearFilters(); clearAdvancedFilters(); }}>
            <X size={14} /> Limpiar filtros
          </Button>
        )}

        <div className="rounded-[24px] border border-border/70 bg-card/85 p-4 shadow-sm flex flex-col gap-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground px-1">Filtros Avanzados</p>
          
          {brandOptions.length > 0 && <SidebarFilterAccordion label="Marca" options={brandOptions} selected={effectiveFilters.brands} onToggle={(val) => toggleAdvancedFilter("brands", val)} />}
          {ramOptions.length > 0 && <SidebarFilterAccordion label="RAM" options={ramOptions} selected={effectiveFilters.ram} onToggle={(val) => toggleAdvancedFilter("ram", val)} />}
          {storageOptions.length > 0 && <SidebarFilterAccordion label="Almacenamiento" options={storageOptions} selected={effectiveFilters.storage} onToggle={(val) => toggleAdvancedFilter("storage", val)} />}
          {refreshRateOptions.length > 0 && <SidebarFilterAccordion label="Tasa de Refresco" options={refreshRateOptions} selected={effectiveFilters.refreshRate} onToggle={(val) => toggleAdvancedFilter("refreshRate", val)} />}
          {screenOptions.length > 0 && <SidebarFilterAccordion label="Pantalla" options={screenOptions} selected={effectiveFilters.screen} onToggle={(val) => toggleAdvancedFilter("screen", val)} />}
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 min-w-0 w-full space-y-4 mt-2 lg:mt-0">
        {/* Hierarchical Breadcrumb */}
        {categoryFilter !== "all" && (
          <div className="flex items-center gap-2 px-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 animate-in fade-in slide-in-from-left-2 transition-all">
            <button 
              onClick={() => setCategoryFilter("all")}
              className="hover:text-primary transition-colors hover:bg-primary/5 px-2 py-1 rounded-md"
            >
              Catálogo
            </button>
            <ChevronRight size={10} className="opacity-30" />
            
            {/* Find Parent if active selection is a subcategory */}
            {(() => {
              const activeCatObject = categoryTree.parents.find(p => 
                p.name === categoryFilter || 
                p.slug === categoryFilter ||
                p.children.some(c => 
                  c.name === categoryFilter || 
                  c.slug === categoryFilter ||
                  c.children.some(sub => sub.name === categoryFilter || sub.slug === categoryFilter)
                )
              );
              
              if (!activeCatObject) return <span className="text-primary capitalize">{categoryFilter.replace(/-/g, ' ')}</span>;
              
              // If we are EXACTLY on the root
              if (activeCatObject.name === categoryFilter || activeCatObject.slug === categoryFilter) {
                return <span className="text-primary">{activeCatObject.name}</span>;
              }

              // Find if it's a Level 1 child
              const level1 = activeCatObject.children.find(c => 
                c.name === categoryFilter || 
                c.slug === categoryFilter ||
                c.children.some(sub => sub.name === categoryFilter || sub.slug === categoryFilter)
              );
              
              if (level1) {
                return (
                  <>
                    <button 
                      onClick={() => setCategoryFilter(activeCatObject.slug || activeCatObject.name)}
                      className="hover:text-primary transition-colors hover:bg-primary/5 px-2 py-1 rounded-md"
                    >
                      {activeCatObject.name}
                    </button>
                    <ChevronRight size={10} className="opacity-30" />
                    
                    {level1.name === categoryFilter || level1.slug === categoryFilter ? (
                      <span className="text-primary">{level1.name}</span>
                    ) : (
                      <>
                        <button 
                          onClick={() => setCategoryFilter(level1.slug || level1.name)}
                          className="hover:text-primary transition-colors hover:bg-primary/5 px-2 py-1 rounded-md"
                        >
                          {level1.name}
                        </button>
                        <ChevronRight size={10} className="opacity-30" />
                        <span className="text-primary capitalize">{categoryFilter.replace(/-/g, ' ')}</span>
                      </>
                    )}
                  </>
                );
              }

              return <span className="text-primary">{categoryFilter}</span>;
            })()}
          </div>
        )}

        <div className="rounded-[20px] border border-border/70 bg-card/85 p-3 shadow-sm mb-4">          <div className="flex flex-wrap items-center justify-between gap-2">
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
            </div>
          </div>



          {activeCategoryChildren.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-border/40 py-3 mt-3 animate-in fade-in slide-in-from-top-2">
              <span className="mr-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Sectores:</span>
              {activeCategoryChildren.map((cat) => {
                const isActive = categoryFilter === (cat.slug || cat.name);
                return (
                  <button
                    key={cat.id}
                    onClick={() => setCategoryFilter(cat.slug || cat.name)}
                    className={cn(
                      "h-8 rounded-full px-4 text-[11px] font-bold transition-all border",
                      isActive
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-secondary/40 text-muted-foreground border-border/60 hover:bg-secondary/60 hover:text-foreground"
                    )}
                  >
                    {cat.name}
                    <span className="ml-1.5 font-normal opacity-50">({categoryCounts[cat.name] || 0})</span>
                  </button>
                );
              })}
              {categoryFilter !== "all" && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 rounded-full px-3 text-[10px] font-bold text-muted-foreground hover:text-destructive"
                  onClick={() => setCategoryFilter("all")}
                >
                  Ver todo
                </Button>
              )}
            </div>
          )}

          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/40">
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
                  viewMode={viewMode as "grid" | "list"}
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
    </div>
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
  tree: { 
    parents: { 
      id: number; 
      name: string; 
      slug?: string | null; 
      children: { 
        id: number; 
        name: string; 
        slug?: string | null; 
        children: { id: number; name: string; slug?: string | null }[] 
      }[] 
    }[]; 
    leaves: { id: number; name: string; slug?: string | null }[] 
  };
  current: string;
  onSelect: (cat: string) => void;
  activeParent: string | null;
  setActiveParent: (val: string | null) => void;
  counts: Record<string, number>;
}) {
  const [open, setOpen] = useState(false);
  const [activeSubParent, setActiveSubParent] = useState<string | null>(null);

  const getIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes("fuente") || n.includes("energia")) return <Zap size={14} />;
    if (n.includes("disco") || n.includes("almacenamiento") || n.includes("ssd") || n.includes("hdd")) return <HardDrive size={14} />;
    if (n.includes("monitor") || n.includes("pantalla")) return <Monitor size={14} />;
    if (n.includes("red") || n.includes("wifi") || n.includes("tp-link")) return <Globe size={14} />;
    if (n.includes("gamer") || n.includes("juego") || n.includes("gaming")) return <Gamepad2 size={14} />;
    if (n.includes("pc") || n.includes("computadora") || n.includes("cpu")) return <Cpu size={14} />;
    if (n.includes("periferico") || n.includes("funda") || n.includes("accesorio")) return <Mouse size={14} />;
    if (n.includes("impres") || n.includes("toner") || n.includes("cartucho")) return <Printer size={14} />;
    if (n.includes("celular") || n.includes("tablet") || n.includes("mobile")) return <Smartphone size={14} />;
    if (n.includes("server") || n.includes("rack") || n.includes("servidor")) return <Server size={14} />;
    if (n.includes("audio") || n.includes("parlante") || n.includes("sonido")) return <Speaker size={14} />;
    if (n.includes("auricular") || n.includes("headset")) return <Headphones size={14} />;
    return <Package size={14} />;
  };

  // Auto-select first subparent when parent changes or on open
  useEffect(() => {
    if (open && activeParent) {
      const parent = tree.parents.find(p => p.name === activeParent);
      if (parent && parent.children.length > 0) {
        if (!activeSubParent || !parent.children.some(c => c.name === activeSubParent)) {
          setActiveSubParent(parent.children[0].name);
        }
      } else {
        setActiveSubParent(null);
      }
    }
  }, [open, activeParent, tree.parents, activeSubParent]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="toolbar"
          size="sm"
          className="group h-10 rounded-xl px-4 text-[13px] font-bold shadow-sm transition-all hover:bg-primary hover:text-primary-foreground"
        >
          <LayoutGrid size={15} className="mr-1.5 transition-transform group-hover:rotate-90" />
          Categorías
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-[1080px] max-w-[95vw] overflow-hidden rounded-[24px] p-0 shadow-2xl border border-border/80 bg-background/95 backdrop-blur-md"
      >
        <div className="flex h-[600px] divide-x divide-border/30">
          {/* Column 1: Main Roots */}
          <div className="w-[240px] shrink-0 bg-secondary/10 p-3 flex flex-col gap-0.5 overflow-y-auto custom-scrollbar">
            <div className="mb-2 px-4 py-2 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">Departamentos</span>
            </div>
            
            <button
              onClick={() => {
                onSelect("all");
                setOpen(false);
              }}
              className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-2 text-left text-[13px] font-bold transition-all h-[44px]",
                current === "all" ? "bg-primary/10 text-primary shadow-sm" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              )}
            >
              <LayoutGrid size={16} className="opacity-70" />
              Todo el catálogo
            </button>

            <div className="my-2 border-t border-border/20 mx-3" />

            {tree.parents.map((parent) => (
              <button
                key={parent.name}
                onMouseEnter={() => setActiveParent(parent.name)}
                onClick={() => {
                  onSelect(parent.slug || parent.name);
                  setOpen(false);
                }}
                className={cn(
                  "relative group flex items-center gap-3 rounded-xl px-4 py-2 text-left text-[13px] font-bold transition-all h-[44px]",
                  activeParent === parent.name
                    ? "bg-primary/5 text-primary border-l-2 border-primary rounded-l-none"
                    : "text-muted-foreground hover:bg-white/10 hover:text-foreground"
                )}
              >
                <span className="shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">{getIcon(parent.name)}</span>
                <span className="flex-1 truncate">{parent.name}</span>
                <ChevronRight size={12} className={cn("transition-transform opacity-10", activeParent === parent.name && "opacity-40 translate-x-1")} />
              </button>
            ))}
          </div>

          {/* Column 2: Level 1 Children */}
          <div className="w-[280px] shrink-0 bg-secondary/5 p-3 flex flex-col gap-0.5 overflow-y-auto custom-scrollbar">
            {activeParent ? (
              <>
                <div className="mb-2 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
                   {activeParent}
                </div>
                {tree.parents.find(p => p.name === activeParent)?.children.map((child) => (
                   <button
                    key={child.name}
                    onMouseEnter={() => setActiveSubParent(child.name)}
                    onClick={() => {
                      onSelect(child.slug || child.name);
                      setOpen(false);
                    }}
                    className={cn(
                      "group flex items-center justify-between rounded-xl px-4 py-2 text-left text-[13px] font-bold transition-all h-[42px]",
                      activeSubParent === child.name 
                        ? "bg-background text-primary shadow-sm border border-border/60" 
                        : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                    )}
                  >
                    <span className="truncate">{child.name}</span>
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] font-medium opacity-30 group-hover:opacity-60">{counts[child.name] || 0}</span>
                       <ChevronRight size={12} className={cn("opacity-10 transition-transform", activeSubParent === child.name && "opacity-50 translate-x-1")} />
                    </div>
                  </button>
                ))}
              </>
            ) : (
              <div className="h-full flex items-center justify-center p-8 text-center text-muted-foreground/30 italic text-xs">
                Selecciona una categoría principal
              </div>
            )}
          </div>

          {/* Column 3: Level 2 Children */}
          <div className="flex-1 bg-background p-6 overflow-y-auto custom-scrollbar">
            {activeParent && activeSubParent ? (
              <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-300">
                {/* Header/Breadcrumb */}
                <div className="flex flex-col gap-3 border-b border-border/50 pb-6">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">
                    <span className="hover:text-primary transition-colors cursor-pointer" onClick={() => { onSelect(activeParent); setOpen(false); }}>{activeParent}</span>
                    <ChevronRight size={10} className="opacity-40" />
                    <span className="text-primary">{activeSubParent}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <h4 className="text-2xl font-bold tracking-tight text-foreground uppercase border-l-4 border-primary pl-4">
                      {activeSubParent}
                    </h4>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 rounded-full text-[11px] font-bold group border-primary/20 hover:border-primary hover:bg-primary/5 text-primary"
                      onClick={() => {
                        const child = tree.parents.find(p => p.name === activeParent)?.children.find(c => c.name === activeSubParent);
                        onSelect(child?.slug || activeSubParent);
                        setOpen(false);
                      }}
                    >
                      Explorar sección <ArrowRight size={14} className="ml-1.5 transition-transform group-hover:translate-x-1" />
                    </Button>
                  </div>
                </div>

                {/* Sub-items (Grid) */}
                <div className="grid grid-cols-2 gap-3">
                  {tree.parents
                    .find(p => p.name === activeParent)
                    ?.children.find(c => c.name === activeSubParent)
                    ?.children.map((subChild) => (
                        <button
                          key={subChild.id}
                          onClick={() => {
                            onSelect(subChild.slug || subChild.name);
                            setOpen(false);
                          }}
                          className="group flex items-center justify-between p-4 rounded-xl border border-border/40 bg-secondary/5 hover:border-primary/20 hover:bg-primary/[0.03] transition-all text-left"
                        >
                          <div className="space-y-0.5">
                            <span className="text-[13px] font-bold block leading-tight text-foreground group-hover:text-primary transition-colors">
                              {subChild.name}
                            </span>
                            <span className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider">
                              {counts[subChild.name] || 0} unidades
                            </span>
                          </div>
                          <div className="h-6 w-6 rounded-lg bg-secondary/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                             <ChevronRight size={12} className="text-primary" />
                          </div>
                        </button>
                    ))}
                  
                  {(!tree.parents
                    .find(p => p.name === activeParent)
                    ?.children.find(c => c.name === activeSubParent)
                    ?.children.length) && (
                      <div className="col-span-2 py-20 flex flex-col items-center justify-center text-center opacity-30 italic">
                         <Box size={32} className="mb-4 opacity-50" />
                         <p className="text-sm font-medium">No hay sub-sectores adicionales para {activeSubParent}</p>
                         <p className="text-[10px] mt-1">Haz clic en el botón de arriba para ver todos los productos registrados</p>
                      </div>
                    )}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-12 space-y-6">
                <div className="relative">
                   <div className="absolute -inset-4 bg-primary/5 rounded-full blur-2xl animate-pulse" />
                   <LayoutGrid size={48} className="text-primary/20 relative" />
                </div>
                <div className="space-y-2">
                   <p className="text-[15px] font-bold text-foreground/60 tracking-tight">Catálogo Inteligente</p>
                   <p className="text-[12px] text-muted-foreground/50 leading-relaxed max-w-[200px] mx-auto">
                     Navega por múltiples niveles para encontrar exactamente lo que tu cliente necesita.
                   </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
