import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fail, methodNotAllowed, ok, parsePagination } from "./_shared/http.js";
import { getRoleFromRequest, ensureWriteRole } from "./_shared/roles.js";
import { createOrderSchema, updateOrderSchema, ORDER_STATUSES, type OrderStatus } from "./_shared/schemas.js";
import { getSupabaseClient, getSupabaseAdmin } from "./_shared/supabaseServer.js";
import { notifyOrderStatusChange } from "./_shared/notifications.js";
import type { ApiRole } from "./_shared/roles.js";

// Transitions each role is allowed to trigger
const ALLOWED_TRANSITIONS: Record<ApiRole, OrderStatus[]> = {
  admin:     [...ORDER_STATUSES],
  vendedor:  ["confirmed", "preparing", "picked", "shipped", "delivered", "rejected"],
  sales:     ["confirmed", "preparing", "picked", "shipped", "delivered", "rejected"],
  cliente:   ["cancelled"],
  client:    ["cancelled"],
  anonymous: [],
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET")   return listOrders(req, res);
  if (req.method === "POST")  return createOrder(req, res);
  if (req.method === "PATCH") return updateOrder(req, res);
  return methodNotAllowed(res, ["GET", "POST", "PATCH"]);
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
  try {
    const supabase = getSupabaseClient(req);
    if (!(await ensureWriteRole(req, res, supabase))) return;

    const parsed = createOrderSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return fail(res, "Invalid order payload", 400, parsed.error.flatten());
    }

    const body = parsed.data;
    const payload = {
      client_id: body.client_id,
      products: body.products,
      total: body.total,
      status: body.status ?? "pending",
      order_number: body.order_number ?? null,
      numero_remito: body.numero_remito ?? null,
    };

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

async function updateOrder(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabaseClient(req);
    const role = await getRoleFromRequest(req, supabase);

    if (role === "anonymous") return fail(res, "Unauthorized", 401);

    const parsed = updateOrderSchema.safeParse(req.body ?? {});
    if (!parsed.success) return fail(res, "Invalid payload", 400, parsed.error.flatten());

    const { id, status, ...rest } = parsed.data;

    // Validate status transition is allowed for this role
    if (status !== undefined && !ALLOWED_TRANSITIONS[role].includes(status)) {
      return fail(res, `Role '${role}' cannot set order status to '${status}'`, 403);
    }

    // Fetch current order to validate ownership and current status
    const { data: currentOrder, error: fetchError } = await supabase
      .from("orders")
      .select("id, client_id, status")
      .eq("id", id)
      .single();

    if (fetchError || !currentOrder) return fail(res, "Order not found", 404);

    // Clients can only cancel their own orders while still pending
    if (role === "cliente" || role === "client") {
      const { data: authData } = await supabase.auth.getUser(
        req.headers.authorization?.slice(7) ?? ""
      );
      const userId = authData.user?.id;
      if (currentOrder.client_id !== userId) {
        return fail(res, "Cannot modify another client's order", 403);
      }
      if (currentOrder.status !== "pending") {
        return fail(res, "Can only cancel orders in pending status", 403);
      }
    }

    const patch: Record<string, unknown> = { ...rest };
    if (status !== undefined) patch.status = status;

    const { data, error } = await supabase
      .from("orders")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error) return fail(res, error.message, 500);

    // Fire-and-forget notifications on status change — never blocks the response
    if (status !== undefined && status !== currentOrder.status) {
      void notifyOrderStatusChange(
        data as { id: number; order_number?: string; client_id: string; total?: number; shipping_provider?: string; tracking_number?: string },
        status,
        getSupabaseAdmin(),
      );
    }

    return ok(res, data);
  } catch (error) {
    return fail(res, (error as Error).message, 500);
  }
}
