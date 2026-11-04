import { createHmac } from "node:crypto";

/**
 * Cliente de la API v2 de Zipnova Envíos (https://docs.zipnova.com). Autenticación básica: el token como
 * usuario y el secret como contraseña, desde ZIPNOVA_API_TOKEN y ZIPNOVA_API_SECRET.
 */

const BASE = "https://api.zipnova.com.ar/v2";
const ESPERA_MS = 20_000;
export const ORIGEN_DE_LA_INTEGRACION = "teqo";

export function hayCredencialesDeZipnova(): boolean {
  return Boolean(process.env.ZIPNOVA_API_TOKEN?.trim() && process.env.ZIPNOVA_API_SECRET?.trim());
}

function autorizacion(): string {
  const token = process.env.ZIPNOVA_API_TOKEN?.trim();
  const secreto = process.env.ZIPNOVA_API_SECRET?.trim();
  if (!token || !secreto) throw new Error("Faltan ZIPNOVA_API_TOKEN y ZIPNOVA_API_SECRET en las variables de entorno.");
  return `Basic ${Buffer.from(`${token}:${secreto}`).toString("base64")}`;
}

async function pedir(ruta: string, init: { method?: string; body?: unknown; aceptar?: string } = {}): Promise<Response> {
  const respuesta = await fetch(`${BASE}${ruta}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: autorizacion(),
      Accept: init.aceptar ?? "application/json",
      ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(ESPERA_MS),
  });
  if (!respuesta.ok) {
    const texto = await respuesta.text().catch(() => "");
    let detalle = texto.slice(0, 300);
    try {
      const json = JSON.parse(texto) as { message?: string; errors?: Record<string, string[]> };
      const errores = json.errors ? Object.values(json.errors).flat().join(" ") : "";
      detalle = [json.message, errores].filter(Boolean).join(" ") || detalle;
    } catch {
      // queda el texto crudo
    }
    throw new Error(`Zipnova respondió ${respuesta.status}${detalle ? `: ${detalle}` : ""}`);
  }
  return respuesta;
}

async function pedirJson<T>(ruta: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const respuesta = await pedir(ruta, init);
  return (await respuesta.json()) as T;
}

// ── Cotizar ─────────────────────────────────────────────────────────────────

export interface ItemDeZipnova {
  weight: number; // gramos
  height: number; // cm
  width: number;
  length: number;
  description?: string;
}

export interface DestinoDeZipnova {
  zipcode: string;
  city: string;
  state: string;
}

export interface PuntoDeRetiro {
  point_id: number;
  description: string;
  open_hours: string | null;
  phone: string | null;
  location: { street: string; street_number: string; street_extras: string | null; city: string; state: string; zipcode: string | null };
}

export interface ResultadoDeCotizacion {
  selectable: boolean;
  logistic_type: string;
  carrier: { id: number; name: string; logo: string | null };
  service_type: { id: number; code: string; name: string; is_urgent: boolean };
  delivery_time: {
    estimated_delivery?: string | null;
    times?: { total?: { min?: string; max?: string } };
    min?: number;
    max?: number;
  };
  amounts: { price: number; price_incl_tax: number; seller_price?: number; seller_price_incl_tax?: number };
  tags?: string[];
  pickup_points?: PuntoDeRetiro[] | null;
}

export async function cotizarConZipnova(params: {
  accountId: number;
  origenId: number;
  destino: DestinoDeZipnova;
  valorDeclarado: number;
  items: ItemDeZipnova[];
}): Promise<ResultadoDeCotizacion[]> {
  const respuesta = await pedirJson<{ results?: unknown; all_results?: unknown }>("/shipments/quote", {
    method: "POST",
    body: {
      account_id: params.accountId,
      origin_id: params.origenId,
      source: ORIGEN_DE_LA_INTEGRACION,
      destination: params.destino,
      declared_value: Math.max(0, Math.round(params.valorDeclarado)),
      items: params.items,
      type_packaging: "dynamic",
    },
  });
  return [...comoLista(respuesta.all_results), ...comoLista(respuesta.results)];
}

/**
 * Zipnova devuelve "results" agrupado por tipo de servicio ({ standard_delivery: {...}, pickup_point: {...} }) y
 * "all_results" como lista; se aceptan las dos formas. Los grupos vacíos (null) se descartan.
 */
function comoLista(valor: unknown): ResultadoDeCotizacion[] {
  const elementos = Array.isArray(valor) ? valor : valor !== null && typeof valor === "object" ? Object.values(valor) : [];
  return elementos.flatMap((e) => (Array.isArray(e) ? e : [e])).filter((e): e is ResultadoDeCotizacion => e !== null && typeof e === "object");
}

/** Días de una duración ISO 8601 como "P3D" o "P1W2D". */
export function diasDeDuracion(duracion: string | undefined | null): number | null {
  if (!duracion) return null;
  const m = /^P(?:(\d+)W)?(?:(\d+)D)?/.exec(duracion);
  if (!m) return null;
  return Number(m[1] ?? 0) * 7 + Number(m[2] ?? 0);
}

// ── Crear y consultar envíos ────────────────────────────────────────────────

export interface EnvioDeZipnova {
  id: number;
  external_id: string | null;
  carrier_tracking_id: string | null;
  status: string;
  status_name: string;
  tracking: string | null;
  tracking_external: string | null;
  carrier?: { id: number; name: string } | null;
}

export async function crearEnvioEnZipnova(cuerpo: Record<string, unknown>): Promise<EnvioDeZipnova> {
  const respuesta = await pedirJson<EnvioDeZipnova | { data: EnvioDeZipnova }>("/shipments", {
    method: "POST",
    body: { source: ORIGEN_DE_LA_INTEGRACION, ...cuerpo },
  });
  return "data" in respuesta && respuesta.data ? respuesta.data : (respuesta as EnvioDeZipnova);
}

export async function obtenerEnvioDeZipnova(id: number): Promise<EnvioDeZipnova> {
  const respuesta = await pedirJson<EnvioDeZipnova | { data: EnvioDeZipnova }>(`/shipments/${id}`);
  return "data" in respuesta && respuesta.data ? respuesta.data : (respuesta as EnvioDeZipnova);
}

/** La etiqueta (label) o la guía (document) en PDF, sin cambiar el estado del envío. */
export async function documentoDelEnvio(id: number, que: "label" | "document"): Promise<Buffer> {
  const respuesta = await pedir(`/shipments/${id}/${que}.pdf?no_status_change=1`, { aceptar: "application/pdf" });
  return Buffer.from(await respuesta.arrayBuffer());
}

// ── Cuenta, orígenes y avisos ───────────────────────────────────────────────

export interface CuentaDeZipnova {
  id: number;
  name?: string;
  description?: string;
}

export interface DireccionDeZipnova {
  id: number;
  name?: string;
  street?: string;
  street_number?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  account_id?: number;
}

const lista = <T>(r: T[] | { data?: T[] }): T[] => (Array.isArray(r) ? r : (r.data ?? []));

export async function cuentasDeZipnova(): Promise<CuentaDeZipnova[]> {
  return lista(await pedirJson<CuentaDeZipnova[] | { data?: CuentaDeZipnova[] }>("/accounts"));
}

export async function direccionesDeZipnova(): Promise<DireccionDeZipnova[]> {
  return lista(await pedirJson<DireccionDeZipnova[] | { data?: DireccionDeZipnova[] }>("/addresses"));
}

/**
 * Zipnova no firma sus avisos: la dirección lleva una clave derivada del secret, y además cada aviso se
 * confirma consultando el envío en Zipnova antes de tocar el pedido.
 */
export function claveDeAvisos(): string {
  const secreto = process.env.ZIPNOVA_API_SECRET?.trim() ?? "";
  return createHmac("sha256", secreto).update("teqo-avisos-zipnova").digest("hex").slice(0, 32);
}

export async function suscribirAvisos(accountId: number, url: string): Promise<void> {
  const existentes = lista(
    await pedirJson<Array<{ id: number; topic: string; url: string }> | { data?: Array<{ id: number; topic: string; url: string }> }>(
      `/accounts/${accountId}/webhooks?topic=status`,
    ),
  );
  const base = url.split("?")[0];
  for (const w of existentes) {
    if (w.url.split("?")[0] === base) await pedir(`/accounts/${accountId}/webhooks/${w.id}`, { method: "DELETE" });
  }
  await pedir(`/accounts/${accountId}/webhooks`, { method: "POST", body: { topic: "status", url } });
}
