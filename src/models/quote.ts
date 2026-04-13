export type QuoteStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "approved"
  | "rejected"
  | "converted"
  | "expired";

export interface QuoteItem {
  product_id: number;
  name: string;
  quantity: number;
  cost: number;
  margin: number;
  unitPrice: number;      // sin IVA
  totalPrice: number;     // sin IVA × qty
  ivaRate: number;        // 10.5 | 21
  ivaAmount: number;
  totalWithIVA: number;
}

export interface Quote {
  id: number;
  client_id: string;
  client_name: string;
  items: QuoteItem[];
  subtotal: number;       // sin IVA
  ivaTotal: number;
  total: number;          // con IVA
  currency: "USD" | "ARS";
  status: QuoteStatus;
  created_at: string;
  updated_at: string;
  /** Versioning: v1 = original, v2 = duplicate, etc. */
  version?: number;
  /** ID of the original quote this was duplicated from */
  parent_id?: number;
  /** ID of the order created from this quote */
  order_id?: string | number;
  /** Optional validity for customer-facing proposals */
  valid_days?: number;
  /** Optional expiration timestamp */
  expires_at?: string;
  /** Commercial / operational notes */
  notes?: string;
  /** Optional linkage to PC Builder draft */
  build_id?: string;
}
