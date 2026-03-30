import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fail, methodNotAllowed, ok, parsePagination } from "./_shared/http";
import { ensureWriteRole } from "./_shared/roles";
import { updateStockSchema } from "./_shared/schemas";
import { getSupabaseClient } from "./_shared/supabaseServer";

interface StockRow {
  id: number;
  sku: string;
  name: string;
  category: string;
  stock: number;
  stock_reserved: number | null;
  stock_min: number | null;
  active: boolean;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") return listStock(req, res);
  if (req.method === "PATCH") return updateStock(req, res);
  return methodNotAllowed(res, ["GET", "PATCH"]);
}

async function listStock(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabaseClient(req);
    const { limit, offset } = parsePagination(req);
    const lowOnly = String(req.query.low_only ?? "false") === "true";
    const sku = req.query.sku ? String(req.query.sku) : undefined;

    let query = supabase
      .from("products")
      .select("id, sku, name, category, stock, stock_reserved, stock_min, active")
      .eq("active", true)
      .order("stock", { ascending: true })
      .range(offset, offset + limit - 1);

    if (sku) query = query.eq("sku", sku);

    const { data, error } = await query;
    if (error) return fail(res, error.message, 500);

    const stockRows = ((data ?? []) as StockRow[]).map((product) => {
      const reserved = Number(product.stock_reserved ?? 0);
      const available = Number(product.stock ?? 0) - reserved;
      return { ...product, stock_reserved: reserved, available };
    });

    const filtered = lowOnly
      ? stockRows.filter((product) => product.stock_min != null && product.available <= Number(product.stock_min))
      : stockRows;

    return ok(res, filtered);
  } catch (error) {
    return fail(res, (error as Error).message, 500);
  }
}

async function updateStock(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabaseClient(req);
    if (!(await ensureWriteRole(req, res, supabase))) return;

    const parsed = updateStockSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return fail(res, "Invalid stock payload", 400, parsed.error.flatten());
    }

    const { sku, stock } = parsed.data;
    const { data, error } = await supabase
      .from("products")
      .update({ stock })
      .eq("sku", sku)
      .select("id, sku, name, stock")
      .single();

    if (error) return fail(res, error.message, 500);
    return ok(res, data);
  } catch (error) {
    return fail(res, (error as Error).message, 500);
  }
}
