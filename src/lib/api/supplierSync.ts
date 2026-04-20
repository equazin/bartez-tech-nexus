import { supabase } from "@/lib/supabase";
import { recordPriceChange } from "@/lib/api/priceHistory";
import { applyInvidFixedCostUsd } from "@/lib/pricing";

export interface SupplierCatalogRecord {
  supplierName: string;
  supplierExternalId: string;
  supplierSku?: string | null;
  canonicalSku?: string | null;
  manufacturerPartNumber?: string | null;
  ean?: string | null;
  brand?: string | null;
  name?: string | null;
  description?: string | null;
  category?: string | null;
  image?: string | null;
  costPrice: number;
  stockAvailable: number;
  active: boolean;
  ivaRate?: number | null;
  leadTimeDays?: number | null;
  priceMultiplier?: number | null;
  sourceCurrency?: "USD" | "ARS";
  sourceCostPrice?: number | null;
  sourceExchangeRate?: number | null;
  forceCreate?: boolean;
  metadata?: Record<string, unknown> | null;
}

export interface SupplierSyncResult {
  supplierId: string;
  inserted: number;
  updated: number;
  skipped: number;
  touchedProductIds: number[];
  errors: string[];
}

export interface SupplierSyncOptions {
  existingProductsMode?: "full" | "price_only";
  createMissingProducts?: boolean;
  perRecordTimeoutMs?: number;
  onProgress?: (snapshot: {
    processed: number;
    total: number;
    inserted: number;
    updated: number;
    skipped: number;
    errorCount: number;
  }) => void;
}

interface SupplierRow {
  id: string;
  name: string;
}

interface CatalogProductRow {
  id: number;
  sku: string | null;
  name: string;
  name_original?: string | null;
  description?: string | null;
  external_id?: string | null;
  cost_price: number;
  stock: number;
  stock_reserved?: number | null;
  active?: boolean | null;
  category?: string | null;
  image?: string | null;
  iva_rate?: number | null;
  specs?: Record<string, unknown> | null;
}

interface ProductSupplierRow {
  id: string;
  product_id: number;
  supplier_id: string;
  cost_price: number;
  source_cost_price?: number | null;
  source_currency?: "USD" | "ARS" | null;
  source_exchange_rate?: number | null;
  stock_available: number;
  stock_reserved: number;
  price_multiplier: number;
  lead_time_days: number;
  is_preferred: boolean;
  active: boolean;
  external_id?: string | null;
}

interface StockSummaryRow {
  product_id: number;
  total_available: number | null;
  total_reserved: number | null;
  net_available: number | null;
  supplier_count: number | null;
}

interface SyncContext {
  supplier: SupplierRow;
  products: CatalogProductRow[];
  productById: Map<number, CatalogProductRow>;
  supplierRows: ProductSupplierRow[];
  supplierRowByExternalId: Map<string, ProductSupplierRow>;
}

function withTimeout<T>(
  task: Promise<T>,
  timeoutMs: number,
  message: string
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return task;
  }

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);

    task
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function normalizeUsdCost(record: SupplierCatalogRecord): number {
  const sourceCurrency = record.sourceCurrency ?? "USD";
  const sourceCost = record.sourceCostPrice ?? record.costPrice;
  const exchangeRate = record.sourceExchangeRate ?? null;
  let normalizedCost = 0;

  if (sourceCurrency === "ARS") {
    if (!exchangeRate || exchangeRate <= 0) {
      normalizedCost = record.costPrice;
    } else {
      normalizedCost = Number((sourceCost / exchangeRate).toFixed(4));
    }
  } else {
    normalizedCost = Number(sourceCost.toFixed(4));
  }

  if (record.supplierName.trim().toUpperCase().includes("INVID")) {
    return applyInvidFixedCostUsd(normalizedCost);
  }

  return normalizedCost;
}

function normalizeToken(value: string | number | null | undefined): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "");
}

function normalizeText(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function readRecordMetadataString(record: SupplierCatalogRecord, key: string): string {
  const value = record.metadata?.[key];
  return typeof value === "string" ? value : "";
}

function tokenizeName(value: string | null | undefined): string[] {
  const normalized = normalizeText(value);
  if (!normalized) return [];
  return normalized
    .split(" ")
    .map((token) => token.replace(/[^a-z0-9]+/g, ""))
    .filter((token) => token.length >= 3);
}

function nameSimilarity(a: string | null | undefined, b: string | null | undefined): { ratio: number; shared: number } {
  const aTokens = new Set(tokenizeName(a));
  const bTokens = new Set(tokenizeName(b));
  if (aTokens.size === 0 || bTokens.size === 0) {
    return { ratio: 0, shared: 0 };
  }

  let shared = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) shared++;
  }

  const union = new Set([...aTokens, ...bTokens]).size;
  return { ratio: union > 0 ? shared / union : 0, shared };
}

type ProductFamily =
  | "storage"
  | "cpu"
  | "notebook"
  | "desktop"
  | "monitor"
  | "memory"
  | "motherboard"
  | "gpu"
  | "network";

