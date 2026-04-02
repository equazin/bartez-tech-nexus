import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fail, methodNotAllowed, ok } from "./_shared/http";
import { getSupabaseAdmin, getSupabaseClient } from "./_shared/supabaseServer";
import { getRoleFromRequest } from "./_shared/roles";

/**
 * POST /api/create-user
 *
 * Creates a new Supabase auth user + profile without affecting the caller's session.
 * Uses the service role key server-side, so the admin stays logged in.
 *
 * Body: {
 *   email: string
 *   password: string
 *   company_name?: string
 *   contact_name?: string
 *   client_type?: string
 *   default_margin?: number
 *   role?: string
 *   phone?: string
 * }
 *
 * Auth: Bearer <admin JWT> — must have role = 'admin'
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  // 1. Verify caller is admin
  const callerClient = getSupabaseClient(req);
  const callerRole = await getRoleFromRequest(req, callerClient);
  if (callerRole !== "admin") {
    return fail(res, "Solo los administradores pueden crear usuarios.", 403);
  }

  // 2. Parse and validate body
  const {
    email,
    password,
    company_name = "",
    contact_name = "",
    client_type = "mayorista",
    default_margin = 20,
    role = "client",
    phone = "",
  } = req.body as Record<string, unknown>;

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return fail(res, "Email inválido.");
  }
  if (!password || typeof password !== "string" || (password as string).length < 6) {
    return fail(res, "La contraseña debe tener al menos 6 caracteres.");
  }

  // 3. Create user with service role — does NOT affect caller's session
  const adminClient = getSupabaseAdmin();

  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: email as string,
    password: password as string,
    email_confirm: true,       // skip email confirmation for admin-created users
    user_metadata: {
      company_name,
      contact_name,
      client_type,
      default_margin: Number(default_margin) || 20,
      role,
      phone,
      email,
    },
  });

  if (authError || !authData?.user) {
    const msg = authError?.message ?? "Error al crear el usuario.";
    if (msg.toLowerCase().includes("already registered") || msg.toLowerCase().includes("already exists")) {
      return fail(res, "El email ya está registrado.", 409);
    }
    return fail(res, msg, 500);
  }

  const userId = authData.user.id;

  // 4. Upsert profile (trigger should have done it, but update to be safe)
  const { error: profileError } = await adminClient
    .from("profiles")
    .upsert({
      id: userId,
      email: email as string,
      phone: phone as string || null,
      company_name: company_name as string,
      contact_name: contact_name as string,
      client_type: client_type as string,
      default_margin: Number(default_margin) || 20,
      role: role as string,
      active: true,
    }, { onConflict: "id" });

  if (profileError) {
    // User was created in auth but profile failed — log and still return success
    console.error("[create-user] Profile upsert failed:", profileError.message);
  }

  return ok(res, { id: userId, email: authData.user.email }, 201);
}
