import { supabase } from "@/lib/supabase";

/**
 * Encapsulates WhatsApp notification logic for B2B Argentina flows.
 * Uses the WhatsApp Business API (mocked through /api/whatsapp-proxy).
 */
export const whatsappNotifications = {
  /**
   * Notify client when an order is dispatched/shipped.
   */
  async notifyOrderShipped(order: any, client: any) {
    if (!client.phone) return;
    
    const message = `¡Hola ${client.contact_name}! 👋 
Tu pedido *${order.order_number || `#${order.id.slice(-8)}`}* de Bartez ya fue despachado. 🚚

📦 *Enviado por:* ${order.shipping_provider || "Logística"}
🛤️ *Seguimiento:* ${order.tracking_number || "---"}

Podés ver los detalles en tu portal: https://portal.bartez.com/pedidos/${order.id}`;

    return this._send(client.phone, message);
  },

  /**
   * Notify client when a marked "Favorite" product has new stock.
   */
  async notifyStockArrival(product: any, client: any) {
    if (!client.phone) return;
    
    const message = `¡Buenas noticias ${client.contact_name}! 🚀 
El producto *${product.name}* ya ingresó a stock y está disponible para la compra. 

🛒 *Precio:* USD ${product.price?.toLocaleString()}
👉 *Link:* https://portal.bartez.com/products/${product.id}`;

    return this._send(client.phone, message);
  },

  /**
   * Internal proxy send logic.
   */
  async _send(phone: string, text: string) {
    console.log(`[WA Notification] Sending to ${phone}: ${text}`);
    try {
      // In production, this calls a Vercel/Supabase Edge Function
      const res = await fetch("/api/whatsapp-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, text }),
      });
      return res.ok;
    } catch (err) {
      console.error("WhatsApp API Proxy error:", err);
      return false;
    }
  }
};
