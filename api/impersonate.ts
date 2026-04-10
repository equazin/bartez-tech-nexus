import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { fail, methodNotAllowed, ok } from "./_shared/http.js";
import { getRoleFromRequest } from "./_shared/roles.js";
import { getSupabaseClient, getSupabaseAdmin } from "./_shared/supabaseServer.js";

const startSchema = z.object({
  client_id: z.string().trim().min(1).max(128),
});

/**
 * POST /api/impersonate        — start impersonation, returns client profile + logs audit
 * DELETE /api/impersonate      — stop impersonation (logs audit stop)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "POST")   return startImpersonation(req, res);
  if (req.method === "DELETE") return stopImpersonation(req, res);
  return methodNotAllowed(res, ["POST", "DELETE"]);
}

async function startImpersonation(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabaseClient(req);
    const role     = await getRoleFromRequest(req, supabase);

    if (role !== "admin" && role !== "vendedor" && role !== "sales") {
      return fail(res, "Forbidden: only admin and sellers can impersonate clients", 403);
    }

    const parsed = startSchema.safeParse(req.body ?? {});
    if (!parsed.success) return fail(res, "Invalid payload", 400, parsed.error.flatten());

    const { client_id } = parsed.data;

    const admin = getSupabaseAdmin();

    // Fetch the impersonated client's profile
    const { data: clientProfile, error: profileError } = await admin
      .from("profiles")
      .select("*")
      .eq("id", client_id)
      .single();

    if (profileError || !clientProfile) return fail(res, "Client not found", 404);

    // Guard: cannot impersonate another admin
    const clientRole = String((clientProfile as { role?: string }).role ?? "client").toLowerCase();
    if (clientRole === "admin") {
      return fail(res, "Cannot impersonate an admin account", 403);
    }

    // Resolve the real admin/seller user ID
    const { data: authData } = await supabase.auth.getUser(
      req.headers.authorization?.slice(7) ?? ""
    );
    const actorId = authData.user?.id ?? "unknown";

    // Write audit log — fire-and-forget (non-blocking)
    void admin.from("activity_log").insert({
      action:    "impersonate_start",
      entity_id: client_id,
      metadata: {
        actor_id:    actorId,
        actor_role:  role,
        client_id,
        client_role: clientRole,
        timestamp:   new Date().toISOString(),
      },
    });

    return ok(res, clientProfile);
  } catch (error) {
    return fail(res, (error as Error).message, 500);
  }
}

async function stopImpersonation(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabaseClient(req);
    const role     = await getRoleFromRequest(req, supabase);

    if (role !== "admin" && role !== "vendedor" && role !== "sales") {
      return fail(res, "Forbidden", 403);
    }

    const { client_id } = (req.body ?? {}) as { client_id?: string };

    const { data: authData } = await supabase.auth.getUser(
      req.headers.authorization?.slice(7) ?? ""
    );
    const actorId = authData.user?.id ?? "unknown";

    // Write stop audit log
    void getSupabaseAdmin().from("activity_log").insert({
      action:    "impersonate_stop",
      entity_id: client_id ?? null,
      metadata: {
        actor_id:  actorId,
        actor_role: role,
        client_id: client_id ?? null,
        timestamp: new Date().toISOString(),
      },
    });

    return ok(res, { stopped: true });
  } catch (error) {
    return fail(res, (error as Error).message, 500);
  }
}
