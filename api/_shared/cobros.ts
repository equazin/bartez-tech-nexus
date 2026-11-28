import { createHmac, timingSafeEqual } from "node:crypto";

import { configuracionDeMercadoPago } from "./mercadopago.js";
import { proveedorDelMedio } from "./medios.js";
import { cobroDeMobbex } from "./mobbex.js";
import { cobroDeOpenpay } from "./openpay.js";

/**
 * Los cobros en línea que no son Mercado Pago: Mobbex y Openpay (BBVA). Cada uno es un proveedor intercambiable
 * que existe solo si sus credenciales están cargadas en el hosting.
 *
 * Sus avisos de pago no vienen firmados. Decisión de Nico del 27/11/2026: el aviso solo dispara una consulta.
 *   1. La dirección del aviso lleva un código propio (HMAC del pago con una credencial que solo conoce la tienda):
 *      un aviso sin ese código se descarta antes de consultar nada.
 *   2. El estado, el monto y la moneda se preguntan al proveedor con las credenciales de la tienda. Nada de lo que
 *      diga el cuerpo del aviso marca un pedido como pagado.
 */

export type EstadoDeCobro = "aprobado" | "pendiente" | "rechazado" | "cancelado";

export interface DatosDelCobro {
  /** El id de nuestra fila en `pagos`. */
  pagoId: number;
  numero: string;
  total: number;
  email: string;
  nombre: string;
  documento: string;
  /** La página de la compra con su token, sin el parámetro `pago`. */
  vuelta: string;
  /** La dirección del aviso, con su código. */
  aviso: string;
  /** Cuántos minutos dura el enlace de pago. */
  minutos: number;
}

export interface CobroCreado {
  /** Con qué se consulta después el estado: la referencia de Mobbex o el id del link de Openpay. */
  referencia: string;
  url: string;
  detalle: Record<string, unknown>;
}

export interface EstadoDelCobro {
  idExterno: string | null;
  estado: EstadoDeCobro;
  /** En pesos; nulo si el proveedor no informó un monto válido. */
  monto: number | null;
  moneda: string | null;
  cuotas: number | null;
  detalle: Record<string, unknown>;
}

export interface CobroEnLinea {
  id: "mobbex" | "openpay";
  nombre: string;
  /** Con qué se calcula el código de la dirección del aviso. Nunca sale de la tienda. */
  secreto: string;
  crear(datos: DatosDelCobro): Promise<CobroCreado>;
  /** El estado de la operación, preguntado al proveedor con las credenciales de la tienda. */
  consultar(referencia: string): Promise<EstadoDelCobro>;
}

/** El proveedor, si tiene sus credenciales cargadas; nulo si no existe o falta configurarlo. */
export function cobroEnLinea(proveedor: string | null | undefined): CobroEnLinea | null {
  if (proveedor === "mobbex") return cobroDeMobbex();
  if (proveedor === "openpay") return cobroDeOpenpay();
  return null;
}

/** Si el medio puede cobrar hoy: la transferencia siempre; los demás, con sus credenciales cargadas. */
export function medioConfigurado(medio: string | null | undefined): boolean {
  const proveedor = proveedorDelMedio(medio);
  if (proveedor === "transferencia") return true;
  if (proveedor === "mercadopago") return configuracionDeMercadoPago() !== null;
  return cobroEnLinea(proveedor) !== null;
}

export function codigoDelAviso(cobro: CobroEnLinea, pagoId: number): string {
  return createHmac("sha256", cobro.secreto).update(`aviso:${cobro.id}:${pagoId}`).digest("hex").slice(0, 32);
}

export function codigoDelAvisoValido(cobro: CobroEnLinea, pagoId: number, codigo: string): boolean {
  const esperado = Buffer.from(codigoDelAviso(cobro, pagoId));
  const recibido = Buffer.from(codigo);
  return esperado.length === recibido.length && timingSafeEqual(esperado, recibido);
}
