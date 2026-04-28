import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fail, methodNotAllowed, ok } from "./_shared/http.js";
import { MANUAL_PUBLIC_POS_KITS, type ManualPublicPosKit } from "./_shared/manualPosKits.js";
import { getSupabaseClient } from "./_shared/supabaseServer.js";

type CategoryRow = {
  id: number;
  name: string;
  slug: string | null;
  parent_id: number | null;
};

type PosProductRow = {
  id: number;
  sku: string | null;
  name: string;
  category: string | null;
  brand_name: string | null;
  image: string | null;
  stock: number | null;
  stock_reserved: number | null;
  cost_price: number | null;
  supplier_multiplier: number | null;
  special_price: number | null;
  offer_percent: number | null;
  iva_rate: number | null;
  active: boolean | null;
};

type PublicPosProduct = {
  id: number;
  sku: string | null;
  name: string;
  category: string;
  brand: string | null;
  image: string | null;
  stock: number;
  priceUsd: number;
  ivaRate: number;
};

type PublicPosKitItem = {
  sku: string | null;
  name: string;
  category: string;
  quantity: number;
};

type PublicPosKit = {
  id: string;
  name: string;
  description: string;
  image: string | null;
  badge: string | null;
  ctaLabel: string;
  whatsappMessage: string | null;
  barposIncluded: boolean;
  items: PublicPosKitItem[];
  priceUsd: number;
  stock: number;
};

type PublicPosKitRow = {
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
};

const DEFAULT_PUBLIC_POS_MARGIN_PCT = 25;

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isPosRoot(category: CategoryRow): boolean {
  const name = normalizeText(category.name);
  const slug = normalizeText(category.slug);
  return slug === "pos" || name.includes("punto de venta") || /\bpos\b/.test(name);
}

function getPublicMarginPct(): number {
  const configuredValue = process.env.PUBLIC_POS_MARGIN_PCT?.trim();
  if (!configuredValue) return DEFAULT_PUBLIC_POS_MARGIN_PCT;

  const raw = Number(configuredValue);
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_PUBLIC_POS_MARGIN_PCT;
}

function calculatePublicPriceUsd(product: PosProductRow, marginPct: number): number {
  const baseCost = Number(product.cost_price ?? 0);
  const multiplier = Number(product.supplier_multiplier ?? 1);
  const safeMultiplier = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
  const listPrice = baseCost * safeMultiplier * (1 + marginPct / 100);

  let finalPrice = listPrice;
  const specialPrice = Number(product.special_price ?? 0);
  if (specialPrice > 0 && specialPrice < finalPrice) {
    finalPrice = specialPrice;
  }

  const offerPercent = Number(product.offer_percent ?? 0);
  if (offerPercent > 0 && offerPercent < 100) {
    const offerPrice = finalPrice * (1 - offerPercent / 100);
    if (offerPrice > 0 && offerPrice < finalPrice) {
      finalPrice = offerPrice;
    }
  }

  return Number(finalPrice.toFixed(2));
}

function getAvailableStock(product: PosProductRow): number {
  return Math.max(0, Number(product.stock ?? 0) - Number(product.stock_reserved ?? 0));
}

function toPublicProduct(product: PosProductRow, marginPct: number): PublicPosProduct | null {
  const priceUsd = calculatePublicPriceUsd(product, marginPct);
  if (!Number.isFinite(priceUsd) || priceUsd <= 0) return null;

  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    category: product.category ?? "Punto de Venta",
    brand: product.brand_name,
    image: product.image,
    stock: getAvailableStock(product),
    priceUsd,
    ivaRate: Number(product.iva_rate ?? 21),
  };
}

function byPriceAsc(left: PublicPosProduct, right: PublicPosProduct): number {
  return left.priceUsd - right.priceUsd || left.name.localeCompare(right.name, "es-AR");
}

function toPublicKit(kit: ManualPublicPosKit): PublicPosKit | null {
  const priceUsd = Number(kit.priceUsd);
  if (!kit.id || !kit.name || !Number.isFinite(priceUsd) || priceUsd <= 0 || kit.items.length === 0) {
    return null;
  }

  return {
    id: kit.id,
    name: kit.name,
    description: kit.description,
    image: kit.image,
    badge: kit.badge,
    ctaLabel: kit.ctaLabel,
    whatsappMessage: kit.whatsappMessage,
    barposIncluded: kit.barposIncluded,
    stock: Math.max(0, Number(kit.stock ?? 0)),
    priceUsd: Number(priceUsd.toFixed(2)),
    items: kit.items.map((item) => ({
      sku: item.sku,
      name: item.name,
      category: item.category,
      quantity: Math.max(1, Number(item.quantity ?? 1)),
    })),
  };
}

