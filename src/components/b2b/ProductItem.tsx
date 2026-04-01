import { Star, Truck, Plus, Minus, Search, ChevronDown, Info, TrendingUp } from "lucide-react";
import { StockBadge } from "./StockBadge";
import { getLugStock } from "@/lib/stockUtils";
import { getNextTier } from "@/lib/pricing";
import type { Product } from "@/models/products";

interface ProductItemProps {
  product: Product;
  viewMode: "grid" | "list";
  inCart: number;
  isFavorite: boolean;
  isCompared: boolean;
  finalPrice: number;
  formatPrice: (p: number) => string;
  onAddToCart: (p: Product) => void;
  onRemoveFromCart: (p: Product) => void;
  onToggleFavorite: (id: number) => void;
  onToggleCompare: (id: number) => void;
  onSelect: (p: Product) => void;
  onFilterBrand?: (brandId: string) => void;
  isPosProduct: (p: Product) => boolean;
  dk: (d: string, l: string) => string;
  wasAdded?: boolean;
  purchaseHistoryCount?: number;
  lastPurchaseUnitPriceDelta?: number;
}

export function ProductItem({
  product,
  viewMode,
  inCart,
  isFavorite,
  isCompared,
  finalPrice,
  formatPrice,
  onAddToCart,
  onRemoveFromCart,
  onToggleFavorite,
  onToggleCompare,
  onSelect,
  onFilterBrand,
  isPosProduct,
  dk,
  wasAdded,
  purchaseHistoryCount = 0,
  lastPurchaseUnitPriceDelta = 0,
}: ProductItemProps) {
  const available = Math.max(0, product.stock - (product.stock_reserved ?? 0));
  const outOfStock = available === 0;

  if (viewMode === "grid") {
    return (
      <div
        className={`${dk("bg-[#111]", "bg-white")} border rounded-xl p-4 flex flex-col transition-all duration-300 relative group overflow-hidden ${
          outOfStock
            ? dk("border-[#1a1a1a]", "border-[#e5e5e5]") + " opacity-40"
            : dk("border-[#1f1f1f] hover:border-primary/40 hover:bg-[#141414]", "border-[#e5e5e5] hover:border-primary/30 hover:bg-[#fafafa]") + 
              " hover:-translate-y-1 hover:shadow-2xl " + 
              (product.featured ? "glow-sm border-primary/20" : "hover:shadow-black/20")
        }`}
      >
        {product.featured && (
          <div className="absolute inset-0 pointer-events-none border-glow opacity-50 group-hover:opacity-100 transition-opacity" />
        )}
        <div className="cursor-pointer" onClick={() => onSelect(product)}>
          <div className="relative mb-3">
            <div className={`h-32 w-full ${dk("bg-gradient-to-br from-[#0a0a0a] to-[#111]", "bg-gradient-to-br from-[#f9f9f9] to-[#ffffff]")} rounded-lg flex items-center justify-center overflow-hidden border ${dk("border-[#1a1a1a]", "border-[#f0f0f0]")} group-hover:scale-[1.02] transition-transform duration-500`}>
              <img src={product.image} alt={product.name}
                loading="lazy"
                decoding="async"
                className="max-h-28 max-w-full object-contain p-2 drop-shadow-2xl" />
            </div>
            {inCart > 0 && (
              <span className="absolute top-2 right-2 h-5 w-5 rounded-full bg-[#2D9F6A] text-white text-[10px] font-black flex items-center justify-center shadow">
                {inCart}
              </span>
            )}
            {product.featured && (
              <span className="absolute top-2 left-2 inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">
                <Star size={8} fill="currentColor" />
              </span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(product.id);
              }}
              className={`absolute bottom-2 right-2 h-7 w-7 rounded-full border flex items-center justify-center transition ${
                isFavorite
                  ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/30"
                  : dk("bg-[#111]/80 text-gray-500 border-[#222] hover:text-yellow-400", "bg-white/80 text-gray-400 border-gray-200 hover:text-yellow-500")
              }`}
            >
              <Star size={11} fill={isFavorite ? "currentColor" : "none"} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onToggleCompare(product.id); }}
              className={`absolute bottom-2 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded border transition ${
                isCompared
                  ? "bg-blue-600 text-white border-blue-500"
                  : dk("bg-[#111]/80 text-gray-500 border-[#222] hover:text-white", "bg-white/80 text-gray-400 border-gray-200 hover:text-gray-700")
              }`}
            >
              {isCompared ? "✓ Comp." : "Comparar"}
            </button>
          </div>
          <h3 className={`font-bold text-sm ${dk("text-white", "text-[#171717]")} leading-tight line-clamp-2 mb-1`}>{product.name}</h3>
          <p className={`text-[11px] ${dk("text-gray-600", "text-[#737373]")} mb-1.5`}>
            {product.category}
            {product.sku && <span className="font-mono ml-1 text-gray-700">· {product.sku}</span>}
          </p>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <StockBadge stock={available} lugStock={getLugStock(product)} />
            {isPosProduct(product) && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Truck size={9} /> POS
              </span>
            )}
            {purchaseHistoryCount > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${dk("bg-[#1c1c1c] text-gray-500", "bg-[#f0f0f0] text-[#737373]")}`}>
                Compraste {purchaseHistoryCount}u
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 mt-auto">
            <div>
              <div className="text-lg text-[#2D9F6A] font-extrabold leading-tight tabular-nums">
                {formatPrice(finalPrice)}
              </div>
              <div className={`text-[10px] ${dk("text-[#525252]", "text-[#a3a3a3]")} mt-0.5`}>sin IVA · {product.iva_rate ?? 21}%</div>
            </div>

            {product.price_tiers && product.price_tiers.length > 0 && (
              <div className="group/tiers relative">
                <button className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all ${dk("bg-[#1a1a1a] text-primary border-primary/20 hover:bg-primary/10", "bg-primary/5 text-primary border-primary/20 hover:bg-primary/10")}`}>
                  <TrendingUp size={10} className="shrink-0" />
                  Escala
                </button>
                <div className={`absolute bottom-full right-0 mb-2 w-52 p-4 rounded-2xl border shadow-2xl opacity-0 translate-y-2 pointer-events-none group-hover/tiers:opacity-100 group-hover/tiers:translate-y-0 transition-all duration-300 z-50 bg-glass-strong ${dk("border-primary/20", "border-primary/10")}`}>
                  <p className={`text-[10px] font-bold uppercase tracking-[0.2em] mb-3 pb-1 border-b ${dk("text-gray-400 border-white/5", "text-[#737373] border-black/5")}`}>Escala Especial</p>
                  <div className="space-y-2">
                    {product.price_tiers.map((t, idx) => (
                      <div key={idx} className="flex justify-between items-center text-[11px] group/item">
                        <span className="text-gray-500 font-medium">{t.min}{t.max ? `-${t.max}` : "+"} unidades</span>
                        <span className="font-bold text-primary group-hover/item:scale-110 transition-transform">{formatPrice(t.price)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          {lastPurchaseUnitPriceDelta > 0 && (
            <div className="mt-1 text-[10px] font-semibold text-amber-500">
              ↑ Este producto aumentó {lastPurchaseUnitPriceDelta.toFixed(1)}% desde tu última compra
            </div>
          )}
        </div>

        <div className="mt-3 flex gap-1.5">
          {inCart > 0 ? (
            <>
              <button onClick={() => onRemoveFromCart(product)}
                className={`flex-1 ${dk("bg-[#1c1c1c] hover:bg-[#252525] text-white border-[#262626]", "bg-[#f5f5f5] hover:bg-[#ebebeb] text-[#171717] border-[#e5e5e5]")} active:scale-95 rounded-lg py-1.5 text-sm font-bold transition-all border`}>−</button>
              <span className={`flex items-center justify-center px-3 ${dk("text-white", "text-[#171717]")} font-bold text-sm`}>{inCart}</span>
              <button onClick={() => onAddToCart(product)}
                className="flex-1 bg-[#2D9F6A] hover:bg-[#25835A] active:scale-95 text-white rounded-lg py-1.5 text-sm font-bold transition-all">+</button>
            </>
          ) : (
            <button
              disabled={outOfStock}
              onClick={() => onAddToCart(product)}
              className={`w-full font-bold text-sm h-8 rounded-lg transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none ${
                wasAdded
                  ? "bg-green-600 hover:bg-green-600 text-white"
                  : "bg-[#2D9F6A] hover:bg-[#25835A] text-white"
              }`}
            >
              {outOfStock ? "Sin stock" : wasAdded ? "✓ Añadido" : "Añadir"}
            </button>
          )}
        </div>
      </div>
    );
  }

  // --- VIEW MODE: LIST ---
  return (
    <div
      className={`group flex items-center gap-4 ${dk("bg-[#111]", "bg-white")} border rounded-xl px-4 py-3 transition-all duration-200 relative overflow-hidden ${
        outOfStock
          ? dk("border-[#1a1a1a]", "border-[#e5e5e5]") + " opacity-40"
          : dk("border-[#1f1f1f] hover:border-primary/30 hover:bg-[#141414]", "border-[#e5e5e5] hover:border-primary/20 hover:bg-[#fafafa]") +
            (product.featured ? " glow-sm border-primary/10" : "")
      }`}
    >
      {product.featured && (
        <div className="absolute inset-0 pointer-events-none border-glow opacity-30 group-hover:opacity-60 transition-opacity" />
      )}
      <div
        className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
        onClick={() => onSelect(product)}
      >
        <div className={`h-14 w-14 shrink-0 ${dk("bg-[#0a0a0a] border-[#1a1a1a] group-hover:border-[#222]", "bg-[#f9f9f9] border-[#e5e5e5] group-hover:border-[#d4d4d4]")} rounded-xl flex items-center justify-center overflow-hidden border transition-colors`}>
          <img src={product.image} alt={product.name}
            loading="lazy"
            decoding="async"
            className="max-h-12 max-w-12 object-contain" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className={`text-sm font-bold ${dk("text-white", "text-[#171717]")} truncate leading-tight`}>{product.name}</p>
            {product.featured && (
              <Star size={11} className="text-yellow-500 shrink-0" fill="currentColor" />
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-gray-600">{product.category}</span>
            {isPosProduct(product) && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Truck size={9} /> POS
              </span>
            )}
            {product.brand_name && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onFilterBrand && product.brand_id) onFilterBrand(product.brand_id);
                }}
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition"
              >
                {product.brand_name}
              </button>
            )}
            {product.sku && (
              <span className={`text-[10px] font-mono ${dk("text-[#525252] bg-[#171717]", "text-[#737373] bg-[#f0f0f0]")} px-1.5 py-0.5 rounded`}>{product.sku}</span>
            )}
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 shrink-0 flex-wrap">
          <StockBadge stock={available} lugStock={getLugStock(product)} />
          {purchaseHistoryCount > 0 && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${dk("bg-[#1c1c1c] text-gray-500", "bg-[#f0f0f0] text-[#737373]")}`}>
              {purchaseHistoryCount}u prev.
            </span>
          )}
        </div>

        <div className="text-right shrink-0 hidden sm:block min-w-[100px]">
          <div className="text-base font-extrabold text-[#2D9F6A] tabular-nums leading-tight">
            {formatPrice(finalPrice)}
          </div>
          <div className={`text-[10px] ${dk("text-[#525252]", "text-[#a3a3a3]")} mt-0.5`}>sin IVA · {product.iva_rate ?? 21}%</div>
          {lastPurchaseUnitPriceDelta > 0 && (
            <div className="text-[10px] font-semibold text-amber-500">
              ↑ +{lastPurchaseUnitPriceDelta.toFixed(1)}% vs última compra
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onToggleCompare(product.id)}
          title="Comparar"
          className={`hidden sm:flex h-8 w-8 items-center justify-center rounded-lg border text-[10px] font-bold transition ${
            isCompared
              ? "bg-blue-600 text-white border-blue-500"
              : dk("bg-[#1c1c1c] text-gray-600 border-[#262626] hover:text-white", "bg-[#f5f5f5] text-gray-400 border-[#e5e5e5] hover:text-gray-700")
          }`}
        >
          ⇄
        </button>
        <button
          onClick={() => onToggleFavorite(product.id)}
          title="Favorito"
          className={`hidden sm:flex h-8 w-8 items-center justify-center rounded-lg border transition ${
            isFavorite
              ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/30"
              : dk("bg-[#1c1c1c] text-gray-600 border-[#262626] hover:text-yellow-400", "bg-[#f5f5f5] text-gray-400 border-[#e5e5e5] hover:text-yellow-500")
          }`}
        >
          <Star size={12} fill={isFavorite ? "currentColor" : "none"} />
        </button>
        {inCart > 0 ? (
          <>
            <button onClick={() => onRemoveFromCart(product)}
              className={`h-8 w-8 ${dk("bg-[#1c1c1c] hover:bg-[#252525] text-white border-[#262626]", "bg-[#f5f5f5] hover:bg-[#ebebeb] text-[#171717] border-[#e5e5e5]")} active:scale-95 rounded-lg text-sm font-bold transition-all flex items-center justify-center border`}>
              <Minus size={12} />
            </button>
            <span className={`w-7 text-center ${dk("text-white", "text-[#171717]")} font-bold text-sm tabular-nums`}>{inCart}</span>
            <button onClick={() => onAddToCart(product)}
              className="h-8 w-8 bg-[#2D9F6A] hover:bg-[#25835A] active:scale-95 text-white rounded-lg text-sm font-bold transition-all flex items-center justify-center">
              <Plus size={12} />
            </button>
          </>
        ) : (
          <button
            disabled={outOfStock}
            onClick={() => onAddToCart(product)}
            className={`text-xs h-8 px-3.5 rounded-lg font-bold transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap ${
              wasAdded
                ? "bg-green-600/90 text-white"
                : "bg-[#2D9F6A] hover:bg-[#25835A] text-white"
            }`}
          >
            {outOfStock ? "Sin stock" : wasAdded ? "✓ Añadido" : "Añadir"}
          </button>
        )}
      </div>
    </div>
  );
}
