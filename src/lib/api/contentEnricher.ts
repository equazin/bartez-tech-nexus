import { supabase } from "@/lib/supabase";
import { Product } from "@/models/products";

export type ContentMode = "only_descriptions" | "only_specs" | "both";

export interface ContentProcessSummary {
  total: number;
  generated: number;
  review_required: number;
  skipped: number;
}

export interface ContentProcessProgress {
  done: number;
  total: number;
  summary: ContentProcessSummary;
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

export async function fetchProductsForContent(mode: ContentMode): Promise<Product[]> {
  let query = supabase
    .from("products")
    .select("id, name, brand_name, sku, description, description_short, description_full, specs, active")
    .eq("active", true)
    .order("name");

  if (mode === "only_descriptions") {
    query = query.or("description_short.is.null,description_short.eq.,description_full.is.null,description_full.eq.");
  } else if (mode === "only_specs") {
    query = query.or("specs.is.null,specs.eq.{}");
  } else {
    query = query.or("description_short.is.null,description_short.eq.,description_full.is.null,description_full.eq.,specs.is.null,specs.eq.{}");
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Product[];
}

async function processBatch(products: Product[], mode: ContentMode, signal?: AbortSignal): Promise<ContentProcessSummary> {
  const payload = products.map((p) => ({
    id: p.id,
    name: p.name,
    brand: p.brand_name ?? null,
    sku: p.sku ?? null,
    description_short: p.description_short ?? null,
    description_full: p.description_full ?? null,
    specs: p.specs ?? null,
  }));
  const base = resolveApiBaseUrl();
  const url = `${base}/api/content-enricher`;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(anonKey ? { "x-supabase-apikey": anonKey } : {}),
    },
    body: JSON.stringify({ products: payload, mode }),
    signal,
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`content-enricher error: ${res.status}${detail ? ` - ${detail}` : ""}`);
  }
  const data = await res.json() as { ok: boolean; summary: ContentProcessSummary };
  return data.summary;
}

export async function processProductContent(
  products: Product[],
  mode: ContentMode,
  onProgress: (p: ContentProcessProgress) => void,
  signal?: AbortSignal
): Promise<ContentProcessSummary> {
  const totals: ContentProcessSummary = { total: 0, generated: 0, review_required: 0, skipped: 0 };
  const batches: Product[][] = [];
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    batches.push(products.slice(i, i + BATCH_SIZE));
  }

  for (let i = 0; i < batches.length; i++) {
    if (signal?.aborted) break;
    const summary = await processBatch(batches[i], mode, signal);
    totals.total += summary.total;
    totals.generated += summary.generated;
    totals.review_required += summary.review_required;
    totals.skipped += summary.skipped;
    onProgress({
      done: Math.min((i + 1) * BATCH_SIZE, products.length),
      total: products.length,
      summary: { ...totals },
    });
  }

  return totals;
}
