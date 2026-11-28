/** Nombres y grupos de los estados y los medios de pago de las compras de la tienda, para el panel. */

export const ESTADOS_DE_LA_TIENDA: Record<string, string> = {
  pendiente_pago: "Pendiente de pago",
  pagado: "Pagado",
  preparando: "En preparación",
  enviado: "Enviado",
  entregado: "Entregado",
  cancelado: "Cancelado",
  reintegrado: "Reintegrado",
  vencido: "Vencido",
};

/** Estados en los que la compra está cobrada. Cancelado, reintegrado y vencido no cuentan como venta. */
export const ESTADOS_PAGADOS: readonly string[] = ["pagado", "preparando", "enviado", "entregado"];

export const estaPagado = (estado: string): boolean => ESTADOS_PAGADOS.includes(estado);

export const NOMBRE_DEL_MEDIO: Record<string, string> = {
  transferencia: "Transferencia",
  mercadopago: "Mercado Pago en 1 pago",
  mercadopago_cuotas: "Mercado Pago en 3 cuotas",
  mobbex: "Mobbex",
  openpay: "Openpay",
};

export const nombreDelMedio = (medio: string | null | undefined): string => NOMBRE_DEL_MEDIO[medio ?? ""] ?? medio ?? "Sin medio";

export type TonoDelEstado = "success" | "secondary" | "destructive" | "muted";

export function tonoDelEstado(estado: string): TonoDelEstado {
  if (estado === "pagado" || estado === "entregado") return "success";
  if (estado === "cancelado" || estado === "vencido") return "muted";
  if (estado === "reintegrado") return "destructive";
  return "secondary";
}
