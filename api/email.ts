import type { VercelRequest, VercelResponse } from "@vercel/node";
import { orderConfirmationHTML, newOrderAlertHTML, quoteStatusHTML, orderPreparingHTML, orderRejectedHTML, orderApprovedHTML, newPaymentHTML } from "./_shared/emailTemplates.js";
import { createMailerTransport, getDefaultFromEmail, sanitizeHeaderText } from "./_shared/mailer.js";
import { orderEmailSchema, contactRequestSchema } from "./_shared/schemas.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const scope = String(req.query.scope ?? "");

  if (scope === "contact") {
    return handleContactEmail(req, res);
  }

  const parsed = orderEmailSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid email payload",
      details: parsed.error.flatten(),
    });
  }

  const payload = parsed.data;
  const fromEmail = getDefaultFromEmail();
  const adminEmail = process.env.ADMIN_EMAIL?.trim() || fromEmail;
  const products = payload.products.map((product) => ({
    product_id: product.product_id,
    name: product.name,
    sku: product.sku,
    quantity: product.quantity,
    unit_price: product.unit_price,
    total_price: product.total_price,
  }));

  try {
    const transport = createMailerTransport();

    if (payload.type === "order_confirmed" && payload.clientEmail) {
      await transport.sendMail({
        from: `"Bartez Tecnologia" <${fromEmail}>`,
        to: payload.clientEmail,
        subject: sanitizeHeaderText(
          `Pedido ${payload.orderNumber} confirmado`,
          "Pedido confirmado"
        ),
        html: orderConfirmationHTML({
          orderNumber: payload.orderNumber ?? "",
          clientName: payload.clientName ?? "Cliente",
          products,
          total: payload.total ?? 0,
        }),
      });
    }

    if (payload.type === "order_approved" && payload.clientEmail) {
      await transport.sendMail({
        from: `"Bartez Tecnologia" <${fromEmail}>`,
        to: payload.clientEmail,
        subject: sanitizeHeaderText(
          `Tu pedido ${payload.orderNumber} fue aprobado ✅`,
          "Pedido aprobado"
        ),
        html: orderApprovedHTML({
          orderNumber: payload.orderNumber ?? "",
          clientName: payload.clientName ?? "Cliente",
          total: payload.total ?? 0,
        }),
      });
    }

    if (payload.type === "order_preparing" && payload.clientEmail) {
      await transport.sendMail({
        from: `"Bartez Tecnologia" <${fromEmail}>`,
        to: payload.clientEmail,
        subject: sanitizeHeaderText(
          `Tu pedido ${payload.orderNumber} está en preparación`,
          "Pedido en preparación"
        ),
        html: orderPreparingHTML({
          orderNumber: payload.orderNumber ?? "",
          clientName: payload.clientName ?? "Cliente",
        }),
      });
    }

    if (payload.type === "order_shipped" && payload.clientEmail) {
      const { orderShippedHTML } = await import("./_shared/emailTemplates.js");
      await transport.sendMail({
        from: `"Bartez Tecnologia" <${fromEmail}>`,
        to: payload.clientEmail,
        subject: sanitizeHeaderText(
          `Tu pedido ${payload.orderNumber} está en camino`,
          "Pedido en camino"
        ),
        html: orderShippedHTML({
          orderNumber: payload.orderNumber ?? "",
          clientName: payload.clientName ?? "Cliente",
          shippingProvider: payload.shippingProvider,
          trackingNumber: payload.trackingNumber,
        }),
      });
    }

    if (payload.type === "order_delivered" && payload.clientEmail) {
      const { orderDeliveredHTML } = await import("./_shared/emailTemplates.js");
      await transport.sendMail({
        from: `"Bartez Tecnologia" <${fromEmail}>`,
        to: payload.clientEmail,
        subject: sanitizeHeaderText(
          `¡Tu pedido ${payload.orderNumber} fue entregado!`,
          "Pedido entregado"
        ),
        html: orderDeliveredHTML({
          orderNumber: payload.orderNumber ?? "",
          clientName: payload.clientName ?? "Cliente",
        }),
      });
    }

    if (payload.type === "order_rejected" && payload.clientEmail) {
      await transport.sendMail({
        from: `"Bartez Tecnologia" <${fromEmail}>`,
        to: payload.clientEmail,
        subject: sanitizeHeaderText(
          `Actualización sobre tu pedido ${payload.orderNumber}`,
          "Pedido rechazado"
        ),
        html: orderRejectedHTML({
          orderNumber: payload.orderNumber ?? "",
          clientName: payload.clientName ?? "Cliente",
        }),
      });
    }

    if (payload.type === "order_confirmed" || payload.type === "new_order_admin") {
      await transport.sendMail({
        from: `"Bartez B2B" <${fromEmail}>`,
        to: adminEmail,
        subject: sanitizeHeaderText(
          `Nuevo pedido ${payload.orderNumber} - $${payload.total.toFixed(2)}`,
          "Nuevo pedido"
        ),
        html: newOrderAlertHTML({
          orderNumber: payload.orderNumber ?? "",
          clientName: payload.clientName ?? payload.clientId,
          clientId: payload.clientId,
          products,
          total: payload.total ?? 0,
        }),
      });
    }

    if ((payload.type === "quote_approved" || payload.type === "quote_rejected") && payload.clientEmail && payload.quoteId) {
      await transport.sendMail({
        from: `"Bartez Tecnologia" <${fromEmail}>`,
        to: payload.clientEmail,
        subject: sanitizeHeaderText(
          payload.type === "quote_approved"
            ? `Tu cotización #${payload.quoteId} fue aprobada`
            : `Tu cotización #${payload.quoteId} fue rechazada`,
          payload.type === "quote_approved" ? "Cotización aprobada" : "Cotización rechazada"
        ),
        html: quoteStatusHTML({
          quoteId: payload.quoteId,
          clientName: payload.clientName ?? "Cliente",
          total: payload.total ?? 0,
          currency: "ARS",
          status: payload.type === "quote_approved" ? "approved" : "rejected",
        }),
      });
    }

    if (payload.type === "new_payment") {
      await transport.sendMail({
        from: `"Bartez B2B" <${fromEmail}>`,
        to: adminEmail,
        subject: sanitizeHeaderText(
          `Nuevo Pago: ${payload.clientName} - ${payload.currency} ${payload.amount}`,
          "Nuevo Pago"
        ),
        html: newPaymentHTML({
          clientName: payload.clientName ?? "Cliente",
          amount: payload.amount ?? 0,
          currency: payload.currency ?? "USD",
          date: payload.date ?? new Date().toISOString(),
          method: payload.method ?? "otro",
          orderNumber: payload.orderNumber,
          invoiceNumber: payload.invoiceNumber,
          fileUrl: payload.fileUrl,
          notes: payload.notes,
          echeqDetails: payload.echeqDetails,
        }),
      });
    }

    return res.status(200).json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Email send failed";
    console.error("[email] Error:", message);
    return res.status(500).json({ error: "Email delivery failed" });
  }
}

async function handleContactEmail(req: VercelRequest, res: VercelResponse) {
  try {
    const parsed = contactRequestSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: "Datos de contacto invalidos",
        details: parsed.error.flatten(),
      });
    }

    const { name, email, message, subject } = parsed.data;
    const transporter = createMailerTransport();
    const fromEmail = getDefaultFromEmail();

    const safeSubject =
      subject ??
      sanitizeHeaderText(`Nueva solicitud de contacto: ${name}`, "Nueva solicitud de contacto");

    await transporter.sendMail({
      from: `"Bartez Soluciones IT" <${fromEmail}>`,
      to: "contacto@bartez.com.ar",
      replyTo: email,
      subject: sanitizeHeaderText(safeSubject, "Nueva solicitud de contacto"),
      text: `Nombre: ${name}\nEmail: ${email}\n\nMensaje:\n${message}`,
    });

    return res.status(200).json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error";
    console.error("[contact] Error:", message);
    return res.status(500).json({ ok: false, error: "No se pudo enviar el mensaje" });
  }
}
