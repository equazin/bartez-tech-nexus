import { Package, Star, Truck, Search, ChevronDown, Loader2 } from "lucide-react";
import type { Product } from "@/models/products";
import type { PriceResult } from "@/hooks/usePricing";
import { SmartSuggestions } from "@/components/b2b/SmartSuggestions";
import { ProductItem } from "@/components/b2b/ProductItem";
import { ProductTable } from "@/components/b2b/ProductTable";
import { VirtualizedProductList } from "@/components/b2b/VirtualizedProductList";

export type ViewMode = "grid" | "list" | "table";
export type CatalogContext = "default" | "featured" | "pos";

const CATALOG_CONTEXTS: { id: CatalogContext; label: string; icon: typeof Package }[] = [
  { id: "default",  label: "Catalogo general",   icon: Package },
  { id: "featured", label: "⭐ Destacados",        icon: Star },
  { id: "pos",      label: "🧾 Punto de Venta",   icon: Truck },
];

export interface CatalogSectionProps {
  // Products
  displayProducts: Product[];
  products: Product[];
  productsLoading: boolean;
  totalCount: number;
  hasMore: boolean;
  loadMore: () => void;
  // Filters / search
  search: string;
  hasActiveFilters: boolean;
  clearFilters: () => void;
  // View
  viewMode: ViewMode;
  handleViewModeChange: (mode: ViewMode) => void;
  catalogContext: CatalogContext;
  setCatalogContext: (ctx: CatalogContext) => void;
  isDark: boolean;
  dk: (dark: string, light: string) => string;
  // Cart / pricing
  cart: Record<number, number>;
  computePrice: (p: Product, qty: number) => PriceResult;
  formatPrice: (n: number) => string;
  productMargins: Record<number, number>;
  globalMargin: number;
  // Interactions
  handleAddToCart: (p: Product) => void;
  onRemoveFromCart: (p: Product) => void;
  handleSmartAddToCart: (product: Product, qty: number) => void;
  handleToggleFavorite: (id: number) => void;
  toggleCompare: (id: number) => void;
  setSelectedProduct: (p: Product | null) => void;
  setBrandFilter: (brand: string) => void;
  isPosProduct: (p: Product) => boolean;
  // State
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
  isDark,
  dk,
  cart,
  computePrice,
  formatPrice,
  productMargins,
  globalMargin,
  handleAddToCart,
  onRemoveFromCart,
  handleSmartAddToCart,
  handleToggleFavorite,
  toggleCompare,
  setSelectedProduct,
  setBrandFilter,
  isPosProduct,
  favoriteProductIds,
  compareList,
  addedIds,
  purchaseHistory,
  latestPurchaseUnitPrice,
}: CatalogSectionProps) {
  return (
    <>
      {/* ── Context tabs ── */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {CATALOG_CONTEXTS.map(({ id, label, icon: Icon }) => {
          const isActive = catalogContext === id;
          return (
            <button
              key={id}
              onClick={() => setCatalogContext(id)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                isActive
                  ? dk("bg-[#1a2a22] border-[#2D9F6A] text-white", "bg-[#e9f6ef] border-[#2D9F6A]/50 text-[#1a7a50]")
                  : dk("bg-[#111] border-[#262626] text-[#a3a3a3] hover:text-white hover:border-[#333]", "bg-white border-[#e5e5e5] text-[#525252] hover:text-[#171717] hover:bg-[#f5f5f5]")
              }`}
            >
              <Icon size={12} />
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Smart suggestions ── */}
      <SmartSuggestions
        isDark={isDark}
        onAddToCart={(productId) => {
          const p = products.find((x) => x.id === productId);
          if (p) handleSmartAddToCart(p, 1);
        }}
        formatPrice={formatPrice}
      />

      {/* ── Mobile view mode toggle ── */}
      <div className={`mb-3 inline-flex items-center gap-1 rounded-lg border p-1 md:hidden ${dk("bg-[#111] border-[#262626]", "bg-white border-[#e5e5e5]")}`}>
        {(["list", "grid", "table"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => handleViewModeChange(mode)}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded transition ${
              viewMode === mode
                ? dk("bg-[#262626] text-white", "bg-[#f0f0f0] text-[#171717]")
                : dk("text-[#737373]", "text-[#737373]")
            }`}
          >
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Product count ── */}
      {!productsLoading && displayProducts.length > 0 && (
        <div className="flex items-center justify-between mb-3">
          <p className={`text-xs ${dk("text-gray-600", "text-[#737373]")}`}>
            <span className="font-bold">{displayProducts.length}</span>
            {totalCount > 0 && <span> de <span className="font-bold">{totalCount}</span></span>}
            {` producto${displayProducts.length !== 1 ? "s" : ""}`}
            {search && <> para "<span className="text-gray-400">{search}</span>"</>}
          </p>
        </div>
      )}

      {/* ── Product list ── */}
      {productsLoading ? (
        viewMode === "list" || viewMode === "table" ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 bg-[#111] border border-[#1a1a1a] rounded-xl px-4 py-3 animate-pulse">
                <div className="h-14 w-14 rounded-xl bg-[#1c1c1c] shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-[#1c1c1c] rounded w-2/3" />
                  <div className="h-2.5 bg-[#171717] rounded w-1/3" />
                </div>
                <div className="h-5 w-16 bg-[#171717] rounded-full" />
                <div className="h-6 w-20 bg-[#1c1c1c] rounded" />
                <div className="h-8 w-20 bg-[#1c1c1c] rounded-lg" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 min-[480px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4 animate-pulse">
                <div className="h-32 w-full bg-[#1c1c1c] rounded-lg mb-3" />
                <div className="h-3.5 bg-[#1c1c1c] rounded w-3/4 mb-2" />
                <div className="h-2.5 bg-[#171717] rounded w-1/2 mb-3" />
                <div className="h-8 w-full bg-[#1c1c1c] rounded-lg" />
              </div>
            ))}
          </div>
        )
      ) : displayProducts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-600">
          <Search size={36} className="mb-3 opacity-20" />
          <p className="text-sm font-medium text-gray-500">No se encontraron productos</p>
          {(search || hasActiveFilters) && (
            <button onClick={clearFilters} className="mt-3 text-xs text-[#2D9F6A] hover:underline">
              Limpiar filtros
            </button>
          )}
        </div>
      ) : viewMode === "list" ? (
        <VirtualizedProductList
          products={displayProducts}
          cart={cart}
          favoriteProductIds={favoriteProductIds}
          compareList={compareList}
          addedIds={addedIds}
          purchaseHistory={purchaseHistory}
          latestPurchaseUnitPrice={latestPurchaseUnitPrice}
          computePrice={computePrice}
          formatPrice={formatPrice}
          handleAddToCart={handleAddToCart}
          onRemoveFromCart={onRemoveFromCart}
          handleToggleFavorite={handleToggleFavorite}
          toggleCompare={toggleCompare}
          setSelectedProduct={setSelectedProduct}
          setBrandFilter={setBrandFilter}
          isPosProduct={isPosProduct}
          dk={dk}
          hasMore={hasMore}
          onLoadMore={loadMore}
        />
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 grid-cols-1 min-[480px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {displayProducts.map((product) => {
            const price = computePrice(product, Math.max(cart[product.id] || 0, 1));
            return (
              <div
                key={product.id}
                style={{
                  contentVisibility: "auto",
                  containIntrinsicSize: "0 220px",
                }}
              >
                <ProductItem
                  product={product}
                  viewMode="grid"
                  inCart={cart[product.id] || 0}
                  isFavorite={favoriteProductIds.includes(product.id)}
                  isCompared={compareList.includes(product.id)}
                  finalPrice={price.unitPrice}
                  formatPrice={formatPrice}
                  onAddToCart={handleAddToCart}
                  onRemoveFromCart={onRemoveFromCart}
                  onToggleFavorite={handleToggleFavorite}
                  onToggleCompare={toggleCompare}
                  onSelect={setSelectedProduct}
                  onFilterBrand={setBrandFilter}
                  isPosProduct={isPosProduct}
                  dk={dk}
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
          products={displayProducts}
          cart={cart}
          favoriteProductIds={favoriteProductIds}
          productMargins={productMargins}
          globalMargin={globalMargin}
          latestPurchaseUnitPrice={latestPurchaseUnitPrice}
          formatPrice={formatPrice}
          onAddToCart={handleAddToCart}
          onRemoveFromCart={onRemoveFromCart}
          onSelect={setSelectedProduct}
          isPosProduct={isPosProduct}
          dk={dk}
          addedIds={addedIds}
          getUnitPrice={(p, q) => computePrice(p, q).unitPrice}
        />
      )}

      {/* ── Load more (grid/table only — list uses infinite scroll) ── */}
      {hasMore && !productsLoading && viewMode !== "list" && (
        <div className="flex justify-center mt-8 mb-12">
          <button
            onClick={loadMore}
            className={`flex items-center gap-2 px-8 py-3 rounded-xl border font-bold transition-all active:scale-[0.98] ${dk(
              "bg-[#111] border-[#222] text-white hover:bg-[#181818] hover:border-[#333] shadow-lg shadow-black/20",
              "bg-white border-[#e5e5e5] text-[#171717] hover:bg-[#f9f9f9] hover:border-[#d4d4d4] shadow-sm"
            )}`}
          >
            Ver más productos
            <ChevronDown size={14} className="animate-bounce" />
          </button>
        </div>
      )}

      {productsLoading && products.length > 0 && (
        <div className="flex justify-center mt-6 mb-12">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-medium">
            <Loader2 size={14} className="animate-spin text-[#2D9F6A]" />
            Cargando más...
          </div>
        </div>
      )}
    </>
  );
}
