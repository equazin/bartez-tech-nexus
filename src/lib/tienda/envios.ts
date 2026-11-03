import { supabase } from "@/lib/supabase";

export interface CotizacionDeEnvio {
  precio: number | null;
  demora_dias_min: number | null;
  demora_dias_max: number | null;
  gratis: boolean;
  disponible: boolean;
}

/** La misma tarifa para todo el país, por peso. Se cotiza con el RPC público; el servidor la recalcula al confirmar. */
export async function cotizarEnvio(pesoKg: number, subtotal: number): Promise<CotizacionDeEnvio> {
  const { data, error } = await supabase.rpc("tienda_cotizar_envio", { p_peso_kg: Math.max(pesoKg, 0.001), p_subtotal: subtotal });
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
