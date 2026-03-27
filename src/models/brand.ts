export interface Brand {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  active: boolean;
  created_at: string;
  /** Computed locally — not stored in DB */
  product_count?: number;
}

export type BrandInsert = Omit<Brand, "id" | "created_at" | "product_count">;
export type BrandUpdate = Partial<BrandInsert>;
