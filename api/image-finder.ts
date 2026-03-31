import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "edge", maxDuration: 60 };

// ─── TYPES ──────────────────────────────────────────────────────────────────

interface ProductInput {
  id: number;
  name: string;
  brand?: string | null;
  brand_name?: string | null; // For compatibility
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

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 
      "Content-Type": "application/json", 
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-supabase-apikey"
    },
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

function buildQuery(product: ProductInput): string {
  let cleanName = product.name
    .replace(/[^\w\s\u00C0-\u017F-]/g, "")
    .replace(/\b(OEM|BULK|RETAIL|BOX|REFURBISHED|OUTLET|GARANTIA|SIN CAJA|OPEN BOX|NUEVO|USADO)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
    
  const parts = [cleanName];
  const brand = product.brand_name || product.brand;
  if (brand && !cleanName.toLowerCase().includes(brand.toLowerCase())) {
    parts.push(brand);
  }
  parts.push("product");
  return parts.join(" ").trim();
}

async function verifyUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

function calcScore(product: ProductInput, candidateTitle: string, width: number, height: number, url: string): number {
  let score = 0;
  const nameNorm = product.name.toLowerCase();
  const titleNorm = candidateTitle.toLowerCase();
  const urlNorm = url.toLowerCase();
  
  // 1. Similitud de nombre (45%)
  const words = nameNorm.split(/[\s-]+/).filter(w => w.length > 2);
  let matches = 0;
  for (const w of words) {
    if (titleNorm.includes(w)) matches++;
  }
  score += (matches / (words.length || 1)) * 0.45;
  
  // 2. Bonus Marca (20%)
  const brand = product.brand_name || product.brand;
  if (brand && titleNorm.includes(brand.toLowerCase())) {
    score += 0.20;
  }
  
  // 3. Bonus SKU (30%)
  if (product.sku && product.sku.length > 4) {
    const skuNorm = product.sku.toLowerCase();
    if (titleNorm.includes(skuNorm) || urlNorm.includes(skuNorm)) {
      score += 0.30;
    }
  }
  
  // 4. Resolución (15%)
  if (width >= 800 && height >= 800) score += 0.15;
  else if (width >= 400 && height >= 400) score += 0.08;
  else if (width === 0) score += 0.05;
  
  // 5. Penalizaciones
  if (titleNorm.includes("caja") || titleNorm.includes("box") || titleNorm.includes("usado")) {
    score -= 0.25;
  }

  return Math.min(score, 1.0);
}

// ─── SEARCH PROVIDERS ────────────────────────────────────────────────────────

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
    const data = await res.json() as any;
    const items = data.resultado ?? data.data ?? data.productos ?? [];
    if (items[0]?.imagenes?.length > 0) return String(items[0].imagenes[0]);
  } catch { /* ignore */ }
  return null;
}

