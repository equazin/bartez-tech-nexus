import { createClient } from "@supabase/supabase-js";

export const config = { maxDuration: 120 };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProductInput {
  id: number;
  name: string;
  brand?: string | null;
  sku?: string | null;
  category?: string | null;
  image?: string | null;
}

interface ImageResult {
  url: string;
  source: string;
  score: number;
  width?: number;
  height?: number;
  title?: string;
}

interface ProductResult {
  productId: number;
  action: "auto_assigned" | "suggested" | "skipped" | "already_has_image";
  topImages: ImageResult[];
  assignedUrl?: string;
}

interface RequestBody {
  products?: ProductInput[];
  mode?: "missing_only" | "all";
  autoAssign?: boolean;
  autoAssignThreshold?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function getSupabase(request: Request) {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    request.headers.get("x-supabase-apikey") ||
    "";
  if (!url || !key) {
    throw new Error("Missing Supabase environment variables for image-finder");
  }
  return createClient<any>(url, key);
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string): string[] {
  return normalize(value)
    .split(" ")
    .filter((t) => t.length >= 2);
}

const NOISE_WORDS = new Set([
  "para", "con", "sin", "los", "las", "del", "una", "uno",
  "que", "por", "the", "and", "for", "with", "product",
  "nuevo", "new", "modelo", "model", "serie", "series",
  "equipo", "articulo", "accesorio", "hardware", "componente",
  "tipo", "version",
]);

function buildQuery(product: ProductInput, strict = false): string {
  const tokens = tokenize(product.name).filter((t) => !NOISE_WORDS.has(t));
  const brandNorm = product.brand ? normalize(product.brand) : "";
  if (brandNorm && !tokens.includes(brandNorm)) {
    tokens.unshift(brandNorm);
  }
  const base = tokens.slice(0, 8);
  if (strict) return base.join(" ");
  return base.concat("product").join(" ");
}

// ---------------------------------------------------------------------------
// Scoring (server-side version — mirrors imageScoring.ts logic)
// ---------------------------------------------------------------------------

const CLEAN_BG_DOMAINS = new Set([
  "elit.com.ar", "clientes.elit.com.ar", "images.elit.com.ar",
  "http2.mlstatic.com", "images-na.ssl-images-amazon.com",
  "m.media-amazon.com", "images.samsung.com",
]);

const BLOCKED_URL_PATTERNS = [
  /favicon/i, /logo/i, /banner/i, /sprite/i,
  /icon[-_]/i, /placeholder/i, /no[-_]?image/i,
  /\/thumb\//i,
];

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return ""; }
}

function isBlocked(url: string): boolean {
  return BLOCKED_URL_PATTERNS.some((p) => p.test(url));
}

