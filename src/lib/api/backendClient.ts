import { supabase } from "@/lib/supabase";

export interface ApiResult<T> {
  ok?: boolean;
  data?: T;
  error?: string;
  details?: unknown;
}

type AuthMode = "none" | "optional" | "required";

function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export function resolveApiBaseUrl(): string {
  const configured = (import.meta.env.VITE_API_BASE_URL || "").trim();
  const isBrowser = typeof window !== "undefined";
  const currentHostname = isBrowser ? window.location.hostname : "";
  const currentProtocol = isBrowser ? window.location.protocol : "";
  const isLocalOrigin = isBrowser && isLocalHostname(currentHostname);
  const isDesktopOrigin = isBrowser && (currentProtocol === "tauri:" || currentHostname === "tauri.localhost");

  if (!configured) {
    if (isLocalOrigin) {
      return "http://localhost:8787";
    }
    return "";
  }

  try {
    const parsed = new URL(configured);
    const isLocalTarget = isLocalHostname(parsed.hostname);
    if (isLocalTarget && !isLocalOrigin && !isDesktopOrigin) {
      return "";
    }
    return configured.replace(/\/$/, "");
  } catch {
    return configured.replace(/\/$/, "");
  }
}

export function buildApiUrl(path: string): string {
  const base = resolveApiBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

async function getAccessToken(authMode: AuthMode): Promise<string | null> {
  if (authMode === "none") {
    return null;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    if (authMode === "required") {
      throw new Error("Sesion expirada. Volve a iniciar sesion.");
    }
    return null;
  }

  return session.access_token;
}

export async function readApiResult<T>(response: Response): Promise<ApiResult<T>> {
  const raw = await response.text();
  if (!raw) {
    return { ok: response.ok, error: response.ok ? undefined : "Respuesta vacia del servidor." };
  }

  try {
    return JSON.parse(raw) as ApiResult<T>;
  } catch {
    return { ok: response.ok, error: raw };
  }
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit & {
    auth?: AuthMode;
    json?: unknown;
  } = {},
): Promise<{ response: Response; result: ApiResult<T> }> {
  const { auth = "none", json, headers, body, ...rest } = init;
  const token = await getAccessToken(auth);
  const finalHeaders = new Headers(headers);

  if (json !== undefined && !finalHeaders.has("Content-Type")) {
    finalHeaders.set("Content-Type", "application/json");
  }

  if (token) {
    finalHeaders.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(buildApiUrl(path), {
    ...rest,
    headers: finalHeaders,
    body: json !== undefined ? JSON.stringify(json) : body,
  });

  const result = await readApiResult<T>(response);
  return { response, result };
}