async function getAirImage(sku: string): Promise<string | null> {
  const token = process.env.AIR_API_TOKEN?.trim() || "";
  if (!token || !sku) return null;
  try {
    const q = new URLSearchParams({ q: "articulos", cod: sku }).toString();
    const res = await fetch(`https://api.air-intra.com/v2/?${q}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json() as any;
    const first = (data.items ?? [])[0];
    return first?.imagen || first?.imagen_url || first?.image || null;
  } catch { return null; }
}

async function searchMercadoLibre(query: string): Promise<SearchResultLike[]> {
  try {
    const url = `https://listado.mercadolibre.com.ar/${encodeURIComponent(query.replace(/\s+/g, '-'))}`;
    const res = await fetch(url, { 
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) return [];
    const html = await res.text();
    const regex = /https:\/\/http2\.mlstatic\.com\/D_[A-Za-z0-9_]+-MLA[0-9]+_[0-9]+-[A-Z]\.(?:jpg|webp)/g;
    const matches = Array.from(new Set(html.match(regex) || []));
    
    return matches.slice(0, 8).map(img => ({
      url: img.replace(/-(I|V|W|E|C|F)\.(jpg|webp)$/, '-O.$2'),
      title: query,
      width: 800,
      height: 800,
      source: "mercadolibre_scraping",
    }));
  } catch { return []; }
}

async function searchBing(query: string, count = 5): Promise<any[]> {
  const key = process.env.BING_SEARCH_API_KEY;
  if (!key) return [];
  try {
    const url = `https://api.bing.microsoft.com/v7.0/images/search?q=${encodeURIComponent(query)}&count=${count}&safeSearch=Strict&imageType=Photo`;
    const res = await fetch(url, { headers: { "Ocp-Apim-Subscription-Key": key }, signal: AbortSignal.timeout(8000) });
    const data = await res.json() as any;
    return data.value ?? [];
  } catch { return []; }
}

async function searchSerpApi(query: string, engine: string, num = 5): Promise<SearchResultLike[]> {
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
    if (engine === "google_images") url.searchParams.set("tbm", "isch");

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
    const data = await res.json() as any;
    const rows = (data.images_results ?? data.inline_images ?? [])
      .map((r: any) => ({
        url: String(r.original || r.url || ""),
        title: String(r.title || ""),
        width: Number(r.original_width || 0),
        height: Number(r.original_height || 0),
        source: engine,
      }))
      .filter((r: any) => Boolean(r.url));

    queryCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, data: rows });
    return rows;
  } catch { return []; }
}

// ─── STORAGE ─────────────────────────────────────────────────────────────────

