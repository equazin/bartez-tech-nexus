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
  BundleType,
  DiscountType,
} from "@/models/bundle";

// ── Helpers internos ──────────────────────────────────────────────────────────

const OPTION_SELECT = `
  id, slot_id, product_id, is_default, sort_order, created_at,
  quantity, is_optional, is_replaceable,
  products ( id, name, sku, unit_price, cost_price, stock, image, category )
` as const;

function mapOption(opt: any) {
  return {
    id: opt.id,
    slot_id: opt.slot_id,
    product_id: opt.product_id,
    is_default: opt.is_default,
    sort_order: opt.sort_order,
    created_at: opt.created_at,
    quantity: opt.quantity ?? 1,
    is_optional: opt.is_optional ?? false,
    is_replaceable: opt.is_replaceable ?? false,
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
  };
}

// ── Fetching para el portal cliente ──────────────────────────────────────────

/**
 * Trae todos los bundles activos con slots y opciones enriquecidas.
 * Usado en home, catálogo con filtro "Kits" y CatalogSection bundles context.
 */
export async function fetchActiveBundles(): Promise<BundleWithSlots[]> {
  // Try with deleted_at filter (migration 091). If the column doesn't exist yet,
  // fall back to querying without it so the portal still works.
  let { data: bundles, error: bundlesErr } = await supabase
    .from("product_bundles")
    .select("*")
    .eq("active", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (bundlesErr) {
    // "42703" = column does not exist (migration 091 not applied yet)
    const isMissingColumn = bundlesErr.code === "42703" ||
      bundlesErr.message?.includes("deleted_at");
    if (!isMissingColumn) throw bundlesErr;

    // Retry without deleted_at filter
    const fallback = await supabase
      .from("product_bundles")
      .select("*")
      .eq("active", true)
      .order("created_at", { ascending: false });
    if (fallback.error) throw fallback.error;
    bundles = fallback.data;
  }
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
    .select(OPTION_SELECT)
    .in("slot_id", slotIds)
    .order("sort_order", { ascending: true });

  if (optsErr) throw optsErr;

  const optsBySlot = new Map<string, any[]>();
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
    type: bundle.type ?? "bundle",
    discount_type: bundle.discount_type ?? "percentage",
    slots: (slotsByBundle.get(bundle.id) ?? []).map((slot) => ({
      ...slot,
      options: (optsBySlot.get(slot.id) ?? []).map(mapOption),
    })),
  }));
}

/** Trae un bundle específico con slots y opciones — query directa sin escanear catálogo. */
export async function fetchBundle(id: string): Promise<BundleWithSlots | null> {
  const { data: bundle, error: bundleErr } = await supabase
    .from("product_bundles")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (bundleErr || !bundle) return null;

  const { data: slots, error: slotsErr } = await supabase
    .from("bundle_slots")
    .select("*")
    .eq("bundle_id", id)
    .order("sort_order", { ascending: true });

  if (slotsErr || !slots || slots.length === 0) {
    return { ...bundle, type: bundle.type ?? "bundle", discount_type: bundle.discount_type ?? "percentage", slots: [] };
  }

  const slotIds = slots.map((s) => s.id);

  const { data: options, error: optsErr } = await supabase
    .from("bundle_slot_options")
    .select(OPTION_SELECT)
    .in("slot_id", slotIds)
    .order("sort_order", { ascending: true });

  if (optsErr) return null;

  const optsBySlot = new Map<string, any[]>();
  (options ?? []).forEach((opt) => {
    const list = optsBySlot.get(opt.slot_id) ?? [];
    list.push(opt);
    optsBySlot.set(opt.slot_id, list);
  });

  return {
    ...bundle,
    type: bundle.type ?? "bundle",
    discount_type: bundle.discount_type ?? "percentage",
    slots: slots.map((slot) => ({
      ...slot,
      options: (optsBySlot.get(slot.id) ?? []).map(mapOption),
    })),
  };
}

