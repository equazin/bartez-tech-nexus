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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === "GET") return await handleList(req, res);
    if (req.method === "PATCH") return await handleUpdate(req, res);
    return methodNotAllowed(res, ["GET", "PATCH"]);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno del servidor.";
    console.error("[registration-requests] Unhandled error:", message);
    return fail(res, message, 500);
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

async function handleList(req: VercelRequest, res: VercelResponse) {
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
    throw new Error("La solicitud no tiene una contraseña válida para crear el acceso del cliente.");
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
      throw new Error("El email ya existe en Auth. Revisá la cuenta antes de aprobar la solicitud.");
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

async function handleUpdate(req: VercelRequest, res: VercelResponse) {
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

