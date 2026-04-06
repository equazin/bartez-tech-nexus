interface OrderProduct {
  product_id: number;
  name: string;
  sku?: string;
  quantity: number;
  unit_price?: number;
  total_price?: number;
}

function productRows(products: OrderProduct[]): string {
  return products
    .map(
      (p) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">${p.name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#666;">${p.sku ?? ""}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;">${p.quantity}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;">
          ${p.total_price != null ? `$${p.total_price.toFixed(2)}` : "—"}
        </td>
      </tr>`
    )
    .join("");
}

export function orderConfirmationHTML(params: {
  orderNumber: string;
  clientName: string;
  products: OrderProduct[];
  total: number;
}): string {
  const { orderNumber, clientName, products, total } = params;
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <!-- Header -->
        <tr>
          <td style="background:#111;padding:24px 32px;">
            <h1 style="margin:0;color:#2D9F6A;font-size:22px;letter-spacing:-0.5px;">Pedido Confirmado</h1>
            <p style="margin:4px 0 0;color:#888;font-size:13px;">${orderNumber}</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:28px 32px;">
            <p style="margin:0 0 16px;color:#333;font-size:15px;">Hola <strong>${clientName}</strong>,</p>
            <p style="margin:0 0 24px;color:#555;font-size:14px;line-height:1.6;">
              Tu pedido fue recibido correctamente. Nuestro equipo lo revisará y te contactará a la brevedad.
            </p>
            <!-- Products table -->
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:6px;overflow:hidden;margin-bottom:24px;">
              <thead>
                <tr style="background:#f8f8f8;">
                  <th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;font-weight:600;">Producto</th>
                  <th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;font-weight:600;">SKU</th>
                  <th style="padding:10px 12px;text-align:center;font-size:12px;color:#666;font-weight:600;">Cant.</th>
                  <th style="padding:10px 12px;text-align:right;font-size:12px;color:#666;font-weight:600;">Total</th>
                </tr>
              </thead>
              <tbody>${productRows(products)}</tbody>
            </table>
            <!-- Total -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:12px 16px;background:#f0fdf4;border-radius:6px;border-left:3px solid #2D9F6A;">
                  <span style="font-size:14px;color:#555;">Total del pedido</span>
                  <span style="float:right;font-size:18px;font-weight:700;color:#111;">$${total.toFixed(2)}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #f0f0f0;background:#fafafa;">
            <p style="margin:0;font-size:12px;color:#aaa;text-align:center;">
              Este es un mensaje automático. Por consultas, responde este email.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function newOrderAlertHTML(params: {
  orderNumber: string;
  clientName: string;
  clientId: string;
  products: OrderProduct[];
  total: number;
}): string {
  const { orderNumber, clientName, clientId, products, total } = params;
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <tr>
          <td style="background:#111;padding:24px 32px;">
            <h1 style="margin:0;color:#f59e0b;font-size:20px;">Nuevo pedido recibido</h1>
            <p style="margin:4px 0 0;color:#888;font-size:13px;">${orderNumber} — $${total.toFixed(2)}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
              <tr>
                <td style="font-size:13px;color:#666;padding:4px 0;">Cliente</td>
                <td style="font-size:13px;font-weight:600;color:#111;text-align:right;">${clientName}</td>
              </tr>
              <tr>
                <td style="font-size:13px;color:#666;padding:4px 0;">ID</td>
                <td style="font-size:12px;color:#888;text-align:right;font-family:monospace;">${clientId}</td>
              </tr>
              <tr>
                <td style="font-size:13px;color:#666;padding:4px 0;">Productos</td>
                <td style="font-size:13px;font-weight:600;color:#111;text-align:right;">${products.length} línea${products.length !== 1 ? "s" : ""}</td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:6px;overflow:hidden;">
              <thead>
                <tr style="background:#f8f8f8;">
                  <th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;">Producto</th>
                  <th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;">SKU</th>
                  <th style="padding:10px 12px;text-align:center;font-size:12px;color:#666;">Cant.</th>
                  <th style="padding:10px 12px;text-align:right;font-size:12px;color:#666;">Total</th>
                </tr>
              </thead>
              <tbody>${productRows(products)}</tbody>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #f0f0f0;background:#fafafa;">
            <p style="margin:0;font-size:12px;color:#aaa;text-align:center;">
              Accedé al <a href="https://bartez-tech-nexus.vercel.app/admin" style="color:#2D9F6A;">panel de administración</a> para gestionar este pedido.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function orderShippedHTML(params: {
  orderNumber: string;
  clientName: string;
  shippingProvider?: string;
  trackingNumber?: string;
}): string {
  const { orderNumber, clientName, shippingProvider, trackingNumber } = params;
  
  let trackingSection = "";
  if (shippingProvider && trackingNumber) {
    let trackingUrl = "#";
    if (shippingProvider.toLowerCase().includes("andreani")) {
      trackingUrl = `https://www.andreani.com/#!/informacionEnvio/${trackingNumber}`;
    } else if (shippingProvider.toLowerCase().includes("oca")) {
      trackingUrl = `https://www.oca.com.ar/Busquedas/Envios?numero=${trackingNumber}`;
    }

    trackingSection = `
      <div style="background:#f0faf5;border:1px solid #2D9F6A33;border-radius:8px;padding:20px;margin:24px 0;text-align:center;">
        <p style="margin:0 0 8px;font-size:12px;color:#666;text-transform:uppercase;letter-spacing:1px;font-weight:bold;">Seguimiento del Envío</p>
        <p style="margin:0 0 16px;font-size:18px;color:#111;font-weight:700;">${shippingProvider}: ${trackingNumber}</p>
        <a href="${trackingUrl}" style="display:inline-block;background:#2D9F6A;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:14px;">Rastrear mi Pedido</a>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <tr>
          <td style="background:#2D9F6A;padding:32px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:24px;">¡Tu pedido está en camino!</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">${orderNumber}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px;color:#333;font-size:16px;">Hola <strong>${clientName}</strong>,</p>
            <p style="margin:0 0 24px;color:#555;font-size:14px;line-height:1.6;">
              Grandes noticias: tu pedido ya fue despachado. Pronto lo tendrás en tus manos.
            </p>
            ${trackingSection}
            <p style="margin:24px 0 0;color:#888;font-size:13px;text-align:center;">
              Podés ver más detalles en el <a href="https://bartez-tech-nexus.vercel.app/portal" style="color:#2D9F6A;">Portal B2B</a>.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function quoteStatusHTML(params: {
  quoteId: number;
  clientName: string;
  total: number;
  currency: string;
  status: "approved" | "rejected";
}): string {
  const { quoteId, clientName, total, currency, status } = params;
  const isApproved = status === "approved";
  const headerBg = isApproved ? "#2D9F6A" : "#dc2626";
  const headerText = isApproved ? "Cotización Aprobada" : "Cotización Rechazada";
  const bodyText = isApproved
    ? "Tu cotización fue revisada y aprobada por nuestro equipo. Podés convertirla en un pedido desde el Portal B2B."
    : "Tu cotización fue revisada y no pudo ser aprobada en esta oportunidad. Podés generar una nueva desde el Portal B2B o contactarnos para más información.";
  const ctaText = isApproved ? "Ver cotización aprobada" : "Generar nueva cotización";
  const fmt = new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 0 }).format(total);

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <tr>
          <td style="background:${headerBg};padding:28px 32px;">
            <h1 style="margin:0;color:#fff;font-size:22px;">${headerText}</h1>
            <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Cotización #${quoteId} — ${fmt}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px;">
            <p style="margin:0 0 16px;color:#333;font-size:15px;">Hola <strong>${clientName}</strong>,</p>
            <p style="margin:0 0 24px;color:#555;font-size:14px;line-height:1.6;">${bodyText}</p>
            <div style="text-align:center;margin:28px 0;">
              <a href="https://bartez-tech-nexus.vercel.app/b2b-portal" style="display:inline-block;background:${headerBg};color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:14px;">${ctaText}</a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #f0f0f0;background:#fafafa;">
            <p style="margin:0;font-size:12px;color:#aaa;text-align:center;">
              Este es un mensaje automático. Por consultas, respondé este email.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function orderDeliveredHTML(params: {
  orderNumber: string;
  clientName: string;
}): string {
  const { orderNumber, clientName } = params;
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function orderPreparingHTML(params: {
  orderNumber: string;
  clientName: string;
}): string {
  const { orderNumber, clientName } = params;
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <tr>
          <td style="background:#f59e0b;padding:32px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:24px;">Tu pedido está en preparación 📦</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">${orderNumber}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px;color:#333;font-size:16px;">Hola <strong>${clientName}</strong>,</p>
            <p style="margin:0 0 24px;color:#555;font-size:14px;line-height:1.6;">
              ¡Buenas noticias! Nuestro equipo de depósito ya ha comenzado a preparar tu pedido. Te notificaremos nuevamente en cuanto sea despachado.
            </p>
            <p style="margin:24px 0 0;color:#888;font-size:13px;text-align:center;">
              Podés hacer el seguimiento de este pedido en el <a href="https://bartez-tech-nexus.vercel.app/portal" style="color:#f59e0b;">Portal B2B</a>.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function orderRejectedHTML(params: {
  orderNumber: string;
  clientName: string;
}): string {
  const { orderNumber, clientName } = params;
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <tr>
          <td style="background:#dc2626;padding:32px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:24px;">Actualización de tu pedido</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">${orderNumber}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px;color:#333;font-size:16px;">Hola <strong>${clientName}</strong>,</p>
            <p style="margin:0 0 24px;color:#555;font-size:14px;line-height:1.6;">
              Lamentablemente, tuvimos que rechazar tu pedido en esta ocasión. Puede deberse a falta de stock de último momento, inconvenientes en pagos o políticas de cuenta.
            </p>
            <p style="margin:0 0 16px;color:#555;font-size:14px;">
              Si tenés preguntas sobre por qué se rechazó tu solicitud, comunicate con tu ejecutivo de cuentas o con nuestro soporte respondiendo a este email.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function orderApprovedHTML(params: {
  orderNumber: string;
  clientName: string;
  total: number;
}): string {
  const { orderNumber, clientName, total } = params;
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <tr>
          <td style="background:#111;padding:24px 32px;">
            <h1 style="margin:0;color:#2D9F6A;font-size:22px;letter-spacing:-0.5px;">Tu pedido fue aprobado ✅</h1>
            <p style="margin:4px 0 0;color:#888;font-size:13px;">${orderNumber}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px;">
            <p style="margin:0 0 16px;color:#333;font-size:15px;">Hola <strong>${clientName}</strong>,</p>
            <p style="margin:0 0 24px;color:#555;font-size:14px;line-height:1.6;">
              Tu pedido <strong>#{${orderNumber}}</strong> fue revisado y aprobado exitosamente.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:12px 16px;background:#f0fdf4;border-radius:6px;border-left:3px solid #2D9F6A;">
                  <span style="font-size:14px;color:#555;">Total del pedido:</span>
                  <span style="float:right;font-size:18px;font-weight:700;color:#111;">$${total.toFixed(2)}</span>
                </td>
              </tr>
            </table>
            <p style="margin:24px 0 0;color:#888;font-size:13px;text-align:center;">
              Podés ver el estado y opciones en tu cuenta del <a href="https://bartez-tech-nexus.vercel.app/portal" style="color:#2D9F6A;">Portal B2B</a>.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function newPaymentHTML(params: {
  clientName: string;
  amount: number;
  currency: string;
  date: string;
  method: string;
  orderNumber?: string;
  invoiceNumber?: string;
  fileUrl?: string;
  notes?: string;
  echeqDetails?: { count: number; dates: string[] } | null;
}): string {
  const { clientName, amount, currency, date, method, orderNumber, invoiceNumber, fileUrl, notes, echeqDetails } = params;
  const isEcheq = method === "echeq";
  const fmt = new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);

  let echeqSection = "";
  if (isEcheq && echeqDetails) {
    const dateList = echeqDetails.dates.map(d => `<li style="margin-bottom:4px;">${new Date(d).toLocaleDateString("es-AR")}</li>`).join("");
    echeqSection = `
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:16px; margin:20px 0;">
        <p style="margin:0 0 8px; font-size:12px; color:#64748b; font-weight:bold; text-transform:uppercase;">Detalle de Echeqs (${echeqDetails.count})</p>
        <ul style="margin:0; padding-left:20px; font-size:14px; color:#1e293b;">
          ${dateList}
        </ul>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <tr>
          <td style="background:#111;padding:24px 32px;">
            <h1 style="margin:0;color:#2D9F6A;font-size:20px;">Nuevo Comprobante de Pago</h1>
            <p style="margin:4px 0 0;color:#888;font-size:13px;">${clientName} — ${method.toUpperCase()}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px;">
            <p style="margin:0 0 20px; color:#333; font-size:15px;">Se ha registrado un nuevo aviso de pago en el Portal B2B.</p>
            
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px; border-collapse:collapse;">
              <tr>
                <td style="padding:8px 0; border-bottom:1px solid #f1f5f9; color:#64748b; font-size:14px;">Monto Informado</td>
                <td style="padding:8px 0; border-bottom:1px solid #f1f5f9; color:#1e293b; font-size:14px; font-weight:bold; text-align:right;">${fmt}</td>
              </tr>
              <tr>
                <td style="padding:8px 0; border-bottom:1px solid #f1f5f9; color:#64748b; font-size:14px;">Fecha Declarada</td>
                <td style="padding:8px 0; border-bottom:1px solid #f1f5f9; color:#1e293b; font-size:14px; text-align:right;">${new Date(date).toLocaleDateString("es-AR")}</td>
              </tr>
              <tr>
                <td style="padding:8px 0; border-bottom:1px solid #f1f5f9; color:#64748b; font-size:14px;">Medio de Pago</td>
                <td style="padding:8px 0; border-bottom:1px solid #f1f5f9; color:#1e293b; font-size:14px; text-align:right; text-transform:capitalize;">${method}</td>
              </tr>
              ${orderNumber ? `<tr><td style="padding:8px 0; border-bottom:1px solid #f1f5f9; color:#64748b; font-size:14px;">Pedido Relacionado</td><td style="padding:8px 0; border-bottom:1px solid #f1f5f9; color:#1e293b; font-size:14px; text-align:right;">${orderNumber}</td></tr>` : ""}
              ${invoiceNumber ? `<tr><td style="padding:8px 0; border-bottom:1px solid #f1f5f9; color:#64748b; font-size:14px;">Factura Realacionada</td><td style="padding:8px 0; border-bottom:1px solid #f1f5f9; color:#1e293b; font-size:14px; text-align:right;">${invoiceNumber}</td></tr>` : ""}
            </table>

            ${echeqSection}

            ${notes ? `
            <div style="background:#fffbeb; border:1px solid #fef3c7; border-radius:8px; padding:16px; margin-bottom:20px;">
              <p style="margin:0 0 4px; font-size:11px; color:#92400e; font-weight:bold; text-transform:uppercase;">Observaciones del Cliente</p>
              <p style="margin:0; font-size:13px; color:#78350f; line-height:1.5;">${notes}</p>
            </div>
            ` : ""}

            <div style="text-align:center; margin-top:32px;">
              ${fileUrl ? `
              <a href="${fileUrl}" style="display:inline-block; background:#2D9F6A; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:bold; font-size:14px;">Ver Comprobante Adjunto</a>
              ` : `
              <p style="color:#ef4444; font-size:13px; font-weight:bold;">⚠️ El cliente no adjuntó un archivo legible.</p>
              `}
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px; border-top:1px solid #f0f0f0; background:#fafafa; text-align:center;">
             <p style="margin:0; font-size:12px; color:#aaa;">Gestioná este pago desde el panel administrativo de Bartez.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
