import { supabase } from "@/lib/supabase";

/** Panel › Envíos con Zipnova: configuración, medidas por categoría y pedidos para despachar. */

export interface ConfiguracionDeZipnova {
  activo: boolean;
  account_id: number | null;
  origen_id: number | null;
  margen_porcentaje: number;
  margen_fijo: number;
  sucursal: boolean;
}

export interface MedidaDeCategoria {
  categoria_id: number;
  alto_cm: number;
  ancho_cm: number;
  largo_cm: number;
}

export interface CategoriaDelPanel {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
}

export interface EstadoDeEnvios {
  zipnova: ConfiguracionDeZipnova;
  credenciales: boolean;
  medidas: MedidaDeCategoria[];
  categorias: CategoriaDelPanel[];
}

export interface CuentasDeZipnova {
  cuentas: Array<{ id: number; name?: string; description?: string }>;
  direcciones: Array<{ id: number; name?: string; street?: string; street_number?: string; city?: string; state?: string; zipcode?: string }>;
}

export interface PedidoParaDespachar {
  id: number;
  order_number: string;
  status: string;
  comprador_nombre: string | null;
  comprador_documento: string | null;
  direccion_envio: Record<string, string | null> | null;
  envio_detalle: { opcion?: string; sucursal?: string | null; transporte?: string | null; entrega_estimada?: string | null } | null;
  zipnova_envio_id: number | null;
  tracking_number: string | null;
  envio_seguimiento_url: string | null;
  shipping_transport: string | null;
  created_at: string;
}

async function cabeceras(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

async function llamar<T>(recurso: string, init: { method?: "GET" | "POST" | "PUT"; body?: unknown } = {}): Promise<T> {
  const respuesta = await fetch(`/api/envios?recurso=${encodeURIComponent(recurso)}`, {
    method: init.method ?? "GET",
    headers: { "Content-Type": "application/json", ...(await cabeceras()) },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const json = (await respuesta.json().catch(() => ({}))) as { ok?: boolean; data?: T; error?: string };
  if (!respuesta.ok || json.ok === false) throw new Error(json.error ?? `Error ${respuesta.status}`);
  return json.data as T;
}

export const obtenerEnvios = () => llamar<EstadoDeEnvios>("configuracion");
export const guardarEnvios = (cambios: { zipnova?: ConfiguracionDeZipnova; medidas?: Array<MedidaDeCategoria & { borrar?: boolean }> }) =>
  llamar<EstadoDeEnvios>("configuracion", { method: "PUT", body: cambios });
export const traerCuentasDeZipnova = () => llamar<CuentasDeZipnova>("cuentas");
export const activarAvisosDeZipnova = () => llamar<{ activados: boolean }>("avisos", { method: "POST", body: {} });
export const listarParaDespachar = () => llamar<PedidoParaDespachar[]>("pendientes");
export const crearEnvio = (orderId: number) =>
  llamar<{ zipnova_envio_id: number; estado: string; seguimiento: string | null }>("crear", { method: "POST", body: { order_id: orderId } });

/** Abre la etiqueta (o la guía) en PDF en otra pestaña. */
export async function abrirEtiqueta(orderId: number, que: "label" | "document" = "label"): Promise<void> {
  const ventana = window.open("", "_blank");
  const respuesta = await fetch(`/api/envios?recurso=etiqueta&order_id=${orderId}&que=${que}`, { headers: await cabeceras() });
  if (!respuesta.ok) {
    ventana?.close();
    const json = (await respuesta.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error ?? `Error ${respuesta.status}`);
  }
  const url = URL.createObjectURL(await respuesta.blob());
  if (ventana) ventana.location.href = url;
  else window.location.href = url;
}