function inferProductFamily(value: string | null | undefined): ProductFamily | null {
  const tokens = new Set(tokenizeName(value));
  if (tokens.size === 0) return null;

  const has = (k: string) => tokens.has(k);
  if (has("notebook") || has("laptop") || has("ultrabook")) return "notebook";
  if (has("desktop") || has("aio") || has("allinone")) return "desktop";
  if (has("monitor") || has("display") || has("pantalla")) return "monitor";
  if (has("procesador") || has("cpu") || has("ryzen") || has("athlon") || has("celeron") || has("pentium") || has("xeon")) return "cpu";
  if (has("placadevideo") || has("gpu") || has("geforce") || has("radeon")) return "gpu";
  if (has("motherboard") || has("placa") || has("mainboard")) return "motherboard";
  if (has("ram") || has("ddr4") || has("ddr5") || has("memoria")) return "memory";
  if (has("router") || has("switch") || has("accesspoint") || has("wifi")) return "network";
  if (has("ssd") || has("nvme") || has("hdd") || has("disco") || has("sata") || has("m2")) return "storage";
  return null;
}

function parseCapacityGbFromText(value: string | null | undefined): number[] {
  const text = normalizeText(value).replace(/,/g, ".");
  if (!text) return [];

  const out: number[] = [];
  const pushCapacity = (rawAmount: string, unit: "tb" | "gb" | "g" | "t0") => {
    const amount = Number(rawAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const gb = (unit === "tb" || unit === "t0") ? amount * 1024 : amount;
    out.push(Math.round(gb));
  };

  const commonRegex = /(\d+(?:\.\d+)?)\s*(tb|gb|g)\b/g;
  let match: RegExpExecArray | null = null;
  while ((match = commonRegex.exec(text)) !== null) {
    pushCapacity(match[1], match[2] as "tb" | "gb" | "g");
  }

  // Some SKUs encode TB as T0 (zero), e.g. SFYR2S/4T0.
  const skuRegex = /(?:^|[^a-z0-9])(\d+(?:\.\d+)?)\s*t0\b/g;
  while ((match = skuRegex.exec(text)) !== null) {
    pushCapacity(match[1], "t0");
  }

  return out;
}

function resolveRecordCapacityGb(record: SupplierCatalogRecord): number | null {
  const candidates = [
    record.name,
    record.description,
    record.supplierSku,
    record.canonicalSku,
    record.manufacturerPartNumber,
    readRecordMetadataString(record, "capacity"),
    readRecordMetadataString(record, "capacity_gb"),
  ];
  const all = candidates.flatMap((candidate) => parseCapacityGbFromText(candidate));
  if (all.length === 0) return null;
  return Math.max(...all);
}

function resolveProductCapacityGb(product: CatalogProductRow): number | null {
  const candidates = [
    product.name_original || product.name,
    product.sku,
    product.external_id,
    readSpecString(product.specs, "capacity"),
    readSpecString(product.specs, "capacity_gb"),
    readSpecString(product.specs, "supplier_sku"),
    readSpecString(product.specs, "manufacturer_part_number"),
  ];
  const all = candidates.flatMap((candidate) => parseCapacityGbFromText(candidate));
  if (all.length === 0) return null;
  return Math.max(...all);
}

function isCapacityCompatible(
  family: ProductFamily | null,
  leftGb: number | null,
  rightGb: number | null
): boolean {
  if (!family || (family !== "storage" && family !== "memory")) return true;
  // If supplier side has a known tier (1TB/2TB/4TB), require that same signal
  // in the matched catalog row to avoid false positives by family-only matching.
  if (!leftGb) return true;
  if (!rightGb) return false;
  const maxValue = Math.max(leftGb, rightGb);
  const diff = Math.abs(leftGb - rightGb);
  return diff <= 64 || diff / maxValue <= 0.1;
}

function isGenericModelToken(token: string): boolean {
  if (!token) return true;
  if (/^(19|20)\d{2}$/.test(token)) return true;
  if (/^\d{1,3}$/.test(token)) return true;
  if (/^\d{1,4}(gb|tb|mhz|ghz|hz|w|mp|fps)$/.test(token)) return true;
  return false;
}

function extractModelTokens(value: string | null | undefined): string[] {
  const normalized = normalizeText(value);
  if (!normalized) return [];

  const out = new Set<string>();
  const rawTokens = normalized.match(/[a-z0-9]+/g) ?? [];
  for (const rawToken of rawTokens) {
    const token = normalizeToken(rawToken);
    if (!token) continue;
    if (token.length < 3 || token.length > 20) continue;
    if (!/\d/.test(token) || !/[a-z]/.test(token)) continue;
    if (isGenericModelToken(token)) continue;
    out.add(token);

    // "bx80768285k" -> "285k", "i712700k" -> "12700k"
    const tail = token.match(/(\d{2,6}[a-z]{1,3})$/);
    if (tail?.[1] && !isGenericModelToken(tail[1])) {
      out.add(tail[1]);
    }

    const numericTail = token.match(/(\d+)([a-z]{1,3})$/);
    if (numericTail) {
      const digits = numericTail[1];
      const letters = numericTail[2];
      const allowShortTail = !["g", "gb", "tb", "mhz", "ghz", "hz"].includes(letters);
      if (!allowShortTail) continue;
      for (const size of [6, 5, 4, 3]) {
        if (digits.length >= size) {
          const tailDigits = digits.slice(-size);
          if (tailDigits.startsWith("0")) continue;
          const shortTail = `${tailDigits}${letters}`;
          if (!isGenericModelToken(shortTail)) {
            out.add(shortTail);
          }
        }
      }
    }
  }

  return Array.from(out);
}

function evaluateModelKeyMatch(aKeys: string[], bKeys: string[]): { score: number; sharedKeys: string[]; maxLen: number } {
  if (aKeys.length === 0 || bKeys.length === 0) {
    return { score: 0, sharedKeys: [], maxLen: 0 };
  }

  const bSet = new Set(bKeys);
  const sharedKeys: string[] = [];
  let score = 0;
  let maxLen = 0;

  for (const key of aKeys) {
    if (!bSet.has(key)) continue;
    sharedKeys.push(key);
    maxLen = Math.max(maxLen, key.length);
    if (key.length >= 8) score += 1.25;
    else if (key.length >= 6) score += 1;
    else if (key.length >= 4) score += 0.75;
    else score += 0.5;
  }

  return {
    score: Number(score.toFixed(3)),
    sharedKeys,
    maxLen,
  };
}

function buildRecordModelKeys(record: SupplierCatalogRecord): string[] {
  const tokens = new Set<string>();
  const candidates = [
    record.manufacturerPartNumber,
    record.canonicalSku,
    record.supplierSku,
    record.name,
    readRecordMetadataString(record, "air_part_number"),
  ];

  for (const candidate of candidates) {
    for (const token of extractModelTokens(candidate)) {
      tokens.add(token);
    }
  }

  return Array.from(tokens);
}

function buildProductModelKeys(product: CatalogProductRow): string[] {
  const tokens = new Set<string>();
  const candidates = [
    product.sku,
    product.external_id,
    readSpecString(product.specs, "manufacturer_part_number"),
    readSpecString(product.specs, "supplier_sku"),
    readSpecString(product.specs, "air_part_number"),
    product.name_original || product.name,
  ];

  for (const candidate of candidates) {
    for (const token of extractModelTokens(candidate)) {
      tokens.add(token);
    }
  }

  return Array.from(tokens);
}

function getRecordBrandToken(record: SupplierCatalogRecord): string {
  return normalizeToken(
    record.brand ||
    readRecordMetadataString(record, "elit_brand") ||
    readRecordMetadataString(record, "air_group") ||
    readRecordMetadataString(record, "supplier_brand")
  );
}

function getProductBrandToken(product: CatalogProductRow): string {
  return normalizeToken(
    readSpecString(product.specs, "elit_brand") ||
    readSpecString(product.specs, "air_group") ||
    readSpecString(product.specs, "supplier_brand") ||
    readSpecString(product.specs, "brand")
  );
}

const KNOWN_BRAND_TOKENS = new Set([
  "hp", "lenovo", "dell", "msi", "asus", "acer", "samsung", "lg", "apple", "huawei",
  "intel", "amd", "kingston", "adata", "bwin", "hikvision", "ezviz", "cudy",
  "coolermaster", "asrock", "biostar", "gigabyte", "corsair", "sandisk", "wd",
  "seagate", "epson", "canon", "brother", "cx", "noga", "logitech", "tplink", "tp",
]);

const GENERIC_LEADING_TOKENS = new Set([
  "notebook", "laptop", "ultrabook", "pc", "cpu", "procesador", "disco", "ssd", "hdd",
  "monitor", "memoria", "ram", "placa", "motherboard", "router", "switch", "accesspoint",
  "accespoint", "adaptador", "fuente", "gabinete", "cooler", "teclado", "mouse",
  "pulgada", "pulgadas", "inch", "inches", "modelo", "model", "serie", "version",
]);

function inferBrandTokenFromText(value: string | null | undefined): string {
  const tokens = tokenizeName(value);
  if (tokens.length === 0) return "";

  for (const token of tokens) {
    if (KNOWN_BRAND_TOKENS.has(token)) return token;
  }

  for (const token of tokens) {
    if (GENERIC_LEADING_TOKENS.has(token)) continue;
    if (/^\d/.test(token)) continue;
    if (token.length < 2 || token.length > 14) continue;
    return token;
  }

  return "";
}

function resolveRecordBrandToken(record: SupplierCatalogRecord): string {
  return getRecordBrandToken(record) || inferBrandTokenFromText(record.name);
}

function resolveProductBrandToken(product: CatalogProductRow): string {
  return getProductBrandToken(product) || inferBrandTokenFromText(product.name_original || product.name);
}

function pushUnique(target: string[], value: string | number | null | undefined) {
  const normalized = normalizeToken(value);
  if (normalized && !target.includes(normalized)) {
    target.push(normalized);
  }
}

function readSpecString(specs: Record<string, unknown> | null | undefined, key: string): string {
  const raw = specs?.[key];
  return typeof raw === "string" ? raw : "";
}

function buildStrongKeys(record: SupplierCatalogRecord): string[] {
  const keys: string[] = [];
  pushUnique(keys, record.canonicalSku);
  pushUnique(keys, record.manufacturerPartNumber);
  pushUnique(keys, record.ean);
  pushUnique(keys, record.supplierSku);
  pushUnique(keys, record.supplierExternalId);
  pushUnique(keys, readRecordMetadataString(record, "ean"));
  pushUnique(keys, readRecordMetadataString(record, "gtin"));
  pushUnique(keys, readRecordMetadataString(record, "upc"));
  return keys;
}

function buildProductStrongKeys(product: CatalogProductRow): string[] {
  const keys: string[] = [];
  pushUnique(keys, product.sku);
  pushUnique(keys, product.external_id);
  pushUnique(keys, readSpecString(product.specs, "manufacturer_part_number"));
  pushUnique(keys, readSpecString(product.specs, "supplier_sku"));
  pushUnique(keys, readSpecString(product.specs, "supplier_external_id"));
  pushUnique(keys, readSpecString(product.specs, "ean"));
  pushUnique(keys, readSpecString(product.specs, "gtin"));
  pushUnique(keys, readSpecString(product.specs, "upc"));
  return keys;
}

function getDisplayName(record: SupplierCatalogRecord): string {
  const fallback = record.canonicalSku || record.manufacturerPartNumber || record.supplierSku || record.supplierExternalId;
  return String(record.name ?? fallback ?? "Producto sincronizado").trim();
}

function getCanonicalSku(record: SupplierCatalogRecord): string {
  return String(
    record.canonicalSku ||
    record.manufacturerPartNumber ||
    record.supplierSku ||
    record.supplierExternalId
  ).trim();
}

function collectRecordSkuSignals(record: SupplierCatalogRecord): string[] {
  const out = new Set<string>();
  const candidates = [
    record.canonicalSku,
    record.manufacturerPartNumber,
    record.supplierSku,
    record.supplierExternalId,
  ];
  for (const candidate of candidates) {
    const normalized = normalizeToken(candidate ?? "");
    if (normalized) {
      out.add(normalized);
    }
  }
  return Array.from(out);
}

function collectProductSkuSignals(product: CatalogProductRow | null | undefined): string[] {
  if (!product) return [];
  const out = new Set<string>();
  const candidates = [
    product.sku,
    product.external_id,
    readSpecString(product.specs, "supplier_sku"),
    readSpecString(product.specs, "manufacturer_part_number"),
    readSpecString(product.specs, "supplier_external_id"),
  ];
  for (const candidate of candidates) {
    const normalized = normalizeToken(candidate ?? "");
    if (normalized) {
      out.add(normalized);
    }
  }
  return Array.from(out);
}

function skuSignalsOverlap(record: SupplierCatalogRecord, product: CatalogProductRow | null | undefined): boolean {
  const recordSignals = collectRecordSkuSignals(record);
  const productSignals = new Set(collectProductSkuSignals(product));
  if (recordSignals.length === 0 || productSignals.size === 0) {
    return false;
  }
  return recordSignals.some((signal) => productSignals.has(signal));
}

export function findMatchingCatalogProduct(
  products: CatalogProductRow[],
  record: SupplierCatalogRecord
): CatalogProductRow | null {
  const recordBrand = resolveRecordBrandToken(record);
  const recordFamily = inferProductFamily(`${record.name ?? ""} ${record.description ?? ""} ${record.category ?? ""}`);
  const recordCapacityGb = resolveRecordCapacityGb(record);

  const strongKeys = buildStrongKeys(record);
  if (strongKeys.length > 0) {
    const exactMatches = products.filter((product) => {
      const productKeys = buildProductStrongKeys(product);
      return strongKeys.some((key) => productKeys.includes(key));
    });

    if (exactMatches.length > 0) {
      const compatibleMatches = exactMatches.filter((product) => {
        const productBrand = resolveProductBrandToken(product);
        const hasBothBrands = Boolean(recordBrand && productBrand);
        if (hasBothBrands && recordBrand !== productBrand) {
          return false;
        }

        const productFamily = inferProductFamily(`${product.name_original || product.name} ${product.category ?? ""}`);
        if (recordFamily && productFamily && recordFamily !== productFamily) {
          return false;
        }

        const productCapacityGb = resolveProductCapacityGb(product);
        if (!isCapacityCompatible(recordFamily, recordCapacityGb, productCapacityGb)) {
          return false;
        }

        return true;
      });

      if (compatibleMatches.length > 0) {
        return compatibleMatches.sort((a, b) => {
          if ((a.active ?? true) !== (b.active ?? true)) return (a.active ?? true) ? -1 : 1;
          return a.cost_price - b.cost_price || a.id - b.id;
        })[0];
      }
    }
  }

  // Second pass: model-key match (useful when supplier uses internal SKU).
  const recordModelKeys = buildRecordModelKeys(record);
  if (recordModelKeys.length > 0) {
    const modelMatches = products
      .map((product) => {
        const productBrand = resolveProductBrandToken(product);
        const hasBothBrands = Boolean(recordBrand && productBrand);
        if (hasBothBrands && recordBrand !== productBrand) {
          return null;
        }

        const productFamily = inferProductFamily(`${product.name_original || product.name} ${product.category ?? ""}`);
        if (recordFamily && productFamily && recordFamily !== productFamily) {
          return null;
        }

        const productCapacityGb = resolveProductCapacityGb(product);
        if (!isCapacityCompatible(recordFamily, recordCapacityGb, productCapacityGb)) {
          return null;
        }

        const productModelKeys = buildProductModelKeys(product);
        const modelMatch = evaluateModelKeyMatch(recordModelKeys, productModelKeys);
        const modelScore = modelMatch.score;
        if (modelScore <= 0) return null;

        const hasBrandSignal = hasBothBrands && recordBrand === productBrand;
        const relaxedWithBrand = hasBrandSignal && modelScore >= 0.75 && modelMatch.maxLen >= 4;
        const strictWithoutBrand = modelScore >= 2 || modelMatch.sharedKeys.length >= 2 || modelMatch.maxLen >= 7;
        if (!relaxedWithBrand && !strictWithoutBrand) {
          return null;
        }

        return {
          product,
          score: modelScore + (hasBrandSignal ? 0.35 : 0) + Math.min(modelMatch.sharedKeys.length, 3) * 0.1,
        };
      })
      .filter((item): item is { product: CatalogProductRow; score: number } => Boolean(item))
      .sort((a, b) => {
        const aActive = a.product.active ?? true;
        const bActive = b.product.active ?? true;
        if (aActive !== bActive) return aActive ? -1 : 1;
        return b.score - a.score || a.product.cost_price - b.product.cost_price || a.product.id - b.product.id;
      });

    if (modelMatches.length > 0) {
      return modelMatches[0].product;
    }
  }

  const normalizedName = normalizeText(record.name);
  if (!normalizedName || normalizedName.length < 8) {
    return null;
  }

  const nameMatches = products.filter((product) => {
    const productName = normalizeText(product.name_original || product.name);
    return productName === normalizedName;
  });

  if (nameMatches.length === 0) {
    const recordPart = normalizeToken(record.manufacturerPartNumber || record.canonicalSku || record.supplierSku);

    const fuzzyMatches = products
      .map((product) => {
        const productName = normalizeText(product.name_original || product.name);
        if (!productName || productName.length < 8) return null;

        const productBrand = resolveProductBrandToken(product);
        const hasBothBrands = Boolean(recordBrand && productBrand);
        if (hasBothBrands && recordBrand !== productBrand) {
          return null;
        }
        const hasBrandSignal = hasBothBrands && recordBrand === productBrand;

        const productFamily = inferProductFamily(`${productName} ${product.category ?? ""}`);
        if (recordFamily && productFamily && recordFamily !== productFamily) {
          return null;
        }

        const productCapacityGb = resolveProductCapacityGb(product);
        if (!isCapacityCompatible(recordFamily, recordCapacityGb, productCapacityGb)) {
          return null;
        }

        const containsName =
          normalizedName.includes(productName) ||
          productName.includes(normalizedName);

        const similarity = nameSimilarity(normalizedName, productName);
        const partMatch = Boolean(
          recordPart &&
          recordPart.length >= 6 &&
          (normalizeToken(product.sku).includes(recordPart) ||
            normalizeToken(product.external_id).includes(recordPart) ||
            normalizeToken(productName).includes(recordPart))
        );

        const passesSimilarity = hasBrandSignal
          ? (
            containsName
              ? Math.min(normalizedName.length, productName.length) >= 12
              : similarity.ratio >= 0.5 && similarity.shared >= 3
          )
          : (
            containsName
              ? Math.min(normalizedName.length, productName.length) >= 16
              : similarity.ratio >= 0.82 && similarity.shared >= 4
          );

        if (!passesSimilarity && !partMatch) {
          return null;
        }

        return {
          product,
          score: (partMatch ? 1 : 0) + similarity.ratio + (containsName ? 0.25 : 0),
        };
      })
      .filter((item): item is { product: CatalogProductRow; score: number } => Boolean(item));

    if (fuzzyMatches.length === 0) {
      return null;
    }

    return fuzzyMatches
      .sort((a, b) => {
        const aActive = a.product.active ?? true;
        const bActive = b.product.active ?? true;
        if (aActive !== bActive) return aActive ? -1 : 1;
        return b.score - a.score || a.product.cost_price - b.product.cost_price || a.product.id - b.product.id;
      })[0]
      .product;
  }

  return nameMatches.sort((a, b) => {
    if ((a.active ?? true) !== (b.active ?? true)) return (a.active ?? true) ? -1 : 1;
    return a.cost_price - b.cost_price || a.id - b.id;
  })[0];
}

export function choosePreferredSupplier(rows: ProductSupplierRow[]): ProductSupplierRow | null {
  if (rows.length === 0) {
    return null;
  }

  const activeRows = rows.filter((row) => row.active);
  const sellableRows = activeRows.filter((row) => (row.stock_available - row.stock_reserved) > 0);
  const candidates = sellableRows.length > 0 ? sellableRows : activeRows.length > 0 ? activeRows : rows;

  return [...candidates].sort((a, b) => {
    const aNet = a.stock_available - a.stock_reserved;
    const bNet = b.stock_available - b.stock_reserved;
    return a.cost_price - b.cost_price || bNet - aNet || a.lead_time_days - b.lead_time_days || a.id.localeCompare(b.id);
  })[0];
}

async function ensureSupplierByName(name: string): Promise<SupplierRow> {
  const normalizedName = name.trim();
  const { data: existing } = await supabase
    .from("suppliers")
    .select("id, name")
    .ilike("name", normalizedName)
    .maybeSingle();

  if (existing) {
    return existing as SupplierRow;
  }

  const { data, error } = await supabase
    .from("suppliers")
    .insert({
      name: normalizedName,
      lead_time_days: 0,
      default_margin: 0,
      price_multiplier: 1,
      active: true,
    })
    .select("id, name")
    .single();

  if (error || !data) {
    throw new Error(error?.message || `No se pudo crear el proveedor ${normalizedName}`);
  }

  return data as SupplierRow;
}

async function buildSyncContext(supplier: SupplierRow): Promise<SyncContext> {
  const [{ data: productsData }, { data: supplierRowsData }] = await Promise.all([
    supabase
      .from("products")
      .select("id, sku, name, name_original, description, external_id, cost_price, stock, stock_reserved, active, category, image, iva_rate, specs"),
    supabase
      .from("product_suppliers")
      .select("id, product_id, supplier_id, cost_price, source_cost_price, source_currency, source_exchange_rate, stock_available, stock_reserved, price_multiplier, lead_time_days, is_preferred, active, external_id")
      .eq("supplier_id", supplier.id),
  ]);

  const products = (productsData ?? []) as CatalogProductRow[];
  const supplierRows = (supplierRowsData ?? []) as ProductSupplierRow[];
  const productById = new Map(products.map((product) => [product.id, product]));
  const supplierRowByExternalId = new Map<string, ProductSupplierRow>();

  for (const row of supplierRows) {
    const key = normalizeToken(row.external_id);
    if (key) {
      supplierRowByExternalId.set(key, row);
    }
  }

  return {
    supplier,
    products,
    productById,
    supplierRows,
    supplierRowByExternalId,
  };
}

function buildProductSpecs(product: CatalogProductRow | null, record: SupplierCatalogRecord) {
  return {
    ...(product?.specs ?? {}),
    ...(record.metadata ?? {}),
    sync_supplier: record.supplierName,
    ...(record.brand ? { supplier_brand: record.brand } : {}),
    ...(record.ean ? { ean: record.ean } : {}),
    supplier_sku: record.supplierSku || record.supplierExternalId,
    supplier_external_id: record.supplierExternalId,
    ...(record.manufacturerPartNumber ? { manufacturer_part_number: record.manufacturerPartNumber } : {}),
  };
}

async function insertCatalogProduct(record: SupplierCatalogRecord): Promise<CatalogProductRow> {
  const payload = {
    sku: getCanonicalSku(record),
    name: getDisplayName(record),
    name_original: getDisplayName(record),
    description: record.description?.trim() || (record.manufacturerPartNumber ? `Part#: ${record.manufacturerPartNumber}` : ""),
    external_id: record.supplierExternalId,
    cost_price: record.costPrice,
    stock: Math.max(0, record.stockAvailable),
    active: record.active,
    category: record.category?.trim() || "Sin categoria",
    image: record.image ?? "",
    iva_rate: record.ivaRate ?? 21,
    specs: buildProductSpecs(null, record),
  };

  const { data, error } = await supabase
    .from("products")
    .insert(payload)
    .select("id, sku, name, name_original, description, external_id, cost_price, stock, stock_reserved, active, category, image, iva_rate, specs")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "No se pudo crear el producto canonico");
  }

  return data as CatalogProductRow;
}

