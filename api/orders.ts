import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fail, methodNotAllowed, ok, parsePagination } from "./_shared/http";
import { ensureWriteRole } from "./_shared/roles";
import { getSupabaseClient } from "./_shared/supabaseServer";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") return listOrders(req, res);
  if (req.method === "POST") return createOrder(req, res);
  return methodNotAllowed(res, ["GET", "POST"]);
}

async function listOrders(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabaseClient(req);
    const { limit, offset } = parsePagination(req);
    const clientId = req.query.client_id ? String(req.query.client_id) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;

    let query = supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (clientId) query = query.eq("client_id", clientId);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return fail(res, error.message, 500);
    return ok(res, data ?? []);
  } catch (error) {
    return fail(res, (error as Error).message, 500);
  }
}

async function createOrder(req: VercelRequest, res: VercelResponse) {
  if (!ensureWriteRole(req, res)) return;

  try {
    const body = req.body ?? {};
    if (!body.client_id || !Array.isArray(body.products) || body.total == null) {
      return fail(res, "Missing required fields: client_id, products[], total");
    }

    const payload = {
      client_id: String(body.client_id),
      products: body.products,
      total: Number(body.total),
      status: String(body.status ?? "pending"),
      order_number: body.order_number ? String(body.order_number) : null,
      numero_remito: body.numero_remito ? String(body.numero_remito) : null,
    };

    const supabase = getSupabaseClient(req);
    const { data, error } = await supabase
      .from("orders")
      .insert(payload)
      .select("*")
      .single();

    if (error) return fail(res, error.message, 500);
    return ok(res, data, 201);
  } catch (error) {
    return fail(res, (error as Error).message, 500);
  }
}
