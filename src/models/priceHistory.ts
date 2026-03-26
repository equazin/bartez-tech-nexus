export interface PriceHistory {
  id: string;
  product_id: number;
  changed_by?: string;
  old_price: number;
  new_price: number;
  change_reason?: string;
  created_at: string;
}

export type PriceHistoryInsert = Omit<PriceHistory, "id" | "created_at">;