function scoreImage(
  candidate: { url: string; source: string; width?: number; height?: number; title?: string },
  product: ProductInput
): number {
  const productTokens = tokenize(product.name).filter((t) => !NOISE_WORDS.has(t));
  const candText = normalize(candidate.title || "") + " " + normalize(candidate.url);
  const candTokens = new Set(tokenize(candText));

  let nameHits = 0;
  for (const t of productTokens) { if (candTokens.has(t)) nameHits++; }
  const nameMatch = productTokens.length > 0
    ? Math.min(1, nameHits / Math.max(productTokens.length * 0.6, 1))
    : 0.3;

  const brandNorm = product.brand ? normalize(product.brand) : "";
  const brandMatch = brandNorm ? (candTokens.has(brandNorm) ? 1 : candText.includes(brandNorm) ? 0.7 : 0) : 0.5;

  const minDim = Math.min(candidate.width || 0, candidate.height || 0);
  const resolution = minDim >= 1000 ? 1 : minDim >= 500 ? (minDim - 500) / 500 : minDim > 0 ? 0 : 0.5;

  const domain = extractDomain(candidate.url);
  let cleanBg = 0.5;
  if (CLEAN_BG_DOMAINS.has(domain)) cleanBg = 1;
  if (domain.includes("mercadolibre") || domain.includes("mlstatic")) cleanBg = 0.9;

  let productType = 0.5;
  if (candidate.source === "supplier") productType = 1;
  if (candidate.source === "mercadolibre") productType = 0.9;
  if (candidate.source === "bing" || candidate.source === "serpapi" || candidate.source === "serper") productType = 0.6;

  return Number(
    (nameMatch * 0.4 + brandMatch * 0.2 + resolution * 0.15 + cleanBg * 0.15 + productType * 0.1).toFixed(4)
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchWithTimeout(input: string, init: RequestInit = {}, ms = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function mergeUniqueImages(candidates: ImageResult[]): ImageResult[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const normalizedUrl = candidate.url.split("?")[0].toLowerCase();
    if (seen.has(normalizedUrl)) return false;
    seen.add(normalizedUrl);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Image sources
// ---------------------------------------------------------------------------

let cachedMlToken = "";
let mlTokenExpiresAt = 0;

async function getMercadoLibreToken(): Promise<string> {
  if (cachedMlToken && Date.now() < mlTokenExpiresAt) {
    return cachedMlToken;
  }
  
  const appId = process.env.MERCADOLIBRE_APP_ID || "7715567298781097";
  const clientSecret = process.env.MERCADOLIBRE_CLIENT_SECRET || "JzmAXvIQQKz68aYn2tVumR5M5INFEdVk";

  if (!appId || !clientSecret) {
    console.warn("[mercadolibre] Missing AppID or ClientSecret");
    return "";
  }
  
  if (!appId || !clientSecret) return "";

  try {
    const res = await fetchWithTimeout("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
      body: `grant_type=client_credentials&client_id=${appId}&client_secret=${clientSecret}`
    });
    
    if (!res.ok) return "";
    
    const data = await res.json() as { access_token?: string; expires_in?: number };
    if (data.access_token && data.expires_in) {
      cachedMlToken = data.access_token;
      mlTokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000; // 5 min safety buffer
      return cachedMlToken;
    }
    return "";
  } catch {
    return "";
  }
}

async function searchBing(query: string): Promise<ImageResult[]> {
  const apiKey = process.env.BING_SEARCH_API_KEY?.trim();
  if (!apiKey) return [];

  try {
    const url = `https://api.bing.microsoft.com/v7.0/images/search?q=${encodeURIComponent(query)}&count=10&mkt=es-AR&safeSearch=Strict&minWidth=400&minHeight=400`;
    const res = await fetchWithTimeout(url, {
      headers: { "Ocp-Apim-Subscription-Key": apiKey },
    });
    if (!res.ok) return [];
    const data = await res.json() as {
      value?: Array<{
        contentUrl: string;
        width: number;
        height: number;
        name?: string;
        hostPageDomainFriendlyName?: string;
      }>;
    };

    return (data.value ?? [])
      .filter((img) => !isBlocked(img.contentUrl))
      .slice(0, 5)
      .map((img) => ({
        url: img.contentUrl,
        source: "bing",
        score: 0,
        width: img.width,
        height: img.height,
        title: img.name || "",
      }));
  } catch {
    return [];
  }
}

async function searchSerper(query: string): Promise<ImageResult[]> {
  const apiKey = process.env.SERPER_API_KEY?.trim() || "3aa3347944e5b83bf9e1095a881eb3ef91e715ae";
  if (!apiKey) {
    console.warn("[serper] Missing API Key");
    return [];
  }
  if (!apiKey) return [];

  try {
    const res = await fetchWithTimeout("https://google.serper.dev/images", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ q: query })
    });
    
    if (!res.ok) return [];
    
    const data = await res.json() as {
      images?: Array<{
        title?: string;
        imageUrl?: string;
        imageWidth?: number;
        imageHeight?: number;
        source?: string;
      }>;
    };

    return (data.images ?? [])
      .filter((img) => img.imageUrl && !isBlocked(img.imageUrl))
      .slice(0, 5)
      .map((img) => ({
        url: img.imageUrl || "",
        source: "serper",
        score: 0,
        width: img.imageWidth,
        height: img.imageHeight,
        title: img.title || "",
      }));
  } catch {
    return [];
  }
}

