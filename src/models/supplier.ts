/** Supplier as stored in the Supabase `suppliers` table (UUID primary key). */
export interface Supplier {
  id: string;
  name: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  lead_time_days: number;
  default_margin: number;
  price_multiplier: number;
  active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type SupplierInsert = Omit<Supplier, "id" | "created_at" | "updated_at">;
export type SupplierUpdate = Partial<SupplierInsert>;

/** Legacy numeric-ID shape used by older stores and admin components. */
export interface LegacySupplier {
  id: number;
  name: string;
  type: "manual";
  price_multiplier: number;
  priority: number;
}
