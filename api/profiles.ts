import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fail, methodNotAllowed, ok } from "./_shared/http.js";
import { getRoleFromRequest } from "./_shared/roles.js";
import { updateProfileSchema } from "./_shared/schemas.js";
import { getSupabaseClient } from "./_shared/supabaseServer.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "PATCH") return updateProfile(req, res);
  return methodNotAllowed(res, ["PATCH"]);
}

async function updateProfile(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabaseClient(req);
    const role = await getRoleFromRequest(req, supabase);

    if (role === "anonymous" || role === "client" || role === "cliente") {
      return fail(res, "Forbidden: insufficient role", 403);
    }

    const parsed = updateProfileSchema.safeParse(req.body ?? {});
    if (!parsed.success) return fail(res, "Invalid payload", 400, parsed.error.flatten());

    const { id, role: targetRole, ...fields } = parsed.data;

    // Only admin can change roles — and cannot demote/promote to admin via API
    if (targetRole !== undefined) {
      if (role !== "admin") {
        return fail(res, "Only admin can change user roles", 403);
      }
      if (targetRole === "admin") {
        return fail(res, "Cannot promote to admin via API", 403);
      }
    }

    const patch: Record<string, unknown> = { ...fields };
    if (targetRole !== undefined) patch.role = targetRole;

    const { data, error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", id)
      .select("id, role, active, estado, credit_limit, client_type, default_margin")
      .single();

    if (error) return fail(res, error.message, 500);
    return ok(res, data);
  } catch (error) {
    return fail(res, (error as Error).message, 500);
  }
}
