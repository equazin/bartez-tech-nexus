import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fail, methodNotAllowed, ok } from "./_shared/http.js";
import { getSupabaseAdmin, getSupabaseClient } from "./_shared/supabaseServer.js";
import { getRoleFromRequest } from "./_shared/roles.js";

type EditableRole = "sales";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    return await _handler(req, res);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno del servidor.";
    console.error("[manage-user] Unhandled error:", message);
    return fail(res, message, 500);
  }
}

async function _handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "PATCH") return methodNotAllowed(res, ["PATCH"]);

  const callerClient = getSupabaseClient(req);
  const callerRole = await getRoleFromRequest(req, callerClient);
  if (callerRole !== "admin") {
    return fail(res, "Solo los administradores pueden gestionar vendedores.", 403);
  }

  const {
    id,
    email,
    contact_name,
    company_name,
    role,
    active,
  } = req.body as Record<string, unknown>;

  if (!id || typeof id !== "string") {
    return fail(res, "Id de usuario invalido.");
  }

  if (email !== undefined && (typeof email !== "string" || !email.includes("@"))) {
    return fail(res, "Email invalido.");
  }

  if (contact_name !== undefined && (typeof contact_name !== "string" || !contact_name.trim())) {
    return fail(res, "Nombre obligatorio.");
  }

  if (role !== undefined && String(role) !== "sales") {
    return fail(res, "Rol invalido.");
  }

  if (active !== undefined && typeof active !== "boolean") {
    return fail(res, "Estado invalido.");
  }

  const adminClient = getSupabaseAdmin();

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, email, contact_name, company_name, role, active")
    .eq("id", id)
    .maybeSingle();

  if (profileError) return fail(res, profileError.message, 500);
  if (!profile) return fail(res, "Vendedor no encontrado.", 404);

  const nextEmail =
    typeof email === "string" ? email.trim().toLowerCase() : String(profile.email ?? "").trim().toLowerCase();
  const nextContactName = typeof contact_name === "string" ? contact_name.trim() : String(profile.contact_name ?? "");
  const nextCompanyName = typeof company_name === "string" && company_name.trim() ? company_name.trim() : nextContactName;
  const nextRole: EditableRole = "sales";
  const nextActive = typeof active === "boolean" ? active : Boolean(profile.active ?? true);

  const { data: duplicate } = await adminClient
    .from("profiles")
    .select("id")
    .eq("email", nextEmail)
    .neq("id", id)
    .limit(1)
    .maybeSingle();

  if (duplicate) {
    return fail(res, "El email ya esta registrado.", 409);
  }

  const { error: authError } = await adminClient.auth.admin.updateUserById(id, {
    ...(nextEmail ? { email: nextEmail } : {}),
    user_metadata: {
      email: nextEmail,
      contact_name: nextContactName,
      company_name: nextCompanyName,
      role: nextRole,
    },
  });

  if (authError) {
    const message = authError.message ?? "No se pudo actualizar el usuario.";
    if (message.toLowerCase().includes("already registered") || message.toLowerCase().includes("already exists")) {
      return fail(res, "El email ya esta registrado.", 409);
    }
    return fail(res, message, 500);
  }

  const { error: updateProfileError } = await adminClient
    .from("profiles")
    .update({
      email: nextEmail || null,
      contact_name: nextContactName,
      company_name: nextCompanyName,
      role: "vendedor",
      active: nextActive,
    })
    .eq("id", id);

  if (updateProfileError) {
    return fail(res, updateProfileError.message, 500);
  }

  return ok(res, {
    id,
    email: nextEmail,
    contact_name: nextContactName,
    company_name: nextCompanyName,
    role: nextRole,
    active: nextActive,
  });
}
