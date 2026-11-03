import { supabase } from "@/lib/supabase";
import type { ContenidoLegal, DatosLegales } from "@/lib/tienda/legal";

export interface Arrepentimiento {
  id: number;
  codigo: string;
  order_id: number | null;
  numero_pedido: string | null;
  email: string;
  nombre: string | null;
  motivo: string | null;
  estado: "recibido" | "en_proceso" | "cerrado" | "rechazado";
  nota_interna: string | null;
  respondido_en: string | null;
  creado_en: string;
}

async function cabeceras(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return { "Content-Type": "application/json", ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) };
}

async function llamar<T>(recurso: string, init: { method?: "GET" | "PATCH"; body?: unknown } = {}): Promise<T> {
  const respuesta = await fetch(`/api/legal?recurso=${encodeURIComponent(recurso)}`, {
    method: init.method ?? "GET",
    headers: await cabeceras(),
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const json = (await respuesta.json().catch(() => ({}))) as { ok?: boolean; data?: T; error?: string };
  if (!respuesta.ok || json.ok === false) throw new Error(json.error ?? `Error ${respuesta.status}`);
  return json.data as T;
}

export const listarArrepentimientos = () => llamar<Arrepentimiento[]>("lista");
export const responderArrepentimiento = (id: number, estado: Arrepentimiento["estado"], nota_interna: string) =>
  llamar<Arrepentimiento>("responder", { method: "PATCH", body: { id, estado, nota_interna } });
export const leerTextosLegales = () => llamar<Partial<ContenidoLegal>>("textos");
export const guardarTextosLegales = (cambios: { datos_legales?: Partial<DatosLegales>; texto_terminos?: string | null; texto_privacidad?: string | null; texto_garantias?: string | null }) =>
  llamar<Partial<ContenidoLegal>>("textos", { method: "PATCH", body: cambios });
