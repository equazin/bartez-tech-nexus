import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fail, methodNotAllowed, ok, parsePagination } from "./_shared/http.js";
import { ensureWriteRole } from "./_shared/roles.js";
import {
  createCouponSchema,
  updateCouponSchema,
  deleteCouponSchema,
} from "./_shared/schemas.js";
import { getSupabaseClient } from "./_shared/supabaseServer.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET")    return listCoupons(req, res);
  if (req.method === "POST")   return createCoupon(req, res);
  if (req.method === "PATCH")  return updateCoupon(req, res);
  if (req.method === "DELETE") return deleteCoupon(req, res);
  return methodNotAllowed(res, ["GET", "POST", "PATCH", "DELETE"]);
}

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

    // Check for duplicate code
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

    // Block deletion if coupon has been used
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
