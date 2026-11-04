/**
 * Los medios de pago de la tienda. Mercado Pago tiene dos: en 1 pago y en 3 cuotas sin interés, cada uno con su
 * margen (Configuración › Transferencia y medios). Los dos cobran por Mercado Pago (pagos.proveedor = 'mercadopago').
 */

export const MEDIOS_DE_LA_TIENDA = ["transferencia", "mercadopago", "mercadopago_cuotas"] as const;
export type MedioDeLaTienda = (typeof MEDIOS_DE_LA_TIENDA)[number];

/** Cuántas cuotas sin interés ofrece el medio en cuotas. Tienen que estar activadas en la cuenta de Mercado Pago. */
export const CUOTAS_SIN_INTERES = 3;

export const esDeMercadoPago = (medio: string | null | undefined): boolean => medio === "mercadopago" || medio === "mercadopago_cuotas";

export const NOMBRE_DEL_MEDIO: Record<MedioDeLaTienda, string> = {
  transferencia: "transferencia bancaria",
  mercadopago: "Mercado Pago",
  mercadopago_cuotas: `${CUOTAS_SIN_INTERES} cuotas sin interés con Mercado Pago`,
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
