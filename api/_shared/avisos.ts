import { createMailerTransport, getDefaultFromEmail, sanitizeHeaderText } from "./mailer.js";
import { pagoAcreditadoHTML, pedidoCanceladoHTML, pedidoEntregadoHTML, pedidoEnviadoHTML } from "./plantillas.js";
import { getSupabaseAdmin } from "./supabaseServer.js";

/**
 * Avisos al comprador de la tienda por cada paso del pedido. Cada aviso se anota en
 * avisos_al_comprador antes de salir: el mismo aviso no se manda dos veces. Nunca tira.
 */

export type TipoDeAviso = "pago_acreditado" | "enviado" | "entregado" | "cancelado";

interface PedidoParaAvisar {
  id: number;
  order_number: string;
  status: string;
  origen: string;
  total: number;
  comprador_email: string | null;
  comprador_nombre: string | null;
  token_acceso: string | null;
  tracking_number: string | null;
  shipping_provider: string | null;
  envio_demora_dias_min: number | null;
  envio_demora_dias_max: number | null;
  pagado_en: string | null;
}

const ASUNTOS: Record<TipoDeAviso, string> = {
  pago_acreditado: "Pago acreditado de tu compra {numero}",
  enviado: "Tu compra {numero} está en camino",
  entregado: "Entregamos tu compra {numero}",
  cancelado: "Tu compra {numero} quedó cancelada",
};

export function sitioPublico(): string {
  return (process.env.VITE_SITE_URL?.trim() || process.env.API_ALLOWED_ORIGIN?.split(",")[0]?.trim() || "").replace(/\/$/, "");
}

function textoDeDemora(min: number | null, max: number | null): string | null {
  if (min === null || max === null) return null;
  if (min === max) return `Llega en ${min} ${min === 1 ? "día hábil" : "días hábiles"} desde el despacho.`;
  return `Llega en ${min} a ${max} días hábiles desde el despacho.`;
}

export async function avisarAlComprador(orderId: number, tipo: TipoDeAviso, extra: { motivo?: string | null } = {}): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from("orders")
      .select("id, order_number, status, origen, total, comprador_email, comprador_nombre, token_acceso, tracking_number, shipping_provider, envio_demora_dias_min, envio_demora_dias_max, pagado_en")
      .eq("id", orderId)
      .maybeSingle();
    const pedido = data as PedidoParaAvisar | null;
    if (!pedido || pedido.origen !== "tienda" || !pedido.comprador_email) return;

    const { error: errorAnotacion } = await supabase.from("avisos_al_comprador").insert({ order_id: pedido.id, tipo, email: pedido.comprador_email });
    if (errorAnotacion) return; // Ya se mandó (índice único) o no se pudo anotar: no se manda.

    const base = sitioPublico();
    const enlace = `${base}/compra/${pedido.id}?t=${pedido.token_acceso ?? ""}`;
    const nombre = pedido.comprador_nombre ?? "";
    const demora = textoDeDemora(pedido.envio_demora_dias_min, pedido.envio_demora_dias_max);
    let html: string;
    switch (tipo) {
      case "pago_acreditado":
        html = pagoAcreditadoHTML({ numero: pedido.order_number, nombre, total: Number(pedido.total), demora, enlace });
        break;
      case "enviado":
        html = pedidoEnviadoHTML({ numero: pedido.order_number, nombre, transporte: pedido.shipping_provider, seguimiento: pedido.tracking_number, demora, enlace });
        break;
      case "entregado":
        html = pedidoEntregadoHTML({ numero: pedido.order_number, nombre, enlace, enlaceArrepentimiento: `${base}/arrepentimiento` });
        break;
      case "cancelado":
        html = pedidoCanceladoHTML({ numero: pedido.order_number, nombre, motivo: extra.motivo ?? null, pagado: Boolean(pedido.pagado_en), enlace });
        break;
    }
    const transporte = createMailerTransport();
    await transporte.sendMail({
      from: `"Teqo" <${getDefaultFromEmail()}>`,
      to: pedido.comprador_email,
      subject: sanitizeHeaderText(ASUNTOS[tipo].replace("{numero}", pedido.order_number), "Novedades de tu compra"),
      html,
    });
  } catch (e: unknown) {
    console.error("[avisos]", tipo, orderId, e instanceof Error ? e.message : e);
  }
}