async function uploadToStorage(url: string, productId: number, supabase: any, envStr: string): Promise<string | null> {
  if (url.includes(`${envStr}/storage`)) return url;
  try {
     const res = await fetch(url, { signal: AbortSignal.timeout(5000), headers: { "User-Agent": "Mozilla/5.0" } });
     if (!res.ok) return null;
     const contentType = res.headers.get("content-type") || "image/jpeg";
     const buf = await res.arrayBuffer();
     const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
     const path = `auto_${productId}_${Date.now()}.${ext}`;
     const { error } = await supabase.storage.from("products").upload(path, buf, { contentType, upsert: true });
     if (error) return null;
     return `${envStr}/storage/v1/object/public/products/${path}`;
  } catch { return null; }
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────

export default async function handler(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") return json({}, 200);
  if (request.method !== "POST") return json({ ok: false, error: "Use POST" }, 405);

  let body: any;
  try { body = await request.json(); } catch { return json({ ok: false, error: "Invalid JSON" }, 400); }

  const envUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  let supabase;
  try { supabase = getSupabase(request); } catch (e: any) { return json({ ok: false, error: e.message }, 500); }

  if (body.action === "upload_and_assign" && body.productId && body.url) {
    const finalUrl = await uploadToStorage(body.url, body.productId, supabase, envUrl) || body.url;
    await supabase.from("products").update({ image: finalUrl }).eq("id", body.productId);
    return json({ ok: true, url: finalUrl });
  }

  const products = (body.products ?? []) as ProductInput[];
  if (products.length === 0) return json({ ok: true, results: [] });
  const results: ProcessResult[] = [];

  for (const product of products) {
    const query = buildQuery(product);
    const bucket: ImageCandidate[] = [];
    
    // 1. Providers
    let pImg = null, pSrc = null;
    if (product.supplier_name?.toLowerCase().includes("elit") && product.sku) {
      pImg = await getElitImage(product.sku);
      if (pImg) pSrc = "elit";
    }
    if (!pImg && product.supplier_name?.toLowerCase().includes("air") && product.sku) {
      pImg = await getAirImage(product.sku);
      if (pImg) pSrc = "air";
    }
    
    if (pImg && pSrc) {
      if (await verifyUrl(pImg)) {
        if (!body.dryRun) {
          const final = await uploadToStorage(pImg, product.id, supabase, envUrl) || pImg;
          await supabase.from("products").update({ image: final }).eq("id", product.id);
          await supabase.from("image_processing_log").insert({ product_id: product.id, query, source: pSrc, image_url: final, score: 1.0, action: "auto_assigned" });
          await supabase.from("image_suggestions").delete().eq("product_id", product.id).eq("status", "pending");
        }
        results.push({ productId: product.id, action: "auto_assigned", candidate: { url: pImg, score: 1.0, source: pSrc }, query });
        continue;
      }
    }

    // 2. Search Engines
    const [ml, google, bing, ddg, amz] = await Promise.all([
      searchMercadoLibre(query),
      searchSerpApi(query, "google_images", 8),
      searchBing(query, 8),
      searchSerpApi(query, "duckduckgo_images", 8),
      searchSerpApi(query, "amazon", 5),
    ]);

    let mlFinal = ml;
    if (ml.length === 0) mlFinal = await searchSerpApi(query, "mercadolibre", 8);

    for (const r of mlFinal) {
      const s = calcScore(product, r.title, r.width, r.height, r.url);
      bucket.push({ url: r.url, title: r.title, source: r.source, score: s, width: r.width, height: r.height });
    }
    for (const res of [google, ddg, amz, bing]) {
      for (const r of res) {
        const item = r as any;
        const title = item.name || item.title || "";
        const url = item.contentUrl || item.thumbnailUrl || item.url || "";
        if (!url) continue;
        const s = calcScore(product, title, item.width || 0, item.height || 0, url);
        bucket.push({ url, title, source: item.source || "search", score: s, width: item.width, height: item.height });
      }
    }

    // 3. Ranking & Classification
    const seen = new Set<string>();
    let ranked = bucket
      .filter(c => {
        const u = c.url.toLowerCase().split('?')[0];
        if (seen.has(u)) return false;
        seen.add(u);
        return true;
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    
    if (ranked[0]?.score >= 0.85 && !(await verifyUrl(ranked[0].url))) ranked.shift();
    
    const best = ranked[0] ?? null;

    if (!best || best.score < 0.40) {
      if (!body.dryRun) {
        await supabase.from("image_processing_log").insert({ product_id: product.id, query, source: best?.source ?? null, image_url: best?.url ?? null, score: best?.score ?? null, action: "discarded" });
      }
      results.push({ productId: product.id, action: "discarded", query, candidates: ranked });
      continue;
    }

    if (best.score >= 0.85) {
      if (!body.dryRun) {
        const final = await uploadToStorage(best.url, product.id, supabase, envUrl) || best.url;
        await supabase.from("products").update({ image: final }).eq("id", product.id);
        await supabase.from("image_processing_log").insert({ product_id: product.id, query, source: best.source, image_url: final, score: best.score, action: "auto_assigned" });
        await supabase.from("image_suggestions").delete().eq("product_id", product.id).eq("status", "pending");
      }
      results.push({ productId: product.id, action: "auto_assigned", candidate: best, query });
    } else {
      if (!body.dryRun) {
        await supabase.from("image_suggestions").delete().eq("product_id", product.id).eq("status", "pending");
        const suggestions = ranked.slice(0, 5).map(c => ({ product_id: product.id, image_url: c.url, score: c.score, source: c.source, status: "pending" }));
        if (suggestions.length > 0) await supabase.from("image_suggestions").insert(suggestions);
        await supabase.from("image_processing_log").insert({ product_id: product.id, query, source: best.source, image_url: best.url, score: best.score, action: "suggested" });
      }
      results.push({ productId: product.id, action: "suggested", candidate: best, candidates: ranked.slice(0, 5), query });
    }
  }

  return json({ 
    ok: true, 
    results, 
    summary: {
      total: results.length,
      auto_assigned: results.filter(r => r.action === "auto_assigned").length,
      suggested: results.filter(r => r.action === "suggested").length,
      discarded: results.filter(r => r.action === "discarded").length,
    }
  });
}
