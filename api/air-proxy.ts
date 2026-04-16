/**
 * Proxy serverless para la API AIR Intranet.
 * Evita CORS agregando autenticación Bearer en el servidor.
 *
 * Variables de entorno requeridas (al menos una de las dos opciones):
 *   Opción A — token directo:
 *     AIR_API_TOKEN = <token emitido por AIR>
 *
 *   Opción B — credenciales (se obtiene el token automáticamente):
 *     AIR_API_USER = <usuario AIR>
 *     AIR_API_PASS = <contraseña AIR>
 */

const AIR_BASE = "https://api.air-intra.com/v2";

const ALLOWED_QUERIES = new Set([
  "check_token",
  "catalogo",
  "articulos",
  "syp",
  "syp_list",
  "get_meta",
]);

// Timeout upstream: slightly under Vercel maxDuration (60s) to return clean 504
const UPSTREAM_TIMEOUT_MS = 55_000;

// ── Token cache (module-scope, survives warm instances) ──────────────────────
let cachedToken = "";
let tokenExpiresAt = 0; // Unix ms

async function resolveToken(): Promise<string> {
  // 1. Static env token
  const staticToken = process.env.AIR_API_TOKEN?.trim() || process.env.AIR_TOKEN?.trim();
  if (staticToken) return staticToken;

  // 2. Cached from a previous login (still valid with 5-min buffer)
  if (cachedToken && Date.now() < tokenExpiresAt - 5 * 60 * 1000) {
    return cachedToken;
  }

  // 3. Auto-login with user/pass
  const user = process.env.AIR_API_USER?.trim();
  const pass = process.env.AIR_API_PASS?.trim();
  if (!user || !pass) return "";

  console.info("[air-proxy] Obtaining token via user/pass login...");
  const loginRes = await fetch(`${AIR_BASE}/?q=login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user, pass }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!loginRes.ok) {
    const errText = await loginRes.text().catch(() => "");
    console.error(`[air-proxy] Login failed ${loginRes.status}: ${errText}`);
    return "";
  }

  const data = await loginRes.json() as Record<string, unknown>;

  // AIR returns { token, expira } — expira is seconds-from-epoch or similar
  const token = typeof data.token === "string" ? data.token.trim() : "";
  const expira = typeof data.expira === "number" ? data.expira : 0;

  if (!token) {
    console.error("[air-proxy] Login response missing token field:", JSON.stringify(data));
    return "";
  }

  cachedToken = token;
  // expira looks like a Unix timestamp in seconds (common in ARG APIs)
  tokenExpiresAt = expira > 1_000_000_000 ? expira * 1000 : Date.now() + 8 * 60 * 60 * 1000;
  console.info("[air-proxy] Token obtained, expires at:", new Date(tokenExpiresAt).toISOString());
  return token;
}

// ── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(request: Request): Promise<Response> {
  // CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (request.method !== "POST") {
    return json({ ok: false, error: "Method not allowed. Use POST." }, 405);
  }

  const host = request.headers.get?.("host") ?? "localhost";
  const url = new URL(request.url, `https://${host}`);
  const q = url.searchParams.get("q") ?? "";
  const baseQuery = q.split("&")[0];

  if (!q || !ALLOWED_QUERIES.has(baseQuery)) {
    return json({ ok: false, error: "Missing or disallowed query parameter." }, 400);
  }

  // Resolve token (static env or auto-login)
  let token: string;
  try {
    token = await resolveToken();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[air-proxy] resolveToken error:", msg);
    token = "";
  }

  if (!token) {
    console.error("[air-proxy] No token available. Set AIR_API_TOKEN or AIR_API_USER+AIR_API_PASS.");
    return json(
      { ok: false, error: "AIR token not configured. Set AIR_API_TOKEN (or AIR_API_USER + AIR_API_PASS) in environment variables." },
      500
    );
  }

  // Build upstream AIR URL forwarding all query params (q, page, etc.)
  const airUrl = `${AIR_BASE}/?${url.searchParams.toString()}`;

  try {
    // Read body only when non-empty — AIR returns 500 for unexpected empty-string bodies
    const rawBody = await request.text().catch(() => "");
    const body = rawBody.trim() ? rawBody : undefined;

    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (body) headers["Content-Type"] = "application/json";

    const airRes = await fetch(airUrl, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    // Log and forward non-OK responses with structured error for easier debugging
    if (!airRes.ok) {
      const errBody = await airRes.text().catch(() => "(no body)");
      console.error(`[air-proxy] AIR returned ${airRes.status} for q=${q}: ${errBody}`);

      // If 401 / 403 → clear cached token so next request re-authenticates
      if (airRes.status === 401 || airRes.status === 403) {
        cachedToken = "";
        tokenExpiresAt = 0;
      }

      return new Response(
        JSON.stringify({ ok: false, error: `AIR HTTP ${airRes.status}`, detail: errBody }),
        {
          status: airRes.status,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        }
      );
    }

    return new Response(airRes.body, {
      status: airRes.status,
      headers: {
        "Content-Type": airRes.headers.get("content-type") || "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    const isTimeout =
      (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) ||
      (err instanceof DOMException && err.name === "TimeoutError");
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[air-proxy] ${isTimeout ? "timeout" : "network error"} q=${q}:`, message);
    return json(
      { ok: false, error: isTimeout ? "AIR API timeout — intenta de nuevo" : `Proxy network error: ${message}` },
      isTimeout ? 504 : 502
    );
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}
