import { fetchAllAirProducts, fetchAllAirSyp, type AirProduct, type AirSyp } from "@/lib/api/airApi";
import { syncSupplierCatalogRecords, type SupplierCatalogRecord } from "@/lib/api/supplierSync";

export interface SyncProgress {
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

export type SyncProgressCallback = (p: SyncProgress) => void;

const INITIAL: SyncProgress = {
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

const AIR_SUPPLIER_NAME = "AIR";

function buildAirCatalogRecord(product: AirProduct): SupplierCatalogRecord {
  const stockAvailable = product.ros?.disponible ?? 0;
  const lugStock = product.lug?.disponible ?? 0;
  const partNumber = String(product.part_number ?? "").trim() || null;
  const sku = String(product.codigo ?? "").trim();

  return {
    supplierName: AIR_SUPPLIER_NAME,
    supplierExternalId: sku,
    supplierSku: sku,
    canonicalSku: partNumber || sku,
    manufacturerPartNumber: partNumber,
    brand: String(product.grupo ?? "").trim() || null,
    name: String(product.descrip ?? "").trim(),
    description: partNumber
      ? `Part#: ${partNumber}`
      : "",
    category: product.rubro ?? "Sin categoria",
    image: "",
    costPrice: Number(product.precio ?? 0),
    stockAvailable,
    active: product.estado?.id === "P",
    ivaRate: Number(product.impuesto_iva?.alicuota ?? 21),
    leadTimeDays: lugStock > 0 && stockAvailable <= 0 ? 3 : 0,
    priceMultiplier: 1,
    metadata: {
      ...(lugStock > 0 ? { lug_stock: String(lugStock) } : {}),
      air_group: String(product.grupo ?? "").trim() || null,
      air_rubro: String(product.rubro ?? "").trim() || null,
      air_part_number: partNumber,
    },
  };
}

function buildAirSypRecord(entry: AirSyp): SupplierCatalogRecord {
  const supplierExternalId = String(entry.codigo ?? "").trim();
  const rosStock = entry.ros?.disponible ?? entry.stock ?? 0;
  const lugStock = entry.lug?.disponible ?? 0;

  return {
    supplierName: AIR_SUPPLIER_NAME,
    supplierExternalId,
    supplierSku: supplierExternalId,
    canonicalSku: supplierExternalId,
    manufacturerPartNumber: null,
    name: supplierExternalId,
    costPrice: Number(entry.precio ?? 0),
    stockAvailable: Number(rosStock ?? 0),
    active: true,
    leadTimeDays: lugStock > 0 && Number(rosStock ?? 0) <= 0 ? 3 : 0,
    metadata: lugStock > 0 ? { lug_stock: String(lugStock) } : undefined,
  };
}

export async function syncAirCatalog(
  onProgress?: SyncProgressCallback,
  userId?: string
): Promise<SyncProgress> {
  const progress: SyncProgress = { ...INITIAL, startedAt: new Date().toISOString() };
  const report = (patch: Partial<SyncProgress>) => {
    Object.assign(progress, patch);
    onProgress?.(progress);
  };

  try {
    report({ phase: "fetching" });
    const airProducts = await fetchAllAirProducts((page, total) => {
      report({ page, fetched: total });
    });

    report({ fetched: airProducts.length, phase: "upserting" });
    const records = airProducts
      .map(buildAirCatalogRecord)
      .filter((record) => record.supplierExternalId && record.costPrice >= 0);

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

export async function syncSelectedAirProducts(
  products: AirProduct[],
  options: {
    forceCreateExternalIds?: string[];
  } = {},
  onProgress?: SyncProgressCallback,
  userId?: string
): Promise<SyncProgress> {
  const progress: SyncProgress = { ...INITIAL, startedAt: new Date().toISOString() };
  const report = (patch: Partial<SyncProgress>) => {
    Object.assign(progress, patch);
    onProgress?.(progress);
  };

  try {
    report({ phase: "upserting", fetched: products.length });
    const forceCreateSet = new Set((options.forceCreateExternalIds ?? []).map((id) => String(id).trim()));
    const records = products
      .map((product) => {
        const record = buildAirCatalogRecord(product);
        if (forceCreateSet.has(record.supplierExternalId)) {
          record.forceCreate = true;
        }
        return record;
      })
      .filter((record) => record.supplierExternalId && record.costPrice >= 0);

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

export async function syncAirPricesStock(
  onProgress?: SyncProgressCallback,
  userId?: string
): Promise<SyncProgress> {
  const progress: SyncProgress = { ...INITIAL, startedAt: new Date().toISOString() };
  const report = (patch: Partial<SyncProgress>) => {
    Object.assign(progress, patch);
    onProgress?.(progress);
  };

  try {
    report({ phase: "fetching" });
    const allSyp = await fetchAllAirSyp((page, total) => {
      report({ page, fetched: total });
    });

    report({ fetched: allSyp.length, phase: "upserting" });
    const records = allSyp
      .map(buildAirSypRecord)
      .filter((record) => record.supplierExternalId);

    const result = await syncSupplierCatalogRecords(records, userId, {
      createMissingProducts: false,
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

const LAST_SYNC_KEY = "air_last_sync";

export interface LastSyncInfo {
  type: "catalog" | "syp";
  finishedAt: string;
  inserted: number;
  updated: number;
  errors: number;
}

export function saveLastSync(info: LastSyncInfo): void {
  localStorage.setItem(LAST_SYNC_KEY, JSON.stringify(info));
}

export function getLastSync(): LastSyncInfo | null {
  try {
    const raw = localStorage.getItem(LAST_SYNC_KEY);
    return raw ? (JSON.parse(raw) as LastSyncInfo) : null;
  } catch {
    return null;
  }
}
