import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, FileText, Calendar, Tag } from "lucide-react";
import {
  fetchPublicQuote,
  markPublicQuoteViewed,
  type PublicQuote as PublicQuoteData,
} from "@/lib/api/publicQuote";

const SITE_NAME = "Bartez Tecnologia";

function formatCurrency(value: number, currency: "USD" | "ARS"): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function setMetaTag(attr: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attr, key);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

function applyMetaTags(quote: PublicQuoteData) {
  const title = `Cotización COT-${String(quote.id).padStart(4, "0")} | ${SITE_NAME}`;
  const description = `Cotización por ${formatCurrency(quote.total, quote.currency)} para ${
    quote.company_name ?? quote.client_name ?? "tu empresa"
  }.`;
  document.title = title;
  setMetaTag("name", "description", description);
  setMetaTag("name", "robots", "noindex,nofollow");
  setMetaTag("property", "og:title", title);
  setMetaTag("property", "og:description", description);
  setMetaTag("property", "og:type", "website");
  setMetaTag("name", "twitter:card", "summary");
  setMetaTag("name", "twitter:title", title);
  setMetaTag("name", "twitter:description", description);
}

export default function PublicQuote() {
  const { token } = useParams<{ token: string }>();
  const [quote, setQuote] = useState<PublicQuoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Token inválido");
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchPublicQuote(token)
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          setError("Cotización no encontrada o expirada");
          return;
        }
        setQuote(data);
        applyMetaTags(data);
        void markPublicQuoteViewed(token);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Error al cargar la cotización");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-[#a3a3a3]">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-center px-6">
        <div className="max-w-md">
          <FileText className="mx-auto h-10 w-10 text-[#525252] mb-3" />
          <h1 className="text-lg font-semibold text-white mb-2">No pudimos mostrar la cotización</h1>
          <p className="text-sm text-[#a3a3a3]">{error ?? "Sin datos para mostrar."}</p>
        </div>
      </div>
    );
  }

  const quoteNumber = `COT-${String(quote.id).padStart(4, "0")}`;
  const createdLabel = formatDate(quote.created_at);
  const expiresLabel = formatDate(quote.expires_at);
  const isExpired = quote.expires_at ? new Date(quote.expires_at) < new Date() : false;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e5e5e5] py-8 px-4">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6">
          <p className="text-xs uppercase tracking-widest text-[#525252] mb-1">{SITE_NAME}</p>
          <h1 className="text-2xl font-semibold text-white">{quoteNumber}</h1>
          {quote.company_name || quote.client_name ? (
            <p className="text-sm text-[#a3a3a3] mt-1">
              Para {quote.company_name ?? quote.client_name}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-[#737373]">
            {createdLabel && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {createdLabel}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Tag className="h-3 w-3" />
              {quote.currency}
            </span>
            {isExpired && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-red-900/30 text-red-300">
                Expirada
              </span>
            )}
          </div>
        </header>

        <section className="rounded-2xl border border-[#1f1f1f] bg-[#111] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1a1a1a] text-xs uppercase tracking-widest text-[#525252]">
            Detalle
          </div>
          <ul className="divide-y divide-[#1a1a1a]">
            {quote.items.length === 0 ? (
              <li className="px-4 py-6 text-sm text-[#737373] text-center">Sin ítems en esta cotización.</li>
            ) : (
              quote.items.map((item, index) => {
                const qty = item.quantity ?? 1;
                const unit = item.unitPrice ?? 0;
                const total = item.totalPrice ?? unit * qty;
                return (
                  <li key={`${item.product_id ?? index}-${index}`} className="px-4 py-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{item.name}</p>
                      {item.sku && <p className="text-[11px] text-[#525252]">{item.sku}</p>}
                      <p className="text-[11px] text-[#a3a3a3] mt-0.5">
                        {qty} × {formatCurrency(unit, quote.currency)}
                      </p>
                    </div>
                    <p className="text-sm font-medium text-white shrink-0">
                      {formatCurrency(total, quote.currency)}
                    </p>
                  </li>
                );
              })
            )}
          </ul>
          <div className="px-4 py-3 border-t border-[#1a1a1a] space-y-1.5 text-sm">
            <div className="flex justify-between text-[#a3a3a3]">
              <span>Subtotal</span>
              <span>{formatCurrency(quote.subtotal, quote.currency)}</span>
            </div>
            <div className="flex justify-between text-[#a3a3a3]">
              <span>IVA</span>
              <span>{formatCurrency(quote.iva_total, quote.currency)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold text-white pt-1.5 border-t border-[#1a1a1a]">
              <span>Total</span>
              <span>{formatCurrency(quote.total, quote.currency)}</span>
            </div>
          </div>
        </section>

        {expiresLabel && (
          <p className="mt-4 text-xs text-[#737373] text-center">
            Válida hasta {expiresLabel}. Comunícate con Bartez para confirmar disponibilidad.
          </p>
        )}

        <footer className="mt-8 text-center text-[10px] text-[#404040]">
          Cotización compartida desde {SITE_NAME}
        </footer>
      </div>
    </div>
  );
}
