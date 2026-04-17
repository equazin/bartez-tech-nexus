/**
 * Proxy serverless para la API AIR Intranet.
 * Evita CORS agregando autenticación Bearer en el servidor.
 *
 * Variables de entorno requeridas (al menos una de las dos opciones):
 *   Opción A — credenciales (se obtiene y refresca el token automáticamente):
 *     AIR_API_USER = <usuario AIR>
 *     AIR_API_PASS = <contraseña AIR>
 *
 *   Opción B — token directo (fallback si no hay user/pass):
 *     AIR_API_TOKEN = <token emitido por AIR>
 *
 * Cuando ambas están presentes se prefiere user/pass porque el token estático
 * caduca silenciosamente y provoca 403 persistentes.
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

// Edge Runtime: no hard Lambda timeout. Allow up to 4.5 min for large catalog pages.
const UPSTREAM_TIMEOUT_MS = 270_000;

// ── Token cache (module-scope, survives warm instances) ──────────────────────
let cachedToken = "";
let tokenExpiresAt = 0; // Unix ms

async function loginAir(user: string, pass: string): Promise<{ token: string; expiresAt: number }> {
  console.info("[air-proxy] Obtaining token via user/pass login...");
  const loginRes = await fetch(`${AIR_BASE}/?q=login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user, pass }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!loginRes.ok) {
    const errText = await loginRes.text().catch(() => "");
    throw new Error(`Login failed ${loginRes.status}: ${errText}`);
  }

  const data = (await loginRes.json()) as Record<string, unknown>;
  const token = typeof data.token === "string" ? data.token.trim() : "";
  const expira = typeof data.expira === "number" ? data.expira : 0;

  if (!token) {
    throw new Error(`Login response missing token: ${JSON.stringify(data)}`);
  }

  // `expira` suele venir como epoch en segundos; si no, asumimos 8 horas.
  const expiresAt = expira > 1_000_000_000 ? expira * 1000 : Date.now() + 8 * 60 * 60 * 1000;
  console.info("[air-proxy] Token obtained, expires at:", new Date(expiresAt).toISOString());
  return { token, expiresAt };
}

async function resolveToken(forceRefresh = false): Promise<string> {
  const user = process.env.AIR_API_USER?.trim();
  const pass = process.env.AIR_API_PASS?.trim();
  const staticToken = process.env.AIR_API_TOKEN?.trim() || process.env.AIR_TOKEN?.trim();

  // Preferimos user/pass cuando están disponibles: el token estático se
  // vence sin aviso y no hay forma de recuperar el servicio sin redeploy.
  if (user && pass) {
    if (!forceRefresh && cachedToken && Date.now() < tokenExpiresAt - 5 * 60 * 1000) {
      return cachedToken;
    }

    try {
      const { token, expiresAt } = await loginAir(user, pass);
      cachedToken = token;
      tokenExpiresAt = expiresAt;
      return token;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[air-proxy] Auto-login error:", msg);
      // Si falla el login pero tenemos token estático, usarlo como último recurso.
      if (staticToken) {
        console.warn("[air-proxy] Falling back to static AIR_API_TOKEN after login failure.");
        return staticToken;
      }
      return "";
    }
  }

  // Sin credenciales → solo nos queda el token estático.
  return staticToken ?? "";
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

  // Siempre enviar JSON válido — AIR devuelve 500 con body vacío y 403 si falta Content-Type.
  const rawBody = await request.text().catch(() => "");
  const body = rawBody.trim() ? rawBody : "{}";

  // Build upstream AIR URL forwarding all query params (q, page, etc.)
  const airUrl = `${AIR_BASE}/?${url.searchParams.toString()}`;

  const hasCredentials = Boolean(
    process.env.AIR_API_USER?.trim() && process.env.AIR_API_PASS?.trim()
  );

  const executeRequest = async (forceRefresh: boolean): Promise<Response> => {
    let token: string;
    try {
      token = await resolveToken(forceRefresh);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[air-proxy] resolveToken error:", msg);
      token = "";
    }

    if (!token) {
      console.error("[air-proxy] No token available. Set AIR_API_TOKEN or AIR_API_USER+AIR_API_PASS.");
      return json(
        {
          ok: false,
          error:
            "AIR token not configured. Set AIR_API_USER + AIR_API_PASS (recomendado) o AIR_API_TOKEN en las variables de entorno.",
        },
        500
      );
    }

    try {
      const airRes = await fetch(airUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body,
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });

      if (!airRes.ok) {
        const errBody = await airRes.text().catch(() => "(no body)");
        console.error(`[air-proxy] AIR returned ${airRes.status} for q=${q}: ${errBody}`);

        // Invalidar cache para que la próxima llamada re-autentique.
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
        {
          ok: false,
          error: isTimeout ? "AIR API timeout — intenta de nuevo" : `Proxy network error: ${message}`,
        },
        isTimeout ? 504 : 502
      );
    }
  };

  // Primer intento con token cacheado / estático.
  const firstResponse = await executeRequest(false);

  // Si el upstream respondió 401/403 y tenemos credenciales, re-login y reintentamos una vez.
  // Evita que un AIR_API_TOKEN vencido bloquee todas las syncs hasta el próximo redeploy.
  if ((firstResponse.status === 401 || firstResponse.status === 403) && hasCredentials) {
    console.warn(`[air-proxy] Upstream ${firstResponse.status} — reintentando con token fresco.`);
    return executeRequest(true);
  }

  return firstResponse;
}

// Run as Edge Function — no hard Lambda timeout; streaming responses can run indefinitely.
export const config = { runtime: "edge" };

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}
