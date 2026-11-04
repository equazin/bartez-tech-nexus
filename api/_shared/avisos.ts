import { createMailerTransport, getDefaultFromEmail, registroDelEnvio, sanitizeHeaderText } from "./mailer.js";
import { pagoAcreditadoHTML, pedidoCanceladoHTML, pedidoEntregadoHTML, pedidoEnviadoHTML } from "./plantillas.js";
import { getSupabaseAdmin } from "./supabaseServer.js";
import { nombreDelMedio } from "./medios.js";

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
  shipping_transport: string | null;
  envio_seguimiento_url: string | null;
  envio_detalle: { opcion?: string; sucursal?: string | null } | null;
  payment_method: string | null;
  shipping_address: string | null;
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
      .select("id, order_number, status, origen, total, comprador_email, comprador_nombre, token_acceso, tracking_number, shipping_provider, envio_demora_dias_min, envio_demora_dias_max, pagado_en, shipping_transport, envio_seguimiento_url, envio_detalle, payment_method, shipping_address")
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
        html = pedidoEnviadoHTML({
          numero: pedido.order_number,
          nombre,
          // Con Zipnova, shipping_provider dice "zipnova": al cliente le sirve el nombre del transporte.
          transporte: pedido.shipping_transport ?? (pedido.shipping_provider === "zipnova" ? null : pedido.shipping_provider),
          seguimiento: pedido.tracking_number,
          demora,
          enlace,
          enlaceSeguimiento: pedido.envio_seguimiento_url,
          sucursal: pedido.envio_detalle?.opcion === "sucursal" ? (pedido.envio_detalle.sucursal ?? null) : null,
        });
        break;
      case "entregado": {
        // El cupón para la próxima compra lo emite cambiarEstadoDeLaTienda antes de este aviso (si está activo).
        const { data: cupon } = await supabase
          .from("coupons")
          .select("code, discount_type, discount_value, min_purchase, max_discount, expires_at")
          .eq("origen_order_id", pedido.id)
          .maybeSingle();
        const c = cupon as {
          code: string;
          discount_type: "percentage" | "fixed";
          discount_value: number;
          min_purchase: number | null;
          max_discount: number | null;
          expires_at: string | null;
        } | null;
        // Los puntos los acredita la base al pasar a entregado, antes de este aviso.
        const { data: movimientos } = await supabase
          .from("puntos_movimientos")
          .select("puntos, disponible_desde")
          .eq("order_id", pedido.id)
          .in("tipo", ["compra", "bono"]);
        const listaDePuntos = (movimientos ?? []) as Array<{ puntos: number; disponible_desde: string }>;
        const sumados = listaDePuntos.reduce((suma, m) => suma + Number(m.puntos), 0);
        html = pedidoEntregadoHTML({
          numero: pedido.order_number,
          nombre,
          enlace,
          enlaceArrepentimiento: `${base}/arrepentimiento?compra=${encodeURIComponent(pedido.order_number)}`,
          cupon: c
            ? {
                codigo: c.code,
                tipo: c.discount_type,
                valor: Number(c.discount_value),
                minimo: c.min_purchase === null ? null : Number(c.min_purchase),
                tope: c.max_discount === null ? null : Number(c.max_discount),
                venceEn: c.expires_at,
              }
            : null,
          email: pedido.comprador_email ?? undefined,
          enlaceCuenta: `${base}/cuenta?cupon=${c ? encodeURIComponent(c.code) : ""}`,
          puntos: sumados > 0 ? { cantidad: sumados, desde: listaDePuntos[0]?.disponible_desde ?? null, enlace: `${base}/cuenta?seccion=puntos` } : null,
        });
        break;
      }
      case "cancelado":
        html = pedidoCanceladoHTML({ numero: pedido.order_number, nombre, motivo: extra.motivo ?? null, pagado: Boolean(pedido.pagado_en), enlace });
        break;
    }
    try {
      const transporte = createMailerTransport();
      const enviado = await transporte.sendMail({
        from: `"Teqo" <${getDefaultFromEmail()}>`,
        to: pedido.comprador_email,
        subject: sanitizeHeaderText(ASUNTOS[tipo].replace("{numero}", pedido.order_number), "Novedades de tu compra"),
        html,
      });
      console.info("[avisos]", tipo, pedido.order_number, registroDelEnvio(enviado));
    } catch (e: unknown) {
      // No salió: se borra la anotación para que el mismo aviso se pueda volver a mandar.
      await supabase.from("avisos_al_comprador").delete().eq("order_id", pedido.id).eq("tipo", tipo);
      throw e;
    }
    if (tipo === "pago_acreditado") await avisarAlAdmin(pedido, base);
  } catch (e: unknown) {
    console.error("[avisos]", tipo, orderId, e instanceof Error ? e.message : e);
  }
}


/** Al admin, cuando se acredita el pago de una compra de la tienda: hay que prepararla. Nunca tira. */
async function avisarAlAdmin(pedido: PedidoParaAvisar, base: string): Promise<void> {
  try {
    const pesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(Number(pedido.total));
    const medio = nombreDelMedio(pedido.payment_method);
    await createMailerTransport().sendMail({
      from: `"Teqo" <${getDefaultFromEmail()}>`,
      to: process.env.ADMIN_EMAIL?.trim() || getDefaultFromEmail(),
      subject: sanitizeHeaderText(`Pago acreditado: ${pedido.order_number} por ${pesos}`, "Pago acreditado"),
      text: [
        `Se acreditó el pago de la compra ${pedido.order_number}: ${pesos} con ${medio}.`,
        "",
        `Comprador: ${pedido.comprador_nombre ?? "sin nombre"} (${pedido.comprador_email ?? "sin email"})`,
        `Envío: ${pedido.shipping_address ?? "sin dirección"}`,
        "",
        `La ves en el panel, en Pedidos: ${base}/admin`,
        "Ahí están el proveedor, los costos y la ganancia de la compra.",
      ].join("\n"),
    });
  } catch (e: unknown) {
    console.error("[avisos] admin", pedido.id, e instanceof Error ? e.message : e);
  }
}
