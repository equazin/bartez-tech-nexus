import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fail, methodNotAllowed, ok } from "./_shared/http.js";
import { getRoleFromRequest } from "./_shared/roles.js";
import { getSupabaseClient } from "./_shared/supabaseServer.js";
import { createRmaSchema, updateRmaSchema } from "./_shared/schemas.js";

/**
 * GET  /api/rma?client_id=...   — list RMAs (client sees own; admin/vendedor sees all or by client)
 * POST /api/rma                 — client creates RMA (status forced to "submitted")
 * PATCH /api/rma                — admin/vendedor updates RMA status + resolution
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET")   return listRmas(req, res);
  if (req.method === "POST")  return createRma(req, res);
  if (req.method === "PATCH") return updateRma(req, res);
  return methodNotAllowed(res, ["GET", "POST", "PATCH"]);
}

async function listRmas(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabaseClient(req);
    const role = await getRoleFromRequest(req, supabase);

    if (role === "anonymous") return fail(res, "Unauthorized", 401);

    const clientId = req.query.client_id ? String(req.query.client_id) : undefined;

    let query = supabase
      .from("rma_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (role === "cliente" || role === "client") {
      // Clients can only see their own RMAs — get their user ID from the token
      const { data: authData } = await supabase.auth.getUser(
        req.headers.authorization?.slice(7) ?? ""
      );
      const userId = authData.user?.id;
      if (!userId) return fail(res, "Unauthorized", 401);
      query = query.eq("client_id", userId);
    } else if (clientId) {
      query = query.eq("client_id", clientId);
    }

    const { data, error } = await query;
    if (error) return fail(res, error.message, 500);
    return ok(res, data ?? []);
  } catch (error) {
    return fail(res, (error as Error).message, 500);
  }
}

async function createRma(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabaseClient(req);
    const role = await getRoleFromRequest(req, supabase);

    if (role === "anonymous") return fail(res, "Unauthorized", 401);

    const parsed = createRmaSchema.safeParse(req.body ?? {});
    if (!parsed.success) return fail(res, "Invalid payload", 400, parsed.error.flatten());

    const payload = { ...parsed.data, status: "submitted" as const };

    // Clients can only create RMAs for themselves
    if (role === "cliente" || role === "client") {
      const { data: authData } = await supabase.auth.getUser(
        req.headers.authorization?.slice(7) ?? ""
      );
      const userId = authData.user?.id;
      if (!userId || payload.client_id !== userId) {
        return fail(res, "Cannot create RMA for another client", 403);
      }
    }

    const { data, error } = await supabase
      .from("rma_requests")
      .insert(payload)
      .select("*")
      .single();

    if (error) return fail(res, error.message, 500);
    return ok(res, data, 201);
  } catch (error) {
    return fail(res, (error as Error).message, 500);
  }
}

async function updateRma(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabaseClient(req);
    const role = await getRoleFromRequest(req, supabase);

    if (role !== "admin" && role !== "vendedor" && role !== "sales") {
      return fail(res, "Forbidden: only admin and sellers can update RMA status", 403);
    }

    const parsed = updateRmaSchema.safeParse(req.body ?? {});
    if (!parsed.success) return fail(res, "Invalid payload", 400, parsed.error.flatten());

    const { id, status, resolution_type, resolution_notes } = parsed.data;

    const patch: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (resolution_type) patch.resolution_type = resolution_type;
    if (resolution_notes) patch.resolution_notes = resolution_notes;
    if (status === "resolved") patch.resolved_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("rma_requests")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error) return fail(res, error.message, 500);
    return ok(res, data);
  } catch (error) {
    return fail(res, (error as Error).message, 500);
  }
}