async function searchSerpApi(query: string): Promise<ImageResult[]> {
  const apiKey = process.env.SERPAPI_API_KEY?.trim();
  if (!apiKey) return [];

  try {
    const url = `https://serpapi.com/search.json?engine=google_images&q=${encodeURIComponent(query)}&num=10&api_key=${apiKey}&gl=ar&hl=es`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return [];
    const data = await res.json() as {
      images_results?: Array<{
        original: string;
        original_width?: number;
        original_height?: number;
        title?: string;
        source?: string;
      }>;
    };

    return (data.images_results ?? [])
      .filter((img) => img.original && !isBlocked(img.original))
      .slice(0, 5)
      .map((img) => ({
        url: img.original,
        source: "serpapi",
        score: 0,
        width: img.original_width,
        height: img.original_height,
        title: img.title || "",
      }));
  } catch {
    return [];
  }
}

async function searchMercadoLibre(query: string): Promise<ImageResult[]> {
  try {
    const url = `https://api.mercadolibre.com/sites/MLA/search?q=${encodeURIComponent(query)}&limit=5`;
    const mlToken = await getMercadoLibreToken();
    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "application/json"
    };
    if (mlToken) {
      headers["Authorization"] = `Bearer ${mlToken}`;
    }

    const res = await fetchWithTimeout(url, { headers });
    if (!res.ok) return [];
    const data = await res.json() as {
      results?: Array<{
        title: string;
        thumbnail: string;
        thumbnail_id?: string;
      }>;
    };

    return (data.results ?? [])
      .filter((r) => r.thumbnail)
      .map((r) => {
        // Upgrade thumbnail from small to full-size
        // MercadoLibre thumbnails use -I.jpg (small), we want -O.jpg (original)
        const fullUrl = r.thumbnail.replace(/-I\.jpg$/i, "-O.jpg");
        return {
          url: fullUrl,
          source: "mercadolibre",
          score: 0,
          width: undefined,
          height: undefined,
          title: r.title,
        };
      });
  } catch {
    return [];
  }
}

