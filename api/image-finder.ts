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
  title?: string;
  width?: number;
  height?: number;
}

interface ProcessResult {
  productId: number;
  action: "auto_assigned" | "suggested" | "discarded" | "skipped";
  candidate?: ImageCandidate;
  candidates?: ImageCandidate[];
  query: string;
}

interface SearchResultLike {
  url: string;
  title: string;
  width: number;
  height: number;
  source: string;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

function getSupabase(request: Request) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    request.headers.get("x-supabase-apikey") ||
    "";
  if (!url || !key) {
    throw new Error("Missing Supabase URL/API key for image-finder");
  }
  return createClient(url, key);
}

const queryCache = new Map<string, { expiresAt: number; data: SearchResultLike[] }>();
const CACHE_TTL_MS = 1000 * 60 * 30;

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

function qualityScore(url: string, title: string): number {
  const t = title.toLowerCase();
  const u = url.toLowerCase();
  const badTokens = ["logo", "icon", "thumbnail", "thumb", "placeholder", "banner"];
  if (badTokens.some((k) => t.includes(k) || u.includes(k))) return 0;
  return 1;
}

function cleanBackgroundScore(title: string): number {
  const t = title.toLowerCase();
  if (t.includes("white background") || t.includes("isolated") || t.includes("product shot")) return 1;
  return 0.6;
}

function resolutionScore(w: number, h: number): number {
  const min = Math.min(w, h);
  if (min >= 1200) return 1.0;
  if (min >= 800) return 0.9;
  if (min >= 500) return 0.75;
  if (min >= 300) return 0.35;
  return 0;
}

function calcScore(product: ProductInput, title: string, w: number, h: number, url: string): number {
  const ns = nameScore(product.name, title);
  const bs = brandScore(product.brand, title);
  const qs = qualityScore(url, title);
  const rs = resolutionScore(w, h);
  const cs = cleanBackgroundScore(title);
  return Math.round((ns * 0.4 + bs * 0.2 + qs * 0.2 + rs * 0.1 + cs * 0.1) * 100) / 100;
}

