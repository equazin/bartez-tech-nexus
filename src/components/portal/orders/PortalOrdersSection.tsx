import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { OrdersPanel } from "@/components/b2b/OrdersPanel";
import { useAuth } from "@/context/AuthContext";
import { useCurrency } from "@/context/CurrencyContext";
import { useImpersonate } from "@/context/ImpersonateContext";
import { useOrders } from "@/hooks/useOrders";
import { useProducts } from "@/hooks/useProducts";
import { useSharedCartState } from "@/hooks/useSharedCartState";
import { fetchMyInvoices } from "@/lib/api/invoices";
import { getAvailableStock } from "@/lib/pricing";
import type { Invoice } from "@/lib/api/invoices";
import type { PortalOrder } from "@/hooks/useOrders";

/**
 * Standalone orders section for /portal/pedidos.
 *
 * Replaces the previous `<B2BPortal chrome="shell" forcedTab="orders" />` wrapper:
 * pulls only what it needs (orders, currency, profile) instead of paying the cost
 * of mounting the full portal (catalog, bundles, quotes, lists, etc.).
 */
export function PortalOrdersSection() {
  const navigate = useNavigate();
  const { profile: authProfile } = useAuth();
  const { activeProfile } = useImpersonate();
  const profile = activeProfile ?? authProfile;
  const userId = profile?.id ?? "";

  const { orders, loading, error, updateOrder } = useOrders();
  const { formatPrice, formatUSD, formatARS, currency } = useCurrency();
  // The repeat-order flow needs the catalog to check stock; we don't need the
  // full admin price list, just enough to resolve stock for cart items.
  const { products } = useProducts({});
  const { setCart, setBundleCartMeta } = useSharedCartState(userId);

  const [myInvoices, setMyInvoices] = useState<Invoice[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetchMyInvoices()
      .then((data) => { if (!cancelled) setMyInvoices(data); })
      .catch(() => { /* non-blocking */ });
    return () => { cancelled = true; };
  }, []);

  const handleRepeatOrder = useCallback((order: PortalOrder) => {
    const newCart: Record<number, number> = {};
    for (const p of order.products) {
      const product = products.find((prod) => prod.id === p.product_id);
      if (!product) continue;
      const available = getAvailableStock(product);
      const qty = Math.min(p.quantity, available);
      if (qty > 0) newCart[p.product_id] = qty;
    }
    setCart(newCart);
    setBundleCartMeta({});
    navigate("/cart");
  }, [products, setCart, setBundleCartMeta, navigate]);

  const handleUpdateProofs = useCallback(
    (id: string | number, proofs: unknown[]) => updateOrder(id, { payment_proofs: proofs }),
    [updateOrder],
  );

  const errorBanner = useMemo(() => {
    if (!error) return null;
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
        No pudimos actualizar tus pedidos. {error}
      </div>
    );
  }, [error]);

  return (
    <div className="space-y-3">
      {errorBanner}
      <OrdersPanel
        orders={orders}
        invoices={myInvoices}
        loading={loading}
        formatPrice={formatPrice}
        formatUSD={formatUSD}
        formatARS={formatARS}
        currency={currency}
        onRepeatOrder={handleRepeatOrder}
        onGoToCatalog={() => navigate("/portal/catalogo")}
        onGoToInvoices={() => navigate("/portal/cuenta/documentos")}
        onUpdateOrderProofs={handleUpdateProofs}
      />
    </div>
  );
}