async function upsertSupplierOffer(
  supplierId: string,
  productId: number,
  record: SupplierCatalogRecord,
  options: {
    priceOnly?: boolean;
    existingRow?: ProductSupplierRow | null;
  } = {}
): Promise<void> {
  const payload: Record<string, unknown> = {
    product_id: productId,
    supplier_id: supplierId,
    cost_price: normalizeUsdCost(record),
    source_cost_price: record.sourceCostPrice ?? record.costPrice,
    source_currency: record.sourceCurrency ?? "USD",
    source_exchange_rate: record.sourceExchangeRate ?? null,
    stock_available: Math.max(0, Math.round(record.stockAvailable)),
    price_multiplier: record.priceMultiplier ?? 1,
    lead_time_days: Math.max(0, Math.round(record.leadTimeDays ?? 0)),
    active: record.active,
    external_id: record.supplierExternalId,
    last_synced_at: new Date().toISOString(),
  };

  if (options.priceOnly) {
    payload.lead_time_days = options.existingRow?.lead_time_days ?? 0;
    payload.price_multiplier = options.existingRow?.price_multiplier ?? 1;
    payload.active = record.active;
  }

  const { error } = await supabase
    .from("product_suppliers")
    .upsert(payload, { onConflict: "product_id,supplier_id" });

  if (error) {
    throw new Error(error.message);
  }
}

