import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fail, methodNotAllowed, ok } from "./_shared/http.js";
import { getSupabaseAdmin, getSupabaseClient } from "./_shared/supabaseServer.js";
import { getRoleFromRequest } from "./_shared/roles.js";

type RegistrationStatus = "pending" | "approved" | "rejected";

type RegistrationRow = {
  id: string;
  cuit: string;
  company_name: string;
  contact_name: string;
  email: string;
  requested_password: string | null;
  entity_type: "empresa" | "persona_fisica";
  tax_status: string;
  status: RegistrationStatus;
  assigned_to: string | null;
  assigned_seller_id: string | null;
  approved_user_id: string | null;
  notes: string | null;
  created_at: string;
};

type SellerRecord = { id: string; name: string; email: string };

type AssignedExecutive = { id: string; email: string; name: string; role: string } | null;

/**
 * GET   /api/create-user?cuit=XXXXXXXXXXX                      -> AFIP lookup
 * GET   /api/create-user?scope=registration-requests&status=* -> admin list registration requests
 * PUT   /api/create-user                                       -> submit public B2B registration request
 * POST  /api/create-user                                       -> create user (admin)
 * PATCH /api/create-user                                       -> edit seller (admin)
 * PATCH /api/create-user?scope=registration-requests          -> approve/reject registration request (admin)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const scope = String(req.query.scope ?? "");

    if (req.method === "GET" && scope === "registration-requests") {
      return await handleListRegistrationRequests(req, res);
    }
    if (req.method === "GET") {
      return await handleAfipLookup(req, res);
    }
    if (req.method === "PUT") {
      return await handleRegistrationRequest(req, res);
    }
    if (req.method === "POST") {
      return await handleCreateUser(req, res);
    }
    if (req.method === "PATCH" && scope === "registration-requests") {
      return await handleUpdateRegistrationRequest(req, res);
    }
    if (req.method === "PATCH") {
      return await handleManageUser(req, res);
    }

    return methodNotAllowed(res, ["GET", "PUT", "POST", "PATCH"]);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error interno del servidor.";
    console.error("[create-user] Unhandled error:", msg);
    return fail(res, msg, 500);
  }
}

async function handleAfipLookup(req: VercelRequest, res: VercelResponse) {
  const cuit = String(req.query.cuit ?? "").replace(/\D/g, "");
  if (cuit.length !== 11) return fail(res, "El CUIT debe tener 11 digitos.", 400);

  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((acc, w, i) => acc + w * Number(cuit[i]), 0);
  const remainder = sum % 11;
  if (remainder === 1) return fail(res, "El CUIT ingresado no es valido. Verifica los numeros.", 400);
  const expected = remainder === 0 ? 0 : 11 - remainder;
  if (expected !== Number(cuit[10])) return fail(res, "El CUIT ingresado no es valido. Verifica los numeros.", 400);

  try {
    const res2 = await fetch(`https://www.cuitonline.com/detalle/${cuit}/`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });

    const html = await res2.text();
    const titleMatch = html.match(/<title>([^(]+)\s*\(/);
    const companyName = titleMatch ? titleMatch[1].trim() : "";
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

async function resolveAssignedExecutive(adminClient: ReturnType<typeof getSupabaseAdmin>, cuit: string): Promise<AssignedExecutive> {
  const normalizedCuit = cuit.replace(/\D/g, "");
  const lastDigit = Number.parseInt(normalizedCuit.slice(-1), 10) || 0;

  const { data } = await adminClient
    .from("profiles")
    .select("id, email, contact_name, company_name, role, active")
    .in("role", ["vendedor", "sales"])
    .eq("active", true)
    .not("email", "is", null)
    .order("contact_name", { ascending: true });

  const sellers = ((data as Array<Record<string, unknown>> | null) ?? [])
    .map((item) => ({
      id: String(item.id ?? ""),
      email: String(item.email ?? "").trim().toLowerCase(),
      name: String(item.contact_name ?? item.company_name ?? "").trim(),
      role: "Ejecutivo comercial",
    }))
    .filter((item) => item.id && item.email);

  if (sellers.length > 0) {
    return sellers[lastDigit % sellers.length];
  }

  return null;
}

async function handleRegistrationRequest(req: VercelRequest, res: VercelResponse) {
  const { cuit, company_name, contact_name, email, password, entity_type, tax_status } =
    req.body as Record<string, unknown>;

  if (!cuit || typeof cuit !== "string") return fail(res, "CUIT requerido.", 400);
  if (!contact_name || typeof contact_name !== "string" || !contact_name.trim()) return fail(res, "Nombre requerido.", 400);
  if (!email || typeof email !== "string" || !email.includes("@")) return fail(res, "Email invalido.", 400);
  if (!password || typeof password !== "string" || password.length < 6) {
    return fail(res, "La contrasena debe tener al menos 6 caracteres.", 400);
  }

  const adminClient = getSupabaseAdmin();
  const assignedExecutive = await resolveAssignedExecutive(adminClient, cuit);
  const { data, error } = await adminClient
    .from("b2b_registration_requests")
    .insert({
      cuit: cuit.replace(/\D/g, ""),
      company_name: (typeof company_name === "string" && company_name.trim()) || (contact_name as string),
      contact_name: (contact_name as string).trim(),
      email: (email as string).trim().toLowerCase(),
      requested_password: password,
      entity_type: entity_type ?? "empresa",
      tax_status: tax_status ?? "responsable_inscripto",
      assigned_to: assignedExecutive?.email ?? null,
      assigned_seller_id: assignedExecutive?.id ?? null,
      status: "pending",
    })
    .select("id, assigned_to")
    .single();

  if (error) {
    console.error("[registration-request] insert failed:", error.message);
    return fail(res, "No se pudo guardar la solicitud. Intenta de nuevo.", 500);
  }

  return ok(res, {
    id: data.id,
    assigned_to: data.assigned_to,
    assigned_executive: assignedExecutive,
  }, 201);
}

async function ensureAdmin(req: VercelRequest, res: VercelResponse) {
  const callerClient = getSupabaseClient(req);
  const callerRole = await getRoleFromRequest(req, callerClient);
  if (callerRole !== "admin") {
    fail(res, "Solo los administradores pueden gestionar altas B2B.", 403);
    return null;
  }
  return getSupabaseAdmin();
}

async function buildSellerMap(adminClient: ReturnType<typeof getSupabaseAdmin>, requests: RegistrationRow[]) {
  const sellerIds = requests
    .map((item) => item.assigned_seller_id?.trim())
    .filter((value): value is string => Boolean(value));
  const sellerEmails = requests
    .map((item) => item.assigned_to?.trim().toLowerCase())
    .filter((value): value is string => Boolean(value));

  const map = new Map<string, SellerRecord>();

  if (sellerIds.length > 0) {
    const { data: sellersById } = await adminClient
      .from("profiles")
      .select("id, email, contact_name, company_name")
      .in("id", [...new Set(sellerIds)]);

    for (const item of (sellersById as Array<Record<string, unknown>> | null) ?? []) {
      const record = {
        id: String(item.id ?? ""),
        name: String(item.contact_name ?? item.company_name ?? "").trim(),
        email: String(item.email ?? "").trim().toLowerCase(),
      };
      if (record.id) map.set(record.id, record);
      if (record.email) map.set(record.email, record);
    }
  }

  if (sellerEmails.length > 0) {
    const missingEmails = [...new Set(sellerEmails)].filter((email) => !map.has(email));
    if (missingEmails.length > 0) {
      const { data: sellersByEmail } = await adminClient
        .from("profiles")
        .select("id, email, contact_name, company_name")
        .in("email", missingEmails);

      for (const item of (sellersByEmail as Array<Record<string, unknown>> | null) ?? []) {
        const record = {
          id: String(item.id ?? ""),
          name: String(item.contact_name ?? item.company_name ?? "").trim(),
          email: String(item.email ?? "").trim().toLowerCase(),
        };
        if (record.id) map.set(record.id, record);
        if (record.email) map.set(record.email, record);
      }
    }
  }

  return map;
}

async function handleListRegistrationRequests(req: VercelRequest, res: VercelResponse) {
  const adminClient = await ensureAdmin(req, res);
  if (!adminClient) return res;

  const status = String(req.query.status ?? "pending");
  const query = adminClient
    .from("b2b_registration_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (status !== "all") {
    query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) return fail(res, error.message, 500);

  const requests = (data as RegistrationRow[] | null) ?? [];
  const sellerMap = await buildSellerMap(adminClient, requests);

  return ok(
    res,
    requests.map((request) => ({
      ...request,
      assigned_seller:
        (request.assigned_seller_id ? sellerMap.get(request.assigned_seller_id) : undefined)
        ?? (request.assigned_to ? sellerMap.get(request.assigned_to.trim().toLowerCase()) : undefined)
        ?? null,
    })),
  );
}

async function approveRegistration(adminClient: ReturnType<typeof getSupabaseAdmin>, request: RegistrationRow) {
  if (request.approved_user_id) {
    return { userId: request.approved_user_id, alreadyCreated: true };
  }

  const normalizedEmail = request.email.trim().toLowerCase();

  const { data: existingProfile } = await adminClient
    .from("profiles")
    .select("id, role")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (existingProfile?.id) {
    await adminClient
      .from("profiles")
      .update({
        assigned_seller_id: request.assigned_seller_id ?? undefined,
        active: true,
        cuit: request.cuit,
      })
      .eq("id", existingProfile.id);

    return { userId: String(existingProfile.id), alreadyCreated: true };
  }

  if (!request.requested_password || request.requested_password.length < 6) {
    throw new Error("La solicitud no tiene una contrasena valida para crear el acceso del cliente.");
  }

  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: normalizedEmail,
    password: request.requested_password,
    email_confirm: true,
    user_metadata: {
      company_name: request.company_name,
      contact_name: request.contact_name,
      role: "client",
      client_type: "empresa",
      cuit: request.cuit,
    },
  });

  if (authError || !authData?.user) {
    const message = authError?.message ?? "No se pudo crear el acceso del cliente.";
    if (message.toLowerCase().includes("already")) {
      throw new Error("El email ya existe en Auth. Revisa la cuenta antes de aprobar la solicitud.");
    }
    throw new Error(message);
  }

  const userId = authData.user.id;

  const { error: profileError } = await adminClient.from("profiles").upsert(
    {
      id: userId,
      email: normalizedEmail,
      company_name: request.company_name,
      contact_name: request.contact_name,
      role: "client",
      client_type: "empresa",
      default_margin: 20,
      active: true,
      cuit: request.cuit,
      assigned_seller_id: request.assigned_seller_id,
    },
    { onConflict: "id" },
  );

  if (profileError) {
    await adminClient.auth.admin.deleteUser(userId);
    throw new Error(profileError.message);
  }

  return { userId, alreadyCreated: false };
}

async function handleUpdateRegistrationRequest(req: VercelRequest, res: VercelResponse) {
  const adminClient = await ensureAdmin(req, res);
  if (!adminClient) return res;

  const { id, status, notes } = req.body as Record<string, unknown>;
  if (!id || typeof id !== "string") return fail(res, "Id invalido.", 400);
  if (!status || !["pending", "approved", "rejected"].includes(String(status))) {
    return fail(res, "Estado invalido.", 400);
  }

  const { data: request, error: requestError } = await adminClient
    .from("b2b_registration_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (requestError) return fail(res, requestError.message, 500);
  if (!request) return fail(res, "Solicitud no encontrada.", 404);

  const payload: { status: string; notes?: string | null; approved_user_id?: string | null; requested_password?: null } = {
    status: String(status),
  };
  if (notes !== undefined) {
    payload.notes = typeof notes === "string" ? notes : null;
  }

  if (status === "approved") {
    try {
      const approval = await approveRegistration(adminClient, request as RegistrationRow);
      payload.approved_user_id = approval.userId;
      payload.requested_password = null;
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : "No se pudo aprobar la solicitud.", 409);
    }
  }

  const { error } = await adminClient
    .from("b2b_registration_requests")
    .update(payload)
    .eq("id", id);

  if (error) return fail(res, error.message, 500);
  return ok(res, { id, status, approved_user_id: payload.approved_user_id ?? null });
}

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

  if (!email || typeof email !== "string" || !email.includes("@")) return fail(res, "Email invalido.");
  if (!password || typeof password !== "string" || password.length < 6) return fail(res, "La contrasena debe tener al menos 6 caracteres.");

  const adminClient = getSupabaseAdmin();

  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: email as string,
    password: password as string,
    email_confirm: true,
    user_metadata: { company_name, contact_name, client_type, default_margin: Number(default_margin) || 20, role: normalizedRole, phone, email },
  });

  if (authError || !authData?.user) {
    const msg = authError?.message ?? "Error al crear el usuario.";
    if (msg.toLowerCase().includes("already registered") || msg.toLowerCase().includes("already exists")) return fail(res, "El email ya esta registrado.", 409);
    return fail(res, msg, 500);
  }

  const userId = authData.user.id;

  const { error: profileError } = await adminClient.from("profiles").upsert({
    id: userId,
    email: email as string,
    phone: (phone as string) || null,
    company_name: company_name as string,
    contact_name: contact_name as string,
    client_type: client_type as string,
    default_margin: Number(default_margin) || 20,
    role: normalizedRole as string,
    active: true,
  }, { onConflict: "id" });

  if (profileError) console.error("[create-user] Profile upsert failed:", profileError.message);

  const hasUTM = utm_source || utm_medium || utm_campaign;
  if (hasUTM) {
    await adminClient.from("lead_sources").upsert({
      user_id: userId,
      first_touch_source: (utm_source as string) ?? null,
      first_touch_medium: (utm_medium as string) ?? null,
      first_touch_campaign: (utm_campaign as string) ?? null,
      first_touch_term: (utm_term as string) ?? null,
      first_touch_at: new Date().toISOString(),
      first_landing_page: (landing_page as string) ?? null,
      last_touch_source: (utm_source as string) ?? null,
      last_touch_medium: (utm_medium as string) ?? null,
      last_touch_campaign: (utm_campaign as string) ?? null,
      last_touch_term: (utm_term as string) ?? null,
      attribution_history: Array.isArray(attribution_history) ? attribution_history : [],
      registered_at: new Date().toISOString(),
    }, { onConflict: "user_id" }).then(({ error }) => {
      if (error) console.error("[create-user] lead_sources upsert failed:", error.message);
    });
  }

  return ok(res, { id: userId, email: authData.user.email }, 201);
}

async function handleManageUser(req: VercelRequest, res: VercelResponse) {
  const callerClient = getSupabaseClient(req);
  const callerRole = await getRoleFromRequest(req, callerClient);
  if (callerRole !== "admin") return fail(res, "Solo los administradores pueden gestionar vendedores.", 403);

  const { id, email, contact_name, company_name, role, active } = req.body as Record<string, unknown>;

  if (!id || typeof id !== "string") return fail(res, "Id de usuario invalido.");
  if (email !== undefined && (typeof email !== "string" || !email.includes("@"))) return fail(res, "Email invalido.");
  if (contact_name !== undefined && (typeof contact_name !== "string" || !contact_name.trim())) return fail(res, "Nombre obligatorio.");
  if (role !== undefined && String(role) !== "sales") return fail(res, "Rol invalido.");
  if (active !== undefined && typeof active !== "boolean") return fail(res, "Estado invalido.");

  const adminClient = getSupabaseAdmin();

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, email, contact_name, company_name, role, active")
    .eq("id", id)
    .maybeSingle();

  if (profileError) return fail(res, profileError.message, 500);
  if (!profile) return fail(res, "Usuario no encontrado.", 404);

  const nextEmail = typeof email === "string" ? email.trim().toLowerCase() : String(profile.email ?? "").trim().toLowerCase();
  const nextContactName = typeof contact_name === "string" ? contact_name.trim() : String(profile.contact_name ?? "");
  const nextCompanyName = typeof company_name === "string" && company_name.trim() ? company_name.trim() : nextContactName;
  const nextActive = typeof active === "boolean" ? active : Boolean(profile.active ?? true);

  const { data: duplicate } = await adminClient
    .from("profiles")
    .select("id")
    .eq("email", nextEmail)
    .neq("id", id)
    .limit(1)
    .maybeSingle();
  if (duplicate) return fail(res, "El email ya esta registrado.", 409);

  const { error: authError } = await adminClient.auth.admin.updateUserById(id, {
    ...(nextEmail ? { email: nextEmail } : {}),
    user_metadata: { email: nextEmail, contact_name: nextContactName, company_name: nextCompanyName, role: "sales" },
  });

  if (authError) {
    const msg = authError.message ?? "No se pudo actualizar el usuario.";
    if (msg.toLowerCase().includes("already registered") || msg.toLowerCase().includes("already exists")) return fail(res, "El email ya esta registrado.", 409);
    return fail(res, msg, 500);
  }

  const { error: updateProfileError } = await adminClient.from("profiles")
    .update({ email: nextEmail || null, contact_name: nextContactName, company_name: nextCompanyName, role: "vendedor", active: nextActive })
    .eq("id", id);

  if (updateProfileError) return fail(res, updateProfileError.message, 500);

  return ok(res, { id, email: nextEmail, contact_name: nextContactName, company_name: nextCompanyName, role: "sales", active: nextActive });
}
