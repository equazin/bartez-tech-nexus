/**
 * Proxy serverless para la API AIR Intranet.
 * Evita errores CORS: el browser llama a /api/air-proxy, este
 * endpoint llama a api.air-intra.com server-side con el token.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

// Aumentar timeout de la función Vercel a 30s (necesario para páginas grandes)
export const config = { maxDuration: 30 };

const AIR_BASE = "https://api.air-intra.com/v2";
const TOKEN = process.env.VITE_AIR_TOKEN ?? "";
const FETCH_TIMEOUT_MS = 25_000; // 25s — deja margen antes del timeout de Vercel

const ALLOWED_QUERIES = new Set([
  "check_token",
  "catalogo",
  "articulos",
  "syp",
  "syp_list",
  "get_meta",
]);

function isAllowedQuery(q: string): boolean {
  const base = q.split("&")[0];
  return ALLOWED_QUERIES.has(base);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed. Use POST." });
  }

  const q = req.query.q ? String(req.query.q) : "";
  if (!q || !isAllowedQuery(q)) {
    return res.status(400).json({ ok: false, error: "Missing or disallowed query parameter." });
  }

  if (!TOKEN) {
    return res.status(500).json({ ok: false, error: "AIR token not configured." });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const airRes = await fetch(`${AIR_BASE}/?q=${q}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: req.body ? JSON.stringify(req.body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timer);

    const contentType = airRes.headers.get("content-type") ?? "";
    const text = await airRes.text();

    if (!airRes.ok) {
      return res.status(airRes.status).json({
        ok: false,
        error: `AIR HTTP ${airRes.status}`,
        detail: text.slice(0, 500),
      });
    }

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({
        ok: false,
        error: "Invalid JSON from AIR API",
        detail: text.slice(0, 200),
      });
    }

    res.setHeader("Content-Type", contentType || "application/json");
    return res.status(200).json(data);
  } catch (err) {
    clearTimeout(timer);
    const isTimeout = err instanceof Error && err.name === "AbortError";
    const msg = isTimeout ? "AIR API timeout (>25s)" : (err instanceof Error ? err.message : String(err));
    const status = isTimeout ? 504 : 502;
    return res.status(status).json({ ok: false, error: msg });
  }
}
