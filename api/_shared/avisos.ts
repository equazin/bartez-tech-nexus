import { createMailerTransport, getDefaultFromEmail, registroDelEnvio, sanitizeHeaderText } from "./mailer.js";
import { pagoAcreditadoHTML, pedidoCanceladoHTML, pedidoEntregadoHTML, pedidoEnviadoHTML, seguimientoCargadoHTML } from "./plantillas.js";
import { getSupabaseAdmin } from "./supabaseServer.js";
import { nombreDelMedio } from "./medios.js";

/**
 * Avisos al comprador de la tienda por cada paso del pedido. Cada aviso se anota en
 * avisos_al_comprador antes de salir: el mismo aviso no se manda dos veces, salvo que el panel
 * pida reenviarlo. Nunca tira: devuelve si el mail salió y, si no, por qué.
 */

export type TipoDeAviso = "pago_acreditado" | "seguimiento" | "enviado" | "entregado" | "cancelado";

/** Lo que pasó con un aviso. El panel lo muestra cuando el aviso se pidió a mano. */
export type ResultadoDelAviso = { enviado: true } | { enviado: false; motivo: string };

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
  seguimiento: "Seguimiento de tu compra {numero}",
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

/** Los transportes que se cargan a mano en el panel (orders.shipping_provider) que tienen un nombre para mostrar. */
const NOMBRE_DEL_TRANSPORTE: Record<string, string> = { andreani: "Andreani", oca: "OCA" };

/**
 * El transporte que ve el comprador. Con Zipnova (o sin nada cargado), el nombre está en shipping_transport,
 * que al comprar guarda el de la cotización. Si el envío se cargó a mano en el panel vale ese: "otro" y
 * "propio" no nombran a nadie, y el de la cotización ya no corresponde.
 */
function transporteDe(pedido: PedidoParaAvisar): string | null {
  const cargado = pedido.shipping_provider?.trim().toLowerCase();
  if (!cargado || cargado === "zipnova") return pedido.shipping_transport ?? null;
  return NOMBRE_DEL_TRANSPORTE[cargado] ?? null;
}

const sucursalDe = (pedido: PedidoParaAvisar): string | null => (pedido.envio_detalle?.opcion === "sucursal" ? (pedido.envio_detalle.sucursal ?? null) : null);

export async function avisarAlComprador(
  orderId: number,
  tipo: TipoDeAviso,
  extra: { motivo?: string | null; /** Pedido a mano desde el panel: sale aunque ya se haya mandado. */ reenviar?: boolean } = {},
): Promise<ResultadoDelAviso> {
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from("orders")
      .select("id, order_number, status, origen, total, comprador_email, comprador_nombre, token_acceso, tracking_number, shipping_provider, envio_demora_dias_min, envio_demora_dias_max, pagado_en, shipping_transport, envio_seguimiento_url, envio_detalle, payment_method, shipping_address")
      .eq("id", orderId)
      .maybeSingle();
    const pedido = data as PedidoParaAvisar | null;
    if (!pedido || pedido.origen !== "tienda") return { enviado: false, motivo: "No es una compra de la tienda." };
    if (!pedido.comprador_email) return { enviado: false, motivo: "La compra no tiene el email del comprador." };
    const seguimiento = pedido.tracking_number?.trim() ?? "";
    if (tipo === "seguimiento" && !seguimiento) return { enviado: false, motivo: "Falta el número de seguimiento." };

    // Reenvío pedido desde el panel: se saca la anotación anterior para que el mismo aviso pueda salir otra vez.
    if (extra.reenviar) await supabase.from("avisos_al_comprador").delete().eq("order_id", pedido.id).eq("tipo", tipo);
    const { error: errorAnotacion } = await supabase.from("avisos_al_comprador").insert({ order_id: pedido.id, tipo, email: pedido.comprador_email });
    // Ya se mandó (índice único) o no se pudo anotar: no se manda.
    if (errorAnotacion) return { enviado: false, motivo: "Ese aviso ya se había mandado." };

    const base = sitioPublico();
    const enlace = `${base}/compra/${pedido.id}?t=${pedido.token_acceso ?? ""}`;
    const nombre = pedido.comprador_nombre ?? "";
    const demora = textoDeDemora(pedido.envio_demora_dias_min, pedido.envio_demora_dias_max);
    let html: string;
    switch (tipo) {
      case "pago_acreditado":
        html = pagoAcreditadoHTML({ numero: pedido.order_number, nombre, total: Number(pedido.total), demora, enlace });
        break;
      case "seguimiento":
        html = seguimientoCargadoHTML({
          numero: pedido.order_number,
          nombre,
          transporte: transporteDe(pedido),
          seguimiento,
          enlace,
          enlaceSeguimiento: pedido.envio_seguimiento_url,
          sucursal: sucursalDe(pedido),
        });
        break;
      case "enviado":
        html = pedidoEnviadoHTML({
          numero: pedido.order_number,
          nombre,
          transporte: transporteDe(pedido),
          seguimiento: pedido.tracking_number,
          demora,
          enlace,
          enlaceSeguimiento: pedido.envio_seguimiento_url,
          sucursal: sucursalDe(pedido),
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
    // El aviso al admin es para preparar la compra: en un reenvío al comprador no hace falta.
    if (tipo === "pago_acreditado" && !extra.reenviar) await avisarAlAdmin(pedido, base);
    return { enviado: true };
  } catch (e: unknown) {
    console.error("[avisos]", tipo, orderId, e instanceof Error ? e.message : e);
    return { enviado: false, motivo: "No se pudo mandar el mail. Probá de nuevo en un rato." };
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
