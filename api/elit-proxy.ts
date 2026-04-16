/**
 * Proxy serverless para la API ELIT.
 * Evita exponer credenciales en el frontend y añade autenticación server-side.
 *
 * Variables de entorno requeridas:
 *   ELIT_API_USER_ID = <ID numérico de usuario ELIT>
 *   ELIT_API_TOKEN   = <token de API ELIT>
 */

const ELIT_BASE = "https://clientes.elit.com.ar/v1/api";

const ALLOWED_PATHS = new Set(["productos"]);

// Timeout upstream: slightly under Vercel maxDuration (60s) to return clean 504
const UPSTREAM_TIMEOUT_MS = 55_000;

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
  const path = url.searchParams.get("path") ?? "";
  if (!path || !ALLOWED_PATHS.has(path)) {
    return json({ ok: false, error: "Missing or disallowed path parameter." }, 400);
  }

  const userId = process.env.ELIT_API_USER_ID?.trim() || "";
  const token = process.env.ELIT_API_TOKEN?.trim() || "";

  if (!userId || !token) {
    console.error("[elit-proxy] ELIT_API_USER_ID or ELIT_API_TOKEN env var not set");
    return json(
      { ok: false, error: "ELIT credentials not configured. Set ELIT_API_USER_ID and ELIT_API_TOKEN in environment variables." },
      500
    );
  }

  // Forward all query params except "path" to the ELIT URL
  const query = new URLSearchParams();
  url.searchParams.forEach((value, key) => {
    if (key !== "path") query.set(key, value);
  });
  if (!query.has("limit")) query.set("limit", "100");

  const elitUrl = `${ELIT_BASE}/${path}?${query.toString()}`;

  try {
    // Read client body (may contain search filters); fall back to empty object
    const rawBody = await request.text().catch(() => "");
    let clientBody: Record<string, unknown> = {};
    if (rawBody.trim()) {
      try {
        clientBody = JSON.parse(rawBody) as Record<string, unknown>;
      } catch {
        // Ignore malformed body
      }
    }

    // Merge client filters with credentials
    const elitBody = {
      ...clientBody,
      user_id: Number(userId),
      token,
    };

    const elitRes = await fetch(elitUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(elitBody),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    if (!elitRes.ok) {
      const errBody = await elitRes.text().catch(() => "(no body)");
      console.error(`[elit-proxy] ELIT returned ${elitRes.status} for path=${path}: ${errBody}`);
      return new Response(
        JSON.stringify({ ok: false, error: `ELIT HTTP ${elitRes.status}`, detail: errBody }),
        {
          status: elitRes.status,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        }
      );
    }

    return new Response(elitRes.body, {
      status: elitRes.status,
      headers: {
        "Content-Type": elitRes.headers.get("content-type") || "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    const isTimeout =
      (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) ||
      (err instanceof DOMException && err.name === "TimeoutError");
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[elit-proxy] ${isTimeout ? "timeout" : "network error"} path=${path}:`, message);
    return json(
      { ok: false, error: isTimeout ? "ELIT API timeout — intenta de nuevo" : `Proxy network error: ${message}` },
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
