/**
 * Server-side fire-and-forget notifications.
 * Called from API handlers after order status changes.
 * Never throws — all errors are logged to console only.
 */
import {
  orderConfirmationHTML,
  orderApprovedHTML,
  orderPreparingHTML,
} from "./emailTemplates.js";
import { createMailerTransport, getDefaultFromEmail, sanitizeHeaderText } from "./mailer.js";
import type { SupabaseClient } from "@supabase/supabase-js";

// Status values that trigger a client-facing email
const STATUS_EMAIL_SUBJECT: Partial<Record<string, string>> = {
  approved:   "Tu pedido {num} fue aprobado ✅",
  confirmed:  "Pedido {num} confirmado",
  preparing:  "Tu pedido {num} está en preparación",
  shipped:    "Tu pedido {num} está en camino 🚚",
  delivered:  "¡Tu pedido {num} fue entregado! 🎉",
  rejected:   "Actualización sobre tu pedido {num}",
  cancelled:  "Tu pedido {num} fue cancelado",
};

const STATUS_WA_TEXT: Partial<Record<string, string>> = {
  approved:  "✅ Tu pedido {num} fue *aprobado*. Pronto comenzamos a prepararlo.",
  confirmed: "📦 Tu pedido {num} fue *confirmado*.",
  preparing: "⚙️ Tu pedido {num} está *en preparación*.",
  shipped:   "🚚 Tu pedido {num} está *en camino*. {tracking}",
  delivered: "🎉 Tu pedido {num} fue *entregado*. ¡Gracias por tu compra!",
  rejected:  "❌ Lamentablemente tu pedido {num} fue *rechazado*. Contactanos para más información.",
  cancelled: "Tu pedido {num} fue *cancelado*.",
};

interface OrderRow {
  id: number | string;
  order_number?: string | null;
  client_id: string;
  total?: number;
  products?: unknown[];
  shipping_provider?: string | null;
  tracking_number?: string | null;
}

interface ClientProfile {
  email?: string | null;
  contact_name?: string | null;
  company_name?: string | null;
  phone?: string | null;
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? "");
}

function buildEmailHTML(status: string, params: { orderNumber: string; clientName: string; total: number; shippingProvider?: string; trackingNumber?: string }): string | null {
  const { orderNumber, clientName, total, shippingProvider, trackingNumber } = params;
  switch (status) {
    case "confirmed":  return orderConfirmationHTML({ orderNumber, clientName, products: [], total });
    case "approved":   return orderApprovedHTML({ orderNumber, clientName, total });
    case "preparing":  return orderPreparingHTML({ orderNumber, clientName });
    default:           return null; // shipped/delivered/rejected loaded dynamically below
  }
}

async function buildEmailHTMLDynamic(status: string, params: { orderNumber: string; clientName: string; total: number; shippingProvider?: string; trackingNumber?: string }): Promise<string | null> {
  const { orderNumber, clientName, shippingProvider, trackingNumber } = params;
  const html = buildEmailHTML(status, params);
  if (html !== null) return html;

  try {
    const templates = await import("./emailTemplates.js");
    if (status === "shipped" && "orderShippedHTML" in templates) {
      return (templates as { orderShippedHTML: (p: { orderNumber: string; clientName: string; shippingProvider?: string; trackingNumber?: string }) => string }).orderShippedHTML({ orderNumber, clientName, shippingProvider: shippingProvider ?? undefined, trackingNumber: trackingNumber ?? undefined });
    }
    if (status === "delivered" && "orderDeliveredHTML" in templates) {
      return (templates as { orderDeliveredHTML: (p: { orderNumber: string; clientName: string }) => string }).orderDeliveredHTML({ orderNumber, clientName });
    }
    if (status === "rejected" && "orderRejectedHTML" in templates) {
      return (templates as { orderRejectedHTML: (p: { orderNumber: string; clientName: string }) => string }).orderRejectedHTML({ orderNumber, clientName });
    }
  } catch {
    // template not found — skip
  }
  return null;
}

async function sendWhatsApp(phone: string, text: string): Promise<void> {
  const token   = process.env.WHATSAPP_API_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) return; // not configured — silent skip

  // Normalize phone: strip non-digits, ensure country code
  const normalized = phone.replace(/\D/g, "");
  if (normalized.length < 10) return;

  await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: normalized,
      type: "text",
      text: { body: text },
    }),
  });
}

/**
 * Fire-and-forget: sends email + WhatsApp to the client when an order status changes.
 * Fetches client profile using the admin client (bypasses RLS).
 * Never throws.
 */
export async function notifyOrderStatusChange(
  order: OrderRow,
  newStatus: string,
  adminSupabase: SupabaseClient,
): Promise<void> {
  const subjectTemplate = STATUS_EMAIL_SUBJECT[newStatus];
  const waTemplate      = STATUS_WA_TEXT[newStatus];
  if (!subjectTemplate && !waTemplate) return; // no notification for this status

  const orderNum = order.order_number ?? `#${String(order.id).slice(-6).toUpperCase()}`;

  try {
    // Fetch client profile (admin client bypasses RLS)
    const { data: client } = await adminSupabase
      .from("profiles")
      .select("email, contact_name, company_name, phone")
      .eq("id", order.client_id)
      .single();

    if (!client) return;

    const profile = client as ClientProfile;
    const clientName = profile.contact_name ?? profile.company_name ?? "Cliente";
    const tracking   = order.tracking_number
      ? `Número de seguimiento: ${order.tracking_number}`
      : "";

    // ── Email ────────────────────────────────────────────────────────────────
    if (subjectTemplate && profile.email) {
      const subject = interpolate(subjectTemplate, { num: orderNum });
      const html    = await buildEmailHTMLDynamic(newStatus, {
        orderNumber:      orderNum,
        clientName,
        total:            order.total ?? 0,
        shippingProvider: order.shipping_provider ?? undefined,
        trackingNumber:   order.tracking_number   ?? undefined,
      });

      if (html) {
        try {
          const transport = createMailerTransport();
          await transport.sendMail({
            from: `"Bartez Tecnologia" <${getDefaultFromEmail()}>`,
            to:   profile.email,
            subject: sanitizeHeaderText(subject, "Actualización de tu pedido"),
            html,
          });
        } catch (emailErr) {
          console.error("[notifications] Email error:", emailErr);
        }
      }
    }

    // ── WhatsApp ─────────────────────────────────────────────────────────────
    if (waTemplate && profile.phone) {
      const text = interpolate(waTemplate, { num: orderNum, tracking });
      try {
        await sendWhatsApp(profile.phone, text);
      } catch (waErr) {
        console.error("[notifications] WhatsApp error:", waErr);
      }
    }
  } catch (err) {
    console.error("[notifications] Unexpected error:", err);
  }
}
