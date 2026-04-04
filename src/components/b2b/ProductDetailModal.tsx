import { X, Plus, Minus, Star } from "lucide-react";
import type { Product } from "@/models/products";
import type { PriceResult } from "@/hooks/usePricing";
import { getAvailableStock } from "@/lib/pricing";
import { getLugStock } from "@/lib/stockUtils";
import { StockBadge } from "@/components/b2b/StockBadge";
import { SmartCompatibility } from "@/components/b2b/SmartCompatibility";

// ── Spec helpers ────────────────────────────────────────────────────────────

const HIDDEN_SPEC_PREFIXES = [
  "elit_", "air_", "supplier_", "preferred_supplier_",
  "sync_", "internal_", "provider_",
];

const HIDDEN_SPEC_TOKENS = [
  "cost", "precio_costo", "precio_compra", "markup", "pvp",
  "exchange", "cotizacion", "external_id", "uuid", "token",
  "source", "last_update", "stock_cd", "stock_total",
  "stock_deposito", "link",
];

function isClientVisibleSpecKey(rawKey: string): boolean {
  const key = rawKey.trim().toLowerCase();
  if (!key) return false;
  if (HIDDEN_SPEC_PREFIXES.some((p) => key.startsWith(p))) return false;
  if (HIDDEN_SPEC_TOKENS.some((t) => key.includes(t))) return false;
  return true;
}

