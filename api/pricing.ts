import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fail, methodNotAllowed, ok, parsePagination } from "./_shared/http.js";
import { ensureWriteRole } from "./_shared/roles.js";
import {
  createPricingRuleSchema,
  updatePricingRuleSchema,
  deletePricingRuleSchema,
  createPriceAgreementSchema,
  updatePriceAgreementSchema,
  createCouponSchema,
  updateCouponSchema,
  deleteCouponSchema,
} from "./_shared/schemas.js";
import { getSupabaseClient } from "./_shared/supabaseServer.js";

/**
 * Routes:
 *   /api/pricing/rules          GET, POST, PATCH, DELETE
 *   /api/pricing/agreements     GET, POST, PATCH
 *   /api/pricing/coupons        GET, POST, PATCH, DELETE
 *
 * Vercel maps /api/pricing.ts to /api/pricing — sub-paths are read from the URL.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = req.url ?? "";
  
  if (url.includes("/agreements")) {
    if (req.method === "GET")   return listAgreements(req, res);
    if (req.method === "POST")  return createAgreement(req, res);
    if (req.method === "PATCH") return updateAgreement(req, res);
    return methodNotAllowed(res, ["GET", "POST", "PATCH"]);
  }

  if (url.includes("/coupons")) {
    if (req.method === "GET")    return listCoupons(req, res);
    if (req.method === "POST")   return createCoupon(req, res);
    if (req.method === "PATCH")  return updateCoupon(req, res);
    if (req.method === "DELETE") return deleteCoupon(req, res);
    return methodNotAllowed(res, ["GET", "POST", "PATCH", "DELETE"]);
  }

  // Default to rules if no specific subpath or if /rules is explicitly requested
  if (url.includes("/rules") || url.split('?')[0].endsWith('/pricing')) {
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

// ── Coupons (ex coupons.ts) ───────────────────────────────────────────────────

async function listCoupons(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabaseClient(req);
    if (!(await ensureWriteRole(req, res, supabase))) return;

    const { limit, offset } = parsePagination(req);
    const { data, error } = await supabase
      .from("coupons")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return fail(res, error.message, 500);
    return ok(res, data ?? []);
  } catch (error) {
    return fail(res, (error as Error).message, 500);
  }
}

async function createCoupon(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabaseClient(req);
    if (!(await ensureWriteRole(req, res, supabase))) return;

    const parsed = createCouponSchema.safeParse(req.body ?? {});
    if (!parsed.success) return fail(res, "Invalid coupon payload", 400, parsed.error.flatten());

    const { data: existing } = await supabase
      .from("coupons")
      .select("id")
      .eq("code", parsed.data.code)
      .maybeSingle();

    if (existing) return fail(res, `Coupon code '${parsed.data.code}' already exists`, 409);

    const { data, error } = await supabase
      .from("coupons")
      .insert(parsed.data)
      .select("*")
      .single();

    if (error) return fail(res, error.message, 500);
    return ok(res, data, 201);
  } catch (error) {
    return fail(res, (error as Error).message, 500);
  }
}

async function updateCoupon(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabaseClient(req);
    if (!(await ensureWriteRole(req, res, supabase))) return;

    const parsed = updateCouponSchema.safeParse(req.body ?? {});
    if (!parsed.success) return fail(res, "Invalid coupon payload", 400, parsed.error.flatten());

    const { id, ...patch } = parsed.data;

    const { data, error } = await supabase
      .from("coupons")
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

async function deleteCoupon(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabaseClient(req);
    if (!(await ensureWriteRole(req, res, supabase))) return;

    const parsed = deleteCouponSchema.safeParse(req.body ?? {});
    if (!parsed.success) return fail(res, "Invalid payload", 400, parsed.error.flatten());

    const { id } = parsed.data;

    const { data: coupon } = await supabase
      .from("coupons")
      .select("id, used_count")
      .eq("id", id)
      .single();

    if (!coupon) return fail(res, "Coupon not found", 404);
    if ((coupon.used_count ?? 0) > 0) {
      return fail(res, "Cannot delete a coupon that has been used. Deactivate it instead.", 409);
    }

    const { error } = await supabase.from("coupons").delete().eq("id", id);
    if (error) return fail(res, error.message, 500);
    return ok(res, { id });
  } catch (error) {
    return fail(res, (error as Error).message, 500);
  }
}
