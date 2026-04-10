import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fail, methodNotAllowed, ok, parsePagination } from "./_shared/http.js";
import { getRoleFromRequest } from "./_shared/roles.js";
import { getSupabaseClient } from "./_shared/supabaseServer.js";
import {
  createQuoteSchema,
  updateQuoteSchema,
  deleteQuoteSchema,
  createRmaSchema,
  updateRmaSchema,
} from "./_shared/schemas.js";

/**
 * Consolidated commerce handler — replaces quotes.ts + rma.ts
 *
 * Routing via ?resource= (set by vercel.json rewrites):
 *   /api/quotes  → /api/commerce?resource=quotes
 *   /api/rma     → /api/commerce?resource=rma
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const resource = String(req.query.resource ?? "");

    if (resource === "quotes") {
      if (req.method === "GET")    return listQuotes(req, res);
      if (req.method === "POST")   return createQuote(req, res);
      if (req.method === "PATCH")  return updateQuote(req, res);
      if (req.method === "DELETE") return deleteQuote(req, res);
      return methodNotAllowed(res, ["GET", "POST", "PATCH", "DELETE"]);
    }

    if (resource === "rma") {
      if (req.method === "GET")   return listRmas(req, res);
      if (req.method === "POST")  return createRma(req, res);
      if (req.method === "PATCH") return updateRma(req, res);
      return methodNotAllowed(res, ["GET", "POST", "PATCH"]);
    }

    return fail(res, "Unknown commerce resource", 404);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error interno del servidor.";
    console.error("[commerce] Unhandled error:", msg);
    return fail(res, msg, 500);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function resolveUserId(
  req: VercelRequest,
  supabase: ReturnType<typeof getSupabaseClient>,
): Promise<string | null> {
  const { data } = await supabase.auth.getUser(req.headers.authorization?.slice(7) ?? "");
  return data.user?.id ?? null;
}

// ─── Quotes (ex quotes.ts) ────────────────────────────────────────────────────

async function listQuotes(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabaseClient(req);
    const role = await getRoleFromRequest(req, supabase);
    if (role === "anonymous") return fail(res, "Unauthorized", 401);

    const { limit, offset } = parsePagination(req);
    const clientId = req.query.client_id ? String(req.query.client_id) : undefined;

    let query = supabase
      .from("quotes")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (role === "cliente" || role === "client") {
      const userId = await resolveUserId(req, supabase);
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

async function createQuote(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabaseClient(req);
    const role = await getRoleFromRequest(req, supabase);
    if (role === "anonymous") return fail(res, "Unauthorized", 401);

    const parsed = createQuoteSchema.safeParse(req.body ?? {});
    if (!parsed.success) return fail(res, "Invalid payload", 400, parsed.error.flatten());

    const body = parsed.data;

    if (role === "cliente" || role === "client") {
      const userId = await resolveUserId(req, supabase);
      if (!userId || body.client_id !== userId) {
        return fail(res, "Cannot create quote for another client", 403);
      }
    }

    const now = new Date().toISOString();
    const payload = {
      client_id:   body.client_id,
      client_name: body.client_name,
      items:       body.items,
      subtotal:    body.subtotal,
      iva_total:   body.iva_total,
      total:       body.total,
      currency:    body.currency,
      status:      body.status,
      version:     body.version,
      parent_id:   body.parent_id ?? null,
      order_id:    body.order_id ?? null,
      valid_days:  body.valid_days ?? null,
      expires_at:  body.expires_at ?? null,
      notes:       body.notes ?? null,
      created_at:  body.created_at ?? now,
      updated_at:  body.updated_at ?? now,
    };

    const { data, error } = await supabase
      .from("quotes")
      .insert(payload)
      .select("*")
      .single();

    if (error) return fail(res, error.message, 500);
    return ok(res, data, 201);
  } catch (error) {
    return fail(res, (error as Error).message, 500);
  }
}

async function updateQuote(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabaseClient(req);
    const role = await getRoleFromRequest(req, supabase);
    if (role === "anonymous") return fail(res, "Unauthorized", 401);

    const parsed = updateQuoteSchema.safeParse(req.body ?? {});
    if (!parsed.success) return fail(res, "Invalid payload", 400, parsed.error.flatten());

    const { id, ...changes } = parsed.data;

    const { data: existing, error: fetchErr } = await supabase
      .from("quotes")
      .select("id, client_id")
      .eq("id", id)
      .single();

    if (fetchErr || !existing) return fail(res, "Quote not found", 404);

    if (role === "cliente" || role === "client") {
      const userId = await resolveUserId(req, supabase);
      if (!userId || (existing as { client_id: string }).client_id !== userId) {
        return fail(res, "Cannot modify another client's quote", 403);
      }
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (changes.client_name !== undefined) patch.client_name = changes.client_name;
    if (changes.items       !== undefined) patch.items       = changes.items;
    if (changes.subtotal    !== undefined) patch.subtotal    = changes.subtotal;
    if (changes.iva_total   !== undefined) patch.iva_total   = changes.iva_total;
    if (changes.total       !== undefined) patch.total       = changes.total;
    if (changes.currency    !== undefined) patch.currency    = changes.currency;
    if (changes.status      !== undefined) patch.status      = changes.status;
    if (changes.version     !== undefined) patch.version     = changes.version;
    if (changes.parent_id   !== undefined) patch.parent_id   = changes.parent_id;
    if (changes.order_id    !== undefined) patch.order_id    = changes.order_id;
    if (changes.valid_days  !== undefined) patch.valid_days  = changes.valid_days;
    if (changes.expires_at  !== undefined) patch.expires_at  = changes.expires_at;
    if (changes.notes       !== undefined) patch.notes       = changes.notes;

    const { data, error } = await supabase
      .from("quotes")
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

async function deleteQuote(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabaseClient(req);
    const role = await getRoleFromRequest(req, supabase);
    if (role === "anonymous") return fail(res, "Unauthorized", 401);

    const parsed = deleteQuoteSchema.safeParse(req.body ?? {});
    if (!parsed.success) return fail(res, "Invalid payload", 400, parsed.error.flatten());

    const { id } = parsed.data;

    const { data: existing, error: fetchErr } = await supabase
      .from("quotes")
      .select("id, client_id, status")
      .eq("id", id)
      .single();

    if (fetchErr || !existing) return fail(res, "Quote not found", 404);

    const quote = existing as { client_id: string; status: string };

    if (role === "cliente" || role === "client") {
      const userId = await resolveUserId(req, supabase);
      if (!userId || quote.client_id !== userId) {
        return fail(res, "Cannot delete another client's quote", 403);
      }
      if (quote.status !== "draft" && quote.status !== "rejected") {
        return fail(res, "Can only delete draft or rejected quotes", 403);
      }
    }

    const { error } = await supabase.from("quotes").delete().eq("id", id);
    if (error) return fail(res, error.message, 500);
    return ok(res, { deleted: true });
  } catch (error) {
    return fail(res, (error as Error).message, 500);
  }
}

// ─── RMA (ex rma.ts) ──────────────────────────────────────────────────────────

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
    if (resolution_type)  patch.resolution_type  = resolution_type;
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
