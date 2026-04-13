import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { fail, methodNotAllowed, ok } from "./_shared/http.js";
import { getRoleFromRequest, ensureWriteRole } from "./_shared/roles.js";
import { updateProfileSchema } from "./_shared/schemas.js";
import { getSupabaseAdmin, getSupabaseClient } from "./_shared/supabaseServer.js";

/**
 * Consolidated users handler — replaces create-user.ts, profiles.ts, impersonate.ts
 *
 * Routing via ?scope=
 *   (no scope)                              → create-user / manage-user logic
 *   ?scope=registration-requests            → B2B registration requests (admin)
 *   ?scope=profile                          → update own profile (PATCH)
 *   ?scope=impersonate                      → start/stop impersonation
 *
 * Original URLs preserved 1-to-1 via vercel.json rewrites:
 *   /api/create-user   → /api/users?scope=create-user   (handled as default)
 *   /api/profiles      → /api/users?scope=profile
 *   /api/impersonate   → /api/users?scope=impersonate
 */

// ─── Types ────────────────────────────────────────────────────────────────────

type RegistrationStatus = "pending" | "approved" | "rejected";
type RegistrationWorkflowStatus =
  | "pending_review"
  | "auto_approved"
  | "approved_manual"
  | "rejected";

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
  updated_at?: string | null;
  review_flags?: string[] | null;
};

type SellerRecord = { id: string; name: string; email: string };

type AssignedExecutive = { id: string; email: string; name: string; role: string } | null;

type RegistrationInsertResult = {
  id: string;
  assigned_to: string | null;
};

const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "yahoo.com.ar",
  "icloud.com",
  "me.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "gmx.com",
  "mail.com",
  "yandex.com",
  "zoho.com",
]);

// ─── Impersonate schemas ──────────────────────────────────────────────────────

const startImpersonateSchema = z.object({
  client_id: z.string().trim().min(1).max(128),
});

// ─── Main router ──────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const scope = String(req.query.scope ?? "");

    // ── /api/profiles → ?scope=profile ──────────────────────────────────────
    if (scope === "profile") {
      if (req.method === "PATCH") return updateProfile(req, res);
      return methodNotAllowed(res, ["PATCH"]);
    }

    // ── /api/impersonate → ?scope=impersonate ────────────────────────────────
    if (scope === "impersonate") {
      if (req.method === "POST")   return startImpersonation(req, res);
      if (req.method === "DELETE") return stopImpersonation(req, res);
      return methodNotAllowed(res, ["POST", "DELETE"]);
    }

    // ── /api/create-user (default scope) ─────────────────────────────────────
    if (req.method === "GET" && scope === "registration-requests") {
      return handleListRegistrationRequests(req, res);
    }
    if (req.method === "GET") {
      return handleAfipLookup(req, res);
    }
    if (req.method === "PUT") {
      return handleRegistrationRequest(req, res);
    }
    if (req.method === "POST") {
      return handleCreateUser(req, res);
    }
    if (req.method === "PATCH" && scope === "registration-requests") {
      return handleUpdateRegistrationRequest(req, res);
    }
    if (req.method === "PATCH") {
      return handleManageUser(req, res);
    }

    return methodNotAllowed(res, ["GET", "PUT", "POST", "PATCH"]);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error interno del servidor.";
    console.error("[users] Unhandled error:", msg);
    return fail(res, msg, 500);
  }
}

// ─── Profile (ex profiles.ts) ─────────────────────────────────────────────────

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

// ─── Impersonation (ex impersonate.ts) ───────────────────────────────────────