async function reconcileCatalogProducts(
  productIds: number[],
  userId?: string,
  options: SupplierSyncOptions = {},
  onItemProcessed?: () => void
): Promise<number> {
  if (productIds.length === 0) {
    return 0;
  }

  const uniqueIds = [...new Set(productIds)];
  const priceOnlyMode = options.existingProductsMode === "price_only";
  const perReconcileTimeoutMs = options.perRecordTimeoutMs ?? 20000;
  let reconciledCount = 0;
  const [{ data: supplierRowsData }, { data: stockSummaryData }, { data: productsData }] = await Promise.all([
    supabase
      .from("product_suppliers")
      .select("id, product_id, supplier_id, cost_price, source_cost_price, source_currency, source_exchange_rate, stock_available, stock_reserved, price_multiplier, lead_time_days, is_preferred, active, external_id")
      .in("product_id", uniqueIds),
    supabase
      .from("product_stock_summary")
      .select("product_id, total_available, total_reserved, net_available, supplier_count")
      .in("product_id", uniqueIds),
    supabase
      .from("products")
      .select("id, cost_price, stock, stock_reserved, active, external_id, specs")
      .in("id", uniqueIds),
  ]);

  const supplierRows = (supplierRowsData ?? []) as ProductSupplierRow[];
  const rowsByProductId = new Map<number, ProductSupplierRow[]>();
  for (const row of supplierRows) {
    const list = rowsByProductId.get(row.product_id) ?? [];
    list.push(row);
    rowsByProductId.set(row.product_id, list);
  }
  const summaryByProductId = new Map<number, StockSummaryRow>(
    ((stockSummaryData ?? []) as StockSummaryRow[]).map((row) => [row.product_id, row])
  );
  const productsById = new Map<number, Pick<CatalogProductRow, "id" | "cost_price" | "stock" | "stock_reserved" | "active" | "external_id" | "specs">>(
    ((productsData ?? []) as Array<Pick<CatalogProductRow, "id" | "cost_price" | "stock" | "stock_reserved" | "active" | "external_id" | "specs">>)
      .map((row) => [row.id, row])
  );

  for (const productId of uniqueIds) {
    try {
      await withTimeout((async () => {
        const rows = rowsByProductId.get(productId) ?? [];
        const preferred = priceOnlyMode
          ? [...(rows.filter((row) => row.active).length > 0 ? rows.filter((row) => row.active) : rows)].sort((a, b) => {
            return a.cost_price - b.cost_price || a.id.localeCompare(b.id);
          })[0]
          : choosePreferredSupplier(rows);
        if (!preferred) {
          return;
        }

        const summary = summaryByProductId.get(productId);
        const currentProduct = productsById.get(productId);
        if (!currentProduct) {
          return;
        }

        const nextPrice = Number(preferred.cost_price ?? 0);
        let writeOk = true;

        if (priceOnlyMode) {
          const nextStock = Math.max(0, summary?.net_available ?? 0);
          const nextReserved = Math.max(0, summary?.total_reserved ?? 0);
          const shouldUpdateProduct =
            currentProduct.cost_price !== nextPrice ||
            (currentProduct.stock ?? 0) !== nextStock ||
            (currentProduct.stock_reserved ?? 0) !== nextReserved;

          if (shouldUpdateProduct) {
            const priceUpdate = await supabase
              .from("products")
              .update({
                cost_price: nextPrice,
                stock: nextStock,
                stock_reserved: nextReserved,
                updated_at: new Date().toISOString(),
              })
              .eq("id", productId);
            if (priceUpdate.error) writeOk = false;
          }
        } else {
          const currentPreferredId = rows.find((row) => row.is_preferred)?.id ?? null;
          const hasOtherPreferred = rows.some((row) => row.is_preferred && row.id !== preferred.id);

          if (hasOtherPreferred) {
            const unsetPreferred = await supabase
              .from("product_suppliers")
              .update({ is_preferred: false })
              .eq("product_id", productId)
              .neq("id", preferred.id);
            if (unsetPreferred.error) writeOk = false;
          }

          if (currentPreferredId !== preferred.id || !preferred.is_preferred) {
            const setPreferred = await supabase
              .from("product_suppliers")
              .update({ is_preferred: true })
              .eq("id", preferred.id);
            if (setPreferred.error) writeOk = false;
          }

          const nextStock = Math.max(0, summary?.net_available ?? 0);
          const nextReserved = Math.max(0, summary?.total_reserved ?? 0);
          const hasActiveSource = rows.some((row) => row.active);
          const nextExternalId = preferred.external_id ?? currentProduct.external_id ?? null;
          const nextSpecs = {
            ...(currentProduct.specs ?? {}),
            preferred_supplier_id: preferred.supplier_id,
            preferred_supplier_external_id: preferred.external_id ?? null,
            preferred_supplier_cost: nextPrice,
            preferred_supplier_cost_currency: preferred.source_currency ?? "USD",
            preferred_supplier_source_cost: preferred.source_cost_price ?? nextPrice,
            preferred_supplier_exchange_rate: preferred.source_exchange_rate ?? null,
            preferred_supplier_lead_time_days: preferred.lead_time_days ?? 0,
          };

          const shouldUpdateProduct =
            currentProduct.cost_price !== nextPrice ||
            (currentProduct.stock ?? 0) !== nextStock ||
            (currentProduct.stock_reserved ?? 0) !== nextReserved ||
            Boolean(currentProduct.active) !== hasActiveSource ||
            (currentProduct.external_id ?? null) !== nextExternalId ||
            JSON.stringify(currentProduct.specs ?? {}) !== JSON.stringify(nextSpecs);

          if (shouldUpdateProduct) {
            const fullUpdate = await supabase
              .from("products")
              .update({
                cost_price: nextPrice,
                stock: nextStock,
                stock_reserved: nextReserved,
                active: hasActiveSource,
                external_id: nextExternalId,
                specs: nextSpecs,
                updated_at: new Date().toISOString(),
              })
              .eq("id", productId);
            if (fullUpdate.error) writeOk = false;
          }
        }

        if (writeOk && currentProduct.cost_price > 0 && currentProduct.cost_price !== nextPrice) {
          void recordPriceChange({
            product_id: productId,
            old_price: currentProduct.cost_price,
            new_price: nextPrice,
            change_reason: "Sync multi proveedor",
            changed_by: userId,
          });
        }
      })(), perReconcileTimeoutMs, `Timeout reconciliando producto ${productId}`);
    } catch {
      // Continuar con el resto de productos aunque uno falle o tarde demasiado.
    } finally {
      reconciledCount++;
      onItemProcessed?.();
    }
  }

  return reconciledCount;
}

