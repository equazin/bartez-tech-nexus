import { supabase } from "@/lib/supabase";
import type { MailAlComprador } from "./mailsDelPanel";

export interface PedidoDeLaTienda {
  id: number;
  order_number: string;
  status: string;
  payment_method: string | null;
  total: number;
  comprador_nombre: string | null;
  comprador_email: string | null;
  created_at: string;
  pagado_en: string | null;
  notes: string | null;
  comprador_telefono?: string | null;
  comprador_documento?: string | null;
  direccion_envio?: Record<string, string | null> | null;
}

/** Una línea que despacha un mayorista directo (New Bytes): se le pide a mano en su sitio. */
export interface LineaDeDespachoDirecto {
  order_id: number;
  nombre: string;
  sku: string | null;
  cantidad: number;
  proveedor: string;
  id_del_mayorista: string | null;
}

export interface PagoDelPanel {
  id: number;
  order_id: number;
  proveedor: "mercadopago" | "transferencia" | "mobbex" | "openpay";
  estado: string;
  monto: number;
  id_externo: string | null;
  cuotas: number | null;
  nota: string | null;
  reintegrado_monto: number;
  aprobado_en: string | null;
  creado_en: string;
}

export interface ConfiguracionDePagos {
  transferencia: { titular?: string | null; cuit?: string | null; banco?: string | null; cbu?: string | null; alias?: string | null };
  pendiente_vence_horas: number | null;
  /** El plazo propio de Mercado Pago. Nulo: vale el general. */
  pendiente_vence_horas_mercadopago: number | null;
  medios: Array<{ id: "mercadopago" | "mercadopago_cuotas" | "transferencia" | "mobbex" | "openpay"; nombre: string; detalle: string; activo: boolean; orden: number; margen_porcentaje: number | string }>;
  mercadopago_configurado: boolean;
  webhook_configurado: boolean;
  /** Credenciales de Mobbex y de Openpay cargadas en el hosting. */
  mobbex_configurado?: boolean;
  openpay_configurado?: boolean;
}

/** Cómo se nombra cada medio de pago en el panel. */
export const NOMBRE_DEL_MEDIO: Record<string, string> = {
  mercadopago: "Mercado Pago",
  mercadopago_cuotas: "Mercado Pago en 3 cuotas",
  transferencia: "Transferencia",
  mobbex: "Mobbex",
  openpay: "Openpay",
};

async function cabeceras(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return { "Content-Type": "application/json", ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) };
}

export async function llamarPagos<T>(
  recurso: string,
  init: { method?: "GET" | "POST" | "PATCH"; body?: unknown; consulta?: Record<string, string | number> } = {},
): Promise<T> {
  const consulta = new URLSearchParams({ recurso });
  for (const [clave, valor] of Object.entries(init.consulta ?? {})) consulta.set(clave, String(valor));
  const respuesta = await fetch(`/api/pagos?${consulta.toString()}`, {
    method: init.method ?? "GET",
    headers: await cabeceras(),
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const json = (await respuesta.json().catch(() => ({}))) as { ok?: boolean; data?: T; error?: string };
  if (!respuesta.ok || json.ok === false) throw new Error(json.error ?? `Error ${respuesta.status}`);
  return json.data as T;
}

export const listarPagos = () => llamarPagos<{ pedidos: PedidoDeLaTienda[]; pagos: PagoDelPanel[]; despachos?: LineaDeDespachoDirecto[] }>("lista");
/** `mail`: el aviso al comprador que quedó saliendo después de responder (ver seguirMail). */
export const validarTransferencia = (orderId: number) =>
  llamarPagos<{ resultado: string; mail?: MailAlComprador }>("validar", { method: "POST", body: { order_id: orderId } });
export const cancelarPedido = (orderId: number, motivo: string) =>
  llamarPagos<{ resultado: string; mail?: MailAlComprador }>("cancelar", { method: "POST", body: { order_id: orderId, motivo } });
export const reintegrarPago = (pagoId: number, monto: number | null, motivo: string) =>
  llamarPagos<{ resultado: string; monto: number; mail?: MailAlComprador }>("reintegrar", {
    method: "POST",
    body: { pago_id: pagoId, monto, motivo },
  });
export const leerConfiguracionDePagos = () => llamarPagos<ConfiguracionDePagos>("configuracion");
export const guardarConfiguracionDePagos = (cambios: {
  transferencia?: ConfiguracionDePagos["transferencia"];
  medios?: Record<string, boolean>;
  margenes?: Record<string, number>;
  pendiente_vence_horas?: number | null;
  pendiente_vence_horas_mercadopago?: number | null;
}) =>
  llamarPagos<ConfiguracionDePagos>("configuracion", { method: "PATCH", body: cambios });
export const vencerPendientes = () => llamarPagos<{ vencidos: number; aviso?: string }>("vencer", { method: "POST" });
