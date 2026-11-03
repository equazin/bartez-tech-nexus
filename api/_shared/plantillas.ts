/**
 * Emails al comprador de la tienda. En español rioplatense, con voseo, sin signos
 * de exclamación en los títulos y sin emojis. Los montos llegan ya formateados.
 */

const formatoPesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

export const pesos = (valor: number): string => formatoPesos.format(Math.round(valor));

function escapar(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
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
  const medio = params.medioPago === "mercadopago" ? "Mercado Pago" : params.medioPago === "transferencia" ? "transferencia bancaria" : params.medioPago;
  const cuerpo = `
    <p style="margin:0 0 12px;font-size:16px;line-height:24px;">Hola ${escapar(params.nombre)}, recibimos tu compra <strong>${escapar(params.numero)}</strong>. Queda pendiente de pago por ${escapar(medio)}.</p>
    ${tablaDeLineas(params.lineas)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
      <tr><td style="padding:4px 0;color:#676B73;">Subtotal</td><td align="right" style="padding:4px 0;">${pesos(params.subtotal)}</td></tr>
      <tr><td style="padding:4px 0;color:#676B73;">Envío</td><td align="right" style="padding:4px 0;">${params.envio > 0 ? pesos(params.envio) : "Sin cargo"}</td></tr>
      ${params.descuento > 0 ? `<tr><td style="padding:4px 0;color:#676B73;">Descuento</td><td align="right" style="padding:4px 0;">- ${pesos(params.descuento)}</td></tr>` : ""}
      <tr><td style="padding:8px 0;font-weight:bold;font-size:16px;">Total</td><td align="right" style="padding:8px 0;font-weight:bold;font-size:16px;">${pesos(params.total)}</td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:14px;line-height:22px;color:#676B73;">Todos los precios son finales, con IVA incluido.</p>
    <p style="margin:24px 0 0;">
      <a href="${escapar(params.enlace)}" style="display:inline-block;background:#E80B2A;color:#FFFFFF;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:12px;">Ver mi compra</a>
    </p>
    <p style="margin:16px 0 0;font-size:14px;line-height:22px;color:#676B73;">Con ese enlace vas a poder ver el estado del pedido y pagarlo. Si tenés dudas, respondé este email.</p>`;
  return base("Recibimos tu compra", cuerpo);
}
