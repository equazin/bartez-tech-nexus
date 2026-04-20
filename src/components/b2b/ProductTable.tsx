import React, { useState } from "react";
import { AlignJustify, LayoutList, Star, Truck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DataTableShell } from "@/components/ui/data-table-shell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAirIncomingStock } from "@/lib/stockUtils";
import type { Product } from "@/models/products";

import { QuickAddControl } from "./QuickAddControl";
import { StockBadge } from "./StockBadge";

interface ProductTableProps {
  products: Product[];
  cart: Record<number, number>;
  favoriteProductIds: number[];
  productMargins: Record<number, number>;
  globalMargin: number;
  latestPurchaseUnitPrice: Record<number, number>;
  formatPrice: (p: number) => string;
  onAddQty: (p: Product, qty: number) => void;
  onRemoveFromCart: (p: Product) => void;
  onSelect: (p: Product) => void;
  isPosProduct: (p: Product) => boolean;
  addedIds: Set<number>;
  getPriceInfo: (p: Product, q: number) => import("@/hooks/usePricing").PriceResult;
  onAddToList?: (product: Product) => void;
}

export function ProductTable({
  products,
  cart,
  favoriteProductIds,
  productMargins,
  globalMargin,
  latestPurchaseUnitPrice,
  formatPrice,
  onAddQty,
  onRemoveFromCart,
  onSelect,
  isPosProduct,
  addedIds,
  getPriceInfo,
  onAddToList,
}: ProductTableProps) {
  const [density, setDensity] = useState<"normal" | "compact">("normal");
  const isCompact = density === "compact";

  return (
    <DataTableShell
      title="Tabla de precios"
      description={isCompact ? undefined : "Vista compacta para comparar stock, precio y accion inmediata sin salir del catalogo."}
      meta={
        <div className="flex items-center gap-2">
          <Badge variant="muted">{products.length} resultados</Badge>
          <div className="flex items-center rounded-lg border border-border/70 bg-background p-0.5">
            <button
              type="button"
              onClick={() => setDensity("normal")}
              className={cn("flex items-center rounded-md px-2 py-1 text-[11px] font-semibold transition", density === "normal" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
              title="Vista normal"
            >
              <LayoutList size={12} />
            </button>
            <button
              type="button"
              onClick={() => setDensity("compact")}
              className={cn("flex items-center rounded-md px-2 py-1 text-[11px] font-semibold transition", isCompact ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
              title="Vista ultra-compacta"
            >
              <AlignJustify size={12} />
            </button>
          </div>
        </div>
      }
    >
      <Table>
        <TableHeader>
          <TableRow className={isCompact ? "[&>th]:py-1.5 [&>th]:text-[10px]" : ""}>
            <TableHead>SKU</TableHead>
            <TableHead>Nombre</TableHead>
            {!isCompact && <TableHead className="hidden sm:table-cell">Categoría</TableHead>}
            <TableHead className="text-center">Stock</TableHead>
            <TableHead className="text-right">Precio</TableHead>
            <TableHead className="text-right">Acción</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => {
            const inCart = cart[product.id] || 0;
            const price = getPriceInfo(product, Math.max(inCart, 1));
            const finalPrice = price.unitPrice;
            const available = Math.max(0, product.stock - (product.stock_reserved ?? 0));
            const incomingStock = getAirIncomingStock(product);
            const outOfStock = available === 0;
            const wasAdded = addedIds.has(product.id);
            const isFavorite = favoriteProductIds.includes(product.id);
            const hasTiers = Boolean(product.price_tiers && product.price_tiers.length > 1);
            const lastUnit = latestPurchaseUnitPrice[product.id];
            const deltaPct = lastUnit ? ((finalPrice - lastUnit) / lastUnit) * 100 : 0;

            return (
              <TableRow key={product.id} className={cn(outOfStock ? "opacity-50" : "", isCompact ? "[&>td]:py-1" : "")}>
                <TableCell>
                  <button type="button" className="text-left" onClick={() => onSelect(product)}>
                    <span className={cn("font-mono text-muted-foreground", isCompact ? "text-[10px]" : "text-xs")}>{product.sku ?? "-"}</span>
                  </button>
                </TableCell>
                <TableCell className={isCompact ? "max-w-[200px]" : "max-w-[280px]"}>
                  <button type="button" className="w-full text-left" onClick={() => onSelect(product)}>
                    <span className={cn("line-clamp-1 font-semibold text-foreground", isCompact ? "text-xs" : "text-sm")}>
                      {product.name}
                      {isFavorite ? <Star size={10} className="ml-1 inline text-amber-500" fill="currentColor" /> : null}
                    </span>
                    {!isCompact && hasTiers ? <span className="mt-1 block text-[11px] font-medium text-primary">Precio por volumen</span> : null}
                  </button>
                </TableCell>
                {!isCompact && (
                  <TableCell className="hidden sm:table-cell">
                    <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{product.category}</span>
                      {isPosProduct(product) ? (
                        <Badge variant="outline" className="gap-1 border-blue-500/20 bg-blue-500/10 text-blue-500">
                          <Truck size={10} /> POS
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                )}
                <TableCell className="text-center">
                  <StockBadge stock={available} incomingStock={incomingStock} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {!isCompact && price.isOffer && price.originalUnitPrice > finalPrice ? (
                    <span className="mb-0.5 block text-[10px] line-through text-muted-foreground/60">
                      {formatPrice(price.originalUnitPrice)}
                    </span>
                  ) : null}
                  <span className={cn("font-bold", isCompact ? "text-xs" : "text-sm", price.isOffer ? "text-sky-500" : "text-primary")}>
                    {formatPrice(finalPrice)}
                  </span>
                  {!isCompact && <span className="mt-1 block text-[11px] text-muted-foreground">+{product.iva_rate ?? 21}% IVA</span>}
                  {!isCompact && lastUnit && deltaPct > 0 ? <span className="block text-[11px] font-semibold text-amber-500">+{deltaPct.toFixed(1)}%</span> : null}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {!isCompact && onAddToList ? (
                      <button
                        type="button"
                        onClick={() => onAddToList(product)}
                        className="rounded-lg border border-border/70 px-2 py-1 text-[11px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      >
                        Lista
                      </button>
                    ) : null}
                    <QuickAddControl
                      inCart={inCart}
                      outOfStock={outOfStock}
                      wasAdded={wasAdded}
                      compact
                      onAddQty={(qty) => onAddQty(product, qty)}
                      onRemoveOne={() => onRemoveFromCart(product)}
                      onNotifyClick={outOfStock ? () => onSelect(product) : undefined}
                    />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </DataTableShell>
  );
}
