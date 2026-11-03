import { supabase } from "@/lib/supabase";

export interface CotizacionDeEnvio {
  precio: number | null;
  demora_dias_min: number | null;
  demora_dias_max: number | null;
  gratis: boolean;
  disponible: boolean;
}

export interface ItemDeEnvio {
  product_id: number;
  cantidad: number;
}

/**
 * La misma tarifa para todo el país. Lo que despacha Teqo se cotiza por peso; lo que despacha un mayorista
 * directo (New Bytes) paga su tarifa plana, una por pedido; si el carrito mezcla los dos, se cobra solo el
 * envío más alto. Se cotiza con el RPC público y el servidor lo recalcula al confirmar.
 */
export async function cotizarEnvio(items: ItemDeEnvio[], subtotal: number): Promise<CotizacionDeEnvio> {
  const { data, error } = await supabase.rpc("tienda_cotizar_envio_carrito", { p_items: items, p_subtotal: subtotal });
  if (error) throw new Error(`No se pudo cotizar el envío: ${error.message}`);
  const fila = (Array.isArray(data) ? data[0] : data) as CotizacionDeEnvio | undefined;
  return fila ?? { precio: null, demora_dias_min: null, demora_dias_max: null, gratis: false, disponible: false };
}

export function textoDeDemora(cotizacion: Pick<CotizacionDeEnvio, "demora_dias_min" | "demora_dias_max">): string {
  const { demora_dias_min: min, demora_dias_max: max } = cotizacion;
  if (min === null || max === null) return "";
  if (min === max) return `Llega en ${min} ${min === 1 ? "día hábil" : "días hábiles"}`;
  return `Llega en ${min} a ${max} días hábiles`;
}

/** Las 24 jurisdicciones, para el formulario de envío. El precio es el mismo en todas. */
export const PROVINCIAS = [
  "Buenos Aires",
  "Ciudad Autónoma de Buenos Aires",
  "Catamarca",
  "Chaco",
  "Chubut",
  "Córdoba",
  "Corrientes",
  "Entre Ríos",
  "Formosa",
  "Jujuy",
  "La Pampa",
  "La Rioja",
  "Mendoza",
  "Misiones",
  "Neuquén",
  "Río Negro",
  "Salta",
  "San Juan",
  "San Luis",
  "Santa Cruz",
  "Santa Fe",
  "Santiago del Estero",
  "Tierra del Fuego",
  "Tucumán",
] as const;

export type Provincia = (typeof PROVINCIAS)[number];
