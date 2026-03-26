import type { VercelRequest, VercelResponse } from "@vercel/node";

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

export function methodNotAllowed(res: VercelResponse, allowed: HttpMethod[]) {
  return res.status(405).json({
    ok: false,
    error: `Method not allowed. Use: ${allowed.join(", ")}`,
  });
}

export function ok(res: VercelResponse, data: unknown, status = 200) {
  return res.status(status).json({ ok: true, data });
}

export function fail(
  res: VercelResponse,
  error: string,
  status = 400,
  details?: unknown
) {
  return res.status(status).json({
    ok: false,
    error,
    ...(details ? { details } : {}),
  });
}

export function parsePagination(req: VercelRequest) {
  const limitRaw = Number(req.query.limit ?? 50);
  const offsetRaw = Number(req.query.offset ?? 0);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;
  const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;
  return { limit, offset };
}
