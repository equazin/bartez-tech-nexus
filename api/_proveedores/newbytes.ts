import { descripcionDeNewBytes, respuestaDelCatalogo } from "../_shared/newBytesServidor";
import { respuestaJson } from "./sesion";

/**
 * Proxy de New Bytes para el panel (la sesión la exige api/proveedores.ts).
 *   GET ?proveedor=newbytes&recurso=catalogo            el catálogo completo
 *   GET ?proveedor=newbytes&recurso=descripcion&id=N    la descripción de un producto
 * Devuelve costos mayoristas: nunca se usa desde la tienda.
 */
export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET") return respuestaJson({ ok: false, error: "Usá GET." }, 405);
  const url = new URL(request.url);
  const recurso = url.searchParams.get("recurso") ?? "catalogo";
  try {
    if (recurso === "catalogo") {
      // Se reenvía tal cual llega (un arreglo de productos), sin esperar a leerlo entero: el runtime edge
      // tiene que empezar a responder en pocos segundos y el catálogo es grande.
      const catalogo = await respuestaDelCatalogo();
      return new Response(catalogo.body, {
        status: 200,
        headers: { "Content-Type": catalogo.headers.get("content-type") || "application/json", "Cache-Control": "no-store" },
      });
    }
    if (recurso === "descripcion") {
      const id = (url.searchParams.get("id") ?? "").trim();
      if (!/^\d+$/.test(id)) return respuestaJson({ ok: false, error: "Falta el id del producto." }, 400);
      return respuestaJson({ ok: true, data: { descripcion: await descripcionDeNewBytes(id) } }, 200);
    }
    return respuestaJson({ ok: false, error: "Recurso desconocido." }, 404);
  } catch (e: unknown) {
    const mensaje = e instanceof Error ? e.message : String(e);
    console.error("[newbytes-proxy]", mensaje);
    return respuestaJson({ ok: false, error: mensaje }, 502);
  }
}
