/**
 * usePortalCart — Manages cart, order submission, and quote lifecycle for the B2B portal.
 */
import { useState, useMemo, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { getAvailableStock } from "@/lib/pricing";
import { getSavedCarts, saveCart, deleteSavedCart, type SavedCart } from "@/lib/savedCarts";
import { getFavoriteProducts, toggleFavoriteProduct } from "@/lib/favoriteProducts";
import { puedeComprar } from "@/lib/api/clientDetail";
import { backend, BackendError } from "@/lib/api/backend";
import { logActivity } from "@/lib/api/activityLog";
import { trackFirstOrder, trackOrderPlaced } from "@/lib/marketingTracker";
import type { Product } from "@/models/products";
import type { PriceResult } from "@/hooks/usePricing";
import type { Quote } from "@/models/quote";
import type { UserProfile } from "@/lib/supabase";
import type { AddOrderPayload, PortalOrder } from "@/hooks/useOrders";

export type CartItem = {
  product: Product;
  quantity: number;
  cost: number;
  margin: number;
  unitPrice: number;
  totalPrice: number;
  ivaRate: number;
  ivaAmount: number;
  totalWithIVA: number;
};

interface UsePortalCartOptions {
  profile: UserProfile | null;
  products: Product[];
  computePrice: (p: Product, qty: number) => PriceResult;
  currency: "USD" | "ARS";
  orders: PortalOrder[];
  addOrder: (order: AddOrderPayload) => Promise<{ error: unknown }>;
  updateOrder: (id: string | number, data: Partial<PortalOrder>) => Promise<unknown>;
  fetchOrders: () => Promise<void>;
  addQuote: (q: Omit<Quote, "id">) => Promise<unknown>;
  updateQuoteStatus: (id: number, status: string) => Promise<unknown>;
  navigate: (path: string) => void;
  setActiveTab: (tab: string) => void;
  /** ARS credit remaining for this client; undefined = no limit */
  creditAvailable?: number;
}

export interface BundleMeta {
  bundleId: string;
  bundleName: string;
}

export function usePortalCart({
  profile,
  products,
  computePrice,
  currency,
  orders,
  addOrder,
  updateOrder,
  fetchOrders,
  addQuote,
  updateQuoteStatus,
  navigate,
  setActiveTab,
  creditAvailable,
}: UsePortalCartOptions) {
  const cartKey = `b2b_cart_${profile?.id || "guest"}`;
  const metaKey = `b2b_cart_meta_${profile?.id || "guest"}`;

  // ── Cart state ────────────────────────────────────────────────────────────
  const [cart, setCart] = useState<Record<number, number>>(() => {
    try { return JSON.parse(localStorage.getItem(cartKey) || "{}"); }
    catch { return {}; }
  });
  const [bundleCartMeta, setBundleCartMeta] = useState<Record<number, BundleMeta>>(() => {
    try { return JSON.parse(localStorage.getItem(metaKey) || "{}"); }
    catch { return {}; }
  });
  const [productMargins, setProductMargins] = useState<Record<number, number>>({});
  const [globalMargin, setGlobalMargin] = useState(profile?.default_margin ?? 20);

  useEffect(() => {
    if (profile?.default_margin) setGlobalMargin(profile.default_margin);
  }, [profile?.default_margin]);

  useEffect(() => {
    localStorage.setItem(cartKey, JSON.stringify(cart));
  }, [cart, cartKey]);

  useEffect(() => {
    localStorage.setItem(metaKey, JSON.stringify(bundleCartMeta));
  }, [bundleCartMeta, metaKey]);

  // ── Saved carts & favorites ───────────────────────────────────────────────
  const [savedCarts, setSavedCarts] = useState<SavedCart[]>(() =>
    getSavedCarts(profile?.id || "guest")
  );
  const [favoriteProductIds, setFavoriteProductIds] = useState<number[]>(() =>
    getFavoriteProducts(profile?.id || "guest")
  );

  useEffect(() => {
    const uid = profile?.id || "guest";
    setSavedCarts(getSavedCarts(uid));
    setFavoriteProductIds(getFavoriteProducts(uid));
  }, [profile?.id]);

  // ── Coupon state ──────────────────────────────────────────────────────────
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<Record<string, unknown> | null>(null);
  const [couponError, setCouponError] = useState("");
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  // ── Order state ───────────────────────────────────────────────────────────
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [creditError, setCreditError] = useState("");
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());

  // ── Quick order ───────────────────────────────────────────────────────────
  const [quickSku, setQuickSku] = useState("");
  const [quickError, setQuickError] = useState("");

  // ── Computed cart data ────────────────────────────────────────────────────
  const cartItems = useMemo((): CartItem[] => {
    return Object.entries(cart)
      .map(([id, qty]) => {
        const product = products.find((p) => p.id === Number(id));
        if (!product) return null;
        const price = computePrice(product, qty);
        return {
          product, quantity: qty,
          cost: price.cost, margin: price.margin,
          unitPrice: price.unitPrice, totalPrice: price.totalPrice,
          ivaRate: price.ivaRate, ivaAmount: price.ivaAmount,
          totalWithIVA: price.totalWithIVA,
        };
      })
      .filter((i): i is CartItem => i !== null);
  }, [cart, products, computePrice]);

  const cartSubtotal = useMemo(() => cartItems.reduce((s, i) => s + i.totalPrice, 0), [cartItems]);
  const cartIVATotal = useMemo(() => cartItems.reduce((s, i) => s + i.ivaAmount, 0), [cartItems]);

  const discountAmount = useMemo(() => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.discount_type === "fixed") return appliedCoupon.discount_value as number;
    return (cartSubtotal * (appliedCoupon.discount_value as number)) / 100;
  }, [appliedCoupon, cartSubtotal]);

  const cartTotal = useMemo(() => Math.max(0, cartSubtotal + cartIVATotal - discountAmount), [cartSubtotal, cartIVATotal, discountAmount]);
  const cartCount = useMemo(() => Object.values(cart).reduce((s, q) => s + q, 0), [cart]);

  // ── Purchase analytics ────────────────────────────────────────────────────
  const purchaseHistory = useMemo(() => {
    const map: Record<number, number> = {};
    for (const order of orders) {
      for (const p of order.products) {
        map[p.product_id] = (map[p.product_id] ?? 0) + p.quantity;
      }
    }
    return map;
  }, [orders]);

  const latestPurchaseUnitPrice = useMemo(() => {
    const map: Record<number, number> = {};
    const sorted = [...orders].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    for (const order of sorted) {
      for (const p of order.products) {
        if (map[p.product_id] == null && p.unit_price != null) {
          map[p.product_id] = p.unit_price;
        }
      }
    }
    return map;
  }, [orders]);

  // ── Cart handlers ─────────────────────────────────────────────────────────
  function handleAddToCart(product: Product) {
    const available = getAvailableStock(product);
    const inCart = cart[product.id] || 0;
    
    if (inCart >= available) {
      toast.error(`Sin stock suficiente para ${product.sku || product.name}`);
      return;
    }
    
    const minQty = product.min_order_qty ?? 1;
    const newQty = inCart === 0 && minQty > 1 ? minQty : inCart + 1;
    const safeQty = Math.min(newQty, available);
    
    setCart((prev) => ({ ...prev, [product.id]: safeQty }));
    setAddedIds((prev) => new Set(prev).add(product.id));
    
    const remaining = available - safeQty;
    if (remaining < 5 && remaining >= 0) {
      toast.warning(`Atención: Quedan solo ${remaining} unidades disponibles.`);
    } else {
      toast.success(`Añadiste 1 unidad de ${product.name}`);
    }

    setTimeout(() => {
      setAddedIds((prev) => { const s = new Set(prev); s.delete(product.id); return s; });
    }, 900);
  }

  function handleSmartAddToCart(product: Product, qty: number = 1) {
    const available = getAvailableStock(product);
    const inCart = cart[product.id] || 0;
    
    if (inCart >= available) {
      toast.error(`Sin stock suficiente para ${product.sku || product.name}`);
      return;
    }

    const toAdd = Math.min(qty, available - inCart);
    const minQty = product.min_order_qty ?? 1;
    const targetQty = inCart + toAdd;
    const newQty = inCart === 0 && targetQty < minQty ? minQty : targetQty;
    const safeQty = Math.min(newQty, available);
    
    setCart((prev) => ({ ...prev, [product.id]: safeQty }));
    setAddedIds((prev) => new Set(prev).add(product.id));

    const remaining = available - safeQty;
    const actuallyAdded = safeQty - inCart;

    // ── Credit check ──────────────────────────────────────────────────────────
    if (creditAvailable != null && creditAvailable > 0) {
      const addedCost = computePrice(product, actuallyAdded).totalWithIVA;
      if (cartTotal + addedCost > creditAvailable) {
        const fmt = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`;
        toast.warning(
          `Límite de crédito: disponible ${fmt(creditAvailable)}, carrito supera ese monto.`,
          { duration: 5000 }
        );
        return;
      }
    }

    if (remaining < 5 && remaining >= 0) {
      toast.warning(`Atención: Quedan solo ${remaining} unidades disponibles.`);
    } else {
      toast.success(`Añadiste ${actuallyAdded} unidades de ${product.name}`);
    }

    setTimeout(() => {
      setAddedIds((prev) => { const s = new Set(prev); s.delete(product.id); return s; });
    }, 900);
  }

  /**
   * Agrega todos los productos de un bundle al carrito y registra el meta del bundle
   * para permitir agrupación visual en CartPage y trazabilidad en order_items.
   */
  function addBundleToCart(
    bundleId: string,
    bundleName: string,
    items: Array<{ product: Product; qty: number }>,
  ) {
    const metaUpdates: Record<number, BundleMeta> = {};
    setCart((prev) => {
      const next = { ...prev };
      for (const { product, qty } of items) {
        const available = getAvailableStock(product);
        const safe      = Math.min(qty, available);
        if (safe > 0) {
          next[product.id] = (next[product.id] ?? 0) + safe;
          metaUpdates[product.id] = { bundleId, bundleName };
        }
      }
      return next;
    });
    setBundleCartMeta((prev) => ({ ...prev, ...metaUpdates }));
    setAddedIds((prev) => {
      const s = new Set(prev);
      items.forEach(({ product }) => s.add(product.id));
      return s;
    });
    setTimeout(() => {
      setAddedIds((prev) => {
        const s = new Set(prev);
        items.forEach(({ product }) => s.delete(product.id));
        return s;
      });
    }, 900);
  }

  const onRemoveFromCart = (product: Product) =>
    setCart((prev) => {
      const qty = prev[product.id] || 0;
      if (qty <= 1) { const { [product.id]: _, ...rest } = prev; return rest; }
      return { ...prev, [product.id]: qty - 1 };
    });

  const onMarginChange = (productId: number, margin: number) =>
    setProductMargins((prev) => ({ ...prev, [productId]: margin }));

  // ── Saved carts ───────────────────────────────────────────────────────────
  const handleSaveCart = useCallback(async () => {
    if (cartItems.length === 0) return;
    const name = `Carrito ${new Date().toLocaleDateString("es-AR")} ${new Date().toLocaleTimeString("es-AR")}`;
    saveCart(profile?.id || "guest", name, cart, productMargins);
    setSavedCarts(getSavedCarts(profile?.id || "guest"));
  }, [cart, cartItems.length, profile?.id, productMargins]);

  function handleSaveNamedCart(name: string) {
    const uid = profile?.id || "guest";
    const rawItems: Record<number, number> = {};
    const rawMargins: Record<number, number> = {};
    cartItems.forEach((i) => {
      rawItems[i.product.id] = i.quantity;
      rawMargins[i.product.id] = i.margin;
    });
    const saved = saveCart(uid, name, rawItems, rawMargins);
    setSavedCarts(getSavedCarts(uid));
    return saved;
  }

  function handleLoadSavedCart(sc: SavedCart) {
    setCart(sc.items);
    setProductMargins(sc.margins);
    navigate("/cart");
  }

  function handleDeleteSavedCart(cartId: string) {
    const uid = profile?.id || "guest";
    deleteSavedCart(uid, cartId);
    setSavedCarts(getSavedCarts(uid));
  }

  // ── Favorites ─────────────────────────────────────────────────────────────
  function handleToggleFavorite(productId: number) {
    const userId = profile?.id || "guest";
    setFavoriteProductIds(toggleFavoriteProduct(userId, productId));
  }

  // ── Quick order ───────────────────────────────────────────────────────────
  const handleResolvedQuickOrder = useCallback((product: Product, qty: number = 1) => {
    const available = getAvailableStock(product);
    const inCart = cart[product.id] || 0;
    const toAdd = Math.min(qty, available - inCart);
    if (toAdd <= 0) {
      setQuickError(`Sin stock disponible para ${product.sku ?? product.id}`);
      setTimeout(() => setQuickError(""), 2500);
      return false;
    }
    setCart((prev) => ({ ...prev, [product.id]: (prev[product.id] || 0) + toAdd }));
    setQuickSku("");
    setQuickError("");
    return true;
  }, [cart]);

  function handleQuickOrder() {
    const parts = quickSku.trim().split(/\s+/);
    const sku = parts[0];
    const qty = parts[1] ? parseInt(parts[1], 10) : 1;
    if (!sku) return;
    const product = products.find((p) => p.sku?.toLowerCase() === sku.toLowerCase());
    if (!product) {
      setQuickError(`SKU "${sku}" no encontrado`);
      setTimeout(() => setQuickError(""), 2500);
      return;
    }
    handleResolvedQuickOrder(product, qty);
  }

  // ── Coupon ────────────────────────────────────────────────────────────────
  async function handleApplyCoupon(code: string) {
    if (!code.trim()) return;
    setValidatingCoupon(true);
    setCouponError("");
    try {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("code", code.trim().toUpperCase())
        .eq("is_active", true)
        .single();

      if (error || !data) { setCouponError("Cupón no válido o expirado."); setAppliedCoupon(null); return; }
      if (data.expires_at && new Date(data.expires_at) < new Date()) { setCouponError("El cupón ha expirado."); return; }
      if (cartSubtotal < (data.min_purchase || 0)) { setCouponError(`Mínimo de compra: USD ${data.min_purchase}`); return; }
      if (data.max_uses && data.used_count >= data.max_uses) { setCouponError("Se alcanzó el límite de usos."); return; }
      if (data.client_id && data.client_id !== profile?.id) { setCouponError("Este cupón no es válido para tu cuenta."); return; }

      setAppliedCoupon(data);
      setCouponError("");
    } catch {
      setCouponError("Error al validar el cupón.");
    } finally {
      setValidatingCoupon(false);
    }
  }

  const handleRemoveCoupon = useCallback(() => {
    setAppliedCoupon(null);
    setCouponError("");
  }, []);

  // ── Order submission ──────────────────────────────────────────────────────
  const handleConfirmOrder = async () => {
    if (!cartItems.length) return;
    setCreditError("");

    if (profile?.id) {
      try {
        const check = await puedeComprar(profile.id);
        if (!check.puede) {
          const msgs: Record<string, string> = {
            cuenta_bloqueada: "Tu cuenta está bloqueada. Contactá a tu ejecutivo de cuenta.",
            cuenta_inactiva: "Tu cuenta está inactiva. Contactá a tu ejecutivo de cuenta.",
            credito_agotado: "No tenés crédito disponible para este pedido.",
          };
          setCreditError(msgs[check.razon ?? ""] ?? "No podés realizar pedidos en este momento.");
          return;
        }
      } catch { /* RPC falla no bloquea el pedido */ }
    }

    for (const item of cartItems) {
      if (item.quantity > getAvailableStock(item.product)) {
        alert(`Stock insuficiente para "${item.product.name}". Ajustá la cantidad.`);
        return;
      }
      const minQty = item.product.min_order_qty ?? 1;
      if (item.quantity < minQty) {
        alert(`"${item.product.name}" requiere un mínimo de ${minQty} unidades.`);
        return;
      }
    }

    setOrderSubmitting(true);
    try {
      // Los precios se resuelven server-side — sólo enviamos product_id + quantity + bundle meta
      const result = await backend.orders.checkout({
        items: Object.entries(cart).map(([productId, qty]) => {
          const pid  = Number(productId);
          const meta = bundleCartMeta[pid];
          return {
            product_id:  pid,
            quantity:    qty,
            bundle_id:   meta?.bundleId   ?? null,
            bundle_name: meta?.bundleName ?? null,
          };
        }),
        coupon_code: (appliedCoupon?.code as string) ?? null,
        notes: null,
        payment_method: null,
        payment_surcharge_pct: null,
        shipping_type: null,
        shipping_address: null,
        shipping_transport: null,
        shipping_cost: null,
      });

      const orderId = result.id;
      const orderNumber = (result as unknown as { order_number?: string }).order_number;

      // Log activity
      void logActivity({
        action: "place_order",
        entity_type: "order",
        entity_id: String(orderId),
        metadata: { order_number: orderNumber ?? String(orderId), total: result.total },
      });

      // Marketing tracking
      if (orders.length === 0) {
        trackFirstOrder(profile?.id ?? "", String(orderId), result.total);
      } else {
        trackOrderPlaced(profile?.id ?? "", String(orderId), result.total);
      }

      // Refresca la lista de pedidos
      void fetchOrders();

      // Email de confirmación (non-blocking)
      void (async () => {
        try {
          const numericOrderId = Number(orderId);
          await fetch("/api/email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "order_confirmed",
              ...(Number.isFinite(numericOrderId) ? { orderId: numericOrderId } : {}),
              orderNumber: orderNumber ?? String(orderId),
              clientId: profile?.id,
              clientEmail: profile?.email ?? undefined,
              clientName: profile?.company_name || profile?.contact_name || undefined,
              products: result.items.map((p) => ({
                product_id: p.product_id,
                name: p.name,
                sku: p.sku,
                quantity: p.quantity,
                unit_price: p.unit_price,
                total_price: p.line_total,
              })),
              total: result.total,
            }),
          });
        } catch {
          // Email es non-critical
        }
      })();

      setOrderSuccess(true);
      setCart({});
      setBundleCartMeta({});
      setAppliedCoupon(null);
      setCouponCode("");
      setActiveTab("orders");
      setTimeout(() => setOrderSuccess(false), 5000);
    } catch (err) {
      const message =
        err instanceof BackendError
          ? err.message
          : err instanceof Error
          ? err.message
          : "Error al procesar el pedido";
      toast.error(message);
    } finally {
      setOrderSubmitting(false);
    }
  };

  // ── Quote handlers ────────────────────────────────────────────────────────
  const clientName = profile?.company_name ?? profile?.contact_name ?? "Cliente";

  function handleSaveQuote() {
    if (!cartItems.length) return;
    addQuote({
      client_id: profile?.id || "guest",
      client_name: clientName,
      items: cartItems.map((item) => ({
        product_id: item.product.id,
        name: item.product.name,
        quantity: item.quantity,
        cost: item.cost,
        margin: item.margin,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        ivaRate: item.ivaRate,
        ivaAmount: item.ivaAmount,
        totalWithIVA: item.totalWithIVA,
      })),
      subtotal: cartSubtotal,
      ivaTotal: cartIVATotal,
      total: cartTotal,
      currency,
      status: "draft",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    setActiveTab("quotes");
  }

  function handleLoadQuote(quote: Quote) {
    const newCart: Record<number, number> = {};
    const newMargins: Record<number, number> = {};
    quote.items.forEach((item) => {
      newCart[item.product_id] = item.quantity;
      newMargins[item.product_id] = item.margin;
    });
    setCart(newCart);
    setProductMargins(newMargins);
    navigate("/cart");
    setActiveTab("catalog");
  }

  async function handleDuplicateQuote(id: number, quotes: Quote[]) {
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
  }

  async function handleConvertQuoteToOrder(quote: Quote) {
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
      toast.success("Cotización convertida en pedido correctamente.");
      setActiveTab("orders");
    }
  }

  function handleRepeatOrder(order: PortalOrder) {
    const newCart: Record<number, number> = {};
    for (const p of order.products) {
      const product = products.find((prod) => prod.id === p.product_id);
      if (!product) continue;
      const available = getAvailableStock(product);
      const qty = Math.min(p.quantity, available);
      if (qty > 0) newCart[p.product_id] = qty;
    }
    setCart(newCart);
    navigate("/cart");
    setActiveTab("catalog");
  }

  return {
    // Cart state
    cart, setCart,
    cartItems,
    cartSubtotal, cartIVATotal, cartTotal, cartCount,
    productMargins, globalMargin,
    bundleCartMeta,
    // Coupon
    couponCode, setCouponCode,
    appliedCoupon, couponError, validatingCoupon,
    discountAmount,
    // Order state
    orderSubmitting, orderSuccess, creditError,
    addedIds,
    // Saved
    savedCarts, favoriteProductIds,
    // Analytics
    purchaseHistory, latestPurchaseUnitPrice,
    // Quick order
    quickSku, setQuickSku, quickError,
    // Handlers — cart
    handleAddToCart, handleSmartAddToCart, addBundleToCart, onRemoveFromCart, onMarginChange,
    handleSaveCart, handleSaveNamedCart, handleLoadSavedCart, handleDeleteSavedCart,
    handleToggleFavorite,
    // Handlers — quick order
    handleQuickOrder, handleResolvedQuickOrder,
    // Handlers — coupon
    handleApplyCoupon, handleRemoveCoupon,
    // Handlers — order
    handleConfirmOrder,
    // Handlers — quotes
    handleSaveQuote, handleLoadQuote, handleDuplicateQuote,
    handleConvertQuoteToOrder, handleRepeatOrder,
    // Helpers
    setGlobalMargin,
  };
}
