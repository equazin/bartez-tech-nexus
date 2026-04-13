import { backend } from "./backendClient";

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

export async function lookupCuit(cuit: string): Promise<CuitLookupResult> {
  return backend.get<CuitLookupResult>("/v1/public/cuit-lookup", { cuit });
}

export async function createRegistrationRequest(
  payload: CreateRegistrationRequestPayload,
): Promise<CreateRegistrationRequestResult> {
  return backend.post<CreateRegistrationRequestResult>("/v1/public/registration-requests", payload);
}

export async function listRegistrationRequests(
  status: RegistrationWorkflowStatus | "all" = "pending_review",
): Promise<RegistrationRequestRecord[]> {
  return backend.get<RegistrationRequestRecord[]>("/v1/admin/registration-requests", { status });
}

export async function updateRegistrationRequest(
  requestId: string,
  payload: UpdateRegistrationRequestPayload,
): Promise<UpdateRegistrationRequestResult> {
  return backend.patch<UpdateRegistrationRequestResult>(`/v1/admin/registration-requests/${requestId}`, payload);
}