export async function syncSupplierCatalogRecords(
  records: SupplierCatalogRecord[],
  userId?: string,
  options: SupplierSyncOptions = {}
): Promise<SupplierSyncResult> {
  if (records.length === 0) {
    throw new Error("No hay productos para sincronizar");
  }

  const supplier = await ensureSupplierByName(records[0].supplierName);
  const context = await buildSyncContext(supplier);
  const touchedProductIds = new Set<number>();
  const existingTouchedProductIds = new Set<number>();
  const errors: string[] = [];
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const existingMode = options.existingProductsMode ?? "full";
  const createMissingProducts = options.createMissingProducts ?? true;
  const perRecordTimeoutMs = options.perRecordTimeoutMs ?? 20000;
  let processed = 0;
  let totalWork = records.length;
  const reportProgress = () => {
    options.onProgress?.({
      processed,
      total: totalWork,
      inserted,
      updated,
      skipped,
      errorCount: errors.length,
    });
  };
  reportProgress();

  for (const record of records) {
    const externalKey = normalizeToken(record.supplierExternalId);
    if (!externalKey) {
      skipped++;
      processed++;
      reportProgress();
      continue;
    }

    try {
      await withTimeout((async () => {
        const existingSupplierRow = context.supplierRowByExternalId.get(externalKey);
        const linkedProduct = existingSupplierRow
          ? context.productById.get(existingSupplierRow.product_id) ?? null
          : null;
        const canReuseLinkedProduct = Boolean(linkedProduct && skuSignalsOverlap(record, linkedProduct));

        let product = record.forceCreate
          ? (canReuseLinkedProduct ? linkedProduct : null)
          : (linkedProduct ?? findMatchingCatalogProduct(context.products, record));
        const wasExisting = Boolean(product);

        if (!product) {
          if (!createMissingProducts && !record.forceCreate) {
            skipped++;
            return;
          }

          product = await insertCatalogProduct(record);
          context.products.push(product);
          context.productById.set(product.id, product);
          inserted++;
        } else {
          updated++;
        }

        if (record.forceCreate && existingSupplierRow) {
          await supabase.from("product_suppliers").delete().eq("id", existingSupplierRow.id);
        }

        await upsertSupplierOffer(context.supplier.id, product.id, record, {
          priceOnly: existingMode === "price_only" && wasExisting,
          existingRow: record.forceCreate ? null : existingSupplierRow,
        });
        touchedProductIds.add(product.id);
        if (wasExisting) {
          existingTouchedProductIds.add(product.id);
        }

        const generatedRowId =
          globalThis.crypto?.randomUUID?.() ??
          `tmp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

        const refreshedSupplierRow: ProductSupplierRow = {
          id: existingSupplierRow?.id ?? generatedRowId,
          product_id: product.id,
          supplier_id: context.supplier.id,
          cost_price: normalizeUsdCost(record),
          source_cost_price: record.sourceCostPrice ?? record.costPrice,
          source_currency: record.sourceCurrency ?? "USD",
          source_exchange_rate: record.sourceExchangeRate ?? null,
          stock_available: Math.max(0, Math.round(record.stockAvailable)),
          stock_reserved: existingSupplierRow?.stock_reserved ?? 0,
          price_multiplier: record.priceMultiplier ?? 1,
          lead_time_days: Math.max(0, Math.round(record.leadTimeDays ?? 0)),
          is_preferred: existingSupplierRow?.is_preferred ?? false,
          active: record.active,
          external_id: record.supplierExternalId,
        };
        context.supplierRowByExternalId.set(externalKey, refreshedSupplierRow);
      })(), perRecordTimeoutMs, `Timeout procesando ${record.supplierExternalId}`);
    } catch (error) {
      errors.push(`${record.supplierExternalId}: ${error instanceof Error ? error.message : String(error)}`);
      skipped++;
    } finally {
      processed++;
      reportProgress();
    }
  }

  if (existingMode === "price_only") {
    const existingIds = [...existingTouchedProductIds];
    const insertedIds = [...touchedProductIds].filter((id) => !existingTouchedProductIds.has(id));
    totalWork += existingIds.length + insertedIds.length;
    reportProgress();
    await reconcileCatalogProducts(existingIds, userId, { existingProductsMode: "price_only", perRecordTimeoutMs }, () => {
      processed++;
      reportProgress();
    });
    await reconcileCatalogProducts(insertedIds, userId, { existingProductsMode: "full", perRecordTimeoutMs }, () => {
      processed++;
      reportProgress();
    });
  } else {
    const touched = [...touchedProductIds];
    totalWork += touched.length;
    reportProgress();
    await reconcileCatalogProducts(touched, userId, { existingProductsMode: "full", perRecordTimeoutMs }, () => {
      processed++;
      reportProgress();
    });
  }

  return {
    supplierId: context.supplier.id,
    inserted,
    updated,
    skipped,
    touchedProductIds: [...touchedProductIds],
    errors,
  };
}
