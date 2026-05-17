import type { Quote } from "@/models/quote";

interface ShareQuoteOptions {
  /** Optional company name to greet the customer. */
  companyName?: string;
  /** Currency formatter (delegates to CurrencyContext.formatPrice). */
  formatPrice: (value: number) => string;
  /** Public link to view the full quote, if available. */
  publicUrl?: string;
}

const MAX_ITEMS_INLINE = 8;

function buildLines(quote: Quote, opts: ShareQuoteOptions): string[] {
  const lines: string[] = [];
  const greeting = quote.client_name?.trim() ? `Hola ${quote.client_name},` : "Hola,";
  lines.push(greeting);
  lines.push("");
  lines.push(`Te paso la cotización *COT-${String(quote.id).padStart(4, "0")}* (${quote.currency}).`);
  lines.push("");

  const items = quote.items.slice(0, MAX_ITEMS_INLINE);
  for (const item of items) {
    const qty = item.quantity ?? 1;
    const total = opts.formatPrice(item.totalPrice ?? (item.unitPrice ?? 0) * qty);
    lines.push(`• ${qty} × ${item.name} — ${total}`);
  }
  if (quote.items.length > MAX_ITEMS_INLINE) {
    lines.push(`(+${quote.items.length - MAX_ITEMS_INLINE} ítems más)`);
  }

  lines.push("");
  lines.push(`*Total:* ${opts.formatPrice(quote.total)} (${quote.currency})`);

  if (quote.expires_at) {
    const expires = new Date(quote.expires_at);
    if (!Number.isNaN(expires.getTime())) {
      lines.push(`Válida hasta: ${expires.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}`);
    }
  }

  if (opts.publicUrl) {
    lines.push("");
    lines.push(`Detalle completo: ${opts.publicUrl}`);
  }

  lines.push("");
  lines.push(opts.companyName ? `Saludos,\n${opts.companyName}` : "Saludos.");
  return lines;
}

export function buildQuoteWhatsappMessage(quote: Quote, opts: ShareQuoteOptions): string {
  return buildLines(quote, opts).join("\n");
}

export function buildQuoteWhatsappUrl(quote: Quote, opts: ShareQuoteOptions & { phone?: string }): string {
  const body = encodeURIComponent(buildQuoteWhatsappMessage(quote, opts));
  const phone = opts.phone ? opts.phone.replace(/\D/g, "") : "";
  return phone
    ? `https://wa.me/${phone}?text=${body}`
    : `https://wa.me/?text=${body}`;
}
