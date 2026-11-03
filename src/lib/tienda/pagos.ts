import type { MedioDisponible } from "./pedidos";

async function pedir<T>(recurso: string, init: RequestInit = {}): Promise<T> {
  const respuesta = await fetch(`/api/pagos?recurso=${recurso}`, { headers: { "Content-Type": "application/json" }, ...init });
  const json = (await respuesta.json().catch(() => ({}))) as { ok?: boolean; data?: T; error?: string };
  if (!respuesta.ok || json.data === undefined) throw new Error(json.error ?? `Error ${respuesta.status}`);
  return json.data;
}

/** Los medios activos según el panel; sin Mercado Pago configurado, no aparece. */
export function listarMedios(): Promise<MedioDisponible[]> {
  return pedir<MedioDisponible[]>("medios");
}

/** El enlace de pago de Mercado Pago para una compra pendiente. */
export async function crearPreferencia(id: number, token: string): Promise<string> {
  const { url } = await pedir<{ url: string }>("preferencia", { method: "POST", body: JSON.stringify({ id, token }) });
  return url;
}

export interface DatosDeTransferencia {
  numero: string;
  total: number;
  estado: string;
  cuenta: { titular: string | null; cuit: string | null; banco: string | null; cbu: string | null; alias: string | null };
  vence_en: string | null;
}

export function datosDeTransferencia(id: number, token: string): Promise<DatosDeTransferencia> {
  return pedir<DatosDeTransferencia>(`transferencia&id=${id}&token=${encodeURIComponent(token)}`);
}
