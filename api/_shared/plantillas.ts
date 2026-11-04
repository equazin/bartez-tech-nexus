import { nombreDelMedio } from "./medios.js";

/**
 * Emails al comprador de la tienda. En español rioplatense, con voseo, sin signos
 * de exclamación en los títulos y sin emojis. Los montos llegan en pesos.
 */

const formatoPesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

export const pesos = (valor: number): string => formatoPesos.format(Math.round(valor));

function escapar(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

function boton(enlace: string, texto: string): string {
  return `<p style="margin:24px 0 0;">
      <a href="${escapar(enlace)}" style="display:inline-block;background:#E80B2A;color:#FFFFFF;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:12px;">${escapar(texto)}</a>
    </p>`;
}

function base(titulo: string, cuerpo: string): string {
  return `<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;background:#F4F4F5;font-family:Arial,Helvetica,sans-serif;color:#17191D;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F4F5;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:16px;overflow:hidden;">
        <tr><td style="background:#17191D;padding:20px 28px;">
          <span style="color:#FFFFFF;font-size:22px;font-weight:bold;letter-spacing:-0.5px;">teqo.</span>
        </td></tr>
        <tr><td style="padding:28px;">
          <h1 style="margin:0 0 16px;font-size:22px;line-height:28px;">${escapar(titulo)}</h1>
          ${cuerpo}
        </td></tr>
        <tr><td style="padding:16px 28px 24px;font-size:12px;line-height:18px;color:#676B73;border-top:1px solid #D5D7DC;">
          Teqo · Subí tu mundo. · Envío a todo el país, al mismo precio en cualquier provincia.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export interface LineaDelEmail {
  nombre: string;
  cantidad: number;
  precioFinal: number;
}

function tablaDeLineas(lineas: LineaDelEmail[]): string {
  if (lineas.length === 0) return "";
  const filas = lineas
    .map(
      (l) => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #D5D7DC;font-size:14px;">${escapar(l.nombre)}<br><span style="color:#676B73;font-size:12px;">${l.cantidad} ${l.cantidad === 1 ? "unidad" : "unidades"}</span></td>
        <td align="right" style="padding:8px 0;border-bottom:1px solid #D5D7DC;font-size:14px;white-space:nowrap;">${pesos(l.precioFinal * l.cantidad)}</td>
      </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">${filas}</table>`;
}

const parrafo = (texto: string): string => `<p style="margin:0 0 12px;font-size:16px;line-height:24px;">${texto}</p>`;
const nota = (texto: string): string => `<p style="margin:16px 0 0;font-size:14px;line-height:22px;color:#676B73;">${texto}</p>`;

export function compraRecibidaHTML(params: {
  numero: string;
  nombre: string;
  lineas: LineaDelEmail[];
  subtotal: number;
  envio: number;
  descuento: number;
  total: number;
  medioPago: string;
  enlace: string;
}): string {
  const medio = nombreDelMedio(params.medioPago);
  const cuerpo = `
    ${parrafo(`Hola ${escapar(params.nombre)}, recibimos tu compra <strong>${escapar(params.numero)}</strong>. Queda pendiente de pago por ${escapar(medio)}.`)}
    ${tablaDeLineas(params.lineas)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
      <tr><td style="padding:4px 0;color:#676B73;">Subtotal</td><td align="right" style="padding:4px 0;">${pesos(params.subtotal)}</td></tr>
      <tr><td style="padding:4px 0;color:#676B73;">Envío</td><td align="right" style="padding:4px 0;">${params.envio > 0 ? pesos(params.envio) : "Sin cargo"}</td></tr>
      ${params.descuento > 0 ? `<tr><td style="padding:4px 0;color:#676B73;">Descuento</td><td align="right" style="padding:4px 0;">- ${pesos(params.descuento)}</td></tr>` : ""}
      <tr><td style="padding:8px 0;font-weight:bold;font-size:16px;">Total</td><td align="right" style="padding:8px 0;font-weight:bold;font-size:16px;">${pesos(params.total)}</td></tr>
    </table>
    ${nota("Todos los precios son finales, con IVA incluido.")}
    ${boton(params.enlace, "Ver mi compra y pagar")}
    ${nota("Con ese enlace vas a poder ver el estado del pedido y pagarlo. Si tenés dudas, respondé este email.")}`;
  return base("Recibimos tu compra", cuerpo);
}

export function pagoAcreditadoHTML(params: { numero: string; nombre: string; total: number; demora: string | null; enlace: string }): string {
  const cuerpo = `
    ${parrafo(`Hola ${escapar(params.nombre)}, se acreditó el pago de ${pesos(params.total)} de tu compra <strong>${escapar(params.numero)}</strong>. Ya empezamos a prepararla.`)}
    ${params.demora ? parrafo(escapar(params.demora)) : ""}
    ${boton(params.enlace, "Ver mi compra")}
    ${nota("Cuando despachemos el pedido te mandamos el número de seguimiento por este mismo medio.")}`;
  return base("Pago acreditado", cuerpo);
}

export function pedidoEnviadoHTML(params: {
  numero: string;
  nombre: string;
  transporte: string | null;
  seguimiento: string | null;
  demora: string | null;
  enlace: string;
  /** Link de seguimiento del envío (Zipnova o el transporte). */
  enlaceSeguimiento?: string | null;
  /** Si retira en una sucursal del transporte: cuál. */
  sucursal?: string | null;
}): string {
  const seguimiento = params.seguimiento
    ? parrafo(`Número de seguimiento${params.transporte ? ` de ${escapar(params.transporte)}` : ""}: <strong>${escapar(params.seguimiento)}</strong>`)
    : params.transporte
      ? parrafo(`Lo lleva ${escapar(params.transporte)}.`)
      : "";
  const destino = params.sucursal
    ? `ya está en camino a la sucursal donde lo retirás: ${escapar(params.sucursal)}. Te avisan cuando esté listo para retirar.`
    : "ya salió hacia tu domicilio.";
  const cuerpo = `
    ${parrafo(`Hola ${escapar(params.nombre)}, tu compra <strong>${escapar(params.numero)}</strong> ${destino}`)}
    ${seguimiento}
    ${params.demora ? parrafo(escapar(params.demora)) : ""}
    ${params.enlaceSeguimiento ? boton(params.enlaceSeguimiento, "Seguir el envío") : ""}
    ${boton(params.enlace, "Ver mi compra")}`;
  return base("Tu pedido está en camino", cuerpo);
}

export interface CuponDelEmail {
  codigo: string;
  tipo: "percentage" | "fixed";
  valor: number;
  minimo: number | null;
  tope: number | null;
  venceEn: string | null;
}

const formatoFecha = new Intl.DateTimeFormat("es-AR", { dateStyle: "long", timeZone: "America/Argentina/Buenos_Aires" });

/** "10% de descuento en compras desde $ 100.000, hasta $ 20.000": lo mismo que muestra Mi cuenta. */
export function describirCupon(c: { tipo: string; valor: number; minimo: number | null; tope: number | null }): string {
  const descuento = c.tipo === "fixed" ? `${pesos(c.valor)} de descuento` : `${Number(c.valor)}% de descuento`;
  const desde = c.minimo && c.minimo > 0 ? ` en compras desde ${pesos(c.minimo)}` : "";
  const hasta = c.tipo !== "fixed" && c.tope && c.tope > 0 ? `, hasta ${pesos(c.tope)}` : "";
  return `${descuento}${desde}${hasta}`;
}

function bloqueDeCupon(cupon: CuponDelEmail, email: string, enlaceCuenta: string): string {
  const vence = cupon.venceEn ? ` Vence el ${formatoFecha.format(new Date(cupon.venceEn))}.` : "";
  return `<div style="margin:24px 0 0;padding:20px;border:1px dashed #17191D;border-radius:16px;">
      <p style="margin:0 0 8px;font-size:14px;line-height:20px;color:#676B73;">Para tu próxima compra</p>
      <p style="margin:0 0 8px;font-size:26px;line-height:32px;font-weight:bold;letter-spacing:2px;">${escapar(cupon.codigo)}</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:22px;">${escapar(describirCupon(cupon))}.${escapar(vence)}</p>
      <p style="margin:0;font-size:14px;line-height:21px;color:#676B73;">Para usarlo, activalo en Mi cuenta: entrás con este email (${escapar(email)}), con Google o con una contraseña. Después lo cargás al finalizar la compra, con la sesión abierta.</p>
      ${boton(enlaceCuenta, "Activar mi cupón")}
    </div>`;
}

export function pedidoEntregadoHTML(params: {
  numero: string;
  nombre: string;
  enlace: string;
  enlaceArrepentimiento: string;
  /** Cupón para la próxima compra, si está activo en el panel. */
  cupon?: CuponDelEmail | null;
  email?: string;
  enlaceCuenta?: string;
  /** Puntos Teqo que sumó la compra, si el programa está activo. */
  puntos?: { cantidad: number; desde: string | null; enlace: string } | null;
}): string {
  const puntos = params.puntos
    ? nota(
        `Sumaste <strong>${new Intl.NumberFormat("es-AR").format(params.puntos.cantidad)} puntos Teqo</strong> con esta compra.${
          params.puntos.desde ? ` Los podés usar desde el ${escapar(formatoFecha.format(new Date(params.puntos.desde)))},` : " Los ves"
        } en <a href="${escapar(params.puntos.enlace)}" style="color:#17191D;">Mi cuenta</a>.`,
      )
    : "";
  const cuerpo = `
    ${parrafo(`Hola ${escapar(params.nombre)}, tu compra <strong>${escapar(params.numero)}</strong> figura como entregada.`)}
    ${parrafo("Si algo no está bien, respondé este email y lo resolvemos.")}
    ${nota(`Podés arrepentirte de la compra dentro de los 10 días corridos desde hoy, sin dar motivos, con el <a href="${escapar(params.enlaceArrepentimiento)}" style="color:#17191D;">botón de arrepentimiento</a>.`)}
    ${boton(params.enlace, "Ver mi compra")}
    ${puntos}
    ${params.cupon && params.email && params.enlaceCuenta ? bloqueDeCupon(params.cupon, params.email, params.enlaceCuenta) : ""}`;
  return base("Entregamos tu pedido", cuerpo);
}

export function facturaDisponibleHTML(params: { numero: string; nombre: string; enlace: string; enlaceFactura: string }): string {
  const cuerpo = `
    ${parrafo(`Hola ${escapar(params.nombre)}, te mandamos la factura de tu compra <strong>${escapar(params.numero)}</strong>. Va adjunta en PDF.`)}
    ${boton(params.enlaceFactura, "Bajar la factura")}
    ${nota(`También la tenés en <a href="${escapar(params.enlace)}" style="color:#17191D;">tu compra</a> y en Mi cuenta. Si ves un dato mal, respondé este email.`)}`;
  return base("Tu factura", cuerpo);
}

export function pedidoCanceladoHTML(params: { numero: string; nombre: string; motivo: string | null; pagado: boolean; enlace: string }): string {
  const cuerpo = `
    ${parrafo(`Hola ${escapar(params.nombre)}, tu compra <strong>${escapar(params.numero)}</strong> quedó cancelada${params.motivo ? `: ${escapar(params.motivo)}` : "."}`)}
    ${params.pagado ? parrafo("Como ya estaba paga, te devolvemos el dinero por el mismo medio con el que pagaste. Te avisamos cuando esté hecho.") : ""}
    ${boton(params.enlace, "Ver mi compra")}
    ${nota("Si tenés dudas, respondé este email.")}`;
  return base("Compra cancelada", cuerpo);
}

export function arrepentimientoRecibidoHTML(params: { codigo: string; nombre: string | null; numero: string | null }): string {
  const cuerpo = `
    ${parrafo(`Hola${params.nombre ? ` ${escapar(params.nombre)}` : ""}, recibimos tu pedido de arrepentimiento${params.numero ? ` sobre la compra <strong>${escapar(params.numero)}</strong>` : ""}.`)}
    ${parrafo(`Tu código de identificación es <strong style="font-size:20px;letter-spacing:1px;">${escapar(params.codigo)}</strong>. Guardalo: con él seguimos el trámite.`)}
    ${parrafo("Dentro de las 24 horas te escribimos por este medio con los pasos para la devolución y el reintegro.")}
    ${nota("Podés arrepentirte dentro de los 10 días corridos desde que recibiste el producto. Si tenés dudas, respondé este email.")}`;
  return base("Recibimos tu arrepentimiento", cuerpo);
}
