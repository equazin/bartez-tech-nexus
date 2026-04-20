import { supabase } from "@/lib/supabase";

export type SupplierSyncType = "catalog" | "delta" | "syp" | "incoming";

export interface SupplierSyncSnapshot {
  type: SupplierSyncType;
  finishedAt: string;
  inserted: number;
  updated: number;
  errors: number;
}

interface SupplierSyncStateRow {
  supplier_name: string;
  last_success_sync_at: string | null;
  last_full_sync_at: string | null;
  last_delta_sync_at: string | null;
  last_sync_meta: Record<string, unknown> | null;
}

function normalizeSupplierName(name: string): string {
  return name.trim().toUpperCase();
}

function readNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getSupplierSyncSnapshot(supplierName: string): Promise<SupplierSyncSnapshot | null> {
  const normalized = normalizeSupplierName(supplierName);
  const { data, error } = await supabase
    .from("supplier_sync_state")
    .select("supplier_name, last_success_sync_at, last_full_sync_at, last_delta_sync_at, last_sync_meta")
    .eq("supplier_name", normalized)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const row = data as SupplierSyncStateRow;
  const meta = (row.last_sync_meta ?? {}) as Record<string, unknown>;
  const finishedAt = row.last_success_sync_at ?? row.last_delta_sync_at ?? row.last_full_sync_at;
  if (!finishedAt) {
    return null;
  }

  return {
    type: String(meta.type ?? "catalog") as SupplierSyncType,
    finishedAt,
    inserted: readNumber(meta.inserted),
    updated: readNumber(meta.updated),
    errors: readNumber(meta.errors),
  };
}

export async function saveSupplierSyncSnapshot(
  supplierName: string,
  snapshot: SupplierSyncSnapshot,
  userId?: string
): Promise<void> {
  const normalized = normalizeSupplierName(supplierName);
  const payload: Record<string, unknown> = {
    supplier_name: normalized,
    last_success_sync_at: snapshot.finishedAt,
    last_sync_meta: {
      type: snapshot.type,
      inserted: snapshot.inserted,
      updated: snapshot.updated,
      errors: snapshot.errors,
      finished_at: snapshot.finishedAt,
    },
  };

  if (snapshot.type === "catalog") {
    payload.last_full_sync_at = snapshot.finishedAt;
  } else {
    payload.last_delta_sync_at = snapshot.finishedAt;
  }

  if (userId) {
    payload.updated_by = userId;
  }

  const { error } = await supabase
    .from("supplier_sync_state")
    .upsert(payload, { onConflict: "supplier_name" });

  if (error) {
    throw new Error(error.message);
  }
}
