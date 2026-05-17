import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { EmptyQuotesState } from "@/components/b2b/empty-states/EmptyQuotesState";
import { QuoteList } from "@/components/QuoteList";
import { useAuth } from "@/context/AuthContext";
import { useImpersonate } from "@/context/ImpersonateContext";
import { useQuotes } from "@/hooks/useQuotes";
import { useSharedCartState } from "@/hooks/useSharedCartState";
import { useAppTheme } from "@/hooks/useAppTheme";
import { supabase } from "@/lib/supabase";
import type { Quote } from "@/models/quote";

/**
 * Standalone quotes section for /portal/cotizaciones. Replaces the legacy
 * `<B2BPortal chrome="shell" forcedTab="quotes" />` wrapper.
 */
export function PortalQuotesSection() {
  const navigate = useNavigate();
  const { profile: authProfile } = useAuth();
  const { activeProfile } = useImpersonate();
  const profile = activeProfile ?? authProfile;
  const userId = profile?.id ?? "guest";

  const { quotes, addQuote, updateStatus: updateQuoteStatus, deleteQuote } = useQuotes(userId);
  const { setCart, setBundleCartMeta } = useSharedCartState(userId);
  const { isDark } = useAppTheme();

  const handleLoadQuote = useCallback((quote: Quote) => {
    const next: Record<number, number> = {};
    quote.items.forEach((item) => { next[item.product_id] = item.quantity; });
    setCart(next);
    setBundleCartMeta({});
    navigate("/cart");
  }, [navigate, setCart, setBundleCartMeta]);

  const handleDuplicateQuote = useCallback(async (id: number) => {
    const original = quotes.find((q) => q.id === id);
    if (!original) return;
    await addQuote({
      ...original,
      status: "draft",
      version: 1,
      parent_id: original.id,
      order_id: undefined,
      created_at: new Date().toISOString(),
    });
  }, [quotes, addQuote]);

  const handleConvertQuoteToOrder = useCallback(async (quote: Quote) => {
    if (!profile?.id) return;
    const { data, error } = await supabase.rpc("convert_quote_to_order", {
      p_quote_id: String(quote.id),
      p_client_id: profile.id,
    });
    if (error) {
      toast.error("No se pudo convertir la cotización en pedido.");
      return;
    }
    if (data) {
      await updateQuoteStatus(quote.id, "converted");
      toast.success("Cotización convertida en pedido correctamente.", {
        action: { label: "Ver pedidos", onClick: () => navigate("/portal/pedidos") },
      });
    }
  }, [profile?.id, updateQuoteStatus, navigate]);

  if (quotes.length === 0) {
    return (
      <EmptyQuotesState
        onGoToCatalog={() => navigate("/portal/catalogo")}
        onGoToCart={() => navigate("/cart")}
      />
    );
  }

  return (
    <div className="mx-auto max-w-[1480px] space-y-4">
      <div className="rounded-[24px] border border-border/70 bg-card px-5 py-4 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Cotizaciones</p>
        <div className="mt-2 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">Propuestas listas para reutilizar o convertir</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Acá concentrás tus borradores, propuestas enviadas y pedidos nacidos desde una cotización.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate("/portal/catalogo")}
              className="rounded-xl border border-border/70 bg-background px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            >
              Volver al catálogo
            </button>
            <button
              type="button"
              onClick={() => navigate("/cart")}
              className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Ir al checkout
            </button>
          </div>
        </div>
      </div>

      <QuoteList
        quotes={quotes}
        isDark={isDark}
        onLoad={handleLoadQuote}
        onUpdateStatus={updateQuoteStatus}
        onDelete={deleteQuote}
        onGoToCatalog={() => navigate("/portal/catalogo")}
        onDuplicate={handleDuplicateQuote}
        onConvertToOrder={handleConvertQuoteToOrder}
      />
    </div>
  );
}
