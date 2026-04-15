import { backend, hasBackendUrl } from "./backend";
import { supabase } from "@/lib/supabase";

export type RegistrationStatus = "pending" | "approved" | "rejected";

export interface AssignedExecutive {
  id?: string;
  email: string;
  name: string;
  role: string;
}

export interface RegistrationRequest {
  id: string;
  cuit: string;
  company_name: string;
  contact_name: string;
  email: string;
  entity_type: "empresa" | "persona_fisica";
  tax_status: string;
  status: RegistrationStatus;
  assigned_to: string | null;
  assigned_seller?: { id: string; name: string; email: string } | null;
  notes: string | null;
  approved_user_id?: string | null;
  created_at: string;
}

export interface CreateRegistrationRequestPayload {
  cuit: string;
  company_name?: string;
  contact_name: string;
  email: string;
  password: string;
  entity_type?: "empresa" | "persona_fisica";
  tax_status: string;
}

export interface RegistrationRequestResult {
  id?: string;
  assigned_to: string | null;
  assigned_executive?: AssignedExecutive | null;
}

export interface UpdateRegistrationRequestPayload {
  status: RegistrationStatus;
  notes?: string;
  client_type?: "mayorista" | "reseller" | "empresa";
  default_margin?: number;
}

async function getSessionHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Sesion expirada. Volve a iniciar sesion.");
  }

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  };
}

async function readLegacyResponse<T>(response: Response): Promise<{ ok?: boolean; data?: T; error?: string }> {
  const raw = await response.text();
  if (!raw) {
    return {
      ok: response.ok,
      error: response.ok ? undefined : "Respuesta vacia del servidor.",
    };
  }

  try {
    return JSON.parse(raw) as { ok?: boolean; data?: T; error?: string };
  } catch {
    return { ok: response.ok, error: raw };
  }
}

export async function createRegistrationRequest(
  payload: CreateRegistrationRequestPayload,
): Promise<RegistrationRequestResult> {
  if (hasBackendUrl) {
    return backend.post<RegistrationRequestResult>("/v1/public/registration-requests", payload);
  }

  const response = await fetch("/api/create-user", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const result = await readLegacyResponse<RegistrationRequestResult>(response);

  if (!response.ok || !result.ok || !result.data) {
    throw new Error(result.error ?? "No pudimos procesar la solicitud.");
  }

  return result.data;
}

export async function listRegistrationRequests(
  status: RegistrationStatus | "all" = "all",
): Promise<RegistrationRequest[]> {
  if (hasBackendUrl) {
    return backend.get<RegistrationRequest[]>("/v1/admin/registration-requests", { status });
  }

  const headers = await getSessionHeaders();
  const response = await fetch(`/api/create-user?scope=registration-requests&status=${status}`, {
    method: "GET",
    headers,
  });
  const result = await readLegacyResponse<RegistrationRequest[]>(response);

  if (!response.ok || !result.ok) {
    throw new Error(result.error ?? "No se pudieron cargar las solicitudes.");
  }

  return result.data ?? [];
}

export async function updateRegistrationRequest(
  requestId: string,
  payload: UpdateRegistrationRequestPayload,
): Promise<{ id: string; status: RegistrationStatus; approved_user_id?: string | null; used_temp_password?: boolean }> {
  if (hasBackendUrl) {
    return backend.patch(`/v1/admin/registration-requests/${requestId}`, payload);
  }

  const headers = await getSessionHeaders();
  const response = await fetch("/api/create-user?scope=registration-requests", {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      id: requestId,
      ...payload,
    }),
  });
  const result = await readLegacyResponse<{
    id: string;
    status: RegistrationStatus;
    approved_user_id?: string | null;
    used_temp_password?: boolean;
  }>(response);

  if (!response.ok || !result.ok || !result.data) {
    throw new Error(result.error ?? "No se pudo actualizar la solicitud.");
  }

  return result.data;
}
