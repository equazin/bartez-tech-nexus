export interface OrderProduct {
  id?: number;
  price?: number;
  total?: number;
  product_id: number;
  name: string;
  quantity: number;
  cost_price: number;
  supplier_id: number;
  supplier_multiplier: number;
  sku: string;
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
  id: number;
  client_id: number;
  products: OrderProduct[];
  total: number;
  status: OrderStatus;
  order_number?: string;
  numero_remito?: string;
  created_at: string;
}
