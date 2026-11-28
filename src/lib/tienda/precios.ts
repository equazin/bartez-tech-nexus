import type { PrecioPorMedio, ProductoPublico } from "./catalogo";

/**
 * El precio de cada producto según el medio de pago. El margen sobre el costo lo pone cada medio
 * (transferencia y Mercado Pago, configurables en el panel); la vista pública trae los precios ya
 * calculados, sin el porcentaje, y acá solo se leen y se nombran. El checkout del servidor vuelve
 * a calcularlos al cobrar.
 */

/** El medio en cuotas: Mercado Pago en 3 cuotas sin interés, con su propio precio. */
export const MEDIO_CON_CUOTAS = "mercadopago_cuotas";
/** Las cuotas sin interés del medio en cuotas (activadas en la cuenta de Mercado Pago). */
export const CUOTAS_SIN_INTERES = 3;

export const esDeMercadoPago = (medio: string | null | undefined): boolean => medio === "mercadopago" || medio === MEDIO_CON_CUOTAS;

/** Quién cobra cada medio que se paga afuera de la tienda y vuelve (todos menos la transferencia). */
const COBRA_EN_LINEA: Record<string, string> = { mercadopago: "Mercado Pago", mercadopago_cuotas: "Mercado Pago", mobbex: "Mobbex", openpay: "Openpay" };

/** El nombre de quien cobra el medio (Mercado Pago, Mobbex u Openpay); nulo para la transferencia. */
export const proveedorEnLinea = (medio: string | null | undefined): string | null => COBRA_EN_LINEA[medio ?? ""] ?? null;

export const esCobroEnLinea = (medio: string | null | undefined): boolean => proveedorEnLinea(medio) !== null;

/** Lo que vale cada cuota sin interés, con centavos. */
export const valorDeLaCuota = (total: number): number => Math.round((total / CUOTAS_SIN_INTERES) * 100) / 100;

const NOMBRES_CORTOS: Record<string, string> = {
  transferencia: "Transferencia",
  mercadopago: "Mercado Pago",
  mercadopago_cuotas: `${CUOTAS_SIN_INTERES} cuotas sin interés`,
  mobbex: "Mobbex",
  openpay: "Openpay",
};

export function nombreCortoDeMedio(medio: Pick<PrecioPorMedio, "id" | "nombre">): string {
  return NOMBRES_CORTOS[medio.id] ?? medio.nombre;
}

type ConPrecios = Pick<ProductoPublico, "precio_final_ars" | "precios_por_medio">;

/** Los precios por medio, del más barato al más caro. Sin datos de medios, el precio final solo. */
export function preciosDe(producto: ConPrecios): PrecioPorMedio[] {
  const lista = (producto.precios_por_medio ?? []).filter((m) => m && typeof m.id === "string");
  if (lista.length > 0) return lista.map((m) => ({ id: m.id, nombre: m.nombre, precio: m.precio === null ? null : Number(m.precio) }));
  return [{ id: "contado", nombre: "Precio final", precio: producto.precio_final_ars }];
}

/** El precio del producto pagando con ese medio; si el medio no está, el precio final. */
export function precioConMedio(producto: ConPrecios, medio: string): number | null {
  const encontrado = preciosDe(producto).find((m) => m.id === medio);
  return encontrado ? encontrado.precio : producto.precio_final_ars;
}