async function startImpersonation(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabaseClient(req);
    const role     = await getRoleFromRequest(req, supabase);

    if (role !== "admin" && role !== "vendedor" && role !== "sales") {
      return fail(res, "Forbidden: only admin and sellers can impersonate clients", 403);
    }

    const parsed = startImpersonateSchema.safeParse(req.body ?? {});
    if (!parsed.success) return fail(res, "Invalid payload", 400, parsed.error.flatten());

    const { client_id } = parsed.data;
    const admin = getSupabaseAdmin();

    const { data: clientProfile, error: profileError } = await admin
      .from("profiles")
      .select("*")
      .eq("id", client_id)
      .single();

    if (profileError || !clientProfile) return fail(res, "Client not found", 404);

    const clientRole = String((clientProfile as { role?: string }).role ?? "client").toLowerCase();
    if (clientRole === "admin") {
      return fail(res, "Cannot impersonate an admin account", 403);
    }

    const { data: authData } = await supabase.auth.getUser(
      req.headers.authorization?.slice(7) ?? ""
    );
    const actorId = authData.user?.id ?? "unknown";

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

// ─── Create-user (ex create-user.ts) ─────────────────────────────────────────

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

function getEmailDomain(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  const atIndex = normalized.lastIndexOf("@");
  if (atIndex <= 0 || atIndex === normalized.length - 1) return null;
  return normalized.slice(atIndex + 1);
}

function isCorporateEmail(email: string): boolean {
  const domain = getEmailDomain(email);
  return !!domain && !FREE_EMAIL_DOMAINS.has(domain);
}

function dedupeFlags(flags: string[]): string[] {
  return [...new Set(flags.filter(Boolean))];
}

function deriveWorkflowStatus(
  status: RegistrationStatus,
  approvedUserId: string | null | undefined,
  notes?: string | null,
): RegistrationWorkflowStatus {
  if (status === "rejected") return "rejected";
  if (status === "approved" && approvedUserId) {
    return notes === "AUTO_APPROVED" ? "auto_approved" : "approved_manual";
  }
  return "pending_review";
}

async function insertRegistrationRequest(
  adminClient: ReturnType<typeof getSupabaseAdmin>,
  payload: {
    cuit: string;
    company_name: string;
    contact_name: string;
    email: string;
    requested_password: string;
    entity_type: string;
    tax_status: string;
    assigned_to: string | null;
    assigned_seller_id: string | null;
    status: RegistrationStatus;
    review_flags?: string[];
  },
): Promise<{ data: RegistrationInsertResult | null; error: { message: string } | null }> {
  const attempts: Array<Record<string, unknown>> = [
    payload,
    {
      cuit: payload.cuit,
      company_name: payload.company_name,
      contact_name: payload.contact_name,
      email: payload.email,
      entity_type: payload.entity_type,
      tax_status: payload.tax_status,
      assigned_to: payload.assigned_to,
      status: payload.status,
    },
    {
      cuit: payload.cuit,
      company_name: payload.company_name,
      contact_name: payload.contact_name,
      email: payload.email,
      entity_type: payload.entity_type,
      tax_status: payload.tax_status,
      status: payload.status,
    },
    {
      cuit: payload.cuit,
      company_name: payload.company_name,
      contact_name: payload.contact_name,
      email: payload.email,
      status: payload.status,
    },
  ];

  let lastError: { message: string } | null = null;

  for (const attempt of attempts) {
    const { data, error } = await adminClient
      .from("b2b_registration_requests")
      .insert(attempt)
      .select("id, assigned_to")
      .single();

    if (!error && data) {
      return { data: data as RegistrationInsertResult, error: null };
    }

    lastError = error ? { message: error.message } : { message: "Respuesta vacia al insertar solicitud." };

    if (!error) continue;

    const retryable =
      /Could not find the .* column/i.test(error.message) ||
      /schema cache/i.test(error.message) ||
      /column .* does not exist/i.test(error.message);

    if (!retryable) {
      return { data: null, error: lastError };
    }
  }

  return { data: null, error: lastError };
}

async function handleRegistrationRequest(req: VercelRequest, res: VercelResponse) {
  const {
    cuit,
    company_name,
    contact_name,
    email,
    password,
    entity_type,
    tax_status,
    is_corporate_email,
    force_pending_review,
    review_flags,
  } =
    req.body as Record<string, unknown>;

  if (!cuit || typeof cuit !== "string") return fail(res, "CUIT requerido.", 400);
  if (!contact_name || typeof contact_name !== "string" || !contact_name.trim()) return fail(res, "Nombre requerido.", 400);
  if (!email || typeof email !== "string" || !email.includes("@")) return fail(res, "Email invalido.", 400);
  if (!password || typeof password !== "string" || password.length < 6) {
    return fail(res, "La contrasena debe tener al menos 6 caracteres.", 400);
  }

  const adminClient = getSupabaseAdmin();
  const normalizedCuit = cuit.replace(/\D/g, "");
  const normalizedTaxStatus = typeof tax_status === "string" ? tax_status.trim() : "";
  if (normalizedCuit.length !== 11) {
    return fail(res, "El CUIT debe tener 11 digitos.", 400);
  }
  if (!normalizedTaxStatus) {
    return fail(res, "Selecciona la condicion fiscal.", 400);
  }

  const normalizedEmail = (email as string).trim().toLowerCase();
  const normalizedEntityType =
    typeof entity_type === "string" && entity_type === "persona_fisica"
      ? "persona_fisica"
      : "empresa";

  const derivedReviewFlags: string[] = [];
  if (normalizedEntityType !== "empresa") derivedReviewFlags.push("cuit_not_empresa");

  const isCorporateEmailFromPayload =
    typeof is_corporate_email === "boolean" ? is_corporate_email : isCorporateEmail(normalizedEmail);
  if (!isCorporateEmailFromPayload) derivedReviewFlags.push("non_corporate_email");

  const providedFlags = Array.isArray(review_flags)
    ? review_flags.filter((flag): flag is string => typeof flag === "string")
    : [];
  const mergedReviewFlags = dedupeFlags([...providedFlags, ...derivedReviewFlags]);
  const manualReviewRequired =
    Boolean(force_pending_review) || mergedReviewFlags.includes("cuit_not_empresa") || mergedReviewFlags.includes("non_corporate_email");

  const assignedExecutive = await resolveAssignedExecutive(adminClient, cuit);
  const insertPayload = {
    cuit: normalizedCuit,
    company_name: (typeof company_name === "string" && company_name.trim()) || (contact_name as string),
    contact_name: (contact_name as string).trim(),
    email: normalizedEmail,
    requested_password: password,
    entity_type: normalizedEntityType,
    tax_status: normalizedTaxStatus,
    assigned_to: assignedExecutive?.email ?? null,
    assigned_seller_id: assignedExecutive?.id ?? null,
    status: "pending" as const,
    review_flags: mergedReviewFlags,
  };

  const { data, error } = await insertRegistrationRequest(adminClient, insertPayload);

  if (error) {
    console.error("[registration-request] insert failed:", error.message);
    return fail(res, "No se pudo guardar la solicitud. Intenta de nuevo.", 500);
  }

  if (!data) {
    return fail(res, "No se pudo guardar la solicitud. Intenta de nuevo.", 500);
  }

  if (manualReviewRequired) {
    return ok(
      res,
      {
        id: data.id,
        status: "pending_review",
        assigned_to: data.assigned_to,
        assigned_executive: assignedExecutive,
        approved_user_id: null,
        review_flags: mergedReviewFlags,
        next_action: "await_review",
      },
      201,
    );
  }

  try {
    const approval = await approveRegistration(
      adminClient,
      {
        id: data.id,
        cuit: normalizedCuit,
        company_name: insertPayload.company_name,
        contact_name: insertPayload.contact_name,
        email: normalizedEmail,
        requested_password: password,
        entity_type: normalizedEntityType,
        tax_status: normalizedTaxStatus,
        status: "pending",
        assigned_to: assignedExecutive?.email ?? null,
        assigned_seller_id: assignedExecutive?.id ?? null,
        approved_user_id: null,
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        client_type: "mayorista",
        default_margin: 20,
      },
    );

    const approvalPayload = {
      status: "approved",
      approved_user_id: approval.userId,
      requested_password: null,
      notes: "AUTO_APPROVED",
    };

    const { error: approvalUpdateError } = await adminClient
      .from("b2b_registration_requests")
      .update(approvalPayload)
      .eq("id", data.id);

    if (approvalUpdateError) {
      throw new Error(approvalUpdateError.message);
    }

    return ok(
      res,
      {
        id: data.id,
        status: "auto_approved",
        assigned_to: data.assigned_to,
        assigned_executive: assignedExecutive,
        approved_user_id: approval.userId,
        review_flags: mergedReviewFlags,
        next_action: "auto_login",
      },
      201,
    );
  } catch (approvalError) {
    const fallbackFlags = dedupeFlags([...mergedReviewFlags, "auto_approval_failed"]);
    console.error(
      "[registration-request] auto approval failed, fallback to manual review:",
      approvalError instanceof Error ? approvalError.message : String(approvalError),
    );

    return ok(
      res,
      {
        id: data.id,
        status: "pending_review",
        assigned_to: data.assigned_to,
        assigned_executive: assignedExecutive,
        approved_user_id: null,
        review_flags: fallbackFlags,
        next_action: "await_review",
      },
      201,
    );
  }

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

  const statusFilter = String(req.query.status ?? "pending_review") as RegistrationWorkflowStatus | "all";
  const query = adminClient
    .from("b2b_registration_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (statusFilter === "pending_review") {
    query.eq("status", "pending");
  } else if (statusFilter === "rejected") {
    query.eq("status", "rejected");
  } else if (statusFilter === "approved_manual" || statusFilter === "auto_approved") {
    query.eq("status", "approved");
  }

  const { data, error } = await query;
  if (error) return fail(res, error.message, 500);

  const requests = (data as RegistrationRow[] | null) ?? [];
  const sellerMap = await buildSellerMap(adminClient, requests);
  const mapped = requests.map((request) => {
    const rawFlags = (request as RegistrationRow & { review_flags?: unknown }).review_flags;
    const flags = Array.isArray(rawFlags)
      ? rawFlags.filter((flag): flag is string => typeof flag === "string")
      : [];
    if (request.entity_type !== "empresa") flags.push("cuit_not_empresa");
    if (!isCorporateEmail(request.email)) flags.push("non_corporate_email");
    const reviewFlags = dedupeFlags(flags);

    const workflowStatus = deriveWorkflowStatus(
      request.status,
      request.approved_user_id,
      request.notes,
    );

    return {
      ...request,
      workflow_status: workflowStatus,
      review_flags: reviewFlags,
      approval_mode:
        workflowStatus === "auto_approved"
          ? "auto"
          : workflowStatus === "approved_manual"
            ? "manual"
            : null,
      assigned_seller:
        (request.assigned_seller_id ? sellerMap.get(request.assigned_seller_id) : undefined)
        ?? (request.assigned_to ? sellerMap.get(request.assigned_to.trim().toLowerCase()) : undefined)
        ?? null,
    };
  });

  const filtered = statusFilter === "all"
    ? mapped
    : mapped.filter((request) => request.workflow_status === statusFilter);

  return ok(res, filtered);
}

async function approveRegistration(
  adminClient: ReturnType<typeof getSupabaseAdmin>,
  request: RegistrationRow,
  config?: { client_type?: string; default_margin?: number }
) {
  if (request.approved_user_id) {
    return { userId: request.approved_user_id, alreadyCreated: true };
  }

  const normalizedEmail = request.email.trim().toLowerCase();

  const { data: existingProfile } = await adminClient
    .from("profiles")
    .select("id, role, client_type, default_margin")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (existingProfile?.id) {
    await adminClient
      .from("profiles")
      .update({
        assigned_seller_id: request.assigned_seller_id ?? undefined,
        active: true,
        cuit: request.cuit,
        tax_status: request.tax_status,
        client_type: config?.client_type ?? existingProfile.client_type ?? "mayorista",
        default_margin: config?.default_margin ?? existingProfile.default_margin ?? 20,
      })
      .eq("id", existingProfile.id);

    return { userId: String(existingProfile.id), alreadyCreated: true };
  }

  const passwordToUse =
    request.requested_password && request.requested_password.length >= 6
      ? request.requested_password
      : Array.from(crypto.getRandomValues(new Uint8Array(12)))
          .map((b) => b.toString(36).padStart(2, "0"))
          .join("")
          .slice(0, 16);
  const usedTempPassword = !request.requested_password || request.requested_password.length < 6;

  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: normalizedEmail,
    password: passwordToUse,
    email_confirm: true,
    user_metadata: {
      company_name: request.company_name,
      contact_name: request.contact_name,
      role: "client",
      client_type: config?.client_type ?? "mayorista",
      cuit: request.cuit,
      tax_status: request.tax_status,
      default_margin: config?.default_margin ?? 20,
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
      client_type: config?.client_type ?? "mayorista",
      default_margin: config?.default_margin ?? 20,
      active: true,
      cuit: request.cuit,
      tax_status: request.tax_status,
      assigned_seller_id: request.assigned_seller_id,
      credit_limit: 0,
      credit_approved: false,
      max_order_value: 0,
    },
    { onConflict: "id" },
  );

  if (profileError) {
    await adminClient.auth.admin.deleteUser(userId);
    throw new Error(profileError.message);
  }

  return { userId, alreadyCreated: false, usedTempPassword };
}

