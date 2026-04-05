import { useCallback } from "react";
import { List, useListRef } from "react-window";
import { AutoSizer } from "react-virtualized-auto-sizer";
import type { Product } from "@/models/products";
import type { PriceResult } from "@/hooks/usePricing";
import { ProductItem } from "@/components/b2b/ProductItem";

const ITEM_HEIGHT = 112;

const SizedAutoSizer = AutoSizer as unknown as React.ComponentType<{
  children: (size: { height: number; width: number }) => React.ReactNode;
}>;

interface RowDataProps {
  products: Product[];
  cart: Record<number, number>;
  favoriteProductIds: number[];
  compareList: number[];
  addedIds: Set<number>;
  purchaseHistory: Record<number, number>;
  latestPurchaseUnitPrice: Record<number, number>;
  computePrice: (p: Product, qty: number) => PriceResult;
  formatPrice: (n: number) => string;
  handleAddQty: (p: Product, qty: number) => void;
  onRemoveFromCart: (p: Product) => void;
  handleToggleFavorite: (id: number) => void;
  toggleCompare: (id: number) => void;
  setSelectedProduct: (p: Product | null) => void;
  isPosProduct: (p: Product) => boolean;
}

interface RowProps extends RowDataProps {
  index: number;
  style: React.CSSProperties;
  ariaAttributes?: Record<string, unknown>;
}

function Row({
  index,
  style,
  products,
  cart,
  favoriteProductIds,
  compareList,
  addedIds,
  purchaseHistory,
  latestPurchaseUnitPrice,
  computePrice,
  formatPrice,
  handleAddQty,
  onRemoveFromCart,
  handleToggleFavorite,
  toggleCompare,
  setSelectedProduct,
  isPosProduct,
  ariaAttributes,
}: RowProps) {
  const product = products[index];
  if (!product) return null;

  const price = computePrice(product, Math.max(cart[product.id] || 0, 1));

  return (
    <div style={{ ...style, paddingBottom: 4 }} {...ariaAttributes}>
      <ProductItem
        product={product}
        viewMode="list"
        inCart={cart[product.id] || 0}
        isFavorite={favoriteProductIds.includes(product.id)}
        isCompared={compareList.includes(product.id)}
        finalPrice={price.unitPrice}
        formatPrice={formatPrice}
        onAddQty={handleAddQty}
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
}

export interface VirtualizedProductListProps {
  products: Product[];
  cart: Record<number, number>;
  favoriteProductIds: number[];
  compareList: number[];
  addedIds: Set<number>;
  purchaseHistory: Record<number, number>;
  latestPurchaseUnitPrice: Record<number, number>;
  computePrice: (p: Product, qty: number) => PriceResult;
  formatPrice: (n: number) => string;
  handleAddQty: (p: Product, qty: number) => void;
  onRemoveFromCart: (p: Product) => void;
  handleToggleFavorite: (id: number) => void;
  toggleCompare: (id: number) => void;
  setSelectedProduct: (p: Product | null) => void;
  isPosProduct: (p: Product) => boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

export function VirtualizedProductList({
  products,
  onLoadMore,
  hasMore,
  ...rowProps
}: VirtualizedProductListProps) {
  const listRef = useListRef();

  const onRowsRendered = useCallback(
    ({ stopIndex }: { startIndex: number; stopIndex: number }) => {
      if (hasMore && onLoadMore && stopIndex >= products.length - 10) {
        onLoadMore();
      }
    },
    [hasMore, onLoadMore, products.length]
  );

  // rowProps spread is passed to each row component by react-window v2
  const rowData: RowDataProps = {
    products,
    ...rowProps,
  };

  return (
    <div style={{ height: "calc(100vh - 320px)", minHeight: 400 }}>
      <SizedAutoSizer>
        {({ height, width }: { height: number; width: number }) => (
          <List
            listRef={listRef}
            defaultHeight={height}
            rowComponent={Row as never}
            rowCount={products.length}
            rowHeight={ITEM_HEIGHT}
            rowProps={rowData as never}
            onRowsRendered={onRowsRendered}
            overscanCount={5}
            style={{ height, width }}
          />
        )}
      </SizedAutoSizer>
    </div>
  );
}
