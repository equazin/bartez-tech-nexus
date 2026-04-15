import { supabase } from "@/lib/supabase";

import type {
  BackendList,
  BackendOrder,
  BackendPricingRuleRow,
  BackendProduct,
  BackendProfile,
  BackendQuoteRow,
  BackendRegistrationRequest,
  BackendRmaRow,
  BackendUpdateRegistrationResult,
  ChangePasswordInput,
  CreateRegistrationRequestInput,
  CuitLookupResponse,
  HealthCheckResponse,
  MeResponse,
  RegistrationRequestResponse,
  UpdateMyProfileInput,
} from "./backendTypes";

export type { BackendOrder, BackendList, BackendProduct, BackendQuoteRow, BackendRmaRow, BackendPricingRuleRow };

// ─── Admin input types ────────────────────────────────────────────────────────

export interface AdminCreateUserInput {
  email: string;
  password: string;
  company_name?: string;
  contact_name?: string;
  client_type?: string;
  default_margin?: number;
  role?: string;
  phone?: string;
  active?: boolean;
}

export interface AdminUpdateUserInput {
  email?: string;
  contact_name?: string;
  company_name?: string;
  role?: string;
  active?: boolean;
  phone?: string;
}

export interface AdminPatchProfileInput {
  client_type?: string;
  default_margin?: number;
  assigned_seller_id?: string;
  credit_limit?: number;
  partner_level?: string;
  monthly_target?: number;
}

// ─────────────────────────────────────────────────────────────────────────────

export interface CheckoutInput {
  items: { product_id: number; quantity: number }[];
  coupon_code?: string | null;
  notes?: string | null;
  payment_method?: string | null;
  payment_surcharge_pct?: number | null;
  shipping_type?: string | null;
  shipping_address?: string | null;
  shipping_transport?: string | null;
  shipping_cost?: number | null;
}

const backendBaseUrl = (import.meta.env.VITE_BACKEND_URL as string | undefined)?.trim().replace(/\/+$/, "") ?? "";
export const hasBackendUrl = backendBaseUrl.length > 0;

type BackendQueryValue = string | number | boolean | null | undefined;
type BackendQueryParams = Record<string, BackendQueryValue>;

export interface BackendOkResponse<T> {
  ok: true;
  data: T;
}

export interface BackendErrorResponse {
  ok: false;
  error: string;
  details?: unknown;
}

export type BackendResponse<T> = BackendOkResponse<T> | BackendErrorResponse;

export class BackendError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = "BackendError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

