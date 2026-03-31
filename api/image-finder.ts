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

// PASO 1: Normalización de Query
function buildQuery(product: ProductInput): string {
  // limpiar nombre, remover caracteres innecesarios
  let cleanName = product.name
    .replace(/[^\w\s\u00C0-\u017F-]/g, "") // Mantener letras, números, espacios y guiones
    .replace(/\b(OEM|BULK|RETAIL|BOX|REFURBISHED|OUTLET|GARANTIA|SIN CAJA|OPEN BOX|NUEVO|USADO)\b/gi, "") // PASO 3: Anti-noise
    .replace(/\s+/g, " ")
    .trim();
    
  const parts = [cleanName];
  if (product.brand && !cleanName.toLowerCase().includes(product.brand.toLowerCase())) {
    parts.push(product.brand);
  }
  parts.push("product");
  return parts.join(" ").trim();
}

// PASO 2: Verificación de link (HEAD ping)
async function verifyUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
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

function qualityScore(url: string, title: string): number {
  const t = title.toLowerCase();
  const u = url.toLowerCase();
  const badTokens = ["logo", "icon", "thumbnail", "thumb", "placeholder", "banner", "render"];
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
  return 0; // if resolutions are missing or < 300
}

// PASO 7: Sistema de Scoring
function calcScore(product: ProductInput, title: string, w: number, h: number, url: string): number {
  const ns = nameScore(product.name, title);         // 40%
  const bs = brandScore(product.brand, title);       // 20%
  const rs = resolutionScore(w, h);                  // 15%
  const cs = cleanBackgroundScore(title);            // 15%
  const qs = qualityScore(url, title);               // 10%
  
  // if format is wrong, drop score severely
  const ext = url.toLowerCase().split('.').pop()?.split('?')[0];
  if (ext && !["jpg", "jpeg", "png", "webp"].includes(ext)) return 0;

  return Math.round((ns * 0.40 + bs * 0.20 + rs * 0.15 + cs * 0.15 + qs * 0.10) * 100) / 100;
}

// ─── PASO 2: ELIT / AIR image lookup ─────────────────────────────────────────

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

// ─── PASO 3: MercadoLibre Scraping ───────────────────────────────────────────

