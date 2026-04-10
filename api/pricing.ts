import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fail, methodNotAllowed, ok } from "./_shared/http.js";
import { ensureWriteRole } from "./_shared/roles.js";
import {
  createPricingRuleSchema,
  updatePricingRuleSchema,
  deletePricingRuleSchema,
  createPriceAgreementSchema,
  updatePriceAgreementSchema,
} from "./_shared/schemas.js";
import { getSupabaseClient } from "./_shared/supabaseServer.js";

/**
 * Routes:
 *   /api/pricing/rules          GET, POST, PATCH, DELETE
 *   /api/pricing/agreements     GET, POST, PATCH
 *
 * Vercel maps /api/pricing.ts to /api/pricing — sub-paths are read from the URL.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = req.url ?? "";
  const isAgreements = url.includes("/agreements");
  const isRules = url.includes("/rules") || !isAgreements;

  if (isAgreements) {
    if (req.method === "GET")   return listAgreements(req, res);
    if (req.method === "POST")  return createAgreement(req, res);
    if (req.method === "PATCH") return updateAgreement(req, res);
    return methodNotAllowed(res, ["GET", "POST", "PATCH"]);
  }

  if (isRules) {
    if (req.method === "GET")    return listRules(req, res);
    if (req.method === "POST")   return createRule(req, res);
    if (req.method === "PATCH")  return updateRule(req, res);
    if (req.method === "DELETE") return deleteRule(req, res);
    return methodNotAllowed(res, ["GET", "POST", "PATCH", "DELETE"]);
  }

  return fail(res, "Unknown pricing resource", 404);
}

// ── Pricing Rules ─────────────────────────────────────────────────────────────

async function listRules(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabaseClient(req);
    if (!(await ensureWriteRole(req, res, supabase))) return;

    const { data, error } = await supabase
      .from("pricing_rules")
      .select("*")
      .order("priority", { ascending: false })
      .order("name");

    if (error) return fail(res, error.message, 500);
    return ok(res, data ?? []);
  } catch (error) {
    return fail(res, (error as Error).message, 500);
  }
}

async function createRule(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabaseClient(req);
    if (!(await ensureWriteRole(req, res, supabase))) return;

    const parsed = createPricingRuleSchema.safeParse(req.body ?? {});
    if (!parsed.success) return fail(res, "Invalid pricing rule payload", 400, parsed.error.flatten());

    const { data, error } = await supabase
      .from("pricing_rules")
      .insert(parsed.data)
      .select("*")
      .single();

    if (error) return fail(res, error.message, 500);
    return ok(res, data, 201);
  } catch (error) {
    return fail(res, (error as Error).message, 500);
  }
}

async function updateRule(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabaseClient(req);
    if (!(await ensureWriteRole(req, res, supabase))) return;

    const parsed = updatePricingRuleSchema.safeParse(req.body ?? {});
    if (!parsed.success) return fail(res, "Invalid pricing rule payload", 400, parsed.error.flatten());

    const { id, ...patch } = parsed.data;

    const { data, error } = await supabase
      .from("pricing_rules")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();

    if (error) return fail(res, error.message, 500);
    return ok(res, data);
  } catch (error) {
    return fail(res, (error as Error).message, 500);
  }
}

async function deleteRule(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabaseClient(req);
    if (!(await ensureWriteRole(req, res, supabase))) return;

    const parsed = deletePricingRuleSchema.safeParse(req.body ?? {});
    if (!parsed.success) return fail(res, "Invalid payload", 400, parsed.error.flatten());

    const { error } = await supabase.from("pricing_rules").delete().eq("id", parsed.data.id);
    if (error) return fail(res, error.message, 500);
    return ok(res, { id: parsed.data.id });
  } catch (error) {
    return fail(res, (error as Error).message, 500);
  }
}

// ── Price Agreements ──────────────────────────────────────────────────────────

async function listAgreements(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabaseClient(req);
    if (!(await ensureWriteRole(req, res, supabase))) return;

    const clientId = req.query.client_id ? String(req.query.client_id) : undefined;

    let query = supabase
      .from("client_price_agreements")
      .select("*")
      .order("valid_from", { ascending: false });

    if (clientId) query = query.eq("client_id", clientId);

    const { data, error } = await query;
    if (error) return fail(res, error.message, 500);
    return ok(res, data ?? []);
  } catch (error) {
    return fail(res, (error as Error).message, 500);
  }
}

async function createAgreement(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabaseClient(req);
    if (!(await ensureWriteRole(req, res, supabase))) return;

    const parsed = createPriceAgreementSchema.safeParse(req.body ?? {});
    if (!parsed.success) return fail(res, "Invalid agreement payload", 400, parsed.error.flatten());

    const { data, error } = await supabase
      .from("client_price_agreements")
      .insert(parsed.data)
      .select("*")
      .single();

    if (error) return fail(res, error.message, 500);
    return ok(res, data, 201);
  } catch (error) {
    return fail(res, (error as Error).message, 500);
  }
}

async function updateAgreement(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabaseClient(req);
    if (!(await ensureWriteRole(req, res, supabase))) return;

    const parsed = updatePriceAgreementSchema.safeParse(req.body ?? {});
    if (!parsed.success) return fail(res, "Invalid agreement payload", 400, parsed.error.flatten());

    const { id, ...patch } = parsed.data;

    const { data, error } = await supabase
      .from("client_price_agreements")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();

    if (error) return fail(res, error.message, 500);
    return ok(res, data);
  } catch (error) {
    return fail(res, (error as Error).message, 500);
  }
}
