import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Cache en memoria por proceso (TTL simple) ───────────────
// categories.id is bigint in DB; Supabase returns it as number
const cache = new Map<string, { categoryId: number; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

function cacheKey(supplierId: string, externalCategoryId: string): string {
  return `${supplierId}::${externalCategoryId}`;
}

/**
 * Resuelve el category_id interno dado un proveedor y su categoría externa.
 * Usa la función SQL `resolve_category` con fallback a "uncategorized".
 */
export async function resolveCategory(
  supplierId: string,
  externalCategoryId: string
): Promise<number> {
  const key = cacheKey(supplierId, externalCategoryId);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.categoryId;
  }

  const { data, error } = await supabase.rpc("resolve_category", {
    p_supplier_id: supplierId,
    p_external_category_id: externalCategoryId,
  });

  if (error) {
    throw new Error(`resolve_category RPC failed: ${error.message}`);
  }

  const categoryId = Number(data);
  cache.set(key, { categoryId, expiresAt: Date.now() + CACHE_TTL_MS });
  return categoryId;
}

/**
 * Registra o actualiza un mapping manual en category_mapping.
 */
export async function upsertCategoryMapping(params: {
  supplierId: string;
  externalCategoryId: string;
  externalCategoryName?: string;
  internalCategoryId: number;
  confidence?: "manual" | "auto_high" | "auto_low";
}): Promise<void> {
  const { error } = await supabase.from("category_mapping").upsert(
    {
      supplier_id: params.supplierId,
      external_category_id: params.externalCategoryId,
      external_category_name: params.externalCategoryName,
      internal_category_id: params.internalCategoryId,
      confidence: params.confidence ?? "manual",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "supplier_id,external_category_id" }
  );

  if (error) {
    throw new Error(`upsertCategoryMapping failed: ${error.message}`);
  }

  // Invalidar cache
  cache.delete(cacheKey(params.supplierId, params.externalCategoryId));
}

/**
 * Carga todos los mappings de un proveedor (útil para pre-calentar cache).
 */
export async function loadSupplierMappings(supplierId: string): Promise<void> {
  const { data, error } = await supabase
    .from("category_mapping")
    .select("external_category_id, internal_category_id")
    .eq("supplier_id", supplierId);

  if (error) {
    throw new Error(`loadSupplierMappings failed: ${error.message}`);
  }

  for (const row of data ?? []) {
    const key = cacheKey(supplierId, row.external_category_id);
    cache.set(key, {
      categoryId: Number(row.internal_category_id),
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  }
}