async function getSupplierImages(
  supabase: any,
  productId: number
): Promise<ImageResult[]> {
  // Check product_suppliers for supplier images stored during sync
  const { data: supplierLinks } = await supabase
    .from("product_suppliers")
    .select("supplier_id, external_id")
    .eq("product_id", productId)
    .eq("active", true);

  if (!supplierLinks || supplierLinks.length === 0) return [];

  // Get supplier names to know if it's ELIT (which has images)
  const supplierIds = supplierLinks
    .map((l: { supplier_id: string | null }) => l.supplier_id)
    .filter(Boolean) as string[];
  
  if (supplierIds.length === 0) return [];

  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("id, name")
    .in("id", supplierIds);

  if (!suppliers) return [];

  // For ELIT suppliers, try to get images from their API response cached in specs
  const { data: product } = await supabase
    .from("products")
    .select("specs, image")
    .eq("id", productId)
    .single();

  const images: ImageResult[] = [];
  if (!product) return [];
  
  const specs = (product.specs ?? {}) as Record<string, unknown>;
  
  // Check if there's a supplier_image or elit_image in specs
  const supplierImage = specs.supplier_image || specs.elit_image || specs.invid_image;
  if (typeof supplierImage === "string" && supplierImage.startsWith("http")) {
    images.push({
      url: supplierImage,
      source: "supplier",
      score: 0,
      title: "Imagen del proveedor",
    });
  }

  // Check for supplier_images array in specs
  const supplierImages = specs.supplier_images;
  if (Array.isArray(supplierImages)) {
    for (const imgUrl of supplierImages) {
      if (typeof imgUrl === "string" && imgUrl.startsWith("http")) {
        images.push({
          url: imgUrl,
          source: "supplier",
          score: 0,
          title: "Imagen del proveedor",
        });
      }
    }
  }

  return images;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export default async function handler(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, x-supabase-apikey",
      },
    });
  }
  if (request.method !== "POST") return json({ ok: false, error: "Use POST" }, 405);

  let body: RequestBody;
  try {
    body = await request.json() as RequestBody;
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const products = body.products ?? [];
  const autoAssign = body.autoAssign ?? false;
  const autoAssignThreshold = body.autoAssignThreshold ?? 0.85;

  if (products.length === 0) {
    return json({
      ok: true,
      results: [],
      summary: { total: 0, auto_assigned: 0, suggested: 0, skipped: 0, already_has_image: 0 },
    });
  }

  let supabase: any;
  try {
    supabase = getSupabase(request);
  } catch (error) {
    return json({ ok: false, error: (error as Error).message }, 500);
  }

  const results: ProductResult[] = [];

  for (const product of products) {
    // Skip products that already have a valid image (unless in "all" mode)
    if (body.mode === "missing_only" && product.image && product.image.startsWith("http")) {
      results.push({
        productId: product.id,
        action: "already_has_image",
        topImages: [],
      });
      continue;
    }

    const query = buildQuery(product);
    const strictQuery = buildQuery(product, true);

    // Prioritize the fastest/highest-signal sources first to avoid Vercel timeouts.
    const [supplierImages, serperImages, mlImages] = await Promise.all([
      getSupplierImages(supabase, product.id).catch(() => [] as ImageResult[]),
      searchSerper(query).catch(() => [] as ImageResult[]),
      searchMercadoLibre(strictQuery).catch(() => [] as ImageResult[]),
    ]);

    let allCandidates = mergeUniqueImages([
      ...supplierImages,
      ...serperImages,
      ...mlImages,
    ]);

    // Bing is slower and noisier; use it only when the primary sources found too little.
    if (allCandidates.length < 2) {
      const bingImages = await searchBing(query).catch(() => [] as ImageResult[]);
      allCandidates = mergeUniqueImages([...allCandidates, ...bingImages]);
    }

    // SerpAPI fallback only if we still have too few candidates
    if (allCandidates.length < 3) {
      const serpImages = await searchSerpApi(query).catch(() => [] as ImageResult[]);
      allCandidates = mergeUniqueImages([...allCandidates, ...serpImages]);
    }

    if (allCandidates.length === 0) {
      // Log the miss
      await supabase.from("image_processing_log").insert({
        product_id: product.id,
        query,
        source: "none",
        action: "discarded",
        score: 0,
      });

      results.push({ productId: product.id, action: "skipped", topImages: [] });
      continue;
    }

    // Score all candidates
    for (const candidate of allCandidates) {
      candidate.score = scoreImage(candidate, product);
    }

    // Deduplicate & sort by score
    const unique = mergeUniqueImages(allCandidates);
    unique.sort((a, b) => b.score - a.score);

    const top3 = unique.slice(0, 3);

    // Save suggestions in DB (upsert to avoid duplicates)
    for (const img of top3) {
      await supabase.from("image_suggestions").upsert({
        product_id: product.id,
        image_url: img.url,
        score: img.score,
        source: img.source,
        status: "pending",
      }, { onConflict: "product_id,image_url" });
    }

    // Auto-assign if threshold met and enabled
    const best = top3[0];
    if (autoAssign && best && best.score >= autoAssignThreshold) {
      await supabase
        .from("products")
        .update({ image: best.url })
        .eq("id", product.id);

      await supabase.from("image_processing_log").insert({
        product_id: product.id,
        query,
        source: best.source,
        image_url: best.url,
        score: best.score,
        action: "auto_assigned",
      });

      // Mark the suggestion as approved
      await supabase
        .from("image_suggestions")
        .update({ status: "approved" })
        .eq("product_id", product.id)
        .eq("image_url", best.url);

      results.push({
        productId: product.id,
        action: "auto_assigned",
        topImages: top3,
        assignedUrl: best.url,
      });
    } else {
      // Log as suggested
      await supabase.from("image_processing_log").insert({
        product_id: product.id,
        query,
        source: best?.source ?? "none",
        image_url: best?.url,
        score: best?.score ?? 0,
        action: "suggested",
      });

      results.push({
        productId: product.id,
        action: "suggested",
        topImages: top3,
      });
    }
  }

  const summary = {
    total: results.length,
    auto_assigned: results.filter((r) => r.action === "auto_assigned").length,
    suggested: results.filter((r) => r.action === "suggested").length,
    skipped: results.filter((r) => r.action === "skipped").length,
    already_has_image: results.filter((r) => r.action === "already_has_image").length,
  };

  return json({ ok: true, results, summary });
}
