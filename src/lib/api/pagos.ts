import { supabase } from "@/lib/supabase";

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
}

export interface PagoDelPanel {
  id: number;
  order_id: number;
  proveedor: "mercadopago" | "transferencia";
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
  medios: Array<{ id: "mercadopago" | "transferencia"; nombre: string; detalle: string; activo: boolean; orden: number }>;
  mercadopago_configurado: boolean;
  webhook_configurado: boolean;
}

async function cabeceras(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return { "Content-Type": "application/json", ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) };
}

export async function llamarPagos<T>(recurso: string, init: { method?: "GET" | "POST" | "PATCH"; body?: unknown } = {}): Promise<T> {
  const respuesta = await fetch(`/api/pagos?recurso=${encodeURIComponent(recurso)}`, {
    method: init.method ?? "GET",
    headers: await cabeceras(),
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const json = (await respuesta.json().catch(() => ({}))) as { ok?: boolean; data?: T; error?: string };
  if (!respuesta.ok || json.ok === false) throw new Error(json.error ?? `Error ${respuesta.status}`);
  return json.data as T;
}

export const listarPagos = () => llamarPagos<{ pedidos: PedidoDeLaTienda[]; pagos: PagoDelPanel[] }>("lista");
export const validarTransferencia = (orderId: number) => llamarPagos<{ resultado: string }>("validar", { method: "POST", body: { order_id: orderId } });
export const cancelarPedido = (orderId: number, motivo: string) => llamarPagos<{ resultado: string }>("cancelar", { method: "POST", body: { order_id: orderId, motivo } });
export const reintegrarPago = (pagoId: number, monto: number | null, motivo: string) =>
  llamarPagos<{ resultado: string; monto: number }>("reintegrar", { method: "POST", body: { pago_id: pagoId, monto, motivo } });
export const leerConfiguracionDePagos = () => llamarPagos<ConfiguracionDePagos>("configuracion");
export const guardarConfiguracionDePagos = (cambios: { transferencia?: ConfiguracionDePagos["transferencia"]; medios?: Record<string, boolean>; pendiente_vence_horas?: number | null }) =>
  llamarPagos<ConfiguracionDePagos>("configuracion", { method: "PATCH", body: cambios });
export const vencerPendientes = () => llamarPagos<{ vencidos: number; aviso?: string }>("vencer", { method: "POST" });
