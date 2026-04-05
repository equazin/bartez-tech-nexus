/**
 * Image scoring, validation, and query-building utilities.
 * Shared between the serverless API and the client-side UI.
 */

// ---------------------------------------------------------------------------
// Normalization helpers
// ---------------------------------------------------------------------------

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string): string[] {
  return normalize(value)
    .split(" ")
    .filter((t) => t.length >= 2);
}

// ---------------------------------------------------------------------------
// Query builder
// ---------------------------------------------------------------------------

/** Noise words that add no value to product image searches. */
const NOISE_WORDS = new Set([
  "para", "con", "sin", "los", "las", "del", "una", "uno",
  "que", "por", "the", "and", "for", "with", "product",
  "nuevo", "new", "modelo", "model", "serie", "series",
  "equipo", "articulo", "accesorio", "hardware", "componente",
  "tipo", "version",
]);

/**
 * Build an optimized search query from product fields.
 * Produces a clean string combining brand + name + "product" keyword.
 */
export function buildSearchQuery(product: {
  name: string;
  brand?: string | null;
  sku?: string | null;
  category?: string | null;
}): string {
  const tokens = tokenize(product.name).filter((t) => !NOISE_WORDS.has(t));

  // Prepend brand if it doesn't appear in the name tokens
  const brandNorm = product.brand ? normalize(product.brand) : "";
  if (brandNorm && !tokens.includes(brandNorm)) {
    tokens.unshift(brandNorm);
  }

  // Cap to avoid overly long queries
  const capped = tokens.slice(0, 8);

  // Append "product" to bias results towards product images
  capped.push("product");

  return capped.join(" ");
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export interface ImageCandidate {
  url: string;
  source: string;
  width?: number;
  height?: number;
  title?: string;
  /** Domain the image was found on */
  domain?: string;
}

export interface ScoredImage {
  url: string;
  source: string;
  score: number;
  breakdown: {
    nameMatch: number;
    brandMatch: number;
    resolution: number;
    cleanBg: number;
    productType: number;
  };
}

/** Domains known to serve clean, white-background product images. */
const CLEAN_BG_DOMAINS = new Set([
  "elit.com.ar",
  "clientes.elit.com.ar",
  "images.elit.com.ar",
  "http2.mlstatic.com",
  "images-na.ssl-images-amazon.com",
  "m.media-amazon.com",
  "images.samsung.com",
  "i.dell.com",
  "store.hp.com",
  "images.acer.com",
  "p.globalsources.com",
]);

/** Domains that produce logos, favicons, or banners — not product photos. */
const BLOCKED_DOMAINS = new Set([
  "logo.clearbit.com",
  "www.google.com",
  "upload.wikimedia.org",
  "cdn.pixabay.com",
  "www.vectorlogo.zone",
]);

/** URL patterns that indicate non-product images. */
const BLOCKED_URL_PATTERNS = [
  /favicon/i,
  /logo/i,
  /banner/i,
  /sprite/i,
  /icon[-_]/i,
  /placeholder/i,
  /no[-_]?image/i,
  /\?w=\d{1,2}&/,  // tiny thumbnails
  /\/thumb\//i,
];

/**
 * Score how well an image candidate matches a product.
 *
 * Weights:
 *   nameMatch  40%  — tokens from the image title/context match the product name
 *   brandMatch 20%  — brand detected in image context
 *   resolution 15%  — size of the image (normalized 500–2000px)
 *   cleanBg    15%  — inferred from hosting domain
 *   productType 10% — product photo vs. generic image
 */
export function scoreImage(
  candidate: ImageCandidate,
  product: { name: string; brand?: string | null }
): ScoredImage {
  // --- Name match (40%) ---
  const productTokens = tokenize(product.name).filter((t) => !NOISE_WORDS.has(t));
  const candidateText = normalize(candidate.title || "") + " " + normalize(candidate.url);
  const candidateTokens = new Set(tokenize(candidateText));

  let nameHits = 0;
  for (const token of productTokens) {
    if (candidateTokens.has(token)) nameHits++;
  }
  const nameMatch = productTokens.length > 0
    ? Math.min(1, nameHits / Math.max(productTokens.length * 0.6, 1))
    : 0.3; // no tokens → neutral

  // --- Brand match (20%) ---
  const brandNorm = product.brand ? normalize(product.brand) : "";
  let brandMatch = 0;
  if (brandNorm) {
    if (candidateTokens.has(brandNorm)) {
      brandMatch = 1;
    } else if (candidateText.includes(brandNorm)) {
      brandMatch = 0.7;
    }
  } else {
    brandMatch = 0.5; // no brand info → neutral
  }

  // --- Resolution (15%) ---
  const minDim = Math.min(candidate.width || 0, candidate.height || 0);
  let resolution = 0;
  if (minDim >= 1000) resolution = 1;
  else if (minDim >= 500) resolution = (minDim - 500) / 500;
  else if (minDim > 0) resolution = 0;
  else resolution = 0.5; // unknown → neutral

  // --- Clean background (15%) ---
  const domain = candidate.domain || extractDomain(candidate.url);
  let cleanBg = 0.5; // neutral by default
  if (CLEAN_BG_DOMAINS.has(domain)) cleanBg = 1;
  if (domain.includes("mercadolibre") || domain.includes("mlstatic")) cleanBg = 0.9;

  // --- Product type (10%) ---
  let productType = 0.5;
  if (candidate.source === "supplier") productType = 1;
  if (candidate.source === "mercadolibre") productType = 0.9;
  if (candidate.source === "bing" || candidate.source === "serpapi") productType = 0.6;

  const score =
    nameMatch * 0.4 +
    brandMatch * 0.2 +
    resolution * 0.15 +
    cleanBg * 0.15 +
    productType * 0.1;

  return {
    url: candidate.url,
    source: candidate.source,
    score: Number(score.toFixed(4)),
    breakdown: {
      nameMatch: Number(nameMatch.toFixed(3)),
      brandMatch: Number(brandMatch.toFixed(3)),
      resolution: Number(resolution.toFixed(3)),
      cleanBg: Number(cleanBg.toFixed(3)),
      productType: Number(productType.toFixed(3)),
    },
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Returns true if the image URL should be rejected. */
export function isBlockedImage(url: string): boolean {
  const domain = extractDomain(url);
  if (BLOCKED_DOMAINS.has(domain)) return true;
  if (BLOCKED_URL_PATTERNS.some((pattern) => pattern.test(url))) return true;
  return false;
}

/**
 * Validate minimum resolution requirement.
 * If dimensions are unknown, returns true (we can't reject).
 */
export function meetsMinResolution(
  width?: number,
  height?: number,
  minSize = 500
): boolean {
  if (!width || !height) return true; // unknown → accept
  return width >= minSize && height >= minSize;
}

/**
 * Remove duplicate image URLs, keeping the highest-scored version.
 */
export function deduplicateImages(images: ScoredImage[]): ScoredImage[] {
  const byUrl = new Map<string, ScoredImage>();
  for (const img of images) {
    const normalizedUrl = img.url.split("?")[0].toLowerCase();
    const existing = byUrl.get(normalizedUrl);
    if (!existing || img.score > existing.score) {
      byUrl.set(normalizedUrl, img);
    }
  }
  return Array.from(byUrl.values()).sort((a, b) => b.score - a.score);
}
