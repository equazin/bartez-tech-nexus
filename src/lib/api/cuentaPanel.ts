import { supabase } from "@/lib/supabase";

/** Panel: facturas de las compras de la tienda y el cupón para la próxima compra. */

export interface CompraParaFacturar {
  id: number;
  order_number: string;
  status: string;
  total: number;
  comprador_nombre: string | null;
  comprador_email: string | null;
  comprador_documento: string | null;
  pagado_en: string | null;
  created_at: string;
  factura: boolean;
  factura_subida_en: string | null;
}

export interface ConfiguracionDelCupon {
  activo: boolean;
  tipo: "percentage" | "fixed";
  valor: number;
  minimo: number;
  tope: number | null;
  dias: number;
  categorias: number[];
  solo_primera: boolean;
}

export interface EstadoDelCupon {
  cupon: ConfiguracionDelCupon | null;
  categorias: Array<{ id: number; name: string; parent_id: number | null }>;
  resumen: { emitidos: number; activados: number; usados: number };
}

export const PDF_MAXIMO_BYTES = 3 * 1024 * 1024;

async function cabeceras(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

async function llamar<T>(recurso: string, init: { method?: "GET" | "POST" | "PUT"; body?: unknown } = {}): Promise<T> {
  const respuesta = await fetch(`/api/cuenta?recurso=${encodeURIComponent(recurso)}`, {
    method: init.method ?? "GET",
    headers: { "Content-Type": "application/json", ...(await cabeceras()) },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const json = (await respuesta.json().catch(() => ({}))) as { ok?: boolean; data?: T; error?: string };
  if (!respuesta.ok || json.ok === false) throw new Error(json.error ?? `Error ${respuesta.status}`);
  return json.data as T;
}

function leerComoBase64(archivo: File): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => {
      const texto = String(lector.result ?? "");
      resolver(texto.slice(texto.indexOf(",") + 1));
    };
    lector.onerror = () => rechazar(new Error("No se pudo leer el archivo."));
    lector.readAsDataURL(archivo);
  });
}

export const listarComprasParaFacturar = () => llamar<CompraParaFacturar[]>("facturas");

export async function subirFactura(orderId: number, archivo: File): Promise<{ email_enviado: boolean; subida_en: string }> {
  if (archivo.type && archivo.type !== "application/pdf") throw new Error("La factura tiene que ser un PDF.");
  if (archivo.size > PDF_MAXIMO_BYTES) throw new Error("El PDF tiene que pesar hasta 3 MB.");
  const pdf = await leerComoBase64(archivo);
  return llamar<{ email_enviado: boolean; subida_en: string }>("subir-factura", { method: "POST", body: { order_id: orderId, pdf } });
}

export const leerCuponDeCompra = () => llamar<EstadoDelCupon>("cupon");
export const guardarCuponDeCompra = (cupon: ConfiguracionDelCupon) => llamar<EstadoDelCupon>("cupon", { method: "PUT", body: cupon });

/** El PDF de la factura, con el enlace firmado del servidor (el mismo que usa el cliente). */
export async function abrirFacturaDelPanel(orderId: number): Promise<void> {
  const { data, error } = await supabase.from("orders").select("token_acceso").eq("id", orderId).maybeSingle();
  const token = (data as { token_acceso: string | null } | null)?.token_acceso;
  if (error || !token) throw new Error("No se pudo abrir la factura.");
  window.open(`/api/cuenta?recurso=factura&id=${orderId}&t=${encodeURIComponent(token)}`, "_blank", "noopener");
}
