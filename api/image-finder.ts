import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "edge", maxDuration: 60 };

// ─── types ───────────────────────────────────────────────────────────────────

interface ProductInput {
  id: number;
  name: string;
  brand?: string | null;
  category?: string | null;
  sku?: string | null;
  supplier_name?: string | null;
  supplier_sku?: string | null;
}

interface ImageCandidate {
  url: string;
  score: number;
  source: string;
  width?: number;
  height?: number;
}

interface ProcessResult {
  productId: number;
  action: "auto_assigned" | "suggested" | "discarded" | "skipped";
  candidate?: ImageCandidate;
  query: string;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
  return createClient(url, key);
}

/** Word-overlap score between a product name and a result title. */
function nameScore(productName: string, title: string): number {
  const words = productName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2);
  if (words.length === 0) return 0;
  const t = title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const hits = words.filter((w) => t.includes(w)).length;
  return hits / words.length;
}

function brandScore(brand: string | null | undefined, title: string): number {
  if (!brand) return 0;
  return title.toLowerCase().includes(brand.toLowerCase()) ? 1.0 : 0;
}

function resolutionScore(w: number, h: number): number {
  const min = Math.min(w, h);
  if (min >= 800) return 1.0;
  if (min >= 500) return 0.7;
  if (min >= 300) return 0.3;
  return 0;
}

function calcScore(product: ProductInput, title: string, w: number, h: number): number {
  const ns = nameScore(product.name, title);
  const bs = brandScore(product.brand, title);
  const rs = resolutionScore(w, h);
  return Math.round((ns * 0.5 + bs * 0.2 + 0.2 + rs * 0.1) * 100) / 100;
}

function buildQuery(product: ProductInput): string {
  const parts = [product.name];
  if (product.brand) parts.push(product.brand);
  if (product.category) parts.push(product.category);
  return parts.join(" ");
}

// ─── ELIT image lookup ────────────────────────────────────────────────────────

async function getElitImage(sku: string): Promise<string | null> {
  const userId = process.env.ELIT_API_USER_ID;
  const token  = process.env.ELIT_API_TOKEN;
  if (!userId || !token || !sku) return null;

  try {
    const res = await fetch("https://clientes.elit.com.ar/v1/api/productos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, token, sku, limit: 1 }),
    });
    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>;
    const items = (data.resultado ?? data.data ?? data.productos ?? data.items ?? []) as Array<Record<string, unknown>>;
    const item = items[0];
    if (!item) return null;
    const imagenes = item.imagenes;
    if (Array.isArray(imagenes) && imagenes.length > 0) return String(imagenes[0]);
  } catch {
    // silently ignore
  }
  return null;
}

// ─── Bing Image Search ────────────────────────────────────────────────────────

interface BingImageResult {
  contentUrl: string;
  name: string;
  width: number;
  height: number;
  encodingFormat: string;
}

async function searchBing(query: string, count = 5): Promise<BingImageResult[]> {
  const key = process.env.BING_SEARCH_API_KEY;
  if (!key) return [];

  try {
    const url = `https://api.bing.microsoft.com/v7.0/images/search?q=${encodeURIComponent(query)}&count=${count}&safeSearch=Strict&imageType=Photo`;
    const res = await fetch(url, { headers: { "Ocp-Apim-Subscription-Key": key } });
    if (!res.ok) return [];
    const data = await res.json() as { value?: BingImageResult[] };
    return data.value ?? [];
  } catch {
    return [];
  }
}

// ─── main handler ─────────────────────────────────────────────────────────────

export default async function handler(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization" } });
  }
  if (request.method !== "POST") return json({ ok: false, error: "Use POST" }, 405);

  let body: { products?: ProductInput[]; dryRun?: boolean };
  try {
    body = await request.json() as typeof body;
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const products = body.products ?? [];
  if (products.length === 0) return json({ ok: true, results: [] });

  const supabase = getSupabase();
  const results: ProcessResult[] = [];

  for (const product of products) {
    const query = buildQuery(product);
    let best: ImageCandidate | null = null;

    // 1. ELIT source (if applicable)
    if (product.supplier_name?.toUpperCase().includes("ELIT") && product.supplier_sku) {
      const elitImg = await getElitImage(product.supplier_sku);
      if (elitImg) {
        best = { url: elitImg, score: 1.0, source: "elit", width: 800, height: 800 };
      }
    }

    // 2. Bing Image Search fallback
    if (!best || best.score < 0.85) {
      const bingResults = await searchBing(query, 5);
      for (const r of bingResults) {
        if (!["jpeg", "jpg", "png"].includes((r.encodingFormat ?? "").toLowerCase())) continue;
        if (Math.min(r.width, r.height) < 300) continue;
        const s = calcScore(product, r.name, r.width, r.height);
        if (!best || s > best.score) {
          best = { url: r.contentUrl, score: s, source: "bing", width: r.width, height: r.height };
        }
      }
    }

    // 3. Classify
    if (!best || best.score < 0.6) {
      // Discard
      if (!body.dryRun) {
        await supabase.from("image_processing_log").insert({
          product_id: product.id,
          query,
          source: best?.source ?? null,
          image_url: best?.url ?? null,
          score: best?.score ?? null,
          action: "discarded",
        });
      }
      results.push({ productId: product.id, action: "discarded", query });
      continue;
    }

    if (best.score >= 0.85) {
      // Auto-assign
      if (!body.dryRun) {
        await supabase.from("products").update({ image: best.url }).eq("id", product.id);
        await supabase.from("image_processing_log").insert({
          product_id: product.id,
          query,
          source: best.source,
          image_url: best.url,
          score: best.score,
          action: "auto_assigned",
        });
      }
      results.push({ productId: product.id, action: "auto_assigned", candidate: best, query });
    } else {
      // Suggest (0.60–0.85)
      if (!body.dryRun) {
        // Upsert: replace any existing pending suggestion for this product
        await supabase.from("image_suggestions").delete().eq("product_id", product.id).eq("status", "pending");
        await supabase.from("image_suggestions").insert({
          product_id: product.id,
          image_url: best.url,
          score: best.score,
          source: best.source,
          status: "pending",
        });
        await supabase.from("image_processing_log").insert({
          product_id: product.id,
          query,
          source: best.source,
          image_url: best.url,
          score: best.score,
          action: "suggested",
        });
      }
      results.push({ productId: product.id, action: "suggested", candidate: best, query });
    }
  }

  const summary = {
    total: results.length,
    auto_assigned: results.filter((r) => r.action === "auto_assigned").length,
    suggested: results.filter((r) => r.action === "suggested").length,
    discarded: results.filter((r) => r.action === "discarded").length,
  };

  return json({ ok: true, results, summary });
}
