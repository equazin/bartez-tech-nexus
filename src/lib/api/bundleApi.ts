/**
 * API de Bundles/Kits — acceso a Supabase.
 * Seguir siempre category_mapping para categorías internas; nunca usar categorías externas.
 */

import { supabase } from "@/lib/supabase";
import type {
  Bundle,
  BundleSlot,
  BundleSlotOption,
  BundleWithSlots,
} from "@/models/bundle";

// ── Fetching para el portal cliente ──────────────────────────────────────────

/**
 * Trae todos los bundles activos con sus slots y opciones enriquecidas con
 * datos del producto (nombre, precio, stock, imagen).
 * Usado en la sección destacada del home y en el catálogo con filtro "Kits".
 */
export async function fetchActiveBundles(): Promise<BundleWithSlots[]> {
  const { data: bundles, error: bundlesErr } = await supabase
    .from("product_bundles")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (bundlesErr) throw bundlesErr;
  if (!bundles || bundles.length === 0) return [];

  const bundleIds = bundles.map((b) => b.id);

  const { data: slots, error: slotsErr } = await supabase
    .from("bundle_slots")
    .select("*")
    .in("bundle_id", bundleIds)
    .order("sort_order", { ascending: true });

  if (slotsErr) throw slotsErr;
  if (!slots || slots.length === 0) {
    return bundles.map((b) => ({ ...b, slots: [] }));
  }

  const slotIds = slots.map((s) => s.id);

  const { data: options, error: optsErr } = await supabase
    .from("bundle_slot_options")
    .select(`
      id,
      slot_id,
      product_id,
      is_default,
      sort_order,
      created_at,
      products (
        id,
        name,
        sku,
        unit_price,
        cost_price,
        stock,
        image,
        category
      )
    `)
    .in("slot_id", slotIds)
    .order("sort_order", { ascending: true });

  if (optsErr) throw optsErr;

  // Reconstruct nested structure
  const optsBySlot = new Map<string, typeof options>( );
  (options ?? []).forEach((opt) => {
    const list = optsBySlot.get(opt.slot_id) ?? [];
    list.push(opt);
    optsBySlot.set(opt.slot_id, list);
  });

  const slotsByBundle = new Map<string, typeof slots>();
  slots.forEach((s) => {
    const list = slotsByBundle.get(s.bundle_id) ?? [];
    list.push(s);
    slotsByBundle.set(s.bundle_id, list);
  });

  return bundles.map((bundle) => ({
    ...bundle,
    slots: (slotsByBundle.get(bundle.id) ?? []).map((slot) => ({
      ...slot,
      options: (optsBySlot.get(slot.id) ?? []).map((opt) => ({
        id: opt.id,
        slot_id: opt.slot_id,
        product_id: opt.product_id,
        is_default: opt.is_default,
        sort_order: opt.sort_order,
        created_at: opt.created_at,
        product: {
          id: (opt.products as any)?.id ?? opt.product_id,
          name: (opt.products as any)?.name ?? "",
          sku: (opt.products as any)?.sku ?? null,
          unit_price: (opt.products as any)?.unit_price ?? 0,
          cost_price: (opt.products as any)?.cost_price ?? null,
          stock: (opt.products as any)?.stock ?? 0,
          image: (opt.products as any)?.image ?? "",
          category: (opt.products as any)?.category ?? "",
        },
      })),
    })),
  }));
}

/** Trae un bundle específico con slots y opciones (portal o admin). */
export async function fetchBundle(id: string): Promise<BundleWithSlots | null> {
  const all = await fetchActiveBundles();
  return all.find((b) => b.id === id) ?? null;
}

/** Para el admin: trae todos los bundles (incluyendo inactivos). */
export async function fetchAllBundles(): Promise<Bundle[]> {
  const { data, error } = await supabase
    .from("product_bundles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/** Para el admin: trae slots de un bundle específico. */
export async function fetchBundleSlots(bundleId: string): Promise<BundleSlot[]> {
  const { data, error } = await supabase
    .from("bundle_slots")
    .select("*")
    .eq("bundle_id", bundleId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/** Para el admin: trae opciones de un slot con datos de producto. */
export async function fetchSlotOptions(slotId: string): Promise<BundleSlotOption[]> {
  const { data, error } = await supabase
    .from("bundle_slot_options")
    .select("*")
    .eq("slot_id", slotId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// ── Mutaciones para el admin ──────────────────────────────────────────────────

export async function createBundle(
  input: Pick<Bundle, "title" | "description" | "discount_pct" | "allows_customization" | "active">
): Promise<Bundle> {
  const { data, error } = await supabase
    .from("product_bundles")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateBundle(
  id: string,
  patch: Partial<Pick<Bundle, "title" | "description" | "discount_pct" | "allows_customization" | "active">>
): Promise<void> {
  const { error } = await supabase
    .from("product_bundles")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteBundle(id: string): Promise<void> {
  const { error } = await supabase
    .from("product_bundles")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function createSlot(
  input: Pick<BundleSlot, "bundle_id" | "label" | "category_id" | "required" | "client_configurable" | "sort_order">
): Promise<BundleSlot> {
  const { data, error } = await supabase
    .from("bundle_slots")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSlot(
  id: string,
  patch: Partial<Pick<BundleSlot, "label" | "category_id" | "required" | "client_configurable" | "sort_order">>
): Promise<void> {
  const { error } = await supabase
    .from("bundle_slots")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteSlot(id: string): Promise<void> {
  const { error } = await supabase
    .from("bundle_slots")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function createSlotOption(
  input: Pick<BundleSlotOption, "slot_id" | "product_id" | "is_default" | "sort_order">
): Promise<BundleSlotOption> {
  const { data, error } = await supabase
    .from("bundle_slot_options")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSlotOption(
  id: string,
  patch: Partial<Pick<BundleSlotOption, "is_default" | "sort_order">>
): Promise<void> {
  const { error } = await supabase
    .from("bundle_slot_options")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteSlotOption(id: string): Promise<void> {
  const { error } = await supabase
    .from("bundle_slot_options")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
