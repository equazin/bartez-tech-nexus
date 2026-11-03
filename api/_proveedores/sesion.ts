/**
 * Los proxies de proveedores devuelven costos mayoristas: solo los usa el panel.
 * Valida el token de Supabase de quien llama contra la base (get_my_role corre con
 * el uid del token, así que un token vencido o falso no pasa) y exige rol de
 * administrador, vendedor o sales. Funciona en el runtime edge: solo usa fetch.
 */

const ROLES_DEL_PANEL = new Set(["admin", "vendedor", "sales"]);

export type ResultadoDeSesion = { ok: true } | { ok: false; status: number; error: string };

export async function sesionDelPanel(request: Request): Promise<ResultadoDeSesion> {
  const encabezado = request.headers.get("authorization") ?? "";
  const token = encabezado.startsWith("Bearer ") ? encabezado.slice(7).trim() : "";
  if (!token) {
    return { ok: false, status: 401, error: "Iniciá sesión en el panel para consultar a los proveedores." };
  }

  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
  const clavePublica = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "").trim();
  if (!url || !clavePublica) {
    return { ok: false, status: 500, error: "Falta la configuración de Supabase en el servidor." };
  }

  try {
    const respuesta = await fetch(`${url}/rest/v1/rpc/get_my_role`, {
      method: "POST",
      headers: { apikey: clavePublica, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(10_000),
    });
    if (!respuesta.ok) {
      return { ok: false, status: 401, error: "La sesión no es válida. Volvé a ingresar al panel." };
    }
    const rol = (await respuesta.json()) as unknown;
    if (typeof rol !== "string" || !ROLES_DEL_PANEL.has(rol.toLowerCase())) {
      return { ok: false, status: 403, error: "Tu cuenta no tiene acceso a los proveedores." };
    }
    return { ok: true };
  } catch {
    return { ok: false, status: 502, error: "No se pudo validar la sesión. Probá de nuevo en unos segundos." };
  }
}

export function respuestaJson(datos: unknown, status = 200): Response {
  return new Response(JSON.stringify(datos), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
