/**
 * Sync script: AIR API → Supabase products
 *
 * Usage:
 *   npx tsx src/lib/suppliers/air/sync.ts
 *   npx tsx src/lib/suppliers/air/sync.ts --dry-run
 */

import { createClient } from "@supabase/supabase-js";
import { createAirClient, type AirProduct } from "./api";
import {
  loadSupplierMappings,
  resolveCategory,
  upsertCategoryMapping,
} from "../../categoryMapper";

// ─── Config ──────────────────────────────────────────────────
const SUPPLIER_SLUG = "air";
const DRY_RUN = process.argv.includes("--dry-run");

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Logger ──────────────────────────────────────────────────
const log = {
  info:  (msg: string) => console.log(`[INFO]  ${msg}`),
  warn:  (msg: string) => console.warn(`[WARN]  ${msg}`),
  error: (msg: string, err?: unknown) =>
    console.error(`[ERROR] ${msg}`, err ?? ""),
};

// ─── Helpers ─────────────────────────────────────────────────
async function getSupplierIdBySlug(slug: string): Promise<string> {
  const { data, error } = await supabase
    .from("suppliers")
    .select("id")
    .ilike("name", slug)
    .single();

  if (error || !data) {
    throw new Error(
      `Supplier "${slug}" not found in DB. Create it first or check the name.`
    );
  }
  return data.id as string;
}

function mapAirProductToDb(
  product: AirProduct,
  supplierId: string,
  categoryId: string
): Record<string, unknown> {
  return {
    name:          product.name,
    description:   product.description,
    cost_price:    product.price,
    stock:         product.stock,
    category_id:   categoryId,
    supplier_uuid: supplierId,
    external_id:   product.product_id,
    active:        true,
    updated_at:    new Date().toISOString(),
  };
}

// ─── Main ─────────────────────────────────────────────────────
async function run(): Promise<void> {
  log.info(`Starting AIR sync${DRY_RUN ? " (DRY RUN)" : ""}`);

  const supplierId = await getSupplierIdBySlug(SUPPLIER_SLUG);
  log.info(`Supplier ID: ${supplierId}`);

  // Pre-calentar cache de mappings conocidos
  await loadSupplierMappings(supplierId);

  const client = createAirClient();

  let inserted = 0;
  let updated  = 0;
  let skipped  = 0;
  const unmapped: string[] = [];

  for await (const product of client.fetchAllProducts()) {
    let categoryId: string;

    try {
      categoryId = await resolveCategory(supplierId, product.category_id);
    } catch (err) {
      log.error(`Failed to resolve category for product ${product.product_id}`, err);
      skipped++;
      continue;
    }

    // Registrar categoría nueva automáticamente como auto_low si no existe
    // (sin mapping manual previo → se detecta porque resolve_category devuelve uncategorized)
    const { data: existingMapping } = await supabase
      .from("category_mapping")
      .select("id")
      .eq("supplier_id", supplierId)
      .eq("external_category_id", product.category_id)
      .maybeSingle();

    if (!existingMapping) {
      unmapped.push(`${product.category_id} (${product.category_name})`);
      // Guardar para revisión posterior con confidence=auto_low
      if (!DRY_RUN) {
        await upsertCategoryMapping({
          supplierId,
          externalCategoryId:   product.category_id,
          externalCategoryName: product.category_name,
          internalCategoryId:   categoryId, // fallback "uncategorized"
          confidence:           "auto_low",
        });
      }
    }

    const payload = mapAirProductToDb(product, supplierId, categoryId);

    if (DRY_RUN) {
      log.info(`[dry] Would upsert: ${product.name} → category_id ${categoryId}`);
      continue;
    }

    const { error, data: upserted } = await supabase
      .from("products")
      .upsert(payload, { onConflict: "external_id" })
      .select("id")
      .single();

    if (error) {
      log.error(`Failed to upsert product ${product.product_id}: ${error.message}`);
      skipped++;
    } else if (upserted) {
      // Distinguir insert vs update por si el id ya existía
      inserted++;
    }
  }

  log.info(`─── Sync complete ───────────────────────`);
  log.info(`Inserted/Updated : ${inserted}`);
  log.info(`Skipped (errors) : ${skipped}`);
  if (unmapped.length > 0) {
    log.warn(`Unmapped categories (auto_low, need manual review):`);
    [...new Set(unmapped)].forEach((c) => log.warn(`  · ${c}`));
  }
}

run().catch((err) => {
  log.error("Sync failed", err);
  process.exit(1);
});