/** Para el admin: trae todos los bundles (incluyendo inactivos pero excluyendo eliminados). */
export async function fetchAllBundles(): Promise<Bundle[]> {
  let { data, error } = await supabase
    .from("product_bundles")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    const isMissingColumn = error.code === "42703" || error.message?.includes("deleted_at");
    if (!isMissingColumn) throw error;
    const fallback = await supabase
      .from("product_bundles")
      .select("*")
      .order("created_at", { ascending: false });
    if (fallback.error) throw fallback.error;
    data = fallback.data;
  }
  return (data ?? []).map((b) => ({
    ...b,
    type: b.type ?? "bundle",
    discount_type: b.discount_type ?? "percentage",
  }));
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

/** Para el admin: trae opciones de un slot. */
export async function fetchSlotOptions(slotId: string): Promise<BundleSlotOption[]> {
  const { data, error } = await supabase
    .from("bundle_slot_options")
    .select("*")
    .eq("slot_id", slotId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((o) => ({
    ...o,
    quantity: o.quantity ?? 1,
    is_optional: o.is_optional ?? false,
    is_replaceable: o.is_replaceable ?? false,
  }));
}

// ── Mutaciones para el admin ──────────────────────────────────────────────────

type BundleInput = Pick<
  Bundle,
  "title" | "description" | "type" | "slug" | "image_url" |
  "discount_type" | "discount_pct" | "fixed_price" |
  "allows_customization" | "active"
>;

export async function createBundle(input: Partial<BundleInput> & Pick<Bundle, "title">): Promise<Bundle> {
  const { data, error } = await supabase
    .from("product_bundles")
    .insert({
      title: input.title,
      description: input.description ?? null,
      type: input.type ?? "bundle",
      slug: input.slug ?? null,
      image_url: input.image_url ?? null,
      discount_type: input.discount_type ?? "percentage",
      discount_pct: input.discount_pct ?? 0,
      fixed_price: input.fixed_price ?? null,
      allows_customization: input.allows_customization ?? true,
      active: input.active ?? true,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateBundle(id: string, patch: Partial<BundleInput>): Promise<void> {
  const { error } = await supabase
    .from("product_bundles")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

/** Soft-delete: marca deleted_at en lugar de borrar físicamente. */
export async function deleteBundle(id: string): Promise<void> {
  const { error } = await supabase
    .from("product_bundles")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

type SlotInput = Pick<
  BundleSlot,
  "bundle_id" | "label" | "category_id" | "required" | "client_configurable" | "sort_order"
>;

export async function createSlot(input: SlotInput): Promise<BundleSlot> {
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
  patch: Partial<Pick<BundleSlot, "label" | "category_id" | "required" | "client_configurable" | "sort_order">>,
): Promise<void> {
  const { error } = await supabase.from("bundle_slots").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteSlot(id: string): Promise<void> {
  const { error } = await supabase.from("bundle_slots").delete().eq("id", id);
  if (error) throw error;
}

type SlotOptionInput = Pick<
  BundleSlotOption,
  "slot_id" | "product_id" | "is_default" | "sort_order" | "quantity" | "is_optional" | "is_replaceable"
>;

export async function createSlotOption(input: SlotOptionInput): Promise<BundleSlotOption> {
  const { data, error } = await supabase
    .from("bundle_slot_options")
    .insert({
      slot_id: input.slot_id,
      product_id: input.product_id,
      is_default: input.is_default,
      sort_order: input.sort_order,
      quantity: input.quantity ?? 1,
      is_optional: input.is_optional ?? false,
      is_replaceable: input.is_replaceable ?? false,
    })
    .select()
    .single();
  if (error) throw error;
  return { ...data, quantity: data.quantity ?? 1, is_optional: data.is_optional ?? false, is_replaceable: data.is_replaceable ?? false };
}

export async function updateSlotOption(
  id: string,
  patch: Partial<Pick<BundleSlotOption, "is_default" | "sort_order" | "quantity" | "is_optional" | "is_replaceable">>,
): Promise<void> {
  const { error } = await supabase.from("bundle_slot_options").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteSlotOption(id: string): Promise<void> {
  const { error } = await supabase.from("bundle_slot_options").delete().eq("id", id);
  if (error) throw error;
}