function getManualPublicKits(): PublicPosKit[] {
  return MANUAL_PUBLIC_POS_KITS.map(toPublicKit).filter((kit): kit is PublicPosKit => kit !== null);
}

function parseKitItems(items: unknown): PublicPosKitItem[] {
  if (!Array.isArray(items)) return [];

  return items.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const value = item as Record<string, unknown>;
    const name = String(value.name ?? "").trim();
    if (!name) return [];

    const quantity = Math.max(1, Number(value.quantity ?? 1));
    return [{
      sku: value.sku == null || value.sku === "" ? null : String(value.sku),
      name,
      category: String(value.category ?? "Punto de Venta"),
      quantity: Number.isFinite(quantity) ? quantity : 1,
    }];
  });
}

function toPublicKitFromRow(row: PublicPosKitRow): PublicPosKit | null {
  const priceUsd = Number(row.price_usd ?? 0);
  const items = parseKitItems(row.items);
  if (!row.id || !row.name || !Number.isFinite(priceUsd) || priceUsd <= 0 || items.length === 0) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    image: row.image_url,
    badge: row.badge,
    ctaLabel: row.cta_label?.trim() || "Comprar",
    whatsappMessage: row.whatsapp_message,
    barposIncluded: row.barpos_included ?? false,
    stock: Math.max(0, Number(row.stock ?? 0)),
    priceUsd: Number(priceUsd.toFixed(2)),
    items,
  };
}

async function getPublicKits(supabase: SupabaseClient): Promise<PublicPosKit[]> {
  const { data, error } = await supabase
    .from("public_pos_kits")
    .select("id, name, description, stock, price_usd, image_url, badge, cta_label, whatsapp_message, barpos_included, items, active, sort_order")
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.warn("[pos-products] Falling back to manual POS kits:", error.message);
    return getManualPublicKits();
  }

  return ((data ?? []) as PublicPosKitRow[])
    .map(toPublicKitFromRow)
    .filter((kit): kit is PublicPosKit => kit !== null);
}

async function getPosCategoryNames(categories: CategoryRow[]): Promise<string[]> {
  const byParent = new Map<number | null, CategoryRow[]>();
  for (const category of categories) {
    const list = byParent.get(category.parent_id) ?? [];
    list.push(category);
    byParent.set(category.parent_id, list);
  }

  const categoryIds = new Set<number>();
  for (const root of categories.filter(isPosRoot)) {
    const stack = [root.id];
    while (stack.length > 0) {
      const currentId = stack.pop();
      if (currentId == null || categoryIds.has(currentId)) continue;

      categoryIds.add(currentId);
      for (const child of byParent.get(currentId) ?? []) {
        stack.push(child.id);
      }
    }
  }

  return categories
    .filter((category) => categoryIds.has(category.id))
    .map((category) => category.name);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  try {
    const supabase = getSupabaseClient(req);
    const marginPct = getPublicMarginPct();
    const kitsPromise = getPublicKits(supabase);

    const { data: categories, error: categoriesError } = await supabase
      .from("categories")
      .select("id, name, slug, parent_id")
      .order("name");

    if (categoriesError) return fail(res, categoriesError.message, 500);

    const posCategoryNames = await getPosCategoryNames((categories ?? []) as CategoryRow[]);
    if (posCategoryNames.length === 0) {
      return ok(res, { products: [], kits: await kitsPromise, meta: { marginPct, count: 0 } });
    }

    const { data: rows, error: productsError } = await supabase
      .from("portal_products")
      .select(
        "id, sku, name, category, brand_name, image, stock, stock_reserved, cost_price, supplier_multiplier, special_price, offer_percent, iva_rate, active",
      )
      .eq("active", true)
      .in("category", posCategoryNames)
      .order("category")
      .order("name")
      .limit(80);

    if (productsError) return fail(res, productsError.message, 500);

    const products = ((rows ?? []) as PosProductRow[])
      .map((product) => toPublicProduct(product, marginPct))
      .filter((product): product is PublicPosProduct => product !== null)
      .sort((left, right) => left.category.localeCompare(right.category, "es-AR") || byPriceAsc(left, right));

    return ok(res, {
      products,
      kits: await kitsPromise,
      meta: { marginPct, count: products.length },
    });
  } catch (error) {
    return fail(res, error instanceof Error ? error.message : "No se pudo cargar Punto de Venta.", 500);
  }
}
