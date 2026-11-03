import air from "./_proveedores/air";
import elit from "./_proveedores/elit";
import newbytes from "./_proveedores/newbytes";
import { respuestaJson, sesionDelPanel } from "./_proveedores/sesion";

/**
 * Proveedores: una sola función para los proxies de AIR, ELIT y New Bytes (el plan Hobby de
 * Vercel admite 12 funciones por deploy). vercel.json reescribe /api/air-proxy y
 * /api/elit-proxy a /api/proveedores?proveedor=... conservando la
 * consulta. Estos proxies devuelven costos mayoristas, así que exigen sesión del panel.
 */

export const config = { runtime: "edge" };

type Manejador = (request: Request) => Promise<Response>;

const PROVEEDORES: Record<string, Manejador> = { air, elit, newbytes };

export default async function handler(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  const url = new URL(request.url);
  const proveedor = url.searchParams.get("proveedor") ?? "";
  const manejador = PROVEEDORES[proveedor];
  if (!manejador) {
    return respuestaJson({ ok: false, error: "No existe ese proveedor." }, 404);
  }

  const sesion = await sesionDelPanel(request);
  if (!sesion.ok) {
    return respuestaJson({ ok: false, error: sesion.error }, sesion.status);
  }

  // Cada proveedor arma la consulta al mayorista con los parámetros que recibe: se le pasa
  // la misma petición sin el parámetro de ruteo. El cuerpo se lee antes para no depender
  // de reenviar un stream (en Node el dev server lo exige con duplex).
  url.searchParams.delete("proveedor");
  const metodo = request.method.toUpperCase();
  const cuerpo = metodo === "GET" || metodo === "HEAD" ? undefined : await request.text();
  return manejador(new Request(url.toString(), { method: metodo, headers: request.headers, body: cuerpo }));
}
