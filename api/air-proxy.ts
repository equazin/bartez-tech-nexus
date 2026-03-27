/**
 * Proxy Edge para la API AIR Intranet.
 * Edge Runtime: 30s timeout (vs 10s Node.js en Hobby plan).
 * Streaming directo: no buffering, sin límites de tamaño de respuesta.
 */

export const config = { runtime: "edge" };

const AIR_BASE = "https://api.air-intra.com/v2";

const ALLOWED_QUERIES = new Set([
  "check_token",
  "catalogo",
  "articulos",
  "syp",
  "syp_list",
  "get_meta",
]);

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return json({ ok: false, error: "Method not allowed. Use POST." }, 405);
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const baseQuery = q.split("&")[0];

  if (!q || !ALLOWED_QUERIES.has(baseQuery)) {
    return json({ ok: false, error: "Missing or disallowed query parameter." }, 400);
  }

  const token = process.env.VITE_AIR_TOKEN ?? "";
  if (!token) {
    return json({ ok: false, error: "AIR token not configured." }, 500);
  }

  // Reenviar todos los query params a AIR
  const airUrl = `${AIR_BASE}/?${url.searchParams.toString()}`;
  console.log(`[air-proxy] → ${airUrl}`);

  try {
    const body = request.body ? await request.text() : undefined;

    const airRes = await fetch(airUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body,
    });

    console.log(`[air-proxy] ← status=${airRes.status} q=${q}`);

    // Streaming directo: evita buffering y límites de tamaño
    return new Response(airRes.body, {
      status: airRes.status,
      headers: {
        "Content-Type": airRes.headers.get("content-type") || "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[air-proxy] fetch error q=${q}:`, msg);
    return json({ ok: false, error: msg }, 502);
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
