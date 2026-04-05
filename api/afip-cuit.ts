import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fail, methodNotAllowed, ok } from "./_shared/http.js";

/**
 * GET /api/afip-cuit?cuit=20217744246
 *
 * Proxies the public AFIP padron lookup via apis.net.ar (no credentials required).
 * Returns normalized entity data: companyName, taxStatus, entityType, active.
 *
 * Using a server-side proxy avoids CORS issues when calling from the browser.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  const cuit = String(req.query.cuit ?? "").replace(/\D/g, "");
  if (cuit.length !== 11) {
    return fail(res, "El CUIT debe tener 11 dígitos.", 400);
  }

  try {
    const upstream = await fetch(`https://apis.net.ar/api/cuit/${cuit}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });

    if (!upstream.ok) {
      if (upstream.status === 404) {
        return fail(res, "CUIT no encontrado en el padrón de AFIP.", 404);
      }
      return fail(res, "Error al consultar AFIP. Intentá de nuevo.", 502);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await upstream.json();

    // apis.net.ar response shape (fields may vary):
    // { razonSocial, nombre, apellido, estadoClave, tipoPersona, categoriaIva, ... }
    const isActive = String(data.estadoClave ?? "").toLowerCase() === "activo";
    const isLegal = String(data.tipoPersona ?? "").toLowerCase() === "juridica";

    const companyName: string = isLegal
      ? (data.razonSocial ?? "Empresa sin nombre")
      : [data.nombre, data.apellido].filter(Boolean).join(" ") || data.razonSocial || "Persona sin nombre";

    const rawIva = String(data.categoriaIva ?? data.categoriaMono ?? "").toLowerCase();
    const taxStatus: string =
      rawIva.includes("responsable inscripto") || rawIva.includes("ri")
        ? "responsable_inscripto"
        : rawIva.includes("mono")
          ? "monotributista"
          : rawIva.includes("exento")
            ? "exento"
            : rawIva || "no_especificado";

    return ok(res, {
      companyName,
      taxStatus,
      entityType: isLegal ? "empresa" : "persona_fisica",
      active: isActive,
      raw: data,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      return fail(res, "El servicio de AFIP tardó demasiado. Intentá de nuevo.", 504);
    }
    return fail(res, "No se pudo consultar el padrón de AFIP.", 502);
  }
}
