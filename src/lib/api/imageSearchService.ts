import { supabase } from "@/lib/supabase";
import type { Product } from "@/models/products";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ImageSearchProgress {
  done: number;
  total: number;
  summary: ImageSearchSummary;
}

export interface ImageSearchSummary {
  total: number;
  auto_assigned: number;
  suggested: number;
  skipped: number;
  already_has_image: number;
}

export interface ImageSuggestion {
  id: string;
  product_id: number;
  image_url: string;
  score: number;
  source: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export type ImageSearchFilter = "missing_only" | "all" | "by_category";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BATCH_SIZE = 5;

function resolveApiBaseUrl(): string {
  const configured = (import.meta.env.VITE_API_BASE_URL || "").trim();
  if (!configured) return "";
  try {
    const parsed = new URL(configured);
    const isLocalTarget =
      parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    const isBrowser = typeof window !== "undefined";
    const isLocalOrigin =
      isBrowser &&
      (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1");
    if (isLocalTarget && !isLocalOrigin) return "";
    return configured.replace(/\/$/, "");
  } catch {
    return configured.replace(/\/$/, "");
  }
}

// ---------------------------------------------------------------------------
// Fetch products that need images
// ---------------------------------------------------------------------------

export async function fetchProductsForImageSearch(
  filter: ImageSearchFilter,
  category?: string
): Promise<Product[]> {
  let query = supabase
    .from("products")
    .select(
      "id, name, brand_name, sku, category, image, active"
    )
    .eq("active", true)
    .order("name");

  if (filter === "missing_only") {
    query = query.or("image.is.null,image.eq.");
  }

  if (filter === "by_category" && category) {
    query = query.eq("category", category);
  }

  const allProducts: Product[] = [];
  const PAGE_SIZE = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allProducts.push(...(data as Product[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return allProducts;
}

// ---------------------------------------------------------------------------
// Process image search in batches
// ---------------------------------------------------------------------------

async function processBatch(
  products: Product[],
  autoAssign: boolean,
  autoAssignThreshold: number,
  signal?: AbortSignal
): Promise<ImageSearchSummary> {
  const payload = products.map((p) => ({
    id: p.id,
    name: p.name,
    brand: p.brand_name ?? null,
    sku: p.sku ?? null,
    category: p.category ?? null,
    image: p.image ?? null,
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
    body: JSON.stringify({
      products: payload,
      mode: "missing_only",
      autoAssign,
      autoAssignThreshold,
    }),
    signal,
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(
      `image-finder error: ${res.status}${detail ? ` - ${detail}` : ""}`
    );
  }

  const data = (await res.json()) as {
    ok: boolean;
    summary: ImageSearchSummary;
  };
  return data.summary;
}

export async function processImageSearch(
  products: Product[],
  autoAssign: boolean,
  autoAssignThreshold: number,
  onProgress: (p: ImageSearchProgress) => void,
  signal?: AbortSignal
): Promise<ImageSearchSummary> {
  const totals: ImageSearchSummary = {
    total: 0,
    auto_assigned: 0,
    suggested: 0,
    skipped: 0,
    already_has_image: 0,
  };

  const batches: Product[][] = [];
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    batches.push(products.slice(i, i + BATCH_SIZE));
  }

  for (let i = 0; i < batches.length; i++) {
    if (signal?.aborted) break;

    const summary = await processBatch(
      batches[i],
      autoAssign,
      autoAssignThreshold,
      signal
    );

    totals.total += summary.total;
    totals.auto_assigned += summary.auto_assigned;
    totals.suggested += summary.suggested;
    totals.skipped += summary.skipped;
    totals.already_has_image += summary.already_has_image;

    onProgress({
      done: Math.min((i + 1) * BATCH_SIZE, products.length),
      total: products.length,
      summary: { ...totals },
    });
  }

  return totals;
}

// ---------------------------------------------------------------------------
// Suggestion management
// ---------------------------------------------------------------------------

export async function fetchSuggestionsForProduct(
  productId: number
): Promise<ImageSuggestion[]> {
  const { data, error } = await supabase
    .from("image_suggestions")
    .select("*")
    .eq("product_id", productId)
    .order("score", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ImageSuggestion[];
}

export async function approveSuggestion(
  suggestion: ImageSuggestion
): Promise<void> {
  // Update product image
  await supabase
    .from("products")
    .update({ image: suggestion.image_url })
    .eq("id", suggestion.product_id);

  // Mark suggestion as approved
  await supabase
    .from("image_suggestions")
    .update({ status: "approved", updated_at: new Date().toISOString() })
    .eq("id", suggestion.id);

  // Reject other pending suggestions for this product
  await supabase
    .from("image_suggestions")
    .update({ status: "rejected", updated_at: new Date().toISOString() })
    .eq("product_id", suggestion.product_id)
    .eq("status", "pending")
    .neq("id", suggestion.id);

  // Log
  await supabase.from("image_processing_log").insert({
    product_id: suggestion.product_id,
    source: suggestion.source,
    image_url: suggestion.image_url,
    score: suggestion.score,
    action: "approved",
  });
}

export async function rejectSuggestion(
  suggestion: ImageSuggestion
): Promise<void> {
  await supabase
    .from("image_suggestions")
    .update({ status: "rejected", updated_at: new Date().toISOString() })
    .eq("id", suggestion.id);

  await supabase.from("image_processing_log").insert({
    product_id: suggestion.product_id,
    source: suggestion.source,
    image_url: suggestion.image_url,
    score: suggestion.score,
    action: "rejected",
  });
}

export async function getImageStats(): Promise<{
  total: number;
  withImage: number;
  withoutImage: number;
  pendingSuggestions: number;
}> {
  // Count products
  const { count: totalCount } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("active", true);

  const { count: withImageCount } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("active", true)
    .not("image", "is", null)
    .neq("image", "");

  const { count: pendingCount } = await supabase
    .from("image_suggestions")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  const total = totalCount ?? 0;
  const withImage = withImageCount ?? 0;

  return {
    total,
    withImage,
    withoutImage: total - withImage,
    pendingSuggestions: pendingCount ?? 0,
  };
}
