export type ActivityAction =
  | "login"
  | "logout"
  | "search"
  | "view_product"
  | "add_to_cart"
  | "remove_from_cart"
  | "place_order"
  | "save_quote"
  | "load_quote"
  | "export_csv"
  | "export_pdf";

export interface ActivityLog {
  id: string;
  user_id?: string;
  action: ActivityAction;
  entity_type?: "product" | "order" | "quote";
  entity_id?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export type ActivityLogInsert = Omit<ActivityLog, "id" | "created_at">;