function buildQuery(product: ProductInput): string {
  const parts = [product.name];
  if (product.brand) parts.push(product.brand);
  if (product.category) parts.push(product.category);
  parts.push("product");
  return parts.join(" ").trim();
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

async function getAirImage(sku: string): Promise<string | null> {
  const token =
    process.env.AIR_API_TOKEN?.trim() ||
    process.env.AIR_TOKEN?.trim() ||
    process.env.VITE_AIR_TOKEN?.trim() ||
    "";
  if (!token || !sku) return null;
  try {
    const q = new URLSearchParams({ q: "articulos", cod: sku }).toString();
    const res = await fetch(`https://api.air-intra.com/v2/?${q}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>;
    const items = (data.items ?? data.resultado ?? data.articulos ?? []) as Array<Record<string, unknown>>;
    const first = items[0];
    if (!first) return null;
    const image =
      (typeof first.imagen === "string" && first.imagen) ||
      (typeof first.imagen_url === "string" && first.imagen_url) ||
      (typeof first.image === "string" && first.image) ||
      "";
    return image || null;
  } catch {
    return null;
  }
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

interface SerpApiImageResult {
  original?: string;
  title?: string;
  original_width?: number;
  original_height?: number;
  source?: string;
}

async function searchSerpApi(
  query: string,
  engine: "google_images" | "duckduckgo_images" | "amazon" | "mercadolibre",
  num = 5
): Promise<SearchResultLike[]> {
  const key = process.env.SERPAPI_API_KEY;
  if (!key) return [];

  const cacheKey = `${engine}:${query}:${num}`;
  const cached = queryCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  try {
    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("engine", engine);
    url.searchParams.set("api_key", key);
    url.searchParams.set("q", query);
    url.searchParams.set("num", String(num));
    if (engine === "google_images") {
      url.searchParams.set("tbm", "isch");
      url.searchParams.set("safe", "active");
    }

    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const data = await res.json() as { images_results?: SerpApiImageResult[]; inline_images?: SerpApiImageResult[] };
    const rows = (data.images_results ?? data.inline_images ?? [])
      .map((r) => ({
        url: String(r.original ?? ""),
        title: String(r.title ?? ""),
        width: Number(r.original_width ?? 0),
        height: Number(r.original_height ?? 0),
        source: engine,
      }))
      .filter((r) => Boolean(r.url));

    queryCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, data: rows });
    return rows;
  } catch {
    return [];
  }
}

function normalizeImageUrl(input: string): string {
  try {
    const u = new URL(input);
    u.hash = "";
    return u.toString();
  } catch {
    return input.trim();
  }
}

function dedupeCandidates(candidates: ImageCandidate[]): ImageCandidate[] {
  const seen = new Set<string>();
  const out: ImageCandidate[] = [];
  for (const c of candidates) {
    const key = normalizeImageUrl(c.url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ ...c, url: key });
  }
  return out;
}

// ─── main handler ─────────────────────────────────────────────────────────────

export default async function handler(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, x-supabase-apikey" } });
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

  let supabase;
  try {
    supabase = getSupabase(request);
  } catch (error) {
    return json({ ok: false, error: (error as Error).message }, 500);
  }
  const results: ProcessResult[] = [];

  for (const product of products) {
    const query = buildQuery(product);
    const bucket: ImageCandidate[] = [];

    // 1) Web search via SerpAPI (Google Images, DuckDuckGo, marketplaces)
    const serpSources: Array<"google_images" | "duckduckgo_images" | "mercadolibre" | "amazon"> = [
      "google_images",
      "duckduckgo_images",
      "mercadolibre",
      "amazon",
    ];
    for (const source of serpSources) {
      const found = await searchSerpApi(query, source, 6);
      for (const r of found) {
        if (Math.min(r.width || 0, r.height || 0) < 500) continue;
        const s = calcScore(product, r.title, r.width || 0, r.height || 0, r.url);
        bucket.push({
          url: r.url,
          title: r.title,
          source: source,
          score: s,
          width: r.width,
          height: r.height,
        });
      }
    }

    // 2) Bing as fallback
    const bingResults = await searchBing(query, 8);
    for (const r of bingResults) {
      if (!["jpeg", "jpg", "png"].includes((r.encodingFormat ?? "").toLowerCase())) continue;
      if (Math.min(r.width, r.height) < 500) continue;
      const s = calcScore(product, r.name, r.width, r.height, r.contentUrl);
      bucket.push({ url: r.contentUrl, score: s, source: "bing", width: r.width, height: r.height, title: r.name });
    }

    const ranked = dedupeCandidates(bucket).sort((a, b) => b.score - a.score).slice(0, 10);
    const best = ranked[0] ?? null;

    // 4) Classify
    if (!best || best.score < 0.6) {
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
      results.push({ productId: product.id, action: "discarded", query, candidates: ranked });
      continue;
    }

    if (best.score >= 0.85) {
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
      results.push({ productId: product.id, action: "auto_assigned", candidate: best, candidates: ranked.slice(0, 5), query });
    } else {
      if (!body.dryRun) {
        await supabase.from("image_suggestions").delete().eq("product_id", product.id).eq("status", "pending");
        const topSuggestions = ranked.slice(0, 5).map((cand) => ({
          product_id: product.id,
          image_url: cand.url,
          score: cand.score,
          source: cand.source,
          status: "pending",
        }));
        if (topSuggestions.length > 0) {
          await supabase.from("image_suggestions").insert(topSuggestions);
        }
        await supabase.from("image_processing_log").insert({
          product_id: product.id,
          query,
          source: best.source,
          image_url: best.url,
          score: best.score,
          action: "suggested",
        });
      }
      results.push({ productId: product.id, action: "suggested", candidate: best, candidates: ranked.slice(0, 5), query });
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
