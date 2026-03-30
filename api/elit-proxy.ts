const ELIT_BASE = "https://clientes.elit.com.ar/v1/api";

const ALLOWED_PATHS = new Set([
  "productos",
]);

export const config = {
  runtime: "edge",
};

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return json({ ok: false, error: "Method not allowed. Use POST." }, 405);
  }

  const url = new URL(request.url);
  const path = url.searchParams.get("path") ?? "";
  if (!path || !ALLOWED_PATHS.has(path)) {
    return json({ ok: false, error: "Missing or disallowed path parameter." }, 400);
  }

  const userId = process.env.ELIT_API_USER_ID?.trim() || "";
  const token = process.env.ELIT_API_TOKEN?.trim() || "";

  if (!userId || !token) {
    return json({ ok: false, error: "ELIT credentials not configured." }, 500);
  }

  const query = new URLSearchParams();
  url.searchParams.forEach((value, key) => {
    if (key !== "path") {
      query.set(key, value);
    }
  });
  if (!query.has("limit")) {
    query.set("limit", "100");
  }

  const elitUrl = `${ELIT_BASE}/${path}?${query.toString()}`;

  try {
    const body = request.body ? await request.json().catch(() => ({})) : {};
    const elitRes = await fetch(elitUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...body,
        user_id: Number(userId),
        token,
      }),
    });

    return new Response(elitRes.body, {
      status: elitRes.status,
      headers: {
        "Content-Type": elitRes.headers.get("content-type") || "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json({ ok: false, error: message }, 502);
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
