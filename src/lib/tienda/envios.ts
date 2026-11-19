import { supabase } from "@/lib/supabase";
import { formatearPesos } from "@/lib/tienda/dinero";

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
 * Lo que se sabe del envío antes de tener el destino (ficha y carrito). Lo que despacha un mayorista directo
 * (New Bytes) paga su tarifa fija, igual en todo el país, una por pedido. Lo que despacha Teqo se cotiza con el
 * transporte según el destino: acá sale sin costo ni plazo ("no disponible"), salvo que el envío sea sin cargo.
 * El servidor vuelve a calcular todo al confirmar la compra.
 */
export async function cotizarEnvio(items: ItemDeEnvio[], subtotal: number): Promise<CotizacionDeEnvio> {
  const { data, error } = await supabase.rpc("tienda_cotizar_envio_carrito", { p_items: items, p_subtotal: subtotal });
  if (error) throw new Error(`No se pudo cotizar el envío: ${error.message}`);
  const fila = (Array.isArray(data) ? data[0] : data) as CotizacionDeEnvio | undefined;
  return fila ?? { precio: null, demora_dias_min: null, demora_dias_max: null, gratis: false, disponible: false };
}

export interface SucursalDeEnvio {
  id: number;
  nombre: string;
  direccion: string;
  horario: string | null;
}

/** Una forma de entrega cotizada para un destino: a domicilio o retiro en una sucursal del transporte. */
export interface OpcionDeEnvio {
  id: "domicilio" | "sucursal";
  precio: number;
  gratis: boolean;
  demora_dias_min: number | null;
  demora_dias_max: number | null;
  entrega_estimada: string | null;
  transporte: string | null;
  sucursales?: SucursalDeEnvio[];
}

export interface DestinoDeEnvio {
  codigo_postal: string;
  localidad: string;
  provincia: string;
}

/**
 * Cotiza el envío a un destino con el servidor (Zipnova para lo que despacha Teqo, la tarifa plana para lo que
 * despacha un mayorista directo). El servidor vuelve a cotizar al confirmar la compra.
 */
export async function cotizarEnvioADestino(
  items: ItemDeEnvio[],
  subtotal: number,
  destino: DestinoDeEnvio,
): Promise<{ opciones: OpcionDeEnvio[]; error: string | null }> {
  const respuesta = await fetch("/api/envios?recurso=cotizar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items, subtotal, destino }),
  });
  const json = (await respuesta.json().catch(() => ({}))) as { data?: { opciones?: OpcionDeEnvio[]; error?: string }; error?: string };
  if (!respuesta.ok) return { opciones: [], error: json.error ?? "No pudimos cotizar el envío. Probá en un rato." };
  return { opciones: json.data?.opciones ?? [], error: json.data?.error ?? null };
}

export function textoDeDemora(cotizacion: Pick<CotizacionDeEnvio, "demora_dias_min" | "demora_dias_max">): string {
  const { demora_dias_min: min, demora_dias_max: max } = cotizacion;
  if (min === null || max === null) return "";
  if (min === max) return `Llega en ${min} ${min === 1 ? "día hábil" : "días hábiles"}`;
  return `Llega en ${min} a ${max} días hábiles`;
}

export interface ResumenDelEnvio {
  /** El costo, "Sin cargo", "A calcular" (depende del destino) o "Cotizando". */
  costo: string;
  /** Cuándo llega, o de qué depende. */
  plazo: string;
  /** El costo ya es el definitivo: no cambia con el destino. */
  costoFirme: boolean;
  /** El costo y el plazo son los mismos en cualquier provincia: solo entonces la tienda lo dice. */
  igualEnTodoElPais: boolean;
}

/**
 * Cómo contar el envío en la ficha y en el carrito, antes de que el comprador cargue su dirección. No promete lo
 * que no se sabe: si el costo depende del destino dice "A calcular", nunca un importe ni un plazo.
 */
export function resumenDelEnvio(cotizacion: CotizacionDeEnvio | null): ResumenDelEnvio {
  if (!cotizacion) return { costo: "Cotizando", plazo: "Consultando el envío", costoFirme: false, igualEnTodoElPais: false };
  if (!cotizacion.disponible) return { costo: "A calcular", plazo: "Depende de tu dirección", costoFirme: false, igualEnTodoElPais: false };
  const demora = textoDeDemora(cotizacion);
  return {
    costo: cotizacion.gratis ? "Sin cargo" : formatearPesos(cotizacion.precio ?? 0),
    plazo: demora ? `${demora} desde que se acredita el pago` : "El plazo depende de tu dirección",
    costoFirme: true,
    igualEnTodoElPais: demora !== "",
  };
}

/** Las 24 jurisdicciones, para el formulario de envío. */
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
