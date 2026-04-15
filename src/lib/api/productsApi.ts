import { backend, hasBackendUrl } from "./backend";
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

export interface PublicProduct {
  id: number;
  name: string;
  category: string | null;
  sku: string | null;
  image: string | null;
  active: boolean;
  stock: number;
  brand: string | null;
}

export interface PublicProductsResponse {
  items: PublicProduct[];
  total: number;
  limit: number;
  offset: number;
}

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

export async function fetchPublicProducts(params: {
  search?: string;
  active?: boolean;
  limit?: number;
  offset?: number;
}): Promise<PublicProductsResponse> {
  if (hasBackendUrl) {
    const data = await backend.get<{
      items: Product[];
      meta?: { count?: number; limit?: number; offset?: number };
    }>("/v1/products", params);

    const items = (data.items ?? []).map((product) => ({
      id: product.id,
      name: product.name,
      category: product.category,
      sku: product.sku,
      image: product.images?.[0] ?? null,
      active: product.active,
      stock: product.stock,
      brand: product.brand,
    }));

    return {
      items,
      total: data.meta?.count ?? items.length,
      limit: data.meta?.limit ?? (params.limit ?? items.length),
      offset: data.meta?.offset ?? (params.offset ?? 0),
    };
  }

  const searchParams = new URLSearchParams();
  if (params.search) searchParams.set("search", params.search);
  if (params.active !== undefined) searchParams.set("active", String(params.active));
  if (params.limit !== undefined) searchParams.set("limit", String(params.limit));
  if (params.offset !== undefined) searchParams.set("offset", String(params.offset));

  const queryString = searchParams.toString();
  const response = await fetch(`/api/products${queryString ? `?${queryString}` : ""}`);
  const raw = await response.text();
  if (!raw) {
    throw new Error("Respuesta vacia del catalogo.");
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error(raw);
  }

  if (!response.ok) {
    throw new Error(
      typeof parsed.error === "string" && parsed.error.trim().length > 0
        ? parsed.error
        : "No se pudo cargar el catalogo.",
    );
  }

  const payload =
    parsed.ok === true && parsed.data && typeof parsed.data === "object"
      ? (parsed.data as Record<string, unknown>)
      : parsed;
  const items = Array.isArray(payload.items) ? (payload.items as PublicProduct[]) : [];
  const meta =
    payload.meta && typeof payload.meta === "object"
      ? (payload.meta as Record<string, unknown>)
      : null;

  return {
    items,
    total:
      typeof payload.total === "number"
        ? payload.total
        : typeof meta?.count === "number"
          ? meta.count
          : items.length,
    limit:
      typeof payload.limit === "number"
        ? payload.limit
        : typeof meta?.limit === "number"
          ? meta.limit
          : params.limit ?? items.length,
    offset:
      typeof payload.offset === "number"
        ? payload.offset
        : typeof meta?.offset === "number"
          ? meta.offset
          : params.offset ?? 0,
  };
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
