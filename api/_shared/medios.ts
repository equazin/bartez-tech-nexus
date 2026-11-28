/**
 * Los medios de pago de la tienda. Mercado Pago tiene dos: en 1 pago y en 3 cuotas sin interés, cada uno con su
 * margen (Configuración › Transferencia y medios). Los dos cobran por Mercado Pago (pagos.proveedor = 'mercadopago').
 * Mobbex y Openpay (BBVA) son un medio cada uno y su propio proveedor; se prenden por configuración.
 */

export const MEDIOS_DE_LA_TIENDA = ["transferencia", "mercadopago", "mercadopago_cuotas", "mobbex", "openpay"] as const;
export type MedioDeLaTienda = (typeof MEDIOS_DE_LA_TIENDA)[number];

/** Quién cobra cada medio: el valor de pagos.proveedor. */
export type ProveedorDePago = "mercadopago" | "transferencia" | "mobbex" | "openpay";

/** Cuántas cuotas sin interés ofrece el medio en cuotas. Tienen que estar activadas en la cuenta de Mercado Pago. */
export const CUOTAS_SIN_INTERES = 3;

export const esDeMercadoPago = (medio: string | null | undefined): boolean => medio === "mercadopago" || medio === "mercadopago_cuotas";

export function proveedorDelMedio(medio: string | null | undefined): ProveedorDePago | null {
  if (esDeMercadoPago(medio)) return "mercadopago";
  if (medio === "transferencia" || medio === "mobbex" || medio === "openpay") return medio;
  return null;
}

/** Los medios que se pagan en la página de un proveedor y vuelven a la tienda (todos menos la transferencia). */
export const esCobroEnLinea = (medio: string | null | undefined): boolean => {
  const proveedor = proveedorDelMedio(medio);
  return proveedor !== null && proveedor !== "transferencia";
};

export const NOMBRE_DEL_PROVEEDOR: Record<ProveedorDePago, string> = {
  mercadopago: "Mercado Pago",
  transferencia: "transferencia bancaria",
  mobbex: "Mobbex",
  openpay: "Openpay",
};

export const NOMBRE_DEL_MEDIO: Record<MedioDeLaTienda, string> = {
  transferencia: "transferencia bancaria",
  mercadopago: "Mercado Pago",
  mercadopago_cuotas: `${CUOTAS_SIN_INTERES} cuotas sin interés con Mercado Pago`,
  mobbex: "Mobbex",
  openpay: "Openpay",
};

export const nombreDelMedio = (medio: string | null | undefined): string =>
  (MEDIOS_DE_LA_TIENDA as readonly string[]).includes(medio ?? "") ? NOMBRE_DEL_MEDIO[medio as MedioDeLaTienda] : (medio ?? "sin dato");

/**
 * Las cuotas que deja elegir la preferencia de Mercado Pago. En 1 pago, una sola: las cuotas sin interés tienen otro
 * precio. En cuotas, hasta 3 y arranca en 3; sin débito ni prepagas, que no tienen cuotas.
 */
export function cuotasDeLaPreferencia(medio: string): { maximas: number; porDefecto: number | null; soloCredito: boolean } {
  if (medio === "mercadopago_cuotas") return { maximas: CUOTAS_SIN_INTERES, porDefecto: CUOTAS_SIN_INTERES, soloCredito: true };
  return { maximas: 1, porDefecto: null, soloCredito: false };
}
