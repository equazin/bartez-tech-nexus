/**
 * usePortalCart — Manages cart, order submission, and quote lifecycle for the B2B portal.
 */
import { useState, useMemo, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { getAvailableStock } from "@/lib/pricing";
import { getSavedCarts, saveCart, deleteSavedCart, type SavedCart } from "@/lib/savedCarts";
import { getFavoriteProducts, toggleFavoriteProduct } from "@/lib/favoriteProducts";
import { puedeComprar } from "@/lib/api/clientDetail";
import type { Product } from "@/models/products";
import type { PriceResult } from "@/hooks/usePricing";
import type { Quote } from "@/models/quote";
import type { UserProfile } from "@/lib/supabase";
import type { PortalOrder } from "@/hooks/useOrders";

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
  currency: string;
  orders: PortalOrder[];
  addOrder: (order: Omit<PortalOrder, "id" | "client_id" | "client_name">) => Promise<{ error: unknown }>;
  updateOrder: (id: string | number, data: Partial<PortalOrder>) => Promise<unknown>;
  addQuote: (q: Omit<Quote, "id">) => Promise<unknown>;
  updateQuoteStatus: (id: number, status: string) => Promise<unknown>;
  navigate: (path: string) => void;
  setActiveTab: (tab: string) => void;
}

export function usePortalCart({
  profile,
  products,
  computePrice,
  currency,
  orders,
  addOrder,
  updateOrder,
  addQuote,
  updateQuoteStatus,
  navigate,
  setActiveTab,
}: UsePortalCartOptions) {
  const cartKey = `b2b_cart_${profile?.id || "guest"}`;

  // ── Cart state ────────────────────────────────────────────────────────────
  const [cart, setCart] = useState<Record<number, number>>(() => {
    try { return JSON.parse(localStorage.getItem(cartKey) || "{}"); }
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
    if (inCart >= available) return;
    const minQty = product.min_order_qty ?? 1;
    const newQty = inCart === 0 && minQty > 1 ? minQty : inCart + 1;
    const safeQty = Math.min(newQty, available);
    setCart((prev) => ({ ...prev, [product.id]: safeQty }));
    setAddedIds((prev) => new Set(prev).add(product.id));
    setTimeout(() => {
      setAddedIds((prev) => { const s = new Set(prev); s.delete(product.id); return s; });
    }, 900);
  }

  function handleSmartAddToCart(product: Product, qty: number = 1) {
    for (let i = 0; i < qty; i++) handleAddToCart(product);
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
    const available = getAvailableStock(product);
    const inCart = cart[product.id] || 0;
    const toAdd = Math.min(qty, available - inCart);
    if (toAdd <= 0) {
      setQuickError(`Sin stock disponible para ${sku}`);
      setTimeout(() => setQuickError(""), 2500);
      return;
    }
    setCart((prev) => ({ ...prev, [product.id]: (prev[product.id] || 0) + toAdd }));
    setQuickSku("");
    setQuickError("");
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
    const orderProducts = cartItems.map((item) => ({
      product_id: item.product.id,
      name: item.product.name,
      sku: item.product.sku || "",
      quantity: item.quantity,
      cost_price: item.cost,
      unit_price: Number(item.unitPrice.toFixed(2)),
      total_price: Number(item.totalPrice.toFixed(2)),
      margin: item.margin,
    }));

    const { error } = await addOrder({
      products: orderProducts,
      total: Number(cartTotal.toFixed(2)),
      status: "pending",
      coupon_code: (appliedCoupon?.code as string) ?? undefined,
      created_at: new Date().toISOString(),
    });

    if (!error) {
      try {
        await Promise.all(
          cartItems.map((item) =>
            supabase.from("products")
              .update({ stock_reserved: (item.product.stock_reserved ?? 0) + item.quantity })
              .eq("id", item.product.id)
          )
        );
      } catch { /* silencioso */ }
    }

    setOrderSubmitting(false);
    if (!error) {
      setOrderSuccess(true);
      setCart({});
      setAppliedCoupon(null);
      setCouponCode("");
      setActiveTab("orders");
      setTimeout(() => setOrderSuccess(false), 5000);
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
    if (!error && data) {
      await updateQuoteStatus(quote.id, "converted");
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
    handleAddToCart, handleSmartAddToCart, onRemoveFromCart, onMarginChange,
    handleSaveCart, handleSaveNamedCart, handleLoadSavedCart, handleDeleteSavedCart,
    handleToggleFavorite,
    // Handlers — quick order
    handleQuickOrder,
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
