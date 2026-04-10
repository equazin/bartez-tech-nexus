import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fail, methodNotAllowed, ok, parsePagination } from "./_shared/http.js";
import { ensureWriteRole } from "./_shared/roles.js";
import { createProductSchema } from "./_shared/schemas.js";
import { getSupabaseClient } from "./_shared/supabaseServer.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") return listProducts(req, res);
  if (req.method === "POST") return createProduct(req, res);
  return methodNotAllowed(res, ["GET", "POST"]);
}

async function listProducts(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabaseClient(req);
    const { limit, offset } = parsePagination(req);
    const category = req.query.category ? String(req.query.category) : undefined;
    const sku      = req.query.sku      ? String(req.query.sku)      : undefined;
    const active   = req.query.active   ? String(req.query.active)   : undefined;
    const search   = req.query.search   ? String(req.query.search).trim() : undefined;
    // public=true → only return name/image/category/sku (no cost_price) for unauthenticated catalog
    const isPublic = req.query.public === "true";

    const selectFields = isPublic
      ? "id, name, category, sku, image, active, stock, brand"
      : "*";

    let query = supabase
      .from("products")
      .select(selectFields, { count: "exact" })
      .order("category")
      .order("name")
      .range(offset, offset + limit - 1);

    if (category) query = query.eq("category", category);
    if (sku)      query = query.eq("sku", sku);
    if (active === "true" || active === "false") query = query.eq("active", active === "true");

    // Full-text search across name and sku using ilike (Supabase Postgres)
    if (search) {
      query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) return fail(res, error.message, 500);

    return ok(res, { items: data ?? [], total: count ?? 0, limit, offset });
  } catch (error) {
    return fail(res, (error as Error).message, 500);
  }
}

async function createProduct(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabaseClient(req);
    if (!(await ensureWriteRole(req, res, supabase))) return;

    const parsed = createProductSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return fail(res, "Invalid product payload", 400, parsed.error.flatten());
    }

    const body = parsed.data;
    const payload = {
      name: body.name,
      category: body.category,
      cost_price: body.cost_price,
      stock: body.stock,
      description: body.description ?? "",
      image: body.image ?? "",
      sku: body.sku ?? null,
      active: body.active ?? true,
      stock_min: body.stock_min ?? null,
      supplier_id: body.supplier_id ?? null,
      supplier_uuid: body.supplier_uuid ?? null,
    };

    const { data, error } = await supabase
      .from("products")
      .insert(payload)
      .select("*")
      .single();

    if (error) return fail(res, error.message, 500);
    return ok(res, data, 201);
  } catch (error) {
    return fail(res, (error as Error).message, 500);
  }
}
