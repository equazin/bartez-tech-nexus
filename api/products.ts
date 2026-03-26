import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fail, methodNotAllowed, ok, parsePagination } from "./_shared/http";
import { ensureWriteRole } from "./_shared/roles";
import { getSupabaseClient } from "./_shared/supabaseServer";

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
    const sku = req.query.sku ? String(req.query.sku) : undefined;
    const active = req.query.active ? String(req.query.active) : undefined;

    let query = supabase
      .from("products")
      .select("*")
      .order("category")
      .order("name")
      .range(offset, offset + limit - 1);

    if (category) query = query.eq("category", category);
    if (sku) query = query.eq("sku", sku);
    if (active === "true" || active === "false") query = query.eq("active", active === "true");

    const { data, error } = await query;
    if (error) return fail(res, error.message, 500);
    return ok(res, data ?? []);
  } catch (error) {
    return fail(res, (error as Error).message, 500);
  }
}

async function createProduct(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabaseClient(req);
    if (!(await ensureWriteRole(req, res, supabase))) return;

    const body = req.body ?? {};
    if (!body.name || !body.category || body.cost_price == null || body.stock == null) {
      return fail(res, "Missing required fields: name, category, cost_price, stock");
    }

    const costPrice = Number(body.cost_price);
    const stock = Number(body.stock);
    const stockMin = body.stock_min != null ? Number(body.stock_min) : null;
    const supplierId = body.supplier_id != null ? Number(body.supplier_id) : null;

    if (!Number.isFinite(costPrice) || costPrice <= 0) {
      return fail(res, "cost_price must be a positive number");
    }
    if (!Number.isFinite(stock) || stock < 0) {
      return fail(res, "stock must be a positive number");
    }
    if (stockMin != null && (!Number.isFinite(stockMin) || stockMin < 0)) {
      return fail(res, "stock_min must be a positive number");
    }
    if (supplierId != null && (!Number.isFinite(supplierId) || supplierId <= 0)) {
      return fail(res, "supplier_id must be a positive number");
    }

    const payload = {
      name: String(body.name),
      category: String(body.category),
      cost_price: costPrice,
      stock,
      description: String(body.description ?? ""),
      image: String(body.image ?? ""),
      sku: body.sku ? String(body.sku) : null,
      active: body.active ?? true,
      stock_min: stockMin,
      supplier_id: supplierId,
      supplier_uuid: body.supplier_uuid ? String(body.supplier_uuid) : null,
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