async function handleUpdateRegistrationRequest(req: VercelRequest, res: VercelResponse) {
  const adminClient = await ensureAdmin(req, res);
  if (!adminClient) return res;

  const { id, status, notes, client_type, default_margin } = req.body as Record<string, unknown>;
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

  let usedTempPassword = false;
  if (status === "approved") {
    try {
      const approval = await approveRegistration(adminClient, request as RegistrationRow, {
        client_type: String(client_type || ""),
        default_margin: Number(default_margin) || undefined,
      });
      payload.approved_user_id = approval.userId;
      payload.requested_password = null;
      usedTempPassword = approval.usedTempPassword ?? false;
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : "No se pudo aprobar la solicitud.", 409);
    }
  }

  const { error } = await adminClient
    .from("b2b_registration_requests")
    .update(payload)
    .eq("id", id);

  if (error) return fail(res, error.message, 500);
  const workflowStatus = deriveWorkflowStatus(
    status as RegistrationStatus,
    payload.approved_user_id ?? null,
    payload.notes ?? null,
  );
  return ok(res, {
    id,
    status,
    workflow_status: workflowStatus,
    approved_user_id: payload.approved_user_id ?? null,
    used_temp_password: usedTempPassword,
  });
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
  const isClientRole = normalizedRole === "client" || normalizedRole === "cliente";

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
    ...(isClientRole
      ? {
          credit_limit: 0,
          credit_approved: false,
          max_order_value: 0,
        }
      : {}),
  }, { onConflict: "id" });

  if (profileError) console.error("[users] Profile upsert failed:", profileError.message);

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
      if (error) console.error("[users] lead_sources upsert failed:", error.message);
    });
  }

  return ok(res, { id: userId, email: authData.user.email }, 201);
}

