import { fetchInvidArticlesPage, type InvidArticle } from "@/lib/api/invidApi";
import { syncSupplierCatalogRecords, type SupplierCatalogRecord } from "@/lib/api/supplierSync";
import { INVID_FIXED_COST_USD } from "@/lib/pricing";

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

const INVID_SUPPLIER_NAME = "INVID";

function buildInvidCatalogRecord(article: InvidArticle): SupplierCatalogRecord {
  const status = String(article.STOCK_STATUS ?? "").toUpperCase();
  const stockAvailable = status === "STOCK OK" ? 10 : status === "BAJO STOCK" ? 3 : 0;
  const supplierSku = String(article.ID ?? "").trim();
  const partNumber = String(article.PART_NUMBER ?? "").trim() || null;
  const brand = String(article.BRAND ?? "").trim() || null;
  
  // INVID sometimes passes images like "https://example.com/images/ART-001.jpg"
  // According to Swagger: "IMAGE_URL": "https://example.com/images/ART-001.jpg"
  const image = String(article.IMAGE_URL ?? "").trim();
  
  const price = Number(article.PRICE ?? 0);
  const currency = String(article.CURRENCY ?? "ARS").toUpperCase() === "USD" ? "USD" : "ARS";

  return {
    supplierName: INVID_SUPPLIER_NAME,
    supplierExternalId: supplierSku,
    supplierSku: supplierSku,
    canonicalSku: partNumber || supplierSku,
    manufacturerPartNumber: partNumber,
    brand: brand,
    name: String(article.TITLE ?? "").trim(),
    description: String(article.DESCRIPTION ?? "").trim() || null,
    category: String(article.CATEGORY ?? "").trim() || null,
    image: image.startsWith("http") ? image : null,
    costPrice: price,
    sourceCostPrice: price,
    sourceCurrency: currency,
    stockAvailable,
    active: true, // Only returns active anyway
    ivaRate: 21, // default or check if we have data for it
    leadTimeDays: 0,
    priceMultiplier: 1,
    metadata: {
      invid_extra_cost_applied: true,
      invid_extra_cost_usd: INVID_FIXED_COST_USD,
      invid_tags: article.TAGS,
      invid_category_id: article.CATEGORY_ID,
      invid_long_desc: article.LONG_DESCRIPTION,
      dimensions: {
        height: article.HEIGHT,
        width: article.WIDTH,
        length: article.LENGTH,
        volume: article.VOLUME,
        unit: article.DIMENSIONS_UNIT
      },
      weight: {
        value: article.WEIGHT,
        unit: article.WEIGHT_UNIT
      }
    },
  };
}

export async function syncInvidCatalog(
  onProgress?: SyncProgressCallback,
  userId?: string
): Promise<SyncProgress> {
  const progress: SyncProgress = { ...INITIAL, startedAt: new Date().toISOString() };
  const report = (patch: Partial<SyncProgress>) => {
    Object.assign(progress, patch);
    onProgress?.({...progress});
  };

  try {
    report({ phase: "checking" });
    const firstPage = await fetchInvidArticlesPage(0);
    if (!firstPage || firstPage.status === 0) {
      throw new Error(firstPage && "message" in firstPage ? String(firstPage.message) : "Failed to authenticate with INVID API");
    }

    report({ phase: "fetching", page: 1, fetched: (firstPage.data || []).length });
    const records: SupplierCatalogRecord[] = [];
    
    // Process first page
    for (const art of firstPage.data || []) {
      records.push(buildInvidCatalogRecord(art));
    }

    // Fetch rest
    let currentOffset = 100;
    while (true) {
      report({ page: progress.page + 1 });
      const page = await fetchInvidArticlesPage(currentOffset);
      if (!page || !page.data || page.data.length === 0) {
        break; // no more data
      }
      
      for (const art of page.data) {
        records.push(buildInvidCatalogRecord(art));
      }
      
      report({ fetched: records.length });
      currentOffset += 100;
      
      if (!page.next_page_url) {
        break; // last page reached
      }
    }

    report({ phase: "upserting", total: records.length });

    const result = await syncSupplierCatalogRecords(
      records,
      userId,
      {
        existingProductsMode: "full",
        onProgress: (snap) => {
          report({
            processed: snap.processed,
            inserted: snap.inserted,
            updated: snap.updated,
            skipped: snap.skipped,
          });
        },
      }
    );

    report({ phase: "done", ...result });
    return progress;

  } catch (err: any) {
    const errorMsg = err.message || "Unknown error";
    report({ phase: "error", errors: [...progress.errors, errorMsg] });
    return progress;
  } finally {
    if (progress.startedAt && !progress.finishedAt) {
      const now = new Date();
      report({
        finishedAt: now.toISOString(),
        durationSeconds: Math.round((now.getTime() - new Date(progress.startedAt).getTime()) / 1000),
      });
    }
  }
}

export async function syncSelectedInvidProducts(
  articles: InvidArticle[],
  options: { forceCreateExternalIds?: string[] } = {},
  userId?: string
): Promise<void> {
  const records = articles.map((article) => {
    const rec = buildInvidCatalogRecord(article);
    if (options.forceCreateExternalIds?.includes(rec.supplierExternalId)) {
      rec.forceCreate = true;
    }
    return rec;
  });

  await syncSupplierCatalogRecords(records, userId, {
    existingProductsMode: "full",
  });
}