export interface BackendFetchOptions extends Omit<RequestInit, "body" | "headers"> {
  auth?: "required" | "optional" | "none";
  body?: unknown;
  headers?: HeadersInit;
  query?: BackendQueryParams;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isBackendOkResponse<T>(value: unknown): value is BackendOkResponse<T> {
  return isRecord(value) && value.ok === true && "data" in value;
}

function isBackendErrorResponse(value: unknown): value is BackendErrorResponse {
  return isRecord(value) && value.ok === false && typeof value.error === "string";
}

function getErrorMessageFromPayload(payload: unknown, fallback: string): string {
  if (typeof payload === "string" && payload.trim().length > 0) {
    return payload;
  }
  if (isRecord(payload)) {
    const message = payload.message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }
  return fallback;
}

function buildUrl(path: string, query?: BackendQueryParams): string {
  if (!hasBackendUrl) {
    throw new BackendError(0, "Falta configurar VITE_BACKEND_URL.");
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${backendBaseUrl}${normalizedPath}`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== null && value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url.toString();
}

async function getAccessToken(authMode: BackendFetchOptions["auth"]): Promise<string | null> {
  if (authMode === "none") {
    return null;
  }

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw new BackendError(401, "No se pudo obtener la sesión de usuario.", error);
  }

  const accessToken = session?.access_token ?? null;
  if (!accessToken && authMode === "required") {
    throw new BackendError(401, "Sesión expirada. Volvé a iniciar sesión.");
  }

  return accessToken;
}

function parseBody(rawBody: string): unknown {
  if (!rawBody) {
    return undefined;
  }

  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    return rawBody;
  }
}

export async function backendFetch<T>(
  path: string,
  options: BackendFetchOptions = {},
): Promise<T> {
  const {
    auth = "required",
    body,
    headers,
    method = body === undefined ? "GET" : "POST",
    query,
    ...rest
  } = options;

  const url = buildUrl(path, query);
  const accessToken = await getAccessToken(auth);

  const requestHeaders = new Headers(headers);
  requestHeaders.set("Content-Type", "application/json");
  if (accessToken) {
    requestHeaders.set("Authorization", `Bearer ${accessToken}`);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Error de red desconocido";
    throw new BackendError(0, `No se pudo conectar con el backend (${detail}).`, error);
  }

  const rawBody = await response.text();
  const payload = parseBody(rawBody);

  if (isBackendErrorResponse(payload)) {
    throw new BackendError(response.status || 500, payload.error, payload.details);
  }

  if (!response.ok) {
    const fallback = `El backend respondió con ${response.status}.`;
    const message = getErrorMessageFromPayload(payload, fallback);
    throw new BackendError(response.status, message, payload);
  }

  if (response.status === 204 || rawBody.length === 0) {
    return undefined as T;
  }

  if (isBackendOkResponse<T>(payload)) {
    return payload.data;
  }

  throw new BackendError(
    response.status,
    "Respuesta inválida del backend: se esperaba { ok: true, data: ... }.",
    payload,
  );
}

export const backend = {
  auth: {
    me: () => backendFetch<MeResponse>("/v1/auth/me"),
  },
  health: {
    check: async (): Promise<{ status: string }> => {
      const response = await backendFetch<HealthCheckResponse>("/v1/health", { auth: "optional" });
      return { status: response.status };
    },
  },
  public: {
    lookupCuit: (cuit: string) =>
      backendFetch<CuitLookupResponse>("/v1/public/cuit-lookup", {
        auth: "optional",
        query: { cuit },
      }),
    createRegistrationRequest: (data: CreateRegistrationRequestInput) =>
      backendFetch<RegistrationRequestResponse>("/v1/public/registration-requests", {
        auth: "optional",
        body: data,
        method: "POST",
      }),
  },
  admin: {
    createUser: (input: AdminCreateUserInput) =>
      backendFetch<{ id: string; email: string; role: string }>("/v1/admin/users", { method: "POST", body: input }),
    listUsers: (query?: { role?: string; active?: boolean; search?: string; limit?: number; offset?: number }) =>
      backendFetch<BackendList<BackendProfile>>("/v1/admin/users", { method: "GET", query }),
    updateUser: (userId: string, patch: AdminUpdateUserInput) =>
      backendFetch<BackendProfile>(`/v1/admin/users/${userId}`, { method: "PATCH", body: patch }),
    patchProfile: (profileId: string, patch: AdminPatchProfileInput) =>
      backendFetch<BackendProfile>(`/v1/admin/profiles/${profileId}`, { method: "PATCH", body: patch }),
    startImpersonation: (clientId: string) =>
      backendFetch<BackendProfile>("/v1/admin/impersonations", { method: "POST", body: { client_id: clientId } }),
    stopImpersonation: (clientId?: string) =>
      backendFetch<void>("/v1/admin/impersonations/current", {
        method: "DELETE",
        body: clientId ? { client_id: clientId } : undefined,
      }),
    listRegistrationRequests: (query?: { status?: string }) =>
      backendFetch<BackendRegistrationRequest[]>("/v1/admin/registration-requests", { method: "GET", query }),
    updateRegistrationRequest: (
      id: string,
      patch: { status: string; notes?: string; client_type?: string; default_margin?: number; assigned_seller_id?: string },
    ) =>
      backendFetch<BackendUpdateRegistrationResult>(`/v1/admin/registration-requests/${id}`, {
        method: "PATCH",
        body: patch,
      }),
  },
  orders: {
    checkout: (input: CheckoutInput) =>
      backendFetch<BackendOrder>("/v1/checkout", { method: "POST", body: input }),
  },
  me: {
    orders: (params?: { status?: string; limit?: number; offset?: number }) =>
      backendFetch<BackendList<BackendOrder>>("/v1/me/orders", { method: "GET", query: params }),
    quotes: (params?: { limit?: number; offset?: number }) =>
      backendFetch<BackendList<BackendQuoteRow>>("/v1/me/quotes", { method: "GET", query: params }),
    getProfile: () =>
      backendFetch<MeResponse>("/v1/me", { method: "GET" }),
    updateProfile: (patch: UpdateMyProfileInput) =>
      backendFetch<BackendProfile>("/v1/me", { method: "PATCH", body: patch }),
    changePassword: (input: ChangePasswordInput) =>
      backendFetch<void>("/v1/me/password", { method: "POST", body: input }),
  },
  quotes: {
    list: (query?: { client_id?: string; status?: string; limit?: number; offset?: number }) =>
      backendFetch<BackendList<BackendQuoteRow>>("/v1/quotes", { method: "GET", query }),
    get: (quoteId: string) =>
      backendFetch<BackendQuoteRow>(`/v1/quotes/${quoteId}`, { method: "GET" }),
    create: (input: Record<string, unknown>) =>
      backendFetch<BackendQuoteRow>("/v1/quotes", { method: "POST", body: input }),
    update: (id: string, patch: Record<string, unknown>) =>
      backendFetch<BackendQuoteRow>(`/v1/quotes/${id}`, { method: "PATCH", body: patch }),
    convert: (id: string, notes?: string | null) =>
      backendFetch<BackendOrder>(`/v1/quotes/${id}/convert`, { method: "POST", body: { notes } }),
  },
  rma: {
    list: (query?: { client_id?: string; order_id?: string; status?: string; limit?: number; offset?: number }) =>
      backendFetch<BackendList<BackendRmaRow>>("/v1/rma", { method: "GET", query }),
    get: (rmaId: string) =>
      backendFetch<BackendRmaRow>(`/v1/rma/${rmaId}`, { method: "GET" }),
    create: (input: {
      client_id: string;
      order_id: string;
      reason: string;
      description?: string;
      items: unknown[];
    }) =>
      backendFetch<BackendRmaRow>("/v1/rma", { method: "POST", body: input }),
    update: (
      id: string,
      patch: {
        status?: string;
        resolution_type?: string | null;
        resolution_notes?: string | null;
        notes?: string | null;
      },
    ) =>
      backendFetch<BackendRmaRow>(`/v1/rma/${id}`, { method: "PATCH", body: patch }),
  },
  products: {
    list: (query?: { search?: string; category?: string; brand?: string; active?: boolean; limit?: number; offset?: number }) =>
      backendFetch<BackendList<BackendProduct>>("/v1/products", { method: "GET", query }),
    get: (productId: number) =>
      backendFetch<BackendProduct>(`/v1/products/${productId}`, { method: "GET" }),
    create: (input: Record<string, unknown>) =>
      backendFetch<BackendProduct>("/v1/products", { method: "POST", body: input }),
    update: (id: number, patch: Record<string, unknown>) =>
      backendFetch<BackendProduct>(`/v1/products/${id}`, { method: "PATCH", body: patch }),
    adjustStock: (id: number, adjustment: { delta: number; reason?: string }) =>
      backendFetch<BackendProduct>(`/v1/products/${id}/stock-adjustments`, { method: "POST", body: adjustment }),
  },
  pricing: {
    listRules: (query?: { active?: boolean; limit?: number; offset?: number }) =>
      backendFetch<BackendPricingRuleRow[]>("/v1/pricing/rules", { method: "GET", query }),
    createRule: (input: Record<string, unknown>) =>
      backendFetch<BackendPricingRuleRow>("/v1/pricing/rules", { method: "POST", body: input }),
    updateRule: (id: string, patch: Record<string, unknown>) =>
      backendFetch<BackendPricingRuleRow>(`/v1/pricing/rules/${id}`, { method: "PATCH", body: patch }),
    deleteRule: (id: string) =>
      backendFetch<void>(`/v1/pricing/rules/${id}`, { method: "DELETE" }),
    resolvePrice: (clientId: string, productId: string | number) =>
      backendFetch<Record<string, unknown>>("/v1/pricing/resolve", {
        method: "GET",
        query: { client_id: clientId, product_id: String(productId) },
      }),
  },
  get: <T>(path: string, query?: BackendQueryParams) =>
    backendFetch<T>(path, { method: "GET", query }),
  post: <T>(path: string, body?: unknown) =>
    backendFetch<T>(path, { method: "POST", body }),
  patch: <T>(path: string, body?: unknown) =>
    backendFetch<T>(path, { method: "PATCH", body }),
  put: <T>(path: string, body?: unknown) =>
    backendFetch<T>(path, { method: "PUT", body }),
  delete: <T>(path: string, body?: unknown) =>
    backendFetch<T>(path, { method: "DELETE", body }),
} as const;
