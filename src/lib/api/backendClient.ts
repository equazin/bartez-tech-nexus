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

function normalizeBackendBaseUrl(value: string | undefined): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";

  const lowered = trimmed.toLowerCase();
  if (lowered === "undefined" || lowered === "null") return "";

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/+$/, "");
  }

  if (trimmed.startsWith("/")) {
    return trimmed === "/" ? "/" : trimmed.replace(/\/+$/, "");
  }

  return "";
}

function joinUrlParts(base: string, path: string): string {
  if (base === "/") {
    return path.startsWith("/") ? path : `/${path}`;
  }
  if (base.endsWith("/") && path.startsWith("/")) {
    return `${base.slice(0, -1)}${path}`;
  }
  if (!base.endsWith("/") && !path.startsWith("/")) {
    return `${base}/${path}`;
  }
  return `${base}${path}`;
}

const BASE_URL = normalizeBackendBaseUrl(import.meta.env.VITE_BACKEND_URL as string | undefined);
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

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  let url: string;
  const params = new URLSearchParams();
  if (options.query) {
    for (const [k, v] of Object.entries(options.query)) {
      if (v !== undefined) params.set(k, String(v));
    }
  }
  const queryString = params.toString();

  if (BASE_URL.startsWith("/")) {
    const relativeUrl = joinUrlParts(BASE_URL, normalizedPath);
    url = queryString ? `${relativeUrl}?${queryString}` : relativeUrl;
  } else {
    try {
      const absolute = new URL(joinUrlParts(BASE_URL, normalizedPath));
      if (queryString) {
        absolute.search = queryString;
      }
      url = absolute.toString();
    } catch {
      throw new BackendError(0, "VITE_BACKEND_URL no es valida. Usa https://... o /api.");
    }
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...authHeader,
      },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Error de red desconocido";
    throw new BackendError(0, `No se pudo conectar con el backend (${detail}).`, error);
  }

  let json: BackendOkResponse<T> | BackendErrorResponse;
  try {
    json = (await res.json()) as BackendOkResponse<T> | BackendErrorResponse;
  } catch {
    throw new BackendError(
      res.ok ? 0 : res.status,
      res.ok ? "Respuesta invalida del backend." : `Backend respondio ${res.status}.`,
    );
  }

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
