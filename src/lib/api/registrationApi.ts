import { BackendError, backend } from "./backendClient";
import { supabase } from "@/lib/supabase";

export type RegistrationBaseStatus = "pending" | "approved" | "rejected";
export type RegistrationWorkflowStatus =
  | "pending_review"
  | "auto_approved"
  | "approved_manual"
  | "rejected";

export interface AssignedExecutive {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface CuitLookupResult {
  companyName: string;
  taxStatus: string;
  entityType: "empresa" | "persona_fisica";
  active: boolean;
}

export interface CreateRegistrationRequestPayload {
  cuit: string;
  company_name?: string;
  contact_name: string;
  email: string;
  password: string;
  entity_type?: "empresa" | "persona_fisica";
  tax_status: string;
  is_corporate_email?: boolean;
  force_pending_review?: boolean;
  review_flags?: string[];
  attribution?: {
    utm_source?: string | null;
    utm_medium?: string | null;
    utm_campaign?: string | null;
    utm_term?: string | null;
    utm_content?: string | null;
    gclid?: string | null;
    wbraid?: string | null;
    gbraid?: string | null;
  };
}

export interface CreateRegistrationRequestResult {
  id: string;
  status: "auto_approved" | "pending_review";
  assigned_to: string | null;
  assigned_executive: AssignedExecutive | null;
  approved_user_id: string | null;
  review_flags: string[];
  next_action: "auto_login" | "await_review";
}

export interface RegistrationRequestRecord {
  id: string;
  cuit: string;
  company_name: string;
  contact_name: string;
  email: string;
  entity_type: "empresa" | "persona_fisica";
  tax_status: string;
  status: RegistrationBaseStatus;
  workflow_status: RegistrationWorkflowStatus;
  assigned_to: string | null;
  assigned_seller_id?: string | null;
  assigned_seller?: { id: string; name: string; email: string } | null;
  approval_mode?: "auto" | "manual" | null;
  review_flags: string[];
  notes: string | null;
  approved_user_id?: string | null;
  approved_at?: string | null;
  rejected_at?: string | null;
  auto_approved_at?: string | null;
  created_at: string;
}

export interface UpdateRegistrationRequestPayload {
  status: RegistrationBaseStatus;
  notes?: string;
  client_type?: "mayorista" | "reseller" | "empresa";
  default_margin?: number;
}

export interface UpdateRegistrationRequestResult {
  id: string;
  status: RegistrationBaseStatus;
  workflow_status: RegistrationWorkflowStatus;
  approved_user_id?: string | null;
  used_temp_password?: boolean;
}

type LocalApiEnvelope<T> =
  | { ok: true; data: T }
  | { ok?: false; error?: string };

function shouldFallbackToLocal(error: unknown): boolean {
  if (error instanceof BackendError) {
    if ([0, 404, 502, 503, 504].includes(error.status)) return true;
    return false;
  }
  if (error instanceof Error) {
    return (
      error.message.includes("VITE_BACKEND_URL") ||
      error.message.includes("Failed to fetch")
    );
  }
  return false;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {};
}

async function callLocalApi<T>(
  path: string,
  method: "GET" | "PUT" | "PATCH",
  body?: unknown,
): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const envelope = (await response
    .json()
    .catch(() => ({ ok: false, error: response.statusText }))) as LocalApiEnvelope<T>;

  if (!response.ok || !envelope.ok) {
    const localError = (envelope as { error?: string }).error;
    throw new Error(localError ?? "Error en API local de registro.");
  }

  return envelope.data;
}

export async function lookupCuit(cuit: string): Promise<CuitLookupResult> {
  try {
    return await backend.get<CuitLookupResult>("/v1/public/cuit-lookup", { cuit });
  } catch (error) {
    if (!shouldFallbackToLocal(error)) throw error;
    return callLocalApi<CuitLookupResult>(`/api/users?cuit=${encodeURIComponent(cuit)}`, "GET");
  }
}

export async function createRegistrationRequest(
  payload: CreateRegistrationRequestPayload,
): Promise<CreateRegistrationRequestResult> {
  try {
    return await backend.post<CreateRegistrationRequestResult>("/v1/public/registration-requests", payload);
  } catch (error) {
    if (!shouldFallbackToLocal(error)) throw error;
    return callLocalApi<CreateRegistrationRequestResult>("/api/users", "PUT", payload);
  }
}

export async function listRegistrationRequests(
  status: RegistrationWorkflowStatus | "all" = "pending_review",
): Promise<RegistrationRequestRecord[]> {
  try {
    return await backend.get<RegistrationRequestRecord[]>("/v1/admin/registration-requests", { status });
  } catch (error) {
    if (!shouldFallbackToLocal(error)) throw error;
    return callLocalApi<RegistrationRequestRecord[]>(
      `/api/users?scope=registration-requests&status=${encodeURIComponent(status)}`,
      "GET",
    );
  }
}

export async function updateRegistrationRequest(
  requestId: string,
  payload: UpdateRegistrationRequestPayload,
): Promise<UpdateRegistrationRequestResult> {
  try {
    return await backend.patch<UpdateRegistrationRequestResult>(`/v1/admin/registration-requests/${requestId}`, payload);
  } catch (error) {
    if (!shouldFallbackToLocal(error)) throw error;
    return callLocalApi<UpdateRegistrationRequestResult>(
      "/api/users?scope=registration-requests",
      "PATCH",
      {
        id: requestId,
        ...payload,
      },
    );
  }
}
