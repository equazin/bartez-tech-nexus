import React from "react";
import { Star, Truck, Plus, Minus } from "lucide-react";
import { StockBadge } from "./StockBadge";
import { getLugStock } from "@/lib/stockUtils";
import type { Product } from "@/models/products";

interface ProductTableProps {
  products: Product[];
  cart: Record<number, number>;
  favoriteProductIds: number[];
  productMargins: Record<number, number>;
  globalMargin: number;
  latestPurchaseUnitPrice: Record<number, number>;
  formatPrice: (p: number) => string;
  onAddToCart: (p: Product) => void;
  onRemoveFromCart: (p: Product) => void;
  onSelect: (p: Product) => void;
  isPosProduct: (p: Product) => boolean;
  dk: (d: string, l: string) => string;
  addedIds: Set<number>;
  getUnitPrice: (p: Product, q: number) => number;
}

export function ProductTable({
  products,
  cart,
  favoriteProductIds,
  productMargins,
  globalMargin,
  latestPurchaseUnitPrice,
  formatPrice,
  onAddToCart,
  onRemoveFromCart,
  onSelect,
  isPosProduct,
  dk,
  addedIds,
  getUnitPrice,
}: ProductTableProps) {
  return (
    <div className={`rounded-xl border overflow-hidden ${dk("border-[#1f1f1f]", "border-[#e5e5e5]")}`}>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className={`${dk("bg-[#0d0d0d] text-[#525252]", "bg-[#f5f5f5] text-[#a3a3a3]")} text-[11px] font-bold uppercase tracking-wide`}>
            <th className="text-left px-3 py-2.5">SKU</th>
            <th className="text-left px-3 py-2.5">Nombre</th>
            <th className="hidden sm:table-cell text-left px-3 py-2.5">Categoría</th>
            <th className="text-center px-3 py-2.5">Stock</th>
            <th className="text-right px-3 py-2.5">Precio s/IVA</th>
            <th className="text-right px-3 py-2.5 w-32">Acción</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product, idx) => {
            const margin = productMargins[product.id] ?? globalMargin;
            const inCart = cart[product.id] || 0;
            const finalPrice = getUnitPrice(product, Math.max(inCart, 1)) * (1 + margin / 100);
            const available = Math.max(0, product.stock - (product.stock_reserved ?? 0));
            const outOfStock = available === 0;
            const wasAdded = addedIds.has(product.id);
            const isFavorite = favoriteProductIds.includes(product.id);
            const hasTiers = product.price_tiers && product.price_tiers.length > 1;
            const lastUnit = latestPurchaseUnitPrice[product.id];
            const deltaPct = lastUnit
              ? ((finalPrice - lastUnit) / lastUnit) * 100
              : 0;

            return (
              <tr
                key={product.id}
                className={`border-t transition ${
                  outOfStock ? "opacity-40 " : ""
                }${idx % 2 === 0
                  ? dk("bg-[#111] border-[#1a1a1a]", "bg-white border-[#f0f0f0]")
                  : dk("bg-[#0d0d0d] border-[#1a1a1a]", "bg-[#fafafa] border-[#f0f0f0]")
                } ${!outOfStock ? dk("hover:bg-[#161616]", "hover:bg-[#f5f5f5]") : ""}`}
              >
                <td className="px-3 py-2">
                  <button className="text-left" onClick={() => onSelect(product)}>
                    <span className={`text-[11px] font-mono ${dk("text-[#525252]", "text-[#737373]")}`}>
                      {product.sku ?? "—"}
                    </span>
                  </button>
                </td>
                <td className="px-3 py-2 max-w-[220px]">
                  <button className="text-left w-full" onClick={() => onSelect(product)}>
                    <span className={`text-sm font-medium ${dk("text-gray-200", "text-[#171717]")} line-clamp-1`}>
                      {product.name}
                      {isFavorite && <Star size={10} className="inline ml-1 text-yellow-500" fill="currentColor" />}
                    </span>
                    {hasTiers && (
                      <span className="text-[10px] text-[#2D9F6A] font-semibold">Precio por volumen</span>
                    )}
                  </button>
                </td>
                <td className={`hidden sm:table-cell px-3 py-2 text-xs ${dk("text-gray-600", "text-[#737373]")}`}>
                  <div className="inline-flex items-center gap-1.5">
                    <span>{product.category}</span>
                    {isPosProduct(product) && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        <Truck size={9} /> POS
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-center">
                  <StockBadge stock={available} lugStock={getLugStock(product)} />
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  <span className="text-sm font-bold text-[#2D9F6A]">{formatPrice(finalPrice)}</span>
                  <span className={`block text-[10px] ${dk("text-[#525252]", "text-[#a3a3a3]")}`}>+{product.iva_rate ?? 21}% IVA</span>
                  {lastUnit && deltaPct > 0 && (
                    <span className="block text-[10px] font-semibold text-amber-500">↑ +{deltaPct.toFixed(1)}%</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {inCart > 0 ? (
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => onRemoveFromCart(product)}
                        className={`h-7 w-7 ${dk("bg-[#1c1c1c] hover:bg-[#252525] text-white border-[#262626]", "bg-[#f5f5f5] hover:bg-[#ebebeb] text-[#171717] border-[#e5e5e5]")} active:scale-95 rounded-md text-sm font-bold transition-all flex items-center justify-center border`}>
                        <Minus size={11} />
                      </button>
                      <span className={`w-5 text-center ${dk("text-white", "text-[#171717]")} font-bold text-xs tabular-nums`}>{inCart}</span>
                      <button onClick={() => onAddToCart(product)}
                        className="h-7 w-7 bg-[#2D9F6A] hover:bg-[#25835A] active:scale-95 text-white rounded-md text-sm font-bold transition-all flex items-center justify-center">
                        <Plus size={11} />
                      </button>
                    </div>
                  ) : (
                    <button
                      disabled={outOfStock}
                      onClick={() => onAddToCart(product)}
                      className={`text-xs h-7 px-3 rounded-md font-bold transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none ${
                        wasAdded ? "bg-green-600/90 text-white" : "bg-[#2D9F6A] hover:bg-[#25835A] text-white"
                      }`}
                    >
                      {outOfStock ? "Sin stock" : wasAdded ? "✓" : "+ Añadir"}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
