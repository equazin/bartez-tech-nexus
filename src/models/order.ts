/** Legacy minimal types — kept for backward compatibility */
export interface OrderProduct {
  id?: number;
  price?: number;
  total?: number;
  product_id: number;
  name: string;
  quantity: number;
  cost_price: number;
  supplier_id?: number;
  supplier_multiplier?: number;
  sku: string;
  unit_price?: number;
  total_price?: number;
  margin?: number;
}

export type OrderStatus =
  | "pending"
  | "approved"
  | "preparing"
  | "shipped"
  | "delivered"
  | "rejected"
  | "dispatched";

export interface Order {
  id: number | string;
  client_id?: number | string;
  products: OrderProduct[];
  total: number;
  status: OrderStatus;
  /** Visible order number: ORD-0001 */
  order_number?: string;
  /** Delivery slip number */
  numero_remito?: string;
  tracking_number?: string;
  shipped_at?: string;
  payment_method?: string;
  payment_surcharge_pct?: number;
  shipping_type?: string;
  shipping_address?: string;
  shipping_transport?: string;
  shipping_cost?: number;
  notes?: string;
  payment_proofs?: unknown[];
  created_at: string;
}
