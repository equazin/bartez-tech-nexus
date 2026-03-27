/**
 * Servicio de sincronización AIR → Supabase
 *
 * Estrategia de upsert:
 *   - PRIMER SYNC (producto nuevo): inserta todos los campos (nombre, categoría, precio, stock, imagen)
 *   - SYNCS POSTERIORES (producto existente): solo actualiza cost_price, stock, active
 *     → El admin puede editar nombre y categoría sin que se sobreescriban en el próximo sync
 */

import { supabase } from "@/lib/supabase";
import {
  fetchAllAirProducts,
  fetchAllAirSyp,
  normalizeAirProduct,
  checkAirToken,
  type AirProduct,
  type AirSyp,
} from "@/lib/api/airApi";
import { recordPriceChange } from "@/lib/api/priceHistory";

export interface SyncProgress {
  phase: "idle" | "checking" | "fetching" | "upserting" | "done" | "error";
  page: number;
  fetched: number;
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
  inserted: 0,
  updated: 0,
  skipped: 0,
  errors: [],
};

// ── Sync completo de catálogo ────────────────────────────────────────────────

/**
 * Sincroniza el catálogo completo de AIR con Supabase.
 * - Productos nuevos: inserta todos los campos
 * - Productos existentes (por sku/external_id): solo actualiza precio, stock, active
 */
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
    // 1. Verificar token
    report({ phase: "checking" });
    await checkAirToken();

    // 2. Obtener todos los SKUs existentes en Supabase
    report({ phase: "fetching" });
    const { data: existingRows } = await supabase
      .from("products")
      .select("id, sku, cost_price")
      .not("sku", "is", null);

    const existingBySku = new Map<string, { id: number; cost_price: number }>();
    for (const row of existingRows ?? []) {
      if (row.sku) existingBySku.set(String(row.sku).toUpperCase(), row);
    }

    // 3. Bajar todos los productos de AIR
    const airProducts = await fetchAllAirProducts((page, total) => {
      report({ page, fetched: total });
    });
    report({ fetched: airProducts.length, phase: "upserting" });

    // 4. Procesar en lotes de 100
    const BATCH = 100;
    for (let i = 0; i < airProducts.length; i += BATCH) {
      const batch = airProducts.slice(i, i + BATCH);
      await processBatch(batch, existingBySku, progress, userId);
      report({
        inserted: progress.inserted,
        updated: progress.updated,
        skipped: progress.skipped,
        errors: progress.errors,
      });
    }

    const finishedAt = new Date().toISOString();
    const started = new Date(progress.startedAt!).getTime();
    const durationSeconds = Math.round((Date.now() - started) / 1000);

    report({ phase: "done", finishedAt, durationSeconds });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    report({ phase: "error", errors: [...progress.errors, msg] });
  }

  return progress;
}

async function processBatch(
  batch: AirProduct[],
  existingBySku: Map<string, { id: number; cost_price: number }>,
  progress: SyncProgress,
  userId?: string
) {
  const toInsert: Record<string, unknown>[] = [];
  const toUpdate: { id: number; sku: string; cost_price: number; stock: number; active: boolean; old_price: number }[] = [];

  for (const p of batch) {
    const normalized = normalizeAirProduct(p);
    const sku = String(normalized.sku ?? "").toUpperCase();
    if (!sku) { progress.skipped++; continue; }

    const existing = existingBySku.get(sku);
    const newPrice = normalized.cost_price as number;
    const newStock = normalized.stock as number;
    const isActive = normalized.active as boolean;

    if (!existing) {
      // Producto nuevo → insertar con todos los campos
      toInsert.push(normalized);
    } else {
      // Producto existente → solo actualizar campos operacionales
      toUpdate.push({
        id: existing.id,
        sku,
        cost_price: newPrice,
        stock: newStock,
        active: isActive,
        old_price: existing.cost_price,
      });
    }
  }

  // Insertar nuevos
  if (toInsert.length > 0) {
    const { error } = await supabase.from("products").insert(toInsert);
    if (error) {
      progress.errors.push(`Insert error: ${error.message}`);
    } else {
      progress.inserted += toInsert.length;
    }
  }

  // Actualizar existentes (solo precio, stock, active)
  for (const u of toUpdate) {
    const { error } = await supabase
      .from("products")
      .update({
        cost_price: u.cost_price,
        stock: u.stock,
        active: u.active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", u.id);

    if (error) {
      progress.errors.push(`Update ${u.sku}: ${error.message}`);
      progress.skipped++;
    } else {
      progress.updated++;
      // Registrar cambio de precio si varió
      if (u.old_price !== u.cost_price && u.old_price > 0) {
        recordPriceChange({
          product_id: u.id,
          old_price: u.old_price,
          new_price: u.cost_price,
          change_reason: "AIR sync",
          changed_by: userId,
        });
      }
    }
  }
}

// ── Sync rápido de stock + precio (SYP) ─────────────────────────────────────

/**
 * Sync rápido: solo actualiza stock y precio usando el endpoint /syp.
 * No toca nombre ni categoría. Más liviano que el sync completo.
 */
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
    report({ phase: "checking" });
    await checkAirToken();

    // Obtener mapa sku→id de Supabase
    report({ phase: "fetching" });
    const { data: existingRows } = await supabase
      .from("products")
      .select("id, sku, cost_price")
      .not("sku", "is", null);

    const existingBySku = new Map<string, { id: number; cost_price: number }>();
    for (const row of existingRows ?? []) {
      if (row.sku) existingBySku.set(String(row.sku).toUpperCase(), row);
    }

    // Bajar todos los SYP
    const allSyp = await fetchAllAirSyp((page, total) => {
      report({ page, fetched: total });
    });
    report({ fetched: allSyp.length, phase: "upserting" });

    for (const s of allSyp) {
      const sku = String(s.codigo ?? "").toUpperCase();
      const existing = existingBySku.get(sku);
      if (!existing) { progress.skipped++; continue; }

      const newPrice = s.precio ?? 0;
      const rosStock = s.ros?.disponible ?? 0;
      const lugStock = s.lug?.disponible ?? 0;
      const newStock = rosStock;

      const lugSpecs = lugStock > 0 ? { lug_stock: String(lugStock) } : {};

      const { error } = await supabase
        .from("products")
        .update({
          cost_price: newPrice,
          stock: newStock,
          specs: lugSpecs,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (error) {
        progress.errors.push(`SYP ${sku}: ${error.message}`);
        progress.skipped++;
      } else {
        progress.updated++;
        if (existing.cost_price !== newPrice && existing.cost_price > 0) {
          recordPriceChange({
            product_id: existing.id,
            old_price: existing.cost_price,
            new_price: newPrice,
            change_reason: "AIR syp sync",
            changed_by: userId,
          });
        }
      }
    }

    const finishedAt = new Date().toISOString();
    const durationSeconds = Math.round(
      (Date.now() - new Date(progress.startedAt!).getTime()) / 1000
    );
    report({ phase: "done", finishedAt, durationSeconds });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    report({ phase: "error", errors: [...progress.errors, msg] });
  }

  return progress;
}

// ── Última sync ───────────────────────────────────────────────────────────────

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
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
