/**
 * WhatsApp Integration Module
 * Handles message formatting and URL generation for WhatsApp shortcuts.
 */

export interface WhatsAppCartData {
  phone: string;
  clientName: string;
  items: Array<{ name: string; quantity: number; unitPrice: number; currency: string }>;
  total: number;
}

/**
 * Generates a WhatsApp URL with a formatted message for sharing a cart.
 */
export function generateWhatsAppCartUrl(data: WhatsAppCartData): string {
  const cleanPhone = data.phone.replace(/\D/g, "");
  
  const itemLines = data.items.map(i => 
    `• ${i.quantity}x ${i.name} (${i.currency} ${i.unitPrice.toLocaleString("es-AR")})`
  ).join("\n");

  const message = encodeURIComponent(
    `*Bartez Tech Nexus - Pedido de ${data.clientName}*\n\n` +
    `Hola! Te comparto mi carrito actual:\n\n` +
    `${itemLines}\n\n` +
    `*Total estimado:* ${data.items[0]?.currency} ${data.total.toLocaleString("es-AR")}\n\n` +
    `¿Me confirmas disponibilidad para cerrar el pedido?`
  );

  return `https://wa.me/${cleanPhone}/?text=${message}`;
}

/**
 * Generates a WhatsApp URL for order status notifications.
 */
export function generateWhatsAppStatusUrl(phone: string, orderNumber: string, status: string): string {
  const cleanPhone = phone.replace(/\D/g, "");
  const statusLabels: Record<string, string> = {
    pending: "En revisión",
    approved: "Aprobado",
    preparing: "En preparación",
    shipped: "Despachado",
    delivered: "Entregado",
    rejected: "Rechazado",
  };

  const message = encodeURIComponent(
    `*Bartez Tech Nexus*\n\n` +
    `Hola! El estado de tu pedido *${orderNumber}* ha cambiado a: *${statusLabels[status] || status}*.\n\n` +
    `Podés seguir el detalle desde el portal B2B.`
  );

  return `https://wa.me/${cleanPhone}/?text=${message}`;
}
