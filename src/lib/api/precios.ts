import { supabase } from "@/lib/supabase";

export interface CotizacionDelDolar {
  id: number;
  valor: number;
  fuente: "manual" | "api";
  nota: string | null;
  vigente_desde: string;
  cargado_por: string | null;
}

export interface FilaDeConfiguracion {
  clave: "margen_base" | "redondeo_pesos" | "cuotas_maximas" | "envio_gratis_desde" | "peso_por_defecto_kg";
  valor: number | null;
  descripcion: string | null;
  actualizado_en: string;
}

export interface EstadoDelDolar {
  vigente: CotizacionDelDolar | null;
  historial: CotizacionDelDolar[];
  configuracion: FilaDeConfiguracion[];
  sin_precio: number;
  recalculados?: number;
}

async function cabecerasConSesion(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

/** Llama a /api/precios con la sesión del panel. Devuelve `data` o tira el error del servidor. */
export async function llamarPrecios<T>(recurso: string, init: { method?: "GET" | "POST" | "PATCH"; body?: unknown } = {}): Promise<T> {
  const respuesta = await fetch(`/api/precios?recurso=${encodeURIComponent(recurso)}`, {
    method: init.method ?? "GET",
    headers: { "Content-Type": "application/json", ...(await cabecerasConSesion()) },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const json = (await respuesta.json().catch(() => ({}))) as { ok?: boolean; data?: T; error?: string };
  if (!respuesta.ok || json.ok === false) throw new Error(json.error ?? `Error ${respuesta.status}`);
  return json.data as T;
}

export const obtenerEstadoDelDolar = () => llamarPrecios<EstadoDelDolar>("dolar");
export const cargarDolar = (valor: number, nota: string) => llamarPrecios<EstadoDelDolar>("dolar", { method: "POST", body: { valor, nota } });
export const guardarConfiguracionDePrecios = (cambios: Partial<Record<FilaDeConfiguracion["clave"], number | null>>) =>
  llamarPrecios<EstadoDelDolar>("configuracion", { method: "PATCH", body: cambios });
export const recalcularPrecios = () => llamarPrecios<{ recalculados: number; en: string }>("recalcular", { method: "POST" });

// ── Sincronización automática (dólar del BNA y ELIT) ─────────────────────────
export type TipoDeDolar = "billete" | "divisa";

export interface ConfiguracionAutomatica {
  dolar: { activo: boolean; tipo: TipoDeDolar };
  elit: { activa: boolean };
  newbytes: { activa: boolean };
}

export interface ResultadoDeMayorista {
  estado: "ok" | "parcial" | "apagada" | "sin_credenciales" | "error";
  vinculados: number;
  revisados: number;
  productos_cambiados: number;
  no_encontrados: number;
  error?: string;
}

export interface CorridaDeSincronizacion {
  empezo: string;
  termino: string;
  disparada_por: "cron" | "panel";
  dolar: { estado: "actualizado" | "sin_cambios" | "apagado" | "error"; valor?: number; anterior?: number | null; fecha?: string | null; origen?: string; error?: string };
  elit: ResultadoDeMayorista;
  /** Las corridas anteriores al alta de New Bytes no lo traen. */
  newbytes?: ResultadoDeMayorista;
  recalculados: number | null;
  error_recalculo?: string;
}

export interface EstadoDeSincronizacion {
  configuracion: ConfiguracionAutomatica;
  ultima: CorridaDeSincronizacion | null;
  credenciales_elit: boolean;
  credenciales_newbytes: boolean;
}

async function llamarSincronizacion<T>(recurso: string, init: { method?: "GET" | "POST" | "PATCH"; body?: unknown } = {}): Promise<T> {
  const respuesta = await fetch(`/api/tienda?modulo=sincronizacion&recurso=${encodeURIComponent(recurso)}`, {
    method: init.method ?? "GET",
    headers: { "Content-Type": "application/json", ...(await cabecerasConSesion()) },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const json = (await respuesta.json().catch(() => ({}))) as { ok?: boolean; data?: T; error?: string };
  if (!respuesta.ok || json.ok === false) throw new Error(json.error ?? `Error ${respuesta.status}`);
  return json.data as T;
}

export const obtenerSincronizacion = () => llamarSincronizacion<EstadoDeSincronizacion>("estado");
export const guardarSincronizacion = (cambios: {
  dolar?: Partial<ConfiguracionAutomatica["dolar"]>;
  elit?: Partial<ConfiguracionAutomatica["elit"]>;
  newbytes?: Partial<ConfiguracionAutomatica["newbytes"]>;
}) =>
  llamarSincronizacion<EstadoDeSincronizacion>("configuracion", { method: "PATCH", body: cambios });
export const sincronizarAhora = () => llamarSincronizacion<CorridaDeSincronizacion>("correr", { method: "POST" });
