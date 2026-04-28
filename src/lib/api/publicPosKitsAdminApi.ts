import { supabase } from "@/lib/supabase";
import type { PublicPosKit, PublicPosKitItem } from "./posProductsApi";

export interface AdminPublicPosKit extends PublicPosKit {
  active: boolean;
  sortOrder: number;
}

export interface AdminPublicPosKitInput {
  id?: string;
  name: string;
  description: string;
  stock: number;
  priceUsd: number;
  image: string | null;
  badge: string | null;
  ctaLabel: string;
  whatsappMessage: string | null;
  barposIncluded: boolean;
  items: PublicPosKitItem[];
  active: boolean;
  sortOrder: number;
}

interface PublicPosKitRow {
  id: string;
  name: string;
  description: string | null;
  stock: number | null;
  price_usd: number | string | null;
  image_url: string | null;
  badge: string | null;
  cta_label: string | null;
  whatsapp_message: string | null;
  barpos_included: boolean | null;
  items: unknown;
  active: boolean | null;
  sort_order: number | null;
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function createPublicPosKitId(name: string): string {
  const base = slugify(name);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base || "kit-pos"}-${suffix}`;
}

function parseItems(items: unknown): PublicPosKitItem[] {
  if (!Array.isArray(items)) return [];

  return items.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const raw = item as Record<string, unknown>;
    const name = String(raw.name ?? "").trim();
    if (!name) return [];

    const quantity = Math.max(1, Number(raw.quantity ?? 1));
    return [{
      sku: raw.sku == null || raw.sku === "" ? null : String(raw.sku),
      name,
      category: String(raw.category ?? "Punto de Venta"),
      quantity: Number.isFinite(quantity) ? quantity : 1,
    }];
  });
}

function toAdminKit(row: PublicPosKitRow): AdminPublicPosKit {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    stock: Math.max(0, Number(row.stock ?? 0)),
    priceUsd: Number(row.price_usd ?? 0),
    image: row.image_url,
    badge: row.badge,
    ctaLabel: row.cta_label?.trim() || "Comprar",
    whatsappMessage: row.whatsapp_message,
    barposIncluded: row.barpos_included ?? false,
    items: parseItems(row.items),
    active: row.active ?? true,
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function toRow(input: AdminPublicPosKitInput) {
  return {
    id: input.id ?? createPublicPosKitId(input.name),
    name: input.name.trim(),
    description: input.description.trim(),
    stock: Math.max(0, Number(input.stock ?? 0)),
    price_usd: Number(input.priceUsd),
    image_url: input.image?.trim() || null,
    badge: input.badge?.trim() || null,
    cta_label: input.ctaLabel.trim() || "Comprar",
    whatsapp_message: input.whatsappMessage?.trim() || null,
    barpos_included: input.barposIncluded,
    items: input.items.map((item) => ({
      sku: item.sku?.trim() || null,
      name: item.name.trim(),
      category: item.category.trim() || "Punto de Venta",
      quantity: Math.max(1, Number(item.quantity ?? 1)),
    })),
    active: input.active,
    sort_order: Number(input.sortOrder ?? 0),
  };
}

export async function fetchAdminPublicPosKits(): Promise<AdminPublicPosKit[]> {
  const { data, error } = await supabase
    .from("public_pos_kits")
    .select("id, name, description, stock, price_usd, image_url, badge, cta_label, whatsapp_message, barpos_included, items, active, sort_order")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as PublicPosKitRow[]).map(toAdminKit);
}

export async function upsertAdminPublicPosKit(input: AdminPublicPosKitInput): Promise<AdminPublicPosKit> {
  const row = toRow(input);
  const { data, error } = await supabase
    .from("public_pos_kits")
    .upsert(row, { onConflict: "id" })
    .select("id, name, description, stock, price_usd, image_url, badge, cta_label, whatsapp_message, barpos_included, items, active, sort_order")
    .single();

  if (error) throw new Error(error.message);
  return toAdminKit(data as PublicPosKitRow);
}

export async function deleteAdminPublicPosKit(id: string): Promise<void> {
  const { error } = await supabase.from("public_pos_kits").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
