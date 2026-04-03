import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * POST /api/whatsapp-send
 * Sends a WhatsApp message via the Meta WhatsApp Business API.
 * Gracefully no-ops if env vars are missing so the app never breaks.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;

  if (!token || !phoneId) {
    console.log("[whatsapp-send] WHATSAPP_API_TOKEN or WHATSAPP_PHONE_ID not configured — skipping send");
    return res.status(200).json({ ok: true, skipped: true });
  }

  const { phone, text } = req.body ?? {};

  if (!phone || !text) {
    return res.status(400).json({ error: "Missing required fields: phone, text" });
  }

  const url = `https://graph.facebook.com/v18.0/${phoneId}/messages`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "text",
        text: { body: text },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[whatsapp-send] Meta API error:", data);
      return res.status(response.status).json({ error: "Meta API error", details: data });
    }

    return res.status(200).json({ ok: true, data });
  } catch (err) {
    console.error("[whatsapp-send] Unexpected error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
