/**
 * backendClient — typed HTTP client for bartez-backend (Fastify).
 *
 * All privileged mutations go through this client instead of Vercel
 * serverless functions. Reads (SELECT with RLS) still use the Supabase
 * JS client directly.
 *
 * Setup: add VITE_BACKEND_URL to .env
 *   VITE_BACKEND_URL=http://localhost:8787   # dev
 *   VITE_BACKEND_URL=https://api.bartez.com.ar  # prod
 */

import { supabase } from "@/lib/supabase";

const BASE_URL = (import.meta.env.VITE_BACKEND_URL as string | undefined)?.replace(/\/$/, "") ?? "";
export const hasBackendUrl = BASE_URL.length > 0;

// ─── Types ────────────────────────────────────────────────────────────────────

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
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "BackendError";
  }
}

// ─── Core ─────────────────────────────────────────────────────────────────────

async function getAuthHeader(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

async function request<T>(
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  options: { body?: unknown; query?: Record<string, string | number | boolean | undefined> } = {},
): Promise<T> {
  if (!BASE_URL) {
    throw new BackendError(0, "VITE_BACKEND_URL no está configurado.");
  }

  const authHeader = await getAuthHeader();

  let url = `${BASE_URL}${path}`;
  if (options.query) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(options.query)) {
      if (v !== undefined) params.set(k, String(v));
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...authHeader,
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });

  const json = (await res.json().catch(() => ({ ok: false, error: res.statusText }))) as
    | BackendOkResponse<T>
    | BackendErrorResponse;

  if (!res.ok || !json.ok) {
    const errResponse = json as BackendErrorResponse;
    throw new BackendError(res.status, errResponse.error ?? "Error inesperado del servidor", errResponse.details);
  }

  return (json as BackendOkResponse<T>).data;
}

// ─── Public API surface ───────────────────────────────────────────────────────

export const backend = {
  get: <T>(path: string, query?: Record<string, string | number | boolean | undefined>) =>
    request<T>("GET", path, { query }),

  post: <T>(path: string, body?: unknown) =>
    request<T>("POST", path, { body }),

  patch: <T>(path: string, body?: unknown) =>
    request<T>("PATCH", path, { body }),

  delete: <T>(path: string, body?: unknown) =>
    request<T>("DELETE", path, { body }),
} as const;
