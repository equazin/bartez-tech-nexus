export type CatalogViewMode = "table" | "grid";

export type CatalogSortKey =
  | "name_asc"
  | "name_desc"
  | "price_asc"
  | "price_desc"
  | "stock_desc"
  | "featured";

export interface CategoryNode {
  id: number;
  name: string;
  slug: string | null;
  parentId: number | null;
  count: number;
  ownCount: number;
  children: CategoryNode[];
}

export interface CategoryCountRow {
  category_id: number;
  name: string;
  parent_id: number | null;
  count: number;
}

export interface CatalogFilters {
  categoryId: number | null;
  brandId: string | null;
  search: string;
  minPrice: number | null;
  maxPrice: number | null;
}

export const DEFAULT_FILTERS: CatalogFilters = {
  categoryId: null,
  brandId: null,
  search: "",
  minPrice: null,
  maxPrice: null,
};

export interface PriceListRow {
  product_id: number;
  sku: string;
  name: string;
  brand_name: string;
  category: string;
  unit_price: number;
  stock: number;
  min_order_qty: number;
}
