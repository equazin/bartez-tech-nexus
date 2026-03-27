import type { VercelRequest, VercelResponse } from "@vercel/node";
import nodemailer from "nodemailer";
import { orderConfirmationHTML, newOrderAlertHTML } from "./_shared/emailTemplates";

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrderProduct {
  product_id: number;
  name: string;
  sku?: string;
  quantity: number;
  unit_price?: number;
  total_price?: number;
}

interface EmailPayload {
  type: "order_confirmed" | "new_order_admin";
  orderId: number;
  orderNumber: string;
  clientId: string;
  clientEmail?: string;
  clientName?: string;
  products: OrderProduct[];
  total: number;
}

// ── Mailer ────────────────────────────────────────────────────────────────────

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error("SMTP_HOST, SMTP_USER, SMTP_PASS env vars are required");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const payload = req.body as EmailPayload;

  if (!payload?.type || !payload?.orderNumber) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const fromEmail   = process.env.FROM_EMAIL   ?? "pedidos@bartez.com.ar";
  const adminEmail  = process.env.ADMIN_EMAIL  ?? fromEmail;

  try {
    const transport = createTransport();

    if (payload.type === "order_confirmed" && payload.clientEmail) {
      await transport.sendMail({
        from:    `"Bartez Tecnología" <${fromEmail}>`,
        to:      payload.clientEmail,
        subject: `✅ Pedido ${payload.orderNumber} confirmado`,
        html:    orderConfirmationHTML({
          orderNumber: payload.orderNumber,
          clientName:  payload.clientName ?? "Cliente",
          products:    payload.products,
          total:       payload.total,
        }),
      });
    }

    if (payload.type === "order_confirmed" || payload.type === "new_order_admin") {
      await transport.sendMail({
        from:    `"Bartez B2B" <${fromEmail}>`,
        to:      adminEmail,
        subject: `🛒 Nuevo pedido ${payload.orderNumber} — $${payload.total.toFixed(2)}`,
        html:    newOrderAlertHTML({
          orderNumber: payload.orderNumber,
          clientName:  payload.clientName ?? payload.clientId,
          clientId:    payload.clientId,
          products:    payload.products,
          total:       payload.total,
        }),
      });
    }

    return res.status(200).json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Email send failed";
    // Log but don't expose internals
    console.error("[email] Error:", message);
    return res.status(500).json({ error: "Email delivery failed" });
  }
}
