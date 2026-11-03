/**
 * Cotización del dólar del Banco de la Nación Argentina, leída de la página pública de Personas
 * (tablas "Cotización Billetes" y "Cotización Divisas"). Si la página no responde o cambió de forma,
 * se usa dolarapi.com, que publica la misma cotización oficial del BNA (solo billete).
 */

export type TipoDeDolar = "billete" | "divisa";

export interface CotizacionBna {
  tipo: TipoDeDolar;
  compra: number;
  venta: number;
  /** Fecha que publica el banco, como la escribe ("3/11/2026"). */
  fecha: string | null;
  origen: "bna" | "dolarapi";
}

const PAGINA_DEL_BNA = "https://www.bna.com.ar/Personas";
const RESPALDO_DOLARAPI = "https://dolarapi.com/v1/dolares/oficial";
const ESPERA_MS = 12_000;
const NAVEGADOR = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

/** "1570,00" → 1570; "1.570,00" → 1570; "1551.0000" → 1551. */
export function numeroDelBanco(texto: string): number {
  const limpio = texto.trim().replace(/\s+/g, "");
  const normalizado = limpio.includes(",") ? limpio.replace(/\./g, "").replace(",", ".") : limpio;
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : Number.NaN;
}

/** Lee la fila "Dolar U.S.A" de la pestaña pedida (id="billetes" o id="divisas") del HTML del banco. */
export function leerTablaDelBna(html: string, tipo: TipoDeDolar): Omit<CotizacionBna, "origen"> | null {
  const id = tipo === "billete" ? "billetes" : "divisas";
  const inicio = html.search(new RegExp(`id=["']${id}["']`, "i"));
  if (inicio < 0) return null;
  const resto = html.slice(inicio);
  const fin = resto.slice(10).search(/id=["'](billetes|divisas|monedas)["']/i);
  const seccion = fin < 0 ? resto : resto.slice(0, fin + 10);

  const fila = seccion.match(/D[oó]lar\s+U\.?S\.?A\.?\s*<\/td>\s*<td[^>]*>\s*([\d.,]+)\s*<\/td>\s*<td[^>]*>\s*([\d.,]+)\s*<\/td>/i);
  if (!fila) return null;
  const compra = numeroDelBanco(fila[1]);
  const venta = numeroDelBanco(fila[2]);
  if (!Number.isFinite(compra) || !Number.isFinite(venta) || venta <= 0) return null;

  const fecha = seccion.match(/class=["']fechaCot["'][^>]*>\s*([^<]+?)\s*</i)?.[1] ?? null;
  return { tipo, compra, venta, fecha };
}

async function desdeElBanco(tipo: TipoDeDolar): Promise<CotizacionBna> {
  const respuesta = await fetch(PAGINA_DEL_BNA, {
    headers: { "User-Agent": NAVEGADOR, Accept: "text/html" },
    signal: AbortSignal.timeout(ESPERA_MS),
  });
  if (!respuesta.ok) throw new Error(`El BNA respondió ${respuesta.status}`);
  const leida = leerTablaDelBna(await respuesta.text(), tipo);
  if (!leida) throw new Error("No se encontró la fila del dólar en la página del BNA");
  return { ...leida, origen: "bna" };
}

async function desdeDolarapi(): Promise<CotizacionBna> {
  const respuesta = await fetch(RESPALDO_DOLARAPI, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(ESPERA_MS) });
  if (!respuesta.ok) throw new Error(`dolarapi.com respondió ${respuesta.status}`);
  const json = (await respuesta.json()) as { compra?: unknown; venta?: unknown; fechaActualizacion?: unknown };
  const compra = Number(json.compra);
  const venta = Number(json.venta);
  if (!Number.isFinite(venta) || venta <= 0) throw new Error("dolarapi.com no trajo un valor de venta");
  const fecha = typeof json.fechaActualizacion === "string" ? new Date(json.fechaActualizacion).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" }) : null;
  return { tipo: "billete", compra: Number.isFinite(compra) ? compra : venta, venta, fecha, origen: "dolarapi" };
}

/** La cotización de venta del tipo pedido. El respaldo de dolarapi.com solo vale para billete. */
export async function consultarDolarBna(tipo: TipoDeDolar): Promise<CotizacionBna> {
  try {
    return await desdeElBanco(tipo);
  } catch (e: unknown) {
    if (tipo !== "billete") throw e;
    console.error("[dolar-bna] La página del BNA falló, se usa dolarapi.com:", e instanceof Error ? e.message : e);
    return desdeDolarapi();
  }
}
