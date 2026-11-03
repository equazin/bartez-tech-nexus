import { respuestaJson } from "./sesion";

/**
 * Proxy de INVID. Antes el panel llamaba a INVID desde el navegador con el usuario y la
 * contraseña escritos en el código; ahora las credenciales viven solo en el servidor.
 *
 * Variables de entorno: INVID_USER e INVID_PASSWORD.
 *   GET ?offset=N  devuelve una página de artículos tal como la entrega INVID.
 */

const INVID_BASE = "https://www.invidcomputers.com/api/v1";
const TIEMPO_MAXIMO_MS = 120_000;

let tokenEnMemoria = "";
let tokenVenceEn = 0;

async function iniciarSesion(): Promise<string> {
  const usuario = process.env.INVID_USER?.trim() ?? "";
  const clave = process.env.INVID_PASSWORD?.trim() ?? "";
  if (!usuario || !clave) {
    throw new Error("Credenciales de INVID no configuradas. Cargá INVID_USER e INVID_PASSWORD en Vercel.");
  }

  const respuesta = await fetch(`${INVID_BASE}/auth.php`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: usuario, password: clave }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!respuesta.ok) {
    throw new Error(`INVID rechazó el inicio de sesión (HTTP ${respuesta.status}).`);
  }

  const datos = (await respuesta.json()) as { status?: number; access_token?: string; expiration_time?: number };
  if (datos.status !== 1 || !datos.access_token) {
    throw new Error("INVID no devolvió un token. Revisá el usuario y la contraseña.");
  }
  tokenEnMemoria = datos.access_token;
  tokenVenceEn = Date.now() + (datos.expiration_time || 3600) * 1000 - 60_000;
  return tokenEnMemoria;
}

async function token(forzar = false): Promise<string> {
  if (!forzar && tokenEnMemoria && Date.now() < tokenVenceEn) return tokenEnMemoria;
  return iniciarSesion();
}

async function pedirPagina(offset: number, forzarToken: boolean): Promise<Response> {
  return fetch(`${INVID_BASE}/articulo.php?offset=${offset}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${await token(forzarToken)}` },
    signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
  });
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET") {
    return respuestaJson({ ok: false, error: "Usá GET." }, 405);
  }

  const offset = Math.max(0, Math.floor(Number(new URL(request.url).searchParams.get("offset") ?? "0")) || 0);

  try {
    let respuesta = await pedirPagina(offset, false);
    if (respuesta.status === 401 || respuesta.status === 403) {
      respuesta = await pedirPagina(offset, true);
    }
    const cuerpo = await respuesta.text();
    if (!respuesta.ok) {
      console.error(`[invid] HTTP ${respuesta.status} offset=${offset}: ${cuerpo.slice(0, 300)}`);
      return respuestaJson({ ok: false, error: `INVID HTTP ${respuesta.status}` }, respuesta.status);
    }
    return new Response(cuerpo, {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error);
    console.error("[invid]", mensaje);
    return respuestaJson({ ok: false, error: mensaje }, 502);
  }
}
