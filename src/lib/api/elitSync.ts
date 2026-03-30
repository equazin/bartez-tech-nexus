import { fetchAllElitProducts, type ElitProduct } from "@/lib/api/elitApi";
import { syncSupplierCatalogRecords, type SupplierCatalogRecord } from "@/lib/api/supplierSync";

export interface SupplierSyncProgress {
  phase: "idle" | "checking" | "fetching" | "upserting" | "done" | "error";
  page: number;
  fetched: number;
  processed?: number;
  total?: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
  startedAt?: string;
  finishedAt?: string;
  durationSeconds?: number;
}

export type SupplierSyncProgressCallback = (progress: SupplierSyncProgress) => void;

const INITIAL: SupplierSyncProgress = {
  phase: "idle",
  page: 0,
  fetched: 0,
  processed: 0,
  total: 0,
  inserted: 0,
  updated: 0,
  skipped: 0,
  errors: [],
};

const ELIT_SUPPLIER_NAME = "ELIT";
const LAST_SYNC_KEY = "elit_last_sync";
const ELIT_DELTA_SAFETY_WINDOW_MINUTES = 5;

export interface SupplierLastSyncInfo {
  type: "catalog" | "delta";
  finishedAt: string;
  inserted: number;
  updated: number;
  errors: number;
}

function parseElitNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const raw = String(value ?? "").trim();
  if (!raw) return 0;

  const normalized = raw
    .replace(/\s+/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(/,(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getImmediateStock(product: ElitProduct) {
  return Math.max(0, Math.round(parseElitNumber(product.stock_deposito_cliente ?? 0)));
}

function getDelayedStock(product: ElitProduct) {
  return Math.max(0, Math.round(parseElitNumber(product.stock_deposito_cd ?? 0)));
}

function getTotalStock(product: ElitProduct) {
  return Math.max(0, Math.round(parseElitNumber(product.stock_total ?? 0)));
}

function getNivelStock(product: ElitProduct): string {
  return String(product.nivel_stock ?? "").trim().toLowerCase();
}

function getAvailableStock(product: ElitProduct): number {
  const immediateStock = getImmediateStock(product);
  const delayedStock = getDelayedStock(product);
  const totalStock = getTotalStock(product);
  const mergedStock = Math.max(totalStock, immediateStock + delayedStock);

  if (mergedStock > 0) {
    return mergedStock;
  }

  // ELIT sometimes indicates availability only through level.
  const nivel = getNivelStock(product);
  if (nivel === "alto" || nivel === "medio") {
    return 1;
  }

  return 0;
}

function getCurrency(product: ElitProduct): "USD" | "ARS" {
  return String(product.moneda ?? "2") === "1" ? "ARS" : "USD";
}

function buildDescription(product: ElitProduct): string {
  const pieces = [
    product.sub_categoria ? `Subcategoria: ${product.sub_categoria}` : null,
    product.garantia ? `Garantia: ${product.garantia}` : null,
    product.ean ? `EAN: ${product.ean}` : null,
  ].filter(Boolean);

  return pieces.join(" - ");
}

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

function formatElitActualizacion(lastUpdatedAt: string | null): string | undefined {
  if (!lastUpdatedAt) return undefined;

  const rawDate = new Date(lastUpdatedAt);
  if (Number.isNaN(rawDate.getTime())) return undefined;

  const safeDate = new Date(rawDate.getTime() - ELIT_DELTA_SAFETY_WINDOW_MINUTES * 60 * 1000);
  const yyyy = safeDate.getUTCFullYear();
  const mm = pad2(safeDate.getUTCMonth() + 1);
  const dd = pad2(safeDate.getUTCDate());
  const hh = pad2(safeDate.getUTCHours());
  const min = pad2(safeDate.getUTCMinutes());

  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function normalizeAttributes(attributes: ElitProduct["atributos"]): Record<string, unknown> {
  if (!Array.isArray(attributes)) {
    return {};
  }

  return attributes.reduce<Record<string, unknown>>((acc, attribute, index) => {
    const label = String(attribute.nombre ?? `atributo_${index + 1}`).trim();
    const value = attribute.valor ?? "";
    if (label) {
      acc[label] = value;
    }
    return acc;
  }, {});
}

function buildElitCatalogRecord(product: ElitProduct): SupplierCatalogRecord {
  const currency = getCurrency(product);
  const cotizacion = parseElitNumber(product.cotizacion ?? 0) || null;
  const sourceCost = parseElitNumber(product.precio ?? 0);
  const comparableUsdCost = currency === "ARS" && cotizacion && cotizacion > 0
    ? Number((sourceCost / cotizacion).toFixed(4))
    : sourceCost;
  const immediateStock = getImmediateStock(product);
  const delayedStock = getDelayedStock(product);
  const totalStock = getTotalStock(product);
  const stockAvailable = getAvailableStock(product);
  const category = [product.categoria, product.sub_categoria].filter(Boolean).join(" / ");

  return {
    supplierName: ELIT_SUPPLIER_NAME,
    supplierExternalId: String(product.id),
    supplierSku: String(product.codigo_producto ?? product.codigo_alfa ?? product.id),
    canonicalSku: String(product.codigo_producto ?? product.codigo_alfa ?? product.id),
    manufacturerPartNumber: product.codigo_alfa || product.codigo_producto || null,
    ean: String(product.ean ?? "").trim() || null,
    brand: String(product.marca ?? "").trim() || null,
    name: product.nombre,
    description: buildDescription(product),
    category: category || "Sin categoria",
    image: Array.isArray(product.imagenes) && product.imagenes.length > 0 ? product.imagenes[0] : "",
    costPrice: comparableUsdCost,
    sourceCostPrice: sourceCost,
    sourceCurrency: currency,
    sourceExchangeRate: cotizacion,
    stockAvailable,
    active: stockAvailable > 0 || sourceCost > 0,
    ivaRate: parseElitNumber(product.iva ?? 21) || 21,
    leadTimeDays: (delayedStock > 0 || (stockAvailable > 0 && immediateStock <= 0)) ? 3 : 0,
    priceMultiplier: 1,
    metadata: {
      elit_brand: product.marca ?? null,
      ean: String(product.ean ?? "").trim() || null,
      elit_link: product.link ?? null,
      elit_nivel_stock: getNivelStock(product) || null,
      elit_stock_total: totalStock,
      elit_stock_cliente: immediateStock,
      elit_stock_cd: delayedStock,
      elit_markup: product.markup ?? null,
      elit_pvp_usd: product.pvp_usd ?? null,
      elit_pvp_ars: product.pvp_ars ?? null,
      elit_last_update: product.actualizado ?? null,
      weight_kg: product.peso ?? null,
      ...normalizeAttributes(product.atributos),
    },
  };
}

export async function syncElitCatalog(
  onProgress?: SupplierSyncProgressCallback,
  userId?: string
): Promise<SupplierSyncProgress> {
  const progress: SupplierSyncProgress = { ...INITIAL, startedAt: new Date().toISOString() };
  const report = (patch: Partial<SupplierSyncProgress>) => {
    Object.assign(progress, patch);
    onProgress?.(progress);
  };

  try {
    report({ phase: "checking" });
    report({ phase: "fetching" });

    const products = await fetchAllElitProducts((offset, total) => {
      report({ page: Math.floor(offset / 100), fetched: total });
    });

    report({ fetched: products.length, phase: "upserting" });
    const records = products.map(buildElitCatalogRecord);
    const result = await syncSupplierCatalogRecords(records, userId, {
      onProgress: (snapshot) => {
        report({
          processed: snapshot.processed,
          total: snapshot.total,
          inserted: snapshot.inserted,
          updated: snapshot.updated,
          skipped: snapshot.skipped,
        });
      },
    });
    const finishedAt = new Date().toISOString();
    const durationSeconds = Math.round((Date.now() - new Date(progress.startedAt!).getTime()) / 1000);

    report({
      phase: "done",
      inserted: result.inserted,
      updated: result.updated,
      skipped: result.skipped,
      errors: result.errors,
      finishedAt,
      durationSeconds,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    report({ phase: "error", errors: [...progress.errors, message] });
  }

  return progress;
}

export async function syncSelectedElitProducts(
  products: ElitProduct[],
  options: {
    forceCreateExternalIds?: string[];
  } = {},
  onProgress?: SupplierSyncProgressCallback,
  userId?: string
): Promise<SupplierSyncProgress> {
  const progress: SupplierSyncProgress = { ...INITIAL, startedAt: new Date().toISOString() };
  const report = (patch: Partial<SupplierSyncProgress>) => {
    Object.assign(progress, patch);
    onProgress?.(progress);
  };

  try {
    report({ phase: "checking" });
    report({ phase: "upserting", fetched: products.length });
    const forceCreateSet = new Set((options.forceCreateExternalIds ?? []).map((id) => String(id).trim()));

    const records = products.map((product) => {
      const record = buildElitCatalogRecord(product);
      if (forceCreateSet.has(record.supplierExternalId)) {
        record.forceCreate = true;
      }
      return record;
    });
    const result = await syncSupplierCatalogRecords(records, userId, {
      existingProductsMode: "price_only",
      onProgress: (snapshot) => {
        report({
          processed: snapshot.processed,
          total: snapshot.total,
          inserted: snapshot.inserted,
          updated: snapshot.updated,
          skipped: snapshot.skipped,
        });
      },
    });
    const finishedAt = new Date().toISOString();
    const durationSeconds = Math.round((Date.now() - new Date(progress.startedAt!).getTime()) / 1000);

    report({
      phase: "done",
      inserted: result.inserted,
      updated: result.updated,
      skipped: result.skipped,
      errors: result.errors,
      finishedAt,
      durationSeconds,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    report({ phase: "error", errors: [...progress.errors, message] });
  }

  return progress;
}

export async function syncElitDelta(
  lastUpdatedAt: string | null,
  onProgress?: SupplierSyncProgressCallback,
  userId?: string
): Promise<SupplierSyncProgress> {
  const progress: SupplierSyncProgress = { ...INITIAL, startedAt: new Date().toISOString() };
  const report = (patch: Partial<SupplierSyncProgress>) => {
    Object.assign(progress, patch);
    onProgress?.(progress);
  };

  try {
    report({ phase: "checking" });
    report({ phase: "fetching" });
    const actualizacion = formatElitActualizacion(lastUpdatedAt);

    const products = await fetchAllElitProducts((offset, total) => {
      report({ page: Math.floor(offset / 100), fetched: total });
    }, actualizacion);

    report({ fetched: products.length, phase: "upserting" });
    const records = products.map(buildElitCatalogRecord);
    const result = await syncSupplierCatalogRecords(records, userId, {
      onProgress: (snapshot) => {
        report({
          processed: snapshot.processed,
          total: snapshot.total,
          inserted: snapshot.inserted,
          updated: snapshot.updated,
          skipped: snapshot.skipped,
        });
      },
    });
    const finishedAt = new Date().toISOString();
    const durationSeconds = Math.round((Date.now() - new Date(progress.startedAt!).getTime()) / 1000);

    report({
      phase: "done",
      inserted: result.inserted,
      updated: result.updated,
      skipped: result.skipped,
      errors: result.errors,
      finishedAt,
      durationSeconds,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    report({ phase: "error", errors: [...progress.errors, message] });
  }

  return progress;
}

export function saveElitLastSync(info: SupplierLastSyncInfo) {
  localStorage.setItem(LAST_SYNC_KEY, JSON.stringify(info));
}

export function getElitLastSync(): SupplierLastSyncInfo | null {
  try {
    const raw = localStorage.getItem(LAST_SYNC_KEY);
    return raw ? (JSON.parse(raw) as SupplierLastSyncInfo) : null;
  } catch {
    return null;
  }
}
