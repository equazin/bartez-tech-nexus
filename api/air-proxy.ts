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

  const token =
    process.env.AIR_API_TOKEN?.trim() ||
    process.env.AIR_TOKEN?.trim() ||
    process.env.VITE_AIR_TOKEN?.trim() ||
    "";
  if (!token) {
    return json({ ok: false, error: "AIR token not configured." }, 500);
  }

  const airUrl = `${AIR_BASE}/?${url.searchParams.toString()}`;

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


    return new Response(airRes.body, {
      status: airRes.status,
      headers: {
        "Content-Type": airRes.headers.get("content-type") || "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[air-proxy] fetch error q=${q}:`, message);
    return json({ ok: false, error: message }, 502);
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