async function handleManageUser(req: VercelRequest, res: VercelResponse) {
  const callerClient = getSupabaseClient(req);
  const callerRole = await getRoleFromRequest(req, callerClient);
  if (callerRole !== "admin") return fail(res, "Solo los administradores pueden gestionar vendedores.", 403);

  const { id, email, contact_name, company_name, role, active, phone } = req.body as Record<string, unknown>;

  if (!id || typeof id !== "string") return fail(res, "Id de usuario invalido.");
  if (email !== undefined && (typeof email !== "string" || !email.includes("@"))) return fail(res, "Email invalido.");
  if (contact_name !== undefined && (typeof contact_name !== "string" || !contact_name.trim())) return fail(res, "Nombre obligatorio.");
  if (role !== undefined && String(role) !== "sales") return fail(res, "Rol invalido.");
  if (active !== undefined && typeof active !== "boolean") return fail(res, "Estado invalido.");
  if (phone !== undefined && typeof phone !== "string") return fail(res, "Celular invalido.");

  const adminClient = getSupabaseAdmin();

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, email, contact_name, company_name, role, active, phone")
    .eq("id", id)
    .maybeSingle();

  if (profileError) return fail(res, profileError.message, 500);
  if (!profile) return fail(res, "Usuario no encontrado.", 404);

  const nextEmail = typeof email === "string" ? email.trim().toLowerCase() : String(profile.email ?? "").trim().toLowerCase();
  const nextContactName = typeof contact_name === "string" ? contact_name.trim() : String(profile.contact_name ?? "");
  const nextCompanyName = typeof company_name === "string" && company_name.trim() ? company_name.trim() : nextContactName;
  const nextActive = typeof active === "boolean" ? active : Boolean(profile.active ?? true);
  const nextPhone = typeof phone === "string" ? phone.trim() : String(profile.phone ?? "").trim();

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
    user_metadata: { email: nextEmail, contact_name: nextContactName, company_name: nextCompanyName, role: "sales", phone: nextPhone },
  });

  if (authError) {
    const msg = authError.message ?? "No se pudo actualizar el usuario.";
    if (msg.toLowerCase().includes("already registered") || msg.toLowerCase().includes("already exists")) return fail(res, "El email ya esta registrado.", 409);
    return fail(res, msg, 500);
  }

  const { error: updateProfileError } = await adminClient.from("profiles")
    .update({ email: nextEmail || null, contact_name: nextContactName, company_name: nextCompanyName, phone: nextPhone || null, role: "vendedor", active: nextActive })
    .eq("id", id);

  if (updateProfileError) return fail(res, updateProfileError.message, 500);

  return ok(res, { id, email: nextEmail, contact_name: nextContactName, company_name: nextCompanyName, phone: nextPhone, role: "sales", active: nextActive });
}

// Re-export ensureWriteRole to avoid unused import warning
void (ensureWriteRole as unknown);
