import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { fail } from "./http.js";

export type ApiRole = "admin" | "vendedor" | "sales" | "cliente" | "client" | "anonymous";

const WRITE_ROLES: ApiRole[] = ["admin", "vendedor", "sales"];

/**
 * Validate the bearer token with the anon client (respects JWT signatures),
 * then resolve the user's role using the admin client so that RLS on the
 * `profiles` table cannot block the lookup.
 */
export async function getRoleFromRequest(
  req: VercelRequest,
  supabase: SupabaseClient,
): Promise<ApiRole> {
  const bearer = req.headers.authorization;
  const token = bearer?.startsWith("Bearer ") ? bearer.slice(7) : undefined;
  if (!token) return "anonymous";

  // Step 1: validate the token and extract the userId via the anon client.
  const { data: authData } = await supabase.auth.getUser(token);
  const userId = authData.user?.id;
  if (!userId) return "anonymous";

  // Step 2: resolve the role from profiles using the service-role client so
  // that RLS policies on `profiles` cannot produce a false "anonymous" result
  // for admin users.
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && serviceRoleKey) {
      const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: profileAdmin } = await adminClient
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();
      if (profileAdmin?.role) {
        const rawAdmin = String(profileAdmin.role).toLowerCase();
        if (rawAdmin === "admin") return "admin";
        if (rawAdmin === "vendedor") return "vendedor";
        if (rawAdmin === "sales") return "sales";
        if (rawAdmin === "cliente") return "cliente";
        return "client";
      }
    }
  } catch {
    // Fall through to anon-client lookup below.
  }

  // Fallback: query with the anon client (may be blocked by RLS for some roles).
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  const raw = String(profile?.role ?? "client").toLowerCase();
  if (raw === "admin") return "admin";
  if (raw === "vendedor") return "vendedor";
  if (raw === "sales") return "sales";
  if (raw === "cliente") return "cliente";
  return "client";
}

export function normalizeRole(role: ApiRole): "admin" | "vendedor" | "sales" | "cliente" | "anonymous" {
  if (role === "client") return "cliente";
  return role;
}

export async function ensureWriteRole(
  req: VercelRequest,
  res: VercelResponse,
  supabase: SupabaseClient,
): Promise<boolean> {
  const role = await getRoleFromRequest(req, supabase);
  if (!WRITE_ROLES.includes(role)) {
    fail(res, "Forbidden for current role", 403);
    return false;
  }
  return true;
}
