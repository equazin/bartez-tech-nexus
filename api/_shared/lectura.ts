/**
 * Lectura defensiva de las respuestas de los proveedores de pago (Mobbex, Openpay): nunca se confía en su forma.
 */

export const objeto = (valor: unknown): Record<string, unknown> =>
  valor !== null && typeof valor === "object" && !Array.isArray(valor) ? (valor as Record<string, unknown>) : {};

export function numero(valor: unknown): number | null {
  const n = typeof valor === "number" ? valor : typeof valor === "string" && valor.trim() !== "" ? Number(valor) : NaN;
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

export function entero(valor: unknown): number | null {
  const n = numero(valor);
  return n !== null && Number.isInteger(n) ? n : null;
}

export const texto = (valor: unknown): string | null => (typeof valor === "string" && valor.trim() !== "" ? valor.trim() : null);

/** Lee una respuesta como JSON sin tirar si viene vacía o rota. */
export async function leerJson(respuesta: Response): Promise<Record<string, unknown>> {
  const crudo = await respuesta.text();
  try {
    return objeto(crudo ? JSON.parse(crudo) : {});
  } catch {
    return {};
  }
}

/** El mensaje de error de un proveedor, corto y sin datos de la tienda. */
export function mensajeDelProveedor(cuerpo: Record<string, unknown>, estado: number): string {
  const mensaje = texto(cuerpo.error) ?? texto(cuerpo.message) ?? texto(objeto(cuerpo.error).message) ?? `respuesta ${estado}`;
  return mensaje.slice(0, 200);
}
