/** Formatos del tablero: pesos sin centavos, números compactos para los ejes, porcentajes y fechas de Argentina. */

import { diaDeArgentina } from "./periodos";

const ZONA = "America/Argentina/Buenos_Aires";

const formatoPesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const formatoEntero = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const formatoUnDecimal = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });
const formatoHora = new Intl.DateTimeFormat("es-AR", { timeZone: ZONA, hour: "2-digit", minute: "2-digit", hour12: false });
const formatoDiaYMes = new Intl.DateTimeFormat("es-AR", { timeZone: ZONA, day: "numeric", month: "numeric" });

export const pesos = (monto: number): string => formatoPesos.format(Math.round(monto));
export const entero = (cantidad: number): string => formatoEntero.format(Math.round(cantidad));
export const porcentaje = (valor: number): string => `${formatoUnDecimal.format(valor)} %`;

/** 950 · 1,8 mil · 25 mil · 1,3 M. Para ejes: un solo estilo en todo el gráfico. */
export function compacto(valor: number): string {
  const absoluto = Math.abs(valor);
  if (absoluto >= 1_000_000) return `${formatoUnDecimal.format(valor / 1_000_000)} M`;
  if (absoluto >= 1_000) return `${formatoUnDecimal.format(valor / 1_000)} mil`;
  return formatoEntero.format(valor);
}

export const pesosCompactos = (monto: number): string => `$ ${compacto(monto)}`;

/** "1 compra", "3 compras". */
export const contar = (cantidad: number, singular: string, plural: string): string => `${entero(cantidad)} ${cantidad === 1 ? singular : plural}`;

export interface Variacion {
  direccion: "sube" | "baja" | "igual";
  /** "+12 %", "−8 %", "igual". */
  texto: string;
}

/** La variación contra el período anterior. Sin base para comparar (anterior en cero) devuelve nulo. */
export function variacion(actual: number, anterior: number): Variacion | null {
  if (!Number.isFinite(actual) || !Number.isFinite(anterior) || anterior <= 0) return null;
  const cambio = ((actual - anterior) / anterior) * 100;
  if (Math.abs(cambio) < 0.5) return { direccion: "igual", texto: "igual" };
  const redondeado = Math.abs(cambio) >= 10 ? formatoEntero.format(Math.abs(cambio)) : formatoUnDecimal.format(Math.abs(cambio));
  return cambio > 0 ? { direccion: "sube", texto: `+${redondeado} %` } : { direccion: "baja", texto: `−${redondeado} %` };
}

/** "hoy a las 09:32" o "el 11/11 a las 09:32". Sin fecha devuelve una cadena vacía. */
export function diaYHora(fecha: string | null | undefined, ahora: Date = new Date()): string {
  if (!fecha) return "";
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return "";
  const hora = formatoHora.format(d);
  return diaDeArgentina(d) === diaDeArgentina(ahora) ? `hoy a las ${hora}` : `el ${formatoDiaYMes.format(d)} a las ${hora}`;
}

/** El tope del eje: el número redondo que sigue al máximo (1, 2, 2,5, 5 o 10 por la potencia de diez). */
export function topeRedondo(maximo: number): number {
  if (!Number.isFinite(maximo) || maximo <= 0) return 1;
  const potencia = 10 ** Math.floor(Math.log10(maximo));
  const fraccion = maximo / potencia;
  const paso = fraccion <= 1 ? 1 : fraccion <= 2 ? 2 : fraccion <= 2.5 ? 2.5 : fraccion <= 5 ? 5 : 10;
  return paso * potencia;
}
