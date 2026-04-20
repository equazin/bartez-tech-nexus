import { extractAirJsonPayload } from "../src/lib/suppliers/air/response";

/**
 * Proxy serverless para la API AIR Intranet.
 * Evita CORS agregando autenticacion Bearer en el servidor.
 *
 * Variables de entorno requeridas (al menos una de las dos opciones):
 *   Opcion A - credenciales (se obtiene y refresca el token automaticamente):
 *     AIR_API_USER = <usuario AIR>
 *     AIR_API_PASS = <contrasena AIR>
 *
 *   Opcion B - token directo (fallback si no hay user/pass):
 *     AIR_API_TOKEN = <token emitido por AIR>
 *
 * Cuando ambas estan presentes se prefiere user/pass porque el token estatico
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

const UPSTREAM_TIMEOUT_MS = 270_000;

let cachedToken = "";
let tokenExpiresAt = 0;

async function loginAir(user: string, pass: string): Promise<{ token: string; expiresAt: number }> {
  console.info("[air-proxy] Obtaining token via user/pass login...");
  const loginUrl = `${AIR_BASE}/?q=login&user=${encodeURIComponent(user)}&pass=${encodeURIComponent(pass)}`;
  const loginRes = await fetch(loginUrl, {
    signal: AbortSignal.timeout(15_000),
  });

  if (!loginRes.ok) {
    const errText = await loginRes.text().catch(() => "");
    throw new Error(`Login AIR fallido (${loginRes.status}): ${errText}`);
  }

  const rawText = await loginRes.text();
  const payload = extractAirJsonPayload(rawText);
  if (!payload) {
    throw new Error(`Login AIR devolvio una respuesta invalida: ${rawText.slice(0, 300)}`);
  }

  const data = JSON.parse(payload.jsonText) as Record<string, unknown>;
  const token = typeof data.token === "string" ? data.token.trim() : "";
  const expira = typeof data.expira === "number" ? data.expira : 0;

  if (!token) {
    throw new Error(`Login AIR sin token en respuesta: ${payload.jsonText}`);
  }

  const expiresAt =
    expira > 1_000_000_000 ? expira * 1000 : Date.now() + 8 * 60 * 60 * 1000;
  console.info("[air-proxy] Token obtenido, expira:", new Date(expiresAt).toISOString());
  return { token, expiresAt };
}

async function resolveToken(forceRefresh = false): Promise<string> {
  const user = process.env.AIR_API_USER?.trim();
  const pass = process.env.AIR_API_PASS?.trim();
  const staticToken = process.env.AIR_API_TOKEN?.trim() || process.env.AIR_TOKEN?.trim();

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
      if (staticToken) {
        console.warn("[air-proxy] Falling back to static AIR_API_TOKEN after login failure.");
        return staticToken;
      }
      throw new Error(`Login AIR fallido: ${msg}`);
    }
  }

  return staticToken ?? "";
}

function parseAirPayload(rawText: string): Record<string, unknown> | null {
  const payload = extractAirJsonPayload(rawText);
  if (!payload) {
    return null;
  }

  try {
    return JSON.parse(payload.jsonText) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isAirRateLimit(payload: Record<string, unknown> | null): boolean {
  if (!payload) {
    return false;
  }

  if (payload.error_id === 403) {
    return true;
  }

  if (typeof payload.error_name === "string" && payload.error_name.toLowerCase().includes("too many")) {
    return true;
  }

  if (typeof payload.error === "string" && payload.error.toLowerCase().includes("rate limit")) {
    return true;
  }

  return false;
}

export default async function handler(request: Request): Promise<Response> {
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

  const rawBody = await request.text().catch(() => "");
  const body = rawBody.trim() ? rawBody : "{}";
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
      return json({ ok: false, error: msg }, 500);
    }

    if (!token) {
      console.error("[air-proxy] No token available. Set AIR_API_TOKEN or AIR_API_USER+AIR_API_PASS.");
      return json(
        {
          ok: false,
          error:
            "Credenciales AIR no configuradas. Settea AIR_API_USER + AIR_API_PASS o AIR_API_TOKEN en las variables de entorno de Vercel.",
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

      const rawText = await airRes.text().catch(() => "");
      const payload = extractAirJsonPayload(rawText);

      if (!airRes.ok) {
        const errBody = (payload?.jsonText ?? rawText) || "(no body)";
        console.error(`[air-proxy] AIR returned ${airRes.status} for q=${q}: ${errBody}`);

        if (isAirRateLimit(parseAirPayload(errBody))) {
          return json(
            {
              ok: false,
              error: "Rate limit AIR - espera 5 minutos antes de volver a sincronizar.",
              detail: errBody,
            },
            429
          );
        }

        if (airRes.status === 401 || airRes.status === 403) {
          cachedToken = "";
          tokenExpiresAt = 0;
        }

        return new Response(
          JSON.stringify({ ok: false, error: `AIR HTTP ${airRes.status}`, detail: errBody }),
          {
            status: airRes.status,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }

      if (payload) {
        if (payload.extracted) {
          console.warn(
            `[air-proxy] Sanitized AIR payload for q=${q} after removing leading/trailing noise.`
          );
        }

        return new Response(payload.jsonText, {
          status: airRes.status,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      const ct = airRes.headers.get("content-type") ?? "";
      console.error(`[air-proxy] AIR devolvio contenido no-JSON (${ct}) para q=${q}: ${rawText.slice(0, 300)}`);
      cachedToken = "";
      tokenExpiresAt = 0;
      return json(
        {
          ok: false,
          error: "AIR devolvio respuesta invalida - posible token expirado. Reintenta en unos segundos.",
          detail: rawText.slice(0, 500),
        },
        502
      );
    } catch (err) {
      const isTimeout =
        (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) ||
        (err instanceof DOMException && err.name === "TimeoutError");
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[air-proxy] ${isTimeout ? "timeout" : "network error"} q=${q}:`, message);
      return json(
        {
          ok: false,
          error: isTimeout ? "AIR API timeout - intenta de nuevo" : `Proxy network error: ${message}`,
        },
        isTimeout ? 504 : 502
      );
    }
  };

  const firstResponse = await executeRequest(false);

  if (firstResponse.status === 401 || firstResponse.status === 403 || firstResponse.status === 502) {
    let isRateLimit = false;
    try {
      const clone = firstResponse.clone();
      const body = (await clone.json()) as Record<string, unknown>;
      isRateLimit = isAirRateLimit(body);
      if (isRateLimit) {
        console.warn(`[air-proxy] Rate limit hit for q=${q}. Wait 5 minutes before retrying.`);
      }
    } catch {
      // Non-JSON response, treat as auth issue.
    }

    if (!isRateLimit && hasCredentials) {
      console.warn(`[air-proxy] Upstream ${firstResponse.status} - retrying with a fresh token.`);
      return executeRequest(true);
    }
  }

  return firstResponse;
}

export const config = { runtime: "edge" };

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
