/**
 * Los períodos del tablero. Todo se cuenta en días de Argentina (sin horario de verano), escritos AAAA-MM-DD, con
 * las dos puntas incluidas. El período anterior es el de la misma cantidad de días inmediatamente antes: la misma
 * regla que usa la función panel_tablero de la base.
 */

const ZONA = "America/Argentina/Buenos_Aires";

export type ClaveDePeriodo = "7d" | "30d" | "mes" | "mes_pasado";

export interface Periodo {
  clave: ClaveDePeriodo;
  etiqueta: string;
  desde: string;
  hasta: string;
  /** Todos los días del período, en orden. */
  dias: string[];
  anterior: { desde: string; hasta: string };
  /** Con qué se compara, para leer al lado de una variación: "los 7 días anteriores". */
  comparacion: string;
}

export const PERIODOS: ReadonlyArray<{ clave: ClaveDePeriodo; etiqueta: string }> = [
  { clave: "7d", etiqueta: "7 días" },
  { clave: "30d", etiqueta: "30 días" },
  { clave: "mes", etiqueta: "Este mes" },
  { clave: "mes_pasado", etiqueta: "Mes pasado" },
];

const partesDelDia = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" });

/** El día de Argentina de una fecha, como AAAA-MM-DD. Con una fecha que no se entiende devuelve una cadena vacía. */
export function diaDeArgentina(fecha: Date | string | null | undefined): string {
  if (!fecha) return "";
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  if (Number.isNaN(d.getTime())) return "";
  const partes = partesDelDia.formatToParts(d);
  const parte = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  return `${parte("year")}-${parte("month")}-${parte("day")}`;
}

function aFechaUtc(dia: string): Date {
  const [anio, mes, d] = dia.split("-").map(Number);
  return new Date(Date.UTC(anio, (mes ?? 1) - 1, d ?? 1));
}

export function sumarDias(dia: string, cantidad: number): string {
  const fecha = aFechaUtc(dia);
  fecha.setUTCDate(fecha.getUTCDate() + cantidad);
  return fecha.toISOString().slice(0, 10);
}

function diasEntre(desde: string, hasta: string): string[] {
  const dias: string[] = [];
  for (let dia = desde; dia <= hasta && dias.length < 400; dia = sumarDias(dia, 1)) dias.push(dia);
  return dias;
}

export function armarPeriodo(clave: ClaveDePeriodo, ahora: Date = new Date()): Periodo {
  const hoy = diaDeArgentina(ahora);
  const primeroDelMes = `${hoy.slice(0, 7)}-01`;
  let desde = sumarDias(hoy, -6);
  let hasta = hoy;
  if (clave === "30d") desde = sumarDias(hoy, -29);
  if (clave === "mes") desde = primeroDelMes;
  if (clave === "mes_pasado") {
    hasta = sumarDias(primeroDelMes, -1);
    desde = `${hasta.slice(0, 7)}-01`;
  }
  const dias = diasEntre(desde, hasta);
  const cantidad = dias.length;
  return {
    clave,
    etiqueta: PERIODOS.find((p) => p.clave === clave)?.etiqueta ?? "",
    desde,
    hasta,
    dias,
    anterior: { desde: sumarDias(desde, -cantidad), hasta: sumarDias(desde, -1) },
    comparacion: cantidad === 1 ? "el día anterior" : `los ${cantidad} días anteriores`,
  };
}

const diaCorto = new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", weekday: "short", day: "numeric" });
const diaNumerico = new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", day: "numeric", month: "numeric" });
const diaLargo = new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });

/** "jue 12": para ejes con pocos días. */
export const etiquetaCortaDelDia = (dia: string): string => diaCorto.format(aFechaUtc(dia)).replace(".", "");
/** "12/11": para ejes con muchos días. */
export const etiquetaNumericaDelDia = (dia: string): string => diaNumerico.format(aFechaUtc(dia));
/** "jueves 12 de noviembre": para leer un día entero. */
export const etiquetaLargaDelDia = (dia: string): string => diaLargo.format(aFechaUtc(dia));

/** "hace 5 min", "hace 3 h", "hace 2 días". Para algo que todavía no pasó o sin fecha devuelve una cadena vacía. */
export function haceCuanto(fecha: string | null | undefined, ahora: Date = new Date()): string {
  if (!fecha) return "";
  const ms = ahora.getTime() - new Date(fecha).getTime();
  if (Number.isNaN(ms) || ms < 0) return "";
  const minutos = Math.floor(ms / 60000);
  if (minutos < 1) return "recién";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return `hace ${dias} ${dias === 1 ? "día" : "días"}`;
}
