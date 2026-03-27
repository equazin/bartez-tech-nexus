/**
 * Sync script: AIR API → Supabase products
 *
 * Usage:
 *   npx tsx src/lib/suppliers/air/sync.ts
 *   npx tsx src/lib/suppliers/air/sync.ts --dry-run
 *
 * Env vars requeridos:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   AIR_API_URL, AIR_API_USER, AIR_API_PASS
 */

import { config } from "dotenv";
config();

import { createClient } from "@supabase/supabase-js";
import { createAirClient, type AirProduct, type AirRubro, totalDisponible } from "./api";
import {
  loadSupplierMappings,
  resolveCategory,
  upsertCategoryMapping,
} from "../../categoryMapper";

// ─── Config ──────────────────────────────────────────────────
const SUPPLIER_NAME = "AIR";
const DRY_RUN       = process.argv.includes("--dry-run");

let _sb: ReturnType<typeof createClient> | null = null;
const supabase = () => {
  if (!_sb) _sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  return _sb as any;
};

// ─── Logger ──────────────────────────────────────────────────
const log = {
  info:  (msg: string) => console.log(`[INFO]  ${msg}`),
  warn:  (msg: string) => console.warn(`[WARN]  ${msg}`),
  error: (msg: string, err?: unknown) =>
    console.error(`[ERROR] ${msg}`, err instanceof Error ? err.message : err ?? ""),
};

// ─── Helpers ─────────────────────────────────────────────────

async function getSupplierId(): Promise<string> {
  const { data, error } = await supabase()
    .from("suppliers")
    .select("id")
    .ilike("name", SUPPLIER_NAME)
    .single();

  if (error || !data) {
    throw new Error(
      `Supplier "${SUPPLIER_NAME}" no encontrado. Crealo en Supabase primero.`
    );
  }
  return data.id as string;
}

/**
 * Sincroniza el catálogo de rubros/grupos de AIR como category_mapping.
 * Si ya existe un mapping manual lo respeta; si no, lo crea como auto_low.
 */
async function syncCatalogo(supplierId: string, rubros: AirRubro[]): Promise<void> {
  log.info(`Sincronizando catálogo AIR: ${rubros.length} rubros`);

  for (const rubro of rubros) {
    // Intentar resolver el rubro
    const categoryId = await resolveCategory(supplierId, rubro.codigo);

    const { data: existing } = await supabase()
      .from("category_mapping")
      .select("id, confidence")
      .eq("supplier_id", supplierId)
      .eq("external_category_id", rubro.codigo)
      .maybeSingle();

    // Solo crear/actualizar si no existe mapping manual previo
    if (!existing || existing.confidence === "auto_low") {
      if (!DRY_RUN) {
        await upsertCategoryMapping({
          supplierId,
          externalCategoryId:   rubro.codigo,
          externalCategoryName: rubro.nombre,
          internalCategoryId:   categoryId,
          confidence:           "auto_low",
        });
      }
      log.info(`  · Rubro ${rubro.codigo} "${rubro.nombre}" → mapeado (pendiente revisión manual)`);
    }
  }
}

function buildProductPayload(
  product: AirProduct,
  supplierId: string,
  categoryId: string
): Record<string, unknown> {
  return {
    name:          product.descrip.trim(),
    name_original: product.descrip.trim(),
    description:   product.descrip.trim(),
    cost_price:    product.precio,
    iva_rate:      product.impuesto_iva?.alicuota ?? 21,
    stock:         totalDisponible(product),
    sku:           product.part_number || null,
    category_id:   categoryId,
    supplier_uuid: supplierId,
    external_id:   product.codigo,
    active:        product.estado?.id === "P",
    updated_at:    new Date().toISOString(),
  };
}

// ─── Main ─────────────────────────────────────────────────────

async function run(): Promise<void> {
  log.info(`=== AIR Sync${DRY_RUN ? " (DRY RUN)" : ""} ===`);

  const client     = createAirClient();
  const supplierId = await getSupplierId();

  log.info(`Supplier ID: ${supplierId}`);

  // 1. Login
  await client.login();
  log.info("Token obtenido");

  // 2. Sincronizar catálogo de rubros
  const rubros = await client.fetchCatalogo();
  await syncCatalogo(supplierId, rubros);

  // 3. Pre-calentar cache de mappings
  await loadSupplierMappings(supplierId);

  // 4. Sync productos
  let upserted  = 0;
  let skipped   = 0;
  const unmapped: Set<string> = new Set();

  for await (const product of client.fetchAllProducts()) {
    const externalCatId = product.rubro ?? "0";

    let categoryId: string;
    try {
      categoryId = await resolveCategory(supplierId, externalCatId);
    } catch (err) {
      log.error(`resolveCategory falló para ${product.codiart}`, err);
      skipped++;
      continue;
    }

    // Detectar si cayó en fallback "uncategorized"
    const { data: catRow } = await supabase()
      .from("categories")
      .select("slug")
      .eq("id", categoryId)
      .single();

    if (catRow?.slug === "uncategorized") {
      unmapped.add(`${externalCatId} (${product.rubro ?? "sin nombre"})`);
    }

    const payload = buildProductPayload(product, supplierId, categoryId);

    if (DRY_RUN) {
      log.info(`[dry] ${product.codiart} "${product.descrip}" → cat ${categoryId}`);
      continue;
    }

    const { error } = await supabase()
      .from("products")
      .upsert(payload, { onConflict: "external_id" });

    if (error) {
      log.error(`Upsert falló para ${product.codiart}: ${error.message}`);
      skipped++;
    } else {
      upserted++;
      if (upserted % 100 === 0) log.info(`  ${upserted} productos procesados...`);
    }
  }

  log.info("─────────────────────────────────────────");
  log.info(`Upserted : ${upserted}`);
  log.info(`Skipped  : ${skipped}`);

  if (unmapped.size > 0) {
    log.warn(`Rubros sin mapping manual (${unmapped.size}) — revisar en admin:`);
    for (const c of unmapped) log.warn(`  · ${c}`);
  }

  log.info("=== Sync completo ===");
}

run().catch((err) => {
  log.error("Sync falló", err);
  process.exit(1);
});