function formatSpecLabel(rawKey: string): string {
  const withSpaces = rawKey.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

function formatSpecValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map((item) => String(item ?? "")).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

// ── Component ────────────────────────────────────────────────────────────────

export interface ProductDetailModalProps {
  product: Product;
  inCart: number;
  computePrice: (p: Product, qty: number) => PriceResult;
  formatPrice: (n: number) => string;
  formatARS: (n: number) => string;
  formatUSD: (n: number) => string;
  currency: string;
  setCurrency: (c: "ARS" | "USD") => void;
  isDark: boolean;
  dk: (dark: string, light: string) => string;
  onClose: () => void;
  onAddToCart: (p: Product) => void;
  onRemoveFromCart: (p: Product) => void;
}

export function ProductDetailModal({
  product: p,
  inCart,
  computePrice,
  formatPrice,
  formatARS,
  formatUSD,
  currency,
  setCurrency,
  isDark,
  dk,
  onClose,
  onAddToCart,
  onRemoveFromCart,
}: ProductDetailModalProps) {
  const priceInfo = computePrice(p, Math.max(inCart, 1));
  const { unitPrice: finalPrice, ivaRate, ivaAmount, totalWithIVA: finalWithIVA } = priceInfo;
  const availableStock = getAvailableStock(p);
  const outOfStock = availableStock === 0;

  const publicSpecs = p.specs
    ? Object.entries(p.specs)
        .filter(([key]) => isClientVisibleSpecKey(key))
        .map(([key, value]) => ({
          key,
          label: formatSpecLabel(key),
          value: formatSpecValue(value),
        }))
        .filter((entry) => entry.value.trim().length > 0)
    : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-2xl w-full max-w-lg shadow-2xl shadow-black/30 flex flex-col max-h-[90vh]`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-3.5 border-b ${dk("border-[#1a1a1a]", "border-[#e5e5e5]")} shrink-0`}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs ${dk("text-gray-500 bg-[#242424]", "text-[#737373] bg-[#f0f0f0]")} px-2 py-0.5 rounded-full font-medium`}>
              {p.category}
            </span>
            {p.featured && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                <Star size={9} fill="currentColor" /> Destacado
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className={`${dk("text-gray-600 hover:text-white hover:bg-[#2a2a2a]", "text-[#a3a3a3] hover:text-[#171717] hover:bg-[#f0f0f0]")} transition p-1 rounded-lg shrink-0`}
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1">
          {/* Image */}
          <div className={`${dk("bg-[#0a0a0a]", "bg-[#f9f9f9]")} flex items-center justify-center h-52 px-8 shrink-0`}>
            <img src={p.image} alt={p.name} className="max-h-40 max-w-full object-contain drop-shadow-xl" />
          </div>

          {/* Info */}
          <div className="px-5 pt-4 pb-2">
            <div className="flex items-start justify-between gap-3 mb-1">
              <h2 className={`text-base font-extrabold ${dk("text-white", "text-[#171717]")} leading-tight`}>{p.name}</h2>
              <StockBadge stock={p.stock} lugStock={getLugStock(p)} />
            </div>

            <div className="flex items-center gap-3 mb-4">
              {p.sku && (
                <span className={`text-[11px] font-mono ${dk("text-[#525252] bg-[#171717] border-[#222]", "text-[#737373] bg-[#f0f0f0] border-[#e5e5e5]")} border px-2 py-0.5 rounded`}>
                  SKU: {p.sku}
                </span>
              )}
              {availableStock > 0 && (
                <span className={`text-[11px] ${dk("text-gray-600", "text-gray-500")}`}>{availableStock} disponibles</span>
              )}
              {p.stock_min > 0 && (
                <span className="text-[11px] text-gray-700">mín. {p.stock_min}</span>
              )}
            </div>

            {/* Price breakdown */}
            <div className={`${dk("bg-[#0d0d0d] border-[#1f1f1f]", "bg-[#f9f9f9] border-[#e5e5e5]")} border rounded-xl px-4 py-3 mb-4`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] ${dk("text-[#737373]", "text-[#a3a3a3]")}`}>Precio unitario</span>
                    <span className="text-base font-extrabold text-[#2D9F6A] tabular-nums">{formatPrice(finalPrice)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] ${dk("text-[#737373]", "text-[#a3a3a3]")}`}>IVA ({ivaRate}%)</span>
                    <span className={`text-sm font-semibold tabular-nums ${dk("text-[#a3a3a3]", "text-[#737373]")}`}>+ {formatPrice(ivaAmount)}</span>
                  </div>
                  <div className={`flex items-center justify-between pt-1.5 border-t ${dk("border-[#222]", "border-[#e5e5e5]")}`}>
                    <span className={`text-[11px] font-semibold ${dk("text-white", "text-[#171717]")}`}>Precio final</span>
                    <span className={`text-base font-extrabold tabular-nums ${dk("text-white", "text-[#171717]")}`}>{formatPrice(finalWithIVA)}</span>
                  </div>
                  <div className={`text-[10px] ${dk("text-[#525252]", "text-[#a3a3a3]")} font-mono`}>
                    {currency === "USD" ? formatARS(finalWithIVA) : formatUSD(finalWithIVA)}
                  </div>
                </div>
                {/* Currency toggle */}
                <div className="text-right shrink-0">
                  <div className={`text-[10px] ${dk("text-[#525252]", "text-[#a3a3a3]")} mb-1`}>Moneda</div>
                  <div className={`flex items-center ${dk("bg-[#171717] border-[#262626]", "bg-[#f0f0f0] border-[#e5e5e5]")} border rounded-lg p-0.5 gap-0.5`}>
                    {(["USD", "ARS"] as const).map((c) => (
                      <button
                        key={c}
                        onClick={() => setCurrency(c)}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${currency === c ? "bg-[#2D9F6A] text-white" : dk("text-[#525252] hover:text-[#a3a3a3]", "text-[#737373] hover:text-[#171717]")}`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* AI Compatibility (Phase 4.1) */}
            <div className="mb-4">
              <SmartCompatibility 
                productId={p.id} 
                isDark={isDark} 
                onAddToCart={onAddToCart}
                formatPrice={formatPrice}
              />
            </div>

            {/* Price tiers */}
            {p.price_tiers && p.price_tiers.length > 0 && (
              <div className="mb-4">
                <p className={`text-[11px] font-semibold uppercase tracking-wider mb-1.5 ${dk("text-gray-500", "text-gray-600")}`}>Precio por volumen</p>
                <div className={`rounded-xl border ${dk("border-[#1f1f1f]", "border-[#e5e5e5]")} overflow-hidden`}>
                  <div className={`grid grid-cols-3 text-[10px] font-bold uppercase tracking-wide ${dk("bg-[#0d0d0d] text-[#525252]", "bg-[#f5f5f5] text-[#a3a3a3]")} px-3 py-1.5`}>
                    <span>Cantidad</span>
                    <span className="text-center">Precio unit.</span>
                    <span className="text-right">Ahorro</span>
                  </div>
                  {p.price_tiers.map((tier, i) => {
                    const saving = ((p.cost_price - tier.price) / p.cost_price * 100);
                    const isActive = inCart >= tier.min && (tier.max === null || inCart <= tier.max);
                    return (
                      <div
                        key={i}
                        className={`grid grid-cols-3 text-xs px-3 py-2 ${
                          isActive
                            ? dk("bg-[#2D9F6A]/10 text-[#2D9F6A]", "bg-[#2D9F6A]/8 text-[#1a7a50]")
                            : i % 2 === 0
                              ? dk("bg-[#0d0d0d] text-gray-400", "bg-[#f9f9f9] text-[#525252]")
                              : dk("bg-[#0a0a0a] text-gray-400", "bg-white text-[#525252]")
                        }`}
                      >
                        <span className="font-medium">
                          {tier.min}{tier.max ? `–${tier.max}` : "+"} u.
                          {isActive && <span className="ml-1 text-[9px] font-bold uppercase">◀ actual</span>}
                        </span>
                        <span className="text-center font-bold tabular-nums">{formatPrice(tier.price)}</span>
                        <span className="text-right text-[10px]">
                          {saving > 0 ? <span className="text-green-400 font-semibold">-{saving.toFixed(0)}%</span> : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Description */}
            {p.description && (
              <div className="mb-4">
                <p className={`text-[11px] font-semibold uppercase tracking-wider mb-1.5 ${dk("text-gray-500", "text-gray-600")}`}>Descripción</p>
                <p className={`text-sm ${dk("text-gray-400", "text-[#525252]")} leading-relaxed whitespace-pre-line`}>{p.description}</p>
              </div>
            )}

            {/* Specs */}
            {publicSpecs.length > 0 && (
              <div className="mb-4">
                <p className={`text-[11px] font-semibold uppercase tracking-wider mb-1.5 ${dk("text-gray-500", "text-gray-600")}`}>Especificaciones</p>
                <div className={`rounded-xl border ${dk("border-[#1f1f1f]", "border-[#e5e5e5]")} overflow-hidden`}>
                  {publicSpecs.map((spec, i) => (
                    <div key={spec.key} className={`flex text-xs ${i % 2 === 0 ? dk("bg-[#0d0d0d]", "bg-[#f9f9f9]") : dk("bg-[#0a0a0a]", "bg-white")}`}>
                      <span className={`${dk("text-gray-500", "text-[#737373]")} px-3 py-2 w-2/5 shrink-0 font-medium`}>{spec.label}</span>
                      <span className={`${dk("text-gray-300", "text-[#525252]")} px-3 py-2 flex-1`}>{spec.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            {p.tags && p.tags.length > 0 && (
              <div className="mb-4">
                <p className={`text-[11px] font-semibold uppercase tracking-wider mb-1.5 ${dk("text-gray-500", "text-gray-600")}`}>Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {p.tags.map((t: string) => (
                    <span key={t} className={`text-[11px] px-2 py-0.5 rounded-full ${dk("bg-[#1c1c1c] text-[#a3a3a3] border-[#262626]", "bg-[#f0f0f0] text-[#525252] border-[#e5e5e5]")} border font-medium`}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer — cart controls */}
        <div className={`px-5 py-4 border-t ${dk("border-[#1a1a1a]", "border-[#e5e5e5]")} shrink-0`}>
          {outOfStock ? (
            <div className={`w-full ${dk("bg-[#1c1c1c] text-[#525252] border-[#222]", "bg-[#f5f5f5] text-[#737373] border-[#e5e5e5]")} font-medium h-11 rounded-xl text-sm flex items-center justify-center border`}>
              Sin stock disponible
            </div>
          ) : inCart > 0 ? (
            <div className="flex items-center gap-3">
              <button
                onClick={() => onRemoveFromCart(p)}
                className={`h-11 w-11 ${dk("bg-[#1c1c1c] hover:bg-[#252525] text-white border-[#262626]", "bg-[#f5f5f5] hover:bg-[#ebebeb] text-[#171717] border-[#e5e5e5]")} rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center border`}
              >
                <Minus size={16} />
              </button>
              <span className={`flex-1 text-center ${dk("text-white", "text-[#171717]")} font-extrabold text-xl`}>{inCart}</span>
              <button
                onClick={() => onAddToCart(p)}
                className="h-11 w-11 bg-[#2D9F6A] hover:bg-[#25835A] text-white rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center"
              >
                <Plus size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => onAddToCart(p)}
              className="w-full bg-[#2D9F6A] hover:bg-[#25835A] text-white font-bold h-11 rounded-xl text-sm transition-all active:scale-[0.98]"
            >
              Agregar al carrito
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
