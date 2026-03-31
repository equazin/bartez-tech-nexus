import { supabase } from "@/lib/supabase";
import { Product } from "@/models/products";

export interface ImageSuggestion {
  id: string;
  product_id: number;
  image_url: string;
  score: number;
  source: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export interface ProcessSummary {
  total: number;
  auto_assigned: number;
  suggested: number;
  discarded: number;
}

export interface ProcessProgress {
  done: number;
  total: number;
  summary: ProcessSummary;
}

const BATCH_SIZE = 10;

function resolveApiBaseUrl(): string {
  const configured = (import.meta.env.VITE_API_BASE_URL || "").trim();
  if (!configured) return "";
  try {
    const parsed = new URL(configured);
    const isLocalTarget = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    const isBrowser = typeof window !== "undefined";
    const isLocalOrigin = isBrowser && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
    if (isLocalTarget && !isLocalOrigin) return "";
    return configured.replace(/\/$/, "");
  } catch {
    return configured.replace(/\/$/, "");
  }
}

/** Fetch products that have no image (null or empty string). */
export async function fetchProductsWithoutImages(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*, suppliers(name)")
    .or("image.is.null,image.eq.''")
    .eq("active", true)
    .order("name");
  if (error) throw new Error(error.message ?? "Error al cargar productos");
  return (data ?? []).map((row) => ({
    ...row,
    supplier_name: (row.suppliers as { name?: string } | null)?.name ?? undefined,
  }));
}

/** Send a batch of products to the image-finder API and return the summary. */
async function processBatch(
  products: Product[],
  signal?: AbortSignal
): Promise<ProcessSummary> {
  const payload = products.map((p) => ({
    id: p.id,
    name: p.name,
    brand: p.brand_name ?? null,
    category: p.category ?? null,
    sku: p.sku ?? null,
    supplier_name: p.supplier_name ?? null,
    supplier_sku: p.sku ?? null,
  }));

  const base = resolveApiBaseUrl();
  const url = `${base}/api/image-finder`;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(anonKey ? { "x-supabase-apikey": anonKey } : {}),
    },
    body: JSON.stringify({ products: payload }),
    signal,
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`image-finder error: ${res.status}${detail ? ` - ${detail}` : ""}`);
  }
  const data = await res.json() as { ok: boolean; summary: ProcessSummary };
  return data.summary;
}

/** Process all products in batches, reporting progress via callback. */
export async function processProducts(
  products: Product[],
  onProgress: (p: ProcessProgress) => void,
  signal?: AbortSignal
): Promise<ProcessSummary> {
  const totals: ProcessSummary = { total: 0, auto_assigned: 0, suggested: 0, discarded: 0 };
  const batches: Product[][] = [];

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    batches.push(products.slice(i, i + BATCH_SIZE));
  }

  for (let i = 0; i < batches.length; i++) {
    if (signal?.aborted) break;
    const summary = await processBatch(batches[i], signal);
    totals.total        += summary.total;
    totals.auto_assigned += summary.auto_assigned;
    totals.suggested    += summary.suggested;
    totals.discarded    += summary.discarded;
    onProgress({ done: Math.min((i + 1) * BATCH_SIZE, products.length), total: products.length, summary: { ...totals } });
  }

  return totals;
}

/** Fetch all pending image suggestions, joined with product name. */
export async function fetchPendingSuggestions(): Promise<(ImageSuggestion & { product_name: string; product_sku?: string })[]> {
  const { data, error } = await supabase
    .from("image_suggestions")
    .select("*, products(name, sku)")
    .eq("status", "pending")
    .order("score", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row,
    product_name: (row.products as { name?: string; sku?: string } | null)?.name ?? `#${row.product_id}`,
    product_sku:  (row.products as { name?: string; sku?: string } | null)?.sku ?? undefined,
  }));
}

/** Fetch recently auto-assigned products (from log). */
export async function fetchAutoAssignedLog(limit = 50): Promise<Array<{
  id: string;
  product_id: number;
  image_url: string;
  score: number;
  source: string;
  created_at: string;
  product_name: string;
}>> {
  const { data, error } = await supabase
    .from("image_processing_log")
    .select("*, products(name)")
    .eq("action", "auto_assigned")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row,
    image_url: row.image_url ?? "",
    product_name: (row.products as { name?: string } | null)?.name ?? `#${row.product_id}`,
  }));
}

/** Approve a suggestion: update product image + mark suggestion approved. */
export async function approveSuggestion(suggestion: ImageSuggestion): Promise<void> {
  const { error: e1 } = await supabase
    .from("products")
    .update({ image: suggestion.image_url })
    .eq("id", suggestion.product_id);
  if (e1) throw e1;

  const { error: e2 } = await supabase
    .from("image_suggestions")
    .update({ status: "approved", updated_at: new Date().toISOString() })
    .eq("id", suggestion.id);
  if (e2) throw e2;

  await supabase
    .from("image_suggestions")
    .update({ status: "rejected", updated_at: new Date().toISOString() })
    .eq("product_id", suggestion.product_id)
    .eq("status", "pending");

  await supabase.from("image_processing_log").insert({
    product_id: suggestion.product_id,
    source: suggestion.source,
    image_url: suggestion.image_url,
    score: suggestion.score,
    action: "approved",
  });
}

/** Reject a suggestion. */
export async function rejectSuggestion(suggestionId: string, productId: number): Promise<void> {
  const { error } = await supabase
    .from("image_suggestions")
    .update({ status: "rejected", updated_at: new Date().toISOString() })
    .eq("id", suggestionId);
  if (error) throw error;

  await supabase.from("image_processing_log").insert({
    product_id: productId,
    action: "rejected",
  });
}