async function searchMercadoLibre(query: string): Promise<SearchResultLike[]> {
  try {
    const url = `https://listado.mercadolibre.com.ar/${encodeURIComponent(query.replace(/\s+/g, '-'))}`;
    const res = await fetch(url, { 
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) return [];
    const html = await res.text();
    // Regular expression to match images like: https://http2.mlstatic.com/D_NQ_NP_918541-MLA72797746416_112023-V.webp
    const regex = /https:\/\/http2\.mlstatic\.com\/D_[A-Za-z0-9_]+-MLA[0-9]+_[0-9]+-[A-Z]\.(?:jpg|webp)/g;
    const matches = html.match(regex) || [];
    const unique = Array.from(new Set(matches)).filter(img => !img.includes('MLA-') && !img.includes('D_Q_NP_')); // Filter thumbnails
    
    const results: SearchResultLike[] = [];
    for (const img of unique.slice(0, 10)) {
       // Attempt to replace standard suffix (I, V, etc.) with 'O' for Original size
       const highResUrl = img.replace(/-(I|V|W|E|C|F)\.(jpg|webp)$/, '-O.$2');
       results.push({
         url: highResUrl,
         title: query, // ML scraping doesn't give us the specific title easily by regex without DOM parsing
         width: 800,   // Assumed high-res size if using -O
         height: 800,
         source: "mercadolibre_scraping",
       });
    }
    return results;
  } catch {
    return [];
  }
}

// ─── PASO 5: Bing Image Search API ───────────────────────────────────────────

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
    const res = await fetch(url, {
      headers: { "Ocp-Apim-Subscription-Key": key },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json() as { value?: BingImageResult[] };
    return data.value ?? [];
  } catch {
    return [];
  }
}

// ─── PASO 4: Google Scraping Liviano (via SerpAPI fallback) ──────────────────

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

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
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

// PASO 6: Unificación de resultados
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

// ─── ALMACENAMIENTO PROPIO (CDN) ──────────────────────────────────────────────
async function uploadToStorage(url: string, productId: number, supabase: any, envStr: string): Promise<string | null> {
  if (url.includes(`${envStr}/storage`)) return url; // Already in Supabase
  try {
     const res = await fetch(url, { signal: AbortSignal.timeout(5000), headers: { "User-Agent": "Mozilla/5.0" } });
     if (!res.ok) return null;
     const contentType = res.headers.get("content-type") || "image/jpeg";
     const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
     const buf = await res.arrayBuffer();
     const path = `auto_${productId}_${Date.now()}.${ext}`;
     const { error } = await supabase.storage.from("products").upload(path, buf, { contentType, upsert: true });
     if (error) return null;
     return `${envStr}/storage/v1/object/public/products/${path}`;
  } catch {
     return null;
  }
}

// ─── main handler ─────────────────────────────────────────────────────────────

export default async function handler(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, x-supabase-apikey" } });
  }
  if (request.method !== "POST") return json({ ok: false, error: "Use POST" }, 405);

  let body: { action?: string; productId?: number; url?: string; products?: ProductInput[]; dryRun?: boolean };
  try {
    body = await request.json() as typeof body;
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  let supabase;
  const envUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  try {
    supabase = getSupabase(request);
  } catch (error) {
    return json({ ok: false, error: (error as Error).message }, 500);
  }

  // Rutina especial: Subir al Storage manualmente a pedido del frontend (approveSuggestion)
  if (body.action === "upload_and_assign" && body.productId && body.url) {
    const finalUrl = await uploadToStorage(body.url, body.productId, supabase, envUrl) || body.url;
    await supabase.from("products").update({ image: finalUrl }).eq("id", body.productId);
    return json({ ok: true, url: finalUrl });
  }

  const products = body.products ?? [];
  if (products.length === 0) return json({ ok: true, results: [] });
  const results: ProcessResult[] = [];

  for (const product of products) {
    const query = buildQuery(product);
    const bucket: ImageCandidate[] = [];
    
    // PASO 2: Proveedores ELIT/AIR tienen prioridad absoluta
    let providerImg = null;
    let providerSource = null;
    
    if (product.supplier_name?.toLowerCase().includes("elit") && product.sku) {
      providerImg = await getElitImage(product.sku);
      if (providerImg) providerSource = "elit";
    }
    if (!providerImg && product.supplier_name?.toLowerCase().includes("air") && product.sku) {
      providerImg = await getAirImage(product.sku);
      if (providerImg) providerSource = "air";
    }
    
    if (providerImg && providerSource) {
      const isValid = await verifyUrl(providerImg);
      if (isValid) {
        if (!body.dryRun) {
          const cdnUrl = await uploadToStorage(providerImg, product.id, supabase, envUrl) || providerImg;
          await supabase.from("products").update({ image: cdnUrl }).eq("id", product.id);
          await supabase.from("image_processing_log").insert({
            product_id: product.id,
            query,
            source: providerSource,
            image_url: cdnUrl,
            score: 1.0,
            action: "auto_assigned",
          });
          await supabase.from("image_suggestions").delete().eq("product_id", product.id).eq("status", "pending");
        }
        results.push({ productId: product.id, action: "auto_assigned", candidate: { url: providerImg, score: 1.0, source: providerSource }, query });
        continue;
      }
    }

    // PASO 3, 4, 5: Búsqueda Multi-Fuente Paralela
    let [mlResults, serpResults, bingResults, ddgResults, amzResults] = await Promise.all([
      searchMercadoLibre(query),
      searchSerpApi(query, "google_images", 8),
      searchBing(query, 8),
      searchSerpApi(query, "duckduckgo_images", 8),
      searchSerpApi(query, "amazon", 5),
    ]);

    // Resiliencia Anti-Bot para ML
    if (mlResults.length === 0) {
      const mlFallback = await searchSerpApi(query, "mercadolibre", 8);
      if (mlFallback.length > 0) mlResults = mlFallback;
    }

    // Llenar balde
    for (const r of mlResults) {
      const s = calcScore(product, r.title, r.width, r.height, r.url);
      bucket.push({ url: r.url, title: r.title, source: r.source, score: s, width: r.width, height: r.height });
    }

    for (const res of [serpResults, ddgResults, amzResults, bingResults]) {
      for (const r of res) {
        const title = (r as any).name || r.title || "";
        const url = (r as any).contentUrl || r.url || "";
        if (!url) continue;
        if (r.width && r.height && Math.min(r.width, r.height) < 300) continue;
        const s = calcScore(product, title, r.width || 0, r.height || 0, url);
        bucket.push({ url, title, source: r.source || "search", score: s, width: r.width, height: r.height });
      }
    }

    // Unificación y Ordenamiento
    let ranked = dedupeCandidates(bucket).sort((a, b) => b.score - a.score).slice(0, 10);
    
    // Verificar top candidate si es muy probable
    if (ranked.length > 0 && ranked[0].score >= 0.85) {
      const isValid = await verifyUrl(ranked[0].url);
      if (!isValid) ranked.shift();
    }
    
    const best = ranked[0] ?? null;

    if (!best || best.score < 0.60) {
      if (!body.dryRun) {
        await supabase.from("image_processing_log").insert({
          product_id: product.id, query, source: best?.source ?? null,
          image_url: best?.url ?? null, score: best?.score ?? null, action: "discarded",
        });
      }
      results.push({ productId: product.id, action: "discarded", query, candidates: ranked });
      continue;
    }

    if (best.score >= 0.85) {
      if (!body.dryRun) {
        const cdnUrl = await uploadToStorage(best.url, product.id, supabase, envUrl) || best.url;
        await supabase.from("products").update({ image: cdnUrl }).eq("id", product.id);
        await supabase.from("image_processing_log").insert({
          product_id: product.id, query, source: best.source,
          image_url: cdnUrl, score: best.score, action: "auto_assigned",
        });
        await supabase.from("image_suggestions").delete().eq("product_id", product.id).eq("status", "pending");
      }
      results.push({ productId: product.id, action: "auto_assigned", candidate: best, query });
    } else {
      if (!body.dryRun) {
        await supabase.from("image_suggestions").delete().eq("product_id", product.id).eq("status", "pending");
        const topSuggestions = ranked.slice(0, 5).map((cand) => ({
          product_id: product.id, image_url: cand.url, score: cand.score, source: cand.source, status: "pending",
        }));
        if (topSuggestions.length > 0) await supabase.from("image_suggestions").insert(topSuggestions);
        await supabase.from("image_processing_log").insert({
          product_id: product.id, query, source: best.source,
          image_url: best.url, score: best.score, action: "suggested",
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
