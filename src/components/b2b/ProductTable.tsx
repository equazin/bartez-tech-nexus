import React from "react";
import { Star, Truck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DataTableShell } from "@/components/ui/data-table-shell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  return (
    <DataTableShell
      title="Tabla de precios"
      description="Vista compacta para comparar stock, precio y accion inmediata sin salir del catalogo."
      meta={<Badge variant="muted">{products.length} resultados</Badge>}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>SKU</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead className="hidden sm:table-cell">Categoria</TableHead>
            <TableHead className="text-center">Stock</TableHead>
            <TableHead className="text-right">Precio s/IVA</TableHead>
            <TableHead className="text-right">Accion</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => {
            const inCart = cart[product.id] || 0;
            const price = getPriceInfo(product, Math.max(inCart, 1));
            const finalPrice = price.unitPrice;
            const available = Math.max(0, product.stock - (product.stock_reserved ?? 0));
            const outOfStock = available === 0;
            const wasAdded = addedIds.has(product.id);
            const isFavorite = favoriteProductIds.includes(product.id);
            const hasTiers = Boolean(product.price_tiers && product.price_tiers.length > 1);
            const lastUnit = latestPurchaseUnitPrice[product.id];
            const deltaPct = lastUnit ? ((finalPrice - lastUnit) / lastUnit) * 100 : 0;

            return (
              <TableRow key={product.id} className={outOfStock ? "opacity-50" : ""}>
                <TableCell>
                  <button type="button" className="text-left" onClick={() => onSelect(product)}>
                    <span className="font-mono text-xs text-muted-foreground">{product.sku ?? "-"}</span>
                  </button>
                </TableCell>
                <TableCell className="max-w-[280px]">
                  <button type="button" className="w-full text-left" onClick={() => onSelect(product)}>
                    <span className="line-clamp-1 text-sm font-semibold text-foreground">
                      {product.name}
                      {isFavorite ? <Star size={10} className="ml-1 inline text-amber-500" fill="currentColor" /> : null}
                    </span>
                    {hasTiers ? <span className="mt-1 block text-[11px] font-medium text-primary">Precio por volumen</span> : null}
                  </button>
                </TableCell>
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
                <TableCell className="text-center">
                      <StockBadge stock={available} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {price.isOffer && price.originalUnitPrice > finalPrice ? (
                    <span className="mb-0.5 block text-[10px] line-through text-muted-foreground/60">
                      {formatPrice(price.originalUnitPrice)}
                    </span>
                  ) : null}
                  <span className={cn(
                    "text-sm font-bold",
                    price.isOffer ? "text-sky-500" : "text-primary"
                  )}>
                    {formatPrice(finalPrice)}
                  </span>
                  <span className="mt-1 block text-[11px] text-muted-foreground">+{product.iva_rate ?? 21}% IVA</span>
                  {lastUnit && deltaPct > 0 ? <span className="block text-[11px] font-semibold text-amber-500">+{deltaPct.toFixed(1)}%</span> : null}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {onAddToList ? (
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
