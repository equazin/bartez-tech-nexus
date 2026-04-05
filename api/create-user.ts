import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fail, methodNotAllowed, ok } from "./_shared/http.js";
import { getSupabaseAdmin, getSupabaseClient } from "./_shared/supabaseServer.js";
import { getRoleFromRequest } from "./_shared/roles.js";

/**
 * GET  /api/create-user?cuit=XXXXXXXXXXX  — AFIP padron lookup (no auth required)
 * POST /api/create-user                   — Create user (admin only)
 * PATCH /api/create-user                  — Edit user/seller (admin only)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === "GET")   return await handleAfipLookup(req, res);
    if (req.method === "POST")  return await handleCreateUser(req, res);
    if (req.method === "PATCH") return await handleManageUser(req, res);
    return methodNotAllowed(res, ["GET", "POST", "PATCH"]);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error interno del servidor.";
    console.error("[create-user] Unhandled error:", msg);
    return fail(res, msg, 500);
  }
}

// ── GET: AFIP padron lookup ────────────────────────────────────────────────────

async function handleAfipLookup(req: VercelRequest, res: VercelResponse) {
  const cuit = String(req.query.cuit ?? "").replace(/\D/g, "");
  if (cuit.length !== 11) return fail(res, "El CUIT debe tener 11 dígitos.", 400);

  // Mod-11 checksum
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((acc, w, i) => acc + w * Number(cuit[i]), 0);
  const remainder = sum % 11;
  if (remainder === 1) return fail(res, "El CUIT ingresado no es válido. Verificá los números.", 400);
  const expected = remainder === 0 ? 0 : 11 - remainder;
  if (expected !== Number(cuit[10])) return fail(res, "El CUIT ingresado no es válido. Verificá los números.", 400);

  // Scrape cuitonline.com — public data, no auth required
  try {
    const res2 = await fetch(`https://www.cuitonline.com/detalle/${cuit}/`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });

    const html = await res2.text();

    // Extract name from <title>NAME (CUIT...) - Cuit Online</title>
    const titleMatch = html.match(/<title>([^(]+)\s*\(/);
    const companyName = titleMatch ? titleMatch[1].trim() : "";

    // Extract from meta description: "... · Persona Física · ..." or "Persona Jurídica"
    const descMatch = html.match(/content="([^"]+CUIT[^"]+)"/);
    const desc = descMatch ? descMatch[1] : "";

    const isLegal = /Persona Jur/i.test(desc);
    const entityType = isLegal ? "empresa" : "persona_fisica";

    const taxStatus =
      /Responsable Inscripto/i.test(desc) ? "responsable_inscripto"
      : /Monotributo|Monotributista/i.test(desc) ? "monotributista"
      : /Exento/i.test(desc) ? "exento"
      : isLegal ? "responsable_inscripto" : "monotributista";

    const notFound = html.includes("ERROR 404") || !companyName;
    if (notFound) {
      // Fall back to prefix-only detection without a name
      const prefix = parseInt(cuit.slice(0, 2), 10);
      const fallbackLegal = [30, 33, 34].includes(prefix);
      return ok(res, {
        companyName: "",
        taxStatus: fallbackLegal ? "responsable_inscripto" : "monotributista",
        entityType: fallbackLegal ? "empresa" : "persona_fisica",
        active: true,
      });
    }

    return ok(res, { companyName, taxStatus, entityType, active: true });
  } catch {
    // Network error — fall back to prefix detection
    const prefix = parseInt(cuit.slice(0, 2), 10);
    const isLegal = [30, 33, 34].includes(prefix);
    return ok(res, {
      companyName: "",
      taxStatus: isLegal ? "responsable_inscripto" : "monotributista",
      entityType: isLegal ? "empresa" : "persona_fisica",
      active: true,
    });
  }
}

// ── POST: Create user ─────────────────────────────────────────────────────────

async function handleCreateUser(req: VercelRequest, res: VercelResponse) {
  const callerClient = getSupabaseClient(req);
  const callerRole = await getRoleFromRequest(req, callerClient);
  if (callerRole !== "admin") return fail(res, "Solo los administradores pueden crear usuarios.", 403);

  const {
    email, password,
    company_name = "", contact_name = "",
    client_type = "mayorista", default_margin = 20,
    role = "client", phone = "",
    utm_source, utm_medium, utm_campaign, utm_term, attribution_history, landing_page,
  } = req.body as Record<string, unknown>;

  const normalizedRole = role === "sales" ? "vendedor" : role;

  if (!email || typeof email !== "string" || !email.includes("@")) return fail(res, "Email inválido.");
  if (!password || typeof password !== "string" || (password as string).length < 6) return fail(res, "La contraseña debe tener al menos 6 caracteres.");

  const adminClient = getSupabaseAdmin();

  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: email as string,
    password: password as string,
    email_confirm: true,
    user_metadata: { company_name, contact_name, client_type, default_margin: Number(default_margin) || 20, role: normalizedRole, phone, email },
  });

  if (authError || !authData?.user) {
    const msg = authError?.message ?? "Error al crear el usuario.";
    if (msg.toLowerCase().includes("already registered") || msg.toLowerCase().includes("already exists")) return fail(res, "El email ya está registrado.", 409);
    return fail(res, msg, 500);
  }

  const userId = authData.user.id;

  const { error: profileError } = await adminClient.from("profiles").upsert({
    id: userId, email: email as string, phone: phone as string || null,
    company_name: company_name as string, contact_name: contact_name as string,
    client_type: client_type as string, default_margin: Number(default_margin) || 20,
    role: normalizedRole as string, active: true,
  }, { onConflict: "id" });

  if (profileError) console.error("[create-user] Profile upsert failed:", profileError.message);

  const hasUTM = utm_source || utm_medium || utm_campaign;
  if (hasUTM) {
    await adminClient.from("lead_sources").upsert({
      user_id: userId,
      first_touch_source: utm_source as string ?? null, first_touch_medium: utm_medium as string ?? null,
      first_touch_campaign: utm_campaign as string ?? null, first_touch_term: utm_term as string ?? null,
      first_touch_at: new Date().toISOString(), first_landing_page: landing_page as string ?? null,
      last_touch_source: utm_source as string ?? null, last_touch_medium: utm_medium as string ?? null,
      last_touch_campaign: utm_campaign as string ?? null, last_touch_term: utm_term as string ?? null,
      attribution_history: Array.isArray(attribution_history) ? attribution_history : [],
      registered_at: new Date().toISOString(),
    }, { onConflict: "user_id" }).then(({ error }) => {
      if (error) console.error("[create-user] lead_sources upsert failed:", error.message);
    });
  }

  return ok(res, { id: userId, email: authData.user.email }, 201);
}

// ── PATCH: Edit user/seller ───────────────────────────────────────────────────

async function handleManageUser(req: VercelRequest, res: VercelResponse) {
  const callerClient = getSupabaseClient(req);
  const callerRole = await getRoleFromRequest(req, callerClient);
  if (callerRole !== "admin") return fail(res, "Solo los administradores pueden gestionar vendedores.", 403);

  const { id, email, contact_name, company_name, role, active } = req.body as Record<string, unknown>;

  if (!id || typeof id !== "string") return fail(res, "Id de usuario inválido.");
  if (email !== undefined && (typeof email !== "string" || !email.includes("@"))) return fail(res, "Email inválido.");
  if (contact_name !== undefined && (typeof contact_name !== "string" || !contact_name.trim())) return fail(res, "Nombre obligatorio.");
  if (role !== undefined && String(role) !== "sales") return fail(res, "Rol inválido.");
  if (active !== undefined && typeof active !== "boolean") return fail(res, "Estado inválido.");

  const adminClient = getSupabaseAdmin();

  const { data: profile, error: profileError } = await adminClient
    .from("profiles").select("id, email, contact_name, company_name, role, active").eq("id", id).maybeSingle();

  if (profileError) return fail(res, profileError.message, 500);
  if (!profile) return fail(res, "Usuario no encontrado.", 404);

  const nextEmail = typeof email === "string" ? email.trim().toLowerCase() : String(profile.email ?? "").trim().toLowerCase();
  const nextContactName = typeof contact_name === "string" ? contact_name.trim() : String(profile.contact_name ?? "");
  const nextCompanyName = typeof company_name === "string" && company_name.trim() ? company_name.trim() : nextContactName;
  const nextActive = typeof active === "boolean" ? active : Boolean(profile.active ?? true);

  const { data: duplicate } = await adminClient.from("profiles").select("id").eq("email", nextEmail).neq("id", id).limit(1).maybeSingle();
  if (duplicate) return fail(res, "El email ya está registrado.", 409);

  const { error: authError } = await adminClient.auth.admin.updateUserById(id, {
    ...(nextEmail ? { email: nextEmail } : {}),
    user_metadata: { email: nextEmail, contact_name: nextContactName, company_name: nextCompanyName, role: "sales" },
  });

  if (authError) {
    const msg = authError.message ?? "No se pudo actualizar el usuario.";
    if (msg.toLowerCase().includes("already registered") || msg.toLowerCase().includes("already exists")) return fail(res, "El email ya está registrado.", 409);
    return fail(res, msg, 500);
  }

  const { error: updateProfileError } = await adminClient.from("profiles")
    .update({ email: nextEmail || null, contact_name: nextContactName, company_name: nextCompanyName, role: "vendedor", active: nextActive })
    .eq("id", id);

  if (updateProfileError) return fail(res, updateProfileError.message, 500);

  return ok(res, { id, email: nextEmail, contact_name: nextContactName, company_name: nextCompanyName, role: "sales", active: nextActive });
}
