import { backend } from "./backendClient";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Product {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  price: number;
  cost: number | null;
  stock: number;
  category: string | null;
  brand: string | null;
  images: string[] | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateProductPayload {
  sku: string;
  name: string;
  description?: string | null;
  price: number;
  cost?: number | null;
  stock?: number;
  category?: string | null;
  brand?: string | null;
  images?: string[] | null;
  active?: boolean;
}

export interface UpdateProductPayload extends Partial<CreateProductPayload> {}

// ─── Reads — direct Supabase (RLS-safe) ──────────────────────────────────────

export async function fetchProducts(params: {
  search?: string;
  category?: string;
  brand?: string;
  active?: boolean;
  limit?: number;
  offset?: number;
}) {
  let query = supabase
    .from("products")
    .select("*", { count: "exact" })
    .order("name", { ascending: true });

  if (params.active !== undefined) query = query.eq("active", params.active);
  if (params.category) query = query.eq("category", params.category);
  if (params.brand) query = query.eq("brand", params.brand);
  if (params.search) {
    const s = params.search.replace(/[%_]/g, "");
    query = query.or(`name.ilike.%${s}%,sku.ilike.%${s}%`);
  }
  if (params.limit) query = query.limit(params.limit);
  if (params.offset) query = query.range(params.offset, params.offset + (params.limit ?? 50) - 1);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return { items: (data ?? []) as Product[], count: count ?? 0 };
}

// ─── Mutations — through backend ──────────────────────────────────────────────

export async function createProductApi(payload: CreateProductPayload): Promise<Product> {
  return backend.post<Product>("/v1/products", payload);
}

export async function updateProductApi(
  id: string,
  patch: UpdateProductPayload,
): Promise<Product> {
  return backend.patch<Product>(`/v1/products/${id}`, patch);
}

export async function adjustStockApi(
  id: number,
  delta: number,
  reason?: string,
): Promise<{ id: number; sku: string; name: string; stock: number }> {
  return backend.post(`/v1/products/${id}/stock-adjustments`, { delta, reason });
}
