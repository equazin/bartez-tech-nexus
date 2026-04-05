import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fail } from "./http.js";

export type ApiRole = "admin" | "vendedor" | "sales" | "cliente" | "client" | "anonymous";

const WRITE_ROLES: ApiRole[] = ["admin", "vendedor", "sales"];

export async function getRoleFromRequest(
  req: VercelRequest,
  supabase: SupabaseClient
): Promise<ApiRole> {
  const bearer = req.headers.authorization;
  const token = bearer?.startsWith("Bearer ") ? bearer.slice(7) : undefined;
  if (!token) return "anonymous";

  const { data: authData } = await supabase.auth.getUser(token);
  const userId = authData.user?.id;
  if (!userId) return "anonymous";

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
  supabase: SupabaseClient
): Promise<boolean> {
  const role = await getRoleFromRequest(req, supabase);
  if (!WRITE_ROLES.includes(role)) {
    fail(res, "Forbidden for current role", 403);
    return false;
  }
  return true;
}
