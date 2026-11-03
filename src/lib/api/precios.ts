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
