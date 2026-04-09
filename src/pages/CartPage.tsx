import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useProducts } from "@/hooks/useProducts";
import { useOrders } from "@/hooks/useOrders";
import { useQuotes } from "@/hooks/useQuotes";
import { usePricingRules } from "@/hooks/usePricingRules";
import { useCurrency } from "@/context/CurrencyContext";
import { useCartSync } from "@/hooks/useCartSync";
import { generateQuotePdfOnDemand } from "@/lib/quotePdfClient";
import { getAvailableStock } from "@/lib/pricing";
import { resolveMarginWithContext } from "@/lib/pricingEngine";
import { usePricing } from "@/hooks/usePricing";
import { useAppTheme } from "@/hooks/useAppTheme";
import { estimateShipping, type ShippingEstimate } from "@/lib/shipping";
import { getFavoriteProducts, toggleFavoriteProduct } from "@/lib/favoriteProducts";
import { convertMoneyAmount, formatMoneyInPreferredCurrency } from "@/lib/money";
import {
  buildOrderNotes,
  clearCheckoutDraft,
  createEmptyOrderMeta,
  deleteCheckoutTemplate,
  getRecentShippingAddresses,
  readCheckoutTemplates,
  readCheckoutDraft,
  rememberShippingAddress,
  saveCheckoutTemplate,
  saveCheckoutDraft,
  type CheckoutOrderMeta,
  type CheckoutTemplate,
} from "@/lib/cartCheckout";
import { OrderStatusTimeline } from "@/components/OrderStatusTimeline";
import { CheckoutWizard } from "@/components/b2b/checkout/CheckoutWizard";
import type { CartStepProps } from "@/components/b2b/checkout/CartStep";
import type { Product } from "@/models/products";

type CartStepCartItem = CartStepProps["cartItems"][number];
import {
  ArrowLeft, ShoppingCart, AlertTriangle, AlertCircle, Minus, Plus,
  Trash2, FileDown, Bookmark, CheckCircle2, Loader2, TrendingUp,
  Truck, MapPin, FileText, Package2, CreditCard, ToggleLeft, ToggleRight,
  Building2, CalendarDays, UserRound, ShieldAlert, Sparkles, Clock3, Save, ChevronDown,
} from "lucide-react";

// -- Types --------------------------------------------------------------------

interface CartItem {
  product: Product;
  quantity: number;
  cost: number;
  margin: number;
  isVolumePricing: boolean;
  unitPrice: number;       // sin IVA
  totalPrice: number;      // sin IVA x qty
  ivaRate: number;
  ivaAmount: number;
  totalWithIVA: number;
  availableStock: number;
  hasStockError: boolean;  // qty > available
  hasStockWarning: boolean; // stock <= 3
  hasMOQError: boolean;    // qty < min_order_qty
}

type PaymentMethod = "transferencia" | "echeq" | "cuenta_corriente" | "efectivo" | "otro";
type ShippingType  = "retiro" | "envio";
type Transport     = "andreani" | "oca" | "expreso" | "comisionista" | "otro";
type EcheqTermDays = 15 | 30 | 45 | 60;

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  transferencia:    "Transferencia bancaria",
  echeq:            "Echeq",
  cuenta_corriente: "Cuenta corriente",
  efectivo:         "Efectivo",
  otro:             "Otro",
};

const TRANSPORT_LABELS: Record<Transport, string> = {
  andreani:     "Andreani",
  oca:          "OCA",
  expreso:      "Expreso",
  comisionista: "Comisionista",
  otro:         "Otro",
};

const ECHEQ_TERM_OPTIONS: EcheqTermDays[] = [15, 30, 45, 60];
const ECHEQ_SURCHARGE_BY_TERM: Record<EcheqTermDays, number> = {
  15: 2.25,
  30: 4.5,
  45: 6.75,
  60: 9,
};

// -- Component -----------------------------------------------------------------

export default function CartPage() {
  const navigate = useNavigate();
  const { profile, isAdmin, user } = useAuth();
  const { products, loading: productsLoading } = useProducts({ isAdmin });

  // Cart state needs to be declared early so we can use the IDs for targeted fetch
  const userId0 = profile?.id || "guest";
  const cartKey0 = `b2b_cart_${userId0}`;
  const [cartProductsById, setCartProductsById] = useState<Record<number, import("@/models/products").Product>>({});
  const [cartProductsLoading, setCartProductsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchCartProducts() {
      setCartProductsLoading(true);
      try {
        const storedCart: Record<number, number> = JSON.parse(localStorage.getItem(cartKey0) || "{}");
        const ids = Object.keys(storedCart).map(Number).filter(Boolean);
        if (ids.length === 0) { setCartProductsById({}); setCartProductsLoading(false); return; }
        const tableName = isAdmin ? "products" : "portal_products";
        const { data } = await supabase.from(tableName).select("*").in("id", ids);
        if (!cancelled && data) {
          const byId: Record<number, import("@/models/products").Product> = {};
          (data as import("@/models/products").Product[]).forEach((p) => { byId[p.id] = p; });
          setCartProductsById(byId);
        }
      } finally {
        if (!cancelled) setCartProductsLoading(false);
      }
    }
    void fetchCartProducts();
    return () => { cancelled = true; };
  }, [cartKey0, isAdmin]);

  const { computePrice } = usePricing(profile);
  const { addOrder, orders } = useOrders();
  const { addQuote } = useQuotes(profile?.id || "guest");
  const { rules: pricingRules } = usePricingRules();
  const {
    currency, formatPrice, formatUSD, formatARS, exchangeRate, convertPrice,
  } = useCurrency();

  const userId = profile?.id || "guest";
  const cartKey     = `b2b_cart_${userId}`;
  const globalMargin = profile?.default_margin ?? 20;
  const clientName  = profile?.company_name ?? profile?.contact_name ?? "Cliente";

  // -- Cart state (synced to localStorage) -------------------------------------
  const [cart, setCart] = useState<Record<number, number>>(() => {
    try { return JSON.parse(localStorage.getItem(cartKey) || "{}"); }
    catch { return {}; }
  });
  useEffect(() => {
    localStorage.setItem(cartKey, JSON.stringify(cart));
  }, [cart, cartKey]);
  useCartSync(cart, setCart);

  useEffect(() => {
    setFavoriteProductIds(getFavoriteProducts(userId));
    setRecentShippingAddresses(getRecentShippingAddresses(userId));
    setCheckoutTemplates(readCheckoutTemplates(userId));
    setSavedDraftAt(readCheckoutDraft(userId)?.savedAt ?? null);
  }, [userId]);

  // -- Theme --------------------------------------------------------------------
  const { isDark } = useAppTheme();
  const dk = (d: string, l: string) => (isDark ? d : l);

  // -- Reseller mode ------------------------------------------------------------
  const [resellerMode,   setResellerMode]   = useState(false);
  const [resellerMargin, setResellerMargin] = useState(15);

  // -- Payment ------------------------------------------------------------------
  const [paymentMethod,   setPaymentMethod]   = useState<PaymentMethod>("transferencia");
  const [echeqTermDays, setEcheqTermDays] = useState<EcheqTermDays>(30);
  const [currentAccountSharePct, setCurrentAccountSharePct] = useState(100);

  // -- Shipping -----------------------------------------------------------------
  const [shippingType,      setShippingType]      = useState<ShippingType>("retiro");
  const [shippingAddress,   setShippingAddress]   = useState("");
  const [shippingTransport, setShippingTransport] = useState<Transport>("andreani");
  const [shippingCost,      setShippingCost]      = useState("");
  const [postalCode,        setPostalCode]        = useState("");
  const [shippingPaymentType, setShippingPaymentType] = useState<"origen" | "destino">("origen");
  const [shippingEstimates, setShippingEstimates] = useState<ShippingEstimate[]>([]);
  const [estimating,        setEstimating]        = useState(false);

  // -- Notes --------------------------------------------------------------------
  const [notes, setNotes] = useState("");
  const [orderMeta, setOrderMeta] = useState<CheckoutOrderMeta>(() => createEmptyOrderMeta());
  const [favoriteProductIds, setFavoriteProductIds] = useState<number[]>([]);
  const [recentShippingAddresses, setRecentShippingAddresses] = useState<string[]>([]);
  const [checkoutTemplates, setCheckoutTemplates] = useState<CheckoutTemplate[]>([]);
  const [savedDraftAt, setSavedDraftAt] = useState<string | null>(null);
  const [draftSaved, setDraftSaved] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateSaved, setTemplateSaved] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewRequested, setReviewRequested] = useState(false);

  // -- UI -----------------------------------------------------------------------
  const [orderSubmitting,   setOrderSubmitting]   = useState(false);
  const [orderSuccess,      setOrderSuccess]      = useState(false);
  const [validationErrors,  setValidationErrors]  = useState<string[]>([]);
  const [listSaved,         setListSaved]         = useState(false);
  const [checkoutMode, setCheckoutMode] = useState<"direct" | "advanced">("direct");
  const [showSaveTools, setShowSaveTools] = useState(false);

  useEffect(() => {
    setShowSaveTools(checkoutMode === "advanced");
  }, [checkoutMode]);

  // -- Cart items - per-product pricing rules applied ---------------------------
  const cartItems: CartItem[] = useMemo(() => {
    return Object.entries(cart)
      .map(([id, qty]) => {
        const product = cartProductsById[Number(id)] ?? products.find((p) => p.id === Number(id));
        if (!product) return null;
        
        const price = computePrice(product, qty);
        
        const availableStock = getAvailableStock(product);
        const minQty = product.min_order_qty ?? product.stock_min ?? 0;
        
        return {
          product,
          quantity: qty,
          cost: price.cost,
          margin: price.margin,
          isVolumePricing: price.isVolumePricing,
          unitPrice: price.unitPrice,
          totalPrice: price.totalPrice,
          ivaRate: price.ivaRate,
          ivaAmount: price.ivaAmount,
          totalWithIVA: price.totalWithIVA,
          availableStock,
          hasStockError: qty > availableStock && availableStock >= 0,
          hasStockWarning: qty <= availableStock && availableStock > 0 && availableStock <= 3,
          hasMOQError: minQty > 0 && qty < minQty,
        };
      })
      .filter((i): i is CartItem => i !== null);
  }, [cart, cartProductsById, products, computePrice]);

  const cartSubtotal     = useMemo(() => cartItems.reduce((s, i) => s + i.totalPrice, 0), [cartItems]);
  const cartIVATotal     = useMemo(() => cartItems.reduce((s, i) => s + i.ivaAmount,  0), [cartItems]);
  const cartBaseTotal    = cartSubtotal + cartIVATotal;
  const paymentSurchargePct = paymentMethod === "echeq" ? ECHEQ_SURCHARGE_BY_TERM[echeqTermDays] : 0;
  const surchargeAmt     = cartBaseTotal * (paymentSurchargePct / 100);
  const shippingCostInputNum = Number(shippingCost || 0);
  const shippingCostBaseUsd = (shippingType === "envio" && shippingPaymentType === "origen")
    ? (currency === "ARS" ? shippingCostInputNum / exchangeRate.rate : shippingCostInputNum)
    : 0;
  const grandTotal       = cartBaseTotal + surchargeAmt + shippingCostBaseUsd;
  const resellerProfit   = cartSubtotal * (resellerMargin / 100);

  // -- Qty helpers --------------------------------------------------------------
  function addQty(productId: number) {
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    const available = getAvailableStock(product);
    setCart((prev) => {
      const nextQty = Math.min((prev[productId] || 0) + 1, Math.max(available, 1));
      return { ...prev, [productId]: nextQty };
    });
  }
  function removeQty(productId: number) {
    setCart((prev) => {
      const qty = prev[productId] || 0;
      if (qty <= 1) {
        const next = { ...prev };
        delete next[productId];
        return next;
      }
      return { ...prev, [productId]: qty - 1 };
    });
  }
  function setQty(productId: number, qty: number) {
    if (qty <= 0) {
      const next = { ...cart };
      delete next[productId];
      setCart(next);
    } else {
      setCart((prev) => ({ ...prev, [productId]: qty }));
    }
  }
  function removeItem(productId: number) {
    const next = { ...cart };
    delete next[productId];
    setCart(next);
  }

  async function handleClearCart() {
    if (cartItems.length === 0) return;
    const confirmed = window.confirm("Esto va a vaciar el carrito completo. ¿Querés continuar?");
    if (!confirmed) return;

    setCart({});
    setValidationErrors([]);
    setOrderSuccess(false);
    setListSaved(false);
    setTemplateSaved(false);
    setDraftSaved(false);
    setReviewRequested(false);

    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from("carts")
        .upsert({
          user_id: user.id,
          items: {},
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
    } catch (error) {
      console.error("No se pudo vaciar el carrito remoto:", error);
    }
  }

  // -- Credit limit -------------------------------------------------------------
  const creditLimitArs = profile?.credit_limit;
  const creditUsedArs = useMemo(() => {
    if (typeof profile?.credit_used === "number") {
      return profile.credit_used;
    }
    return orders
      .filter((o) => o.status === "pending" || o.status === "approved")
      .reduce((sum, order) => sum + convertMoneyAmount(order.total ?? 0, "USD", "ARS", exchangeRate.rate), 0);
  }, [exchangeRate.rate, orders, profile?.credit_used]);
  // credit_limit === 0 means "unlimited / not configured" - no restriction applied
  const creditAvailableArs = (creditLimitArs != null && creditLimitArs > 0)
    ? Math.max(0, creditLimitArs - creditUsedArs)
    : null;
  const currentAccountAmount = paymentMethod === "cuenta_corriente"
    ? grandTotal * (currentAccountSharePct / 100)
    : 0;
  const transferAmount = paymentMethod === "cuenta_corriente"
    ? Math.max(0, grandTotal - currentAccountAmount)
    : 0;
  const currentAccountAmountArs = convertMoneyAmount(currentAccountAmount, "USD", "ARS", exchangeRate.rate);
  const projectedCreditRemainingArs = creditAvailableArs != null
    ? Math.max(0, creditAvailableArs - currentAccountAmountArs)
    : null;
  const creditAvailableDisplay = creditAvailableArs != null
    ? formatPrice(creditAvailableArs, "ARS")
    : "Sin limite";
  const projectedCreditRemainingDisplay = projectedCreditRemainingArs != null
    ? formatPrice(projectedCreditRemainingArs, "ARS")
    : "Sin limite";
  const clientPaymentTerms = profile?.payment_terms ?? 30;
  const maxCurrentAccountSharePct = creditAvailableArs != null && grandTotal > 0
    ? Math.max(0, Math.min(100, Math.floor((creditAvailableArs / convertMoneyAmount(grandTotal, "USD", "ARS", exchangeRate.rate)) * 100)))
    : 100;
  const paymentSummaryLabel = paymentMethod === "echeq"
    ? `Echeq ${echeqTermDays} días`
    : paymentMethod === "cuenta_corriente"
      ? `${currentAccountSharePct}% cta. cte. / ${100 - currentAccountSharePct}% transferencia`
      : PAYMENT_LABELS[paymentMethod];
  const paymentDetailNote = paymentMethod === "echeq"
    ? `Pago seleccionado: Echeq ${echeqTermDays} días con ${paymentSurchargePct.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% de recargo.`
    : paymentMethod === "cuenta_corriente"
      ? `Pago seleccionado: ${currentAccountSharePct}% cuenta corriente (${clientPaymentTerms} días) y ${100 - currentAccountSharePct}% transferencia.`
      : `Pago seleccionado: ${PAYMENT_LABELS[paymentMethod]}.`;
  const totalUnits = useMemo(() => cartItems.reduce((sum, item) => sum + item.quantity, 0), [cartItems]);
  const totalWeightKg = useMemo(
    () => cartItems.reduce((sum, item) => sum + (item.product.weight_kg ?? 0.5) * item.quantity, 0),
    [cartItems]
  );
  const purchaseHistory = useMemo(() => {
    const map: Record<number, number> = {};
    orders.forEach((order) => {
      order.products.forEach((product) => {
        map[product.product_id] = (map[product.product_id] ?? 0) + product.quantity;
      });
    });
    return map;
  }, [orders]);
  const productLookup = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const cartIds = useMemo(() => new Set(cartItems.map((item) => item.product.id)), [cartItems]);
  const cartCategories = useMemo(() => new Set(cartItems.map((item) => item.product.category)), [cartItems]);
  const cartBrands = useMemo(
    () => new Set(cartItems.map((item) => item.product.brand_id).filter(Boolean)),
    [cartItems]
  );
  const companionScores = useMemo(() => {
    const scores: Record<number, number> = {};
    orders.forEach((order) => {
      const hasCartMatch = order.products.some((product) => cartIds.has(product.product_id));
      if (!hasCartMatch) return;
      order.products.forEach((product) => {
        if (!cartIds.has(product.product_id)) {
          scores[product.product_id] = (scores[product.product_id] ?? 0) + product.quantity;
        }
      });
    });
    return scores;
  }, [cartIds, orders]);
  const selectedShippingEstimate = shippingEstimates.find((estimate) => estimate.carrier === shippingTransport);
  const suggestionSections = useMemo(() => {
    if (cartItems.length === 0) return [];

    const used = new Set<number>();
    const toProducts = (ids: number[]) =>
      ids
        .map((id) => productLookup.get(id))
        .filter((product): product is Product => Boolean(product))
        .filter((product) => !cartIds.has(product.id) && !used.has(product.id) && getAvailableStock(product) > 0)
        .slice(0, 4)
        .map((product) => {
          used.add(product.id);
          return product;
        });

    const recurrent = Object.entries(purchaseHistory)
      .sort(([, a], [, b]) => b - a)
      .map(([id]) => Number(id));

    const together = Object.entries(companionScores)
      .sort(([, a], [, b]) => b - a)
      .map(([id]) => Number(id));

    const typicalMissing = products
      .filter((product) =>
        favoriteProductIds.includes(product.id) ||
        cartCategories.has(product.category) ||
        (product.brand_id != null && cartBrands.has(product.brand_id))
      )
      .sort((a, b) => (purchaseHistory[b.id] ?? 0) - (purchaseHistory[a.id] ?? 0))
      .map((product) => product.id);

    return [
      {
        key: "recurrent",
        title: "Lo que comprás siempre",
        helper: "Basado en tu historial reciente.",
        products: toProducts(recurrent),
      },
      {
        key: "together",
        title: "Lo que suele ir junto",
        helper: "Productos que aparecieron en pedidos similares.",
        products: toProducts(together),
      },
      {
        key: "missing",
        title: "Faltantes típicos",
        helper: "Favoritos o referencias que suelen acompañar este pedido.",
        products: toProducts(typicalMissing),
      },
    ].filter((section) => section.products.length > 0);
  }, [cartBrands, cartCategories, cartIds, cartItems.length, companionScores, favoriteProductIds, productLookup, products, purchaseHistory]);
  const blockingIssues = useMemo(() => {
    const issues: string[] = [];
    cartItems.forEach((item) => {
      if (item.product.stock === 0) {
        issues.push(`${item.product.name}: sin stock disponible.`);
      } else if (item.hasStockError) {
        issues.push(`${item.product.name}: solo ${item.availableStock} unidades disponibles.`);
      }
      const minQty = item.product.min_order_qty ?? item.product.stock_min ?? 0;
      if (minQty > 0 && item.quantity < minQty) {
        issues.push(`${item.product.name}: pedido mínimo ${minQty} unidades.`);
      }
    });
    if (shippingType === "envio" && !shippingAddress.trim()) {
      issues.push("Completá la dirección de entrega para coordinar el envío.");
    }
    if (paymentMethod === "cuenta_corriente" && creditAvailableArs != null && currentAccountAmountArs > creditAvailableArs) {
      issues.push(`Crédito insuficiente. Disponible: ${creditAvailableDisplay} - solicitado en cuenta corriente: ${formatPrice(currentAccountAmountArs, "ARS")}.`);
    }
    if (shippingType === "envio" && !postalCode.trim()) {
      issues.push("Indicá el código postal para validar logística y costo.");
    }
    if (paymentMethod === "cuenta_corriente" && currentAccountSharePct > 0 && creditAvailableArs === 0) {
      issues.push("No tenés saldo disponible en cuenta corriente para este mix de pago.");
    }
    return issues;
  }, [cartItems, creditAvailableArs, creditAvailableDisplay, currency, currentAccountAmountArs, currentAccountSharePct, exchangeRate.rate, paymentMethod, postalCode, shippingAddress, shippingType]);
  const warningIssues = useMemo(() => {
    const issues: string[] = [];
    cartItems.forEach((item) => {
      if (!item.hasStockError && item.hasStockWarning) {
        issues.push(`${item.product.name}: quedan ${item.availableStock} unidades disponibles.`);
      }
      if (item.isVolumePricing) {
        issues.push(`${item.product.name}: tiene precio por volumen aplicado.`);
      }
    });
    if (shippingType === "envio" && postalCode.trim() && shippingEstimates.length === 0) {
      issues.push("Estimá el envío para ver transportes y tiempos sugeridos.");
    }
    if (paymentMethod === "cuenta_corriente" && creditAvailableArs != null && projectedCreditRemainingArs != null && projectedCreditRemainingArs <= creditAvailableArs * 0.15) {
      issues.push("El pedido deja muy poco crédito disponible. Conviene revisión comercial.");
    }
    if (orderMeta.requestedDate) {
      const requestedTimestamp = new Date(orderMeta.requestedDate).getTime();
      if (Number.isFinite(requestedTimestamp) && requestedTimestamp < new Date().setHours(0, 0, 0, 0)) {
        issues.push("La fecha requerida quedó en el pasado. Revisala antes de confirmar.");
      }
    }
    if (shippingType === "envio" && shippingCostInputNum <= 0) {
      issues.push("Definí el costo de envío o elegí una tarifa estimada antes de cerrar.");
    }
    if (shippingType === "envio" && !orderMeta.receiverContact.trim()) {
      issues.push("Sumá un contacto receptor para agilizar la entrega.");
    }
    if (paymentMethod === "echeq" && echeqTermDays > clientPaymentTerms) {
      issues.push(`El echeq seleccionado supera tu plazo habitual de ${clientPaymentTerms} días.`);
    }
    return issues;
  }, [cartItems, clientPaymentTerms, creditAvailableArs, echeqTermDays, orderMeta.receiverContact, orderMeta.requestedDate, paymentMethod, postalCode, projectedCreditRemainingArs, shippingCostInputNum, shippingEstimates.length, shippingType]);

  // -- Shipping estimation ------------------------------------------------------
  function handleEstimateShipping() {
    const cp = postalCode.trim();
    if (!cp) return;
    setEstimating(true);
    const items = cartItems.map((i) => ({
      weight_kg: i.product.weight_kg ?? 0.5,
      quantity:  i.quantity,
    }));
    const estimates = estimateShipping(items, cp, exchangeRate.rate, cartSubtotal);
    setShippingEstimates(estimates);
    setEstimating(false);
    if (estimates.length > 0) {
      setShippingTransport(estimates[0].carrier as Transport);
      setShippingCost(String(currency === "ARS" ? Math.round(estimates[0].price_usd * exchangeRate.rate) : estimates[0].price_usd));
    }
  }

  function updateOrderMeta<K extends keyof CheckoutOrderMeta>(key: K, value: CheckoutOrderMeta[K]) {
    setOrderMeta((prev) => ({ ...prev, [key]: value }));
  }

  function handleToggleFavorite(productId: number) {
    setFavoriteProductIds(toggleFavoriteProduct(userId, productId));
  }

  function handleSaveDraft() {
    const savedDraft = saveCheckoutDraft(userId, {
      cart,
      resellerMode,
      resellerMargin,
      paymentMethod,
      echeqTermDays,
      currentAccountSharePct,
      shippingType,
      shippingAddress,
      shippingTransport,
      shippingCost,
      postalCode,
      notes,
      orderMeta,
      savedAt: new Date().toISOString(),
    });
    if (shippingType === "envio" && shippingAddress.trim()) {
      setRecentShippingAddresses(rememberShippingAddress(userId, shippingAddress));
    }
    setSavedDraftAt(savedDraft.savedAt);
    setDraftSaved(true);
    setTimeout(() => setDraftSaved(false), 2500);
  }

  function handleRestoreDraft() {
    const draft = readCheckoutDraft(userId);
    if (!draft) return;
    setCart(draft.cart);
    setResellerMode(draft.resellerMode);
    setResellerMargin(draft.resellerMargin);
    setPaymentMethod(draft.paymentMethod as PaymentMethod);
    setEcheqTermDays((ECHEQ_TERM_OPTIONS.includes(draft.echeqTermDays as EcheqTermDays) ? draft.echeqTermDays : 30) as EcheqTermDays);
    setCurrentAccountSharePct(Math.min(100, Math.max(0, draft.currentAccountSharePct ?? 100)));
    setShippingType(draft.shippingType as ShippingType);
    setShippingAddress(draft.shippingAddress);
    setShippingTransport(draft.shippingTransport as Transport);
    setShippingCost(draft.shippingCost);
    setPostalCode(draft.postalCode);
    setNotes(draft.notes);
    setOrderMeta({
      ...createEmptyOrderMeta(),
      ...draft.orderMeta,
    });
    setSavedDraftAt(draft.savedAt);
    setValidationErrors([]);
  }

  function clearSavedDraft() {
    clearCheckoutDraft(userId);
    setSavedDraftAt(null);
  }

  function validateCheckout(): string[] {
    const errs: string[] = [];
    if (cartItems.length === 0) errs.push("El carrito está vacío.");
    errs.push(...blockingIssues);
    return errs;
  }

  // -- Validation ---------------------------------------------------------------
  function validate(): string[] {
    const errs: string[] = [];
    if (cartItems.length === 0) errs.push("El carrito está vacío.");
    cartItems.forEach((item) => {
      if (item.product.stock === 0) {
        errs.push(`${item.product.name}: sin stock disponible.`);
      } else if (item.hasStockError) {
        errs.push(`${item.product.name}: solo ${item.availableStock} unidades disponibles.`);
      }
      const minQty = item.product.min_order_qty ?? item.product.stock_min ?? 0;
      if (minQty > 0 && item.quantity < minQty) {
        errs.push(`${item.product.name}: pedido mínimo ${minQty} unidades.`);
      }
    });
    if (paymentMethod === "cuenta_corriente" && creditAvailableArs != null && currentAccountAmountArs > creditAvailableArs) {
      errs.push(`Límite de crédito insuficiente. Disponible: ${creditAvailableDisplay}, pedido en cuenta corriente: ${formatMoneyInPreferredCurrency(currentAccountAmountArs, "ARS", currency, exchangeRate.rate, 0)}.`);
    }
    return errs;
  }

  // -- Confirm order -------------------------------------------------------------
  async function handleConfirmOrder() {
    const errs = validateCheckout();
    if (errs.length) { setValidationErrors(errs); return; }
    setValidationErrors([]);
    setOrderSubmitting(true);
    const shippingNote = shippingPaymentType === "destino" 
      ? `Envío: Pago en destino por el cliente a través de ${TRANSPORT_LABELS[shippingTransport]}.`
      : "";
    const compiledNotes = [paymentDetailNote, shippingNote, buildOrderNotes(notes, orderMeta)].filter(Boolean).join("\n\n");

    const orderProducts = cartItems.map((item) => ({
      product_id:  item.product.id,
      name:        item.product.name,
      sku:         item.product.sku || "",
      quantity:    item.quantity,
      cost_price:  item.cost,
      unit_price:  Number(item.unitPrice.toFixed(2)),
      total_price: Number(item.totalPrice.toFixed(2)),
      margin:      item.margin,
    }));

    const { error } = await addOrder({
      products:              orderProducts,
      total:                 Number(grandTotal.toFixed(2)),
      status:                "pending",
      payment_method:        paymentMethod,
      payment_surcharge_pct: paymentSurchargePct || undefined,
      shipping_type:         shippingType,
      shipping_address:      shippingType === "envio" ? shippingAddress || undefined : undefined,
      shipping_transport:    shippingType === "envio" ? shippingTransport : undefined,
      shipping_cost:         shippingType === "envio" && shippingCostBaseUsd > 0 ? Number(shippingCostBaseUsd.toFixed(2)) : undefined,
      notes:                 compiledNotes || undefined,
      created_at:            new Date().toISOString(),
    });

    setOrderSubmitting(false);
    if (!error) {
      if (shippingType === "envio" && shippingAddress.trim()) {
        setRecentShippingAddresses(rememberShippingAddress(userId, shippingAddress));
      }
      clearCheckoutDraft(userId);
      setSavedDraftAt(null);
      setOrderSuccess(true);
      setCart({});
      setTimeout(() => navigate("/b2b-portal"), 2200);
    } else {
      setValidationErrors([`Error al confirmar pedido: ${error}`]);
    }
  }

  // -- Save quote ----------------------------------------------------------------
  async function handleSaveQuote() {
    if (!cartItems.length) return;
    const now = new Date();
    const compiledNotes = [paymentDetailNote, buildOrderNotes(notes, orderMeta)].filter(Boolean).join("\n\n");
    const expiresAt = new Date(now.getTime() + orderMeta.quoteValidityDays * 24 * 60 * 60 * 1000).toISOString();
    await addQuote({
      client_id:   userId,
      client_name: clientName,
      items: cartItems.map((item) => ({
        product_id:   item.product.id,
        name:         item.product.name,
        quantity:     item.quantity,
        cost:         item.cost,
        margin:       item.margin,
        unitPrice:    item.unitPrice,
        totalPrice:   item.totalPrice,
        ivaRate:      item.ivaRate,
        ivaAmount:    item.ivaAmount,
        totalWithIVA: item.totalWithIVA,
      })),
      subtotal:    cartSubtotal,
      ivaTotal:    cartIVATotal,
      total:       cartBaseTotal,
      currency,
      status:      "draft",
      notes:       compiledNotes || undefined,
      valid_days:  orderMeta.quoteValidityDays,
      expires_at:  expiresAt,
      created_at:  now.toISOString(),
      updated_at:  now.toISOString(),
    });
    navigate("/b2b-portal?tab=quotes");
  }

  // -- Export PDF ----------------------------------------------------------------
  async function handleExportPDF() {
    const extraMarginFactor = resellerMode ? (1 + resellerMargin / 100) : 1;
    const isWhiteLabel = resellerMode;
    const exportClientName = orderMeta.finalClientName.trim() || clientName;
    const exportCompanyName = isWhiteLabel ? exportClientName : "Bartez Tecnología";
    const paymentTerms = paymentMethod === "echeq"
      ? `${paymentSummaryLabel} + ${paymentSurchargePct.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
      : paymentMethod === "cuenta_corriente" && currentAccountSharePct === 100
        ? `Cuenta corriente - ${clientPaymentTerms} dias`
        : paymentSummaryLabel;
    const deliveryTerms = shippingType === "envio"
      ? `${selectedShippingEstimate?.label || TRANSPORT_LABELS[shippingTransport]} - ${shippingAddress || "Dirección a confirmar"}`
      : `Retiro en sucursal${orderMeta.branchName ? ` - ${orderMeta.branchName}` : ""}`;

    await generateQuotePdfOnDemand({
      clientName: exportClientName,
      companyName: exportCompanyName,
      whiteLabel: isWhiteLabel,
      currency,
      products: cartItems.map((item) => ({
        name:         item.product.name,
        quantity:     item.quantity,
        price:        Number(convertPrice(item.unitPrice * extraMarginFactor).toFixed(2)),
        total:        Number(convertPrice(item.totalPrice * extraMarginFactor).toFixed(2)),
        ivaRate:      item.ivaRate,
        ivaAmount:    Number(convertPrice(item.ivaAmount).toFixed(2)),
        totalWithIVA: Number(convertPrice(
          item.totalPrice * extraMarginFactor + item.ivaAmount
        ).toFixed(2)),
      })),
      total:    Number(convertPrice(
        resellerMode
          ? cartSubtotal * (1 + resellerMargin / 100) + cartIVATotal
          : cartBaseTotal
      ).toFixed(2)),
      subtotal: Number(convertPrice(cartSubtotal).toFixed(2)),
      ivaTotal: Number(convertPrice(cartIVATotal).toFixed(2)),
      date:     new Date().toLocaleDateString("es-AR"),
      validityDays: orderMeta.quoteValidityDays,
      paymentTerms,
      deliveryTerms,
      showCost: false,
      iva:      true,
    });
  }

  async function handleRequestReview() {
    if (!cartItems.length) return;
    setReviewRequested(false);
    setReviewSubmitting(true);
    const now = new Date();
    const compiledNotes = [paymentDetailNote, buildOrderNotes(notes, orderMeta)].filter(Boolean).join("\n\n");
    const expiresAt = new Date(now.getTime() + orderMeta.quoteValidityDays * 24 * 60 * 60 * 1000).toISOString();

    const quote = await addQuote({
      client_id:   userId,
      client_name: clientName,
      items: cartItems.map((item) => ({
        product_id:   item.product.id,
        name:         item.product.name,
        quantity:     item.quantity,
        cost:         item.cost,
        margin:       item.margin,
        unitPrice:    item.unitPrice,
        totalPrice:   item.totalPrice,
        ivaRate:      item.ivaRate,
        ivaAmount:    item.ivaAmount,
        totalWithIVA: item.totalWithIVA,
      })),
      subtotal:    cartSubtotal,
      ivaTotal:    cartIVATotal,
      total:       cartBaseTotal,
      currency,
      status:      "sent",
      notes:       compiledNotes || undefined,
      valid_days:  orderMeta.quoteValidityDays,
      expires_at:  expiresAt,
      created_at:  now.toISOString(),
      updated_at:  now.toISOString(),
    });

    setReviewSubmitting(false);
    if (quote) {
      setReviewRequested(true);
      setValidationErrors([]);
      navigate("/b2b-portal?tab=quotes");
    }
  }

  // -- Save as list (template) ---------------------------------------------------
  function handleSaveList() {
    if (!cartItems.length) return;
    const listsKey = `b2b_saved_lists_${userId}`;
    interface SavedList { id: string; name: string; cart: Record<number, number>; created_at: string; }
    let lists: SavedList[] = [];
    try { lists = JSON.parse(localStorage.getItem(listsKey) || "[]"); } catch { /* ignore */ }
    const name = `Lista ${new Date().toLocaleDateString("es-AR")} - ${cartItems.length} productos`;
    lists.unshift({ id: Date.now().toString(), name, cart, created_at: new Date().toISOString() });
    localStorage.setItem(listsKey, JSON.stringify(lists.slice(0, 20)));
    setListSaved(true);
    setTimeout(() => setListSaved(false), 2500);
  }

  function handleSaveTemplate() {
    if (!cartItems.length) return;
    const nextTemplates = saveCheckoutTemplate(userId, {
      name: templateName.trim() || `Plantilla ${orderMeta.branchName || profile?.client_type || "general"}`,
      clientType: profile?.client_type ?? "cliente",
      branchName: orderMeta.branchName.trim() || "General",
      paymentMethod,
      shippingType,
      shippingTransport,
      cart,
      notes,
      orderMeta,
    });
    setCheckoutTemplates(nextTemplates);
    setTemplateName("");
    setTemplateSaved(true);
    setTimeout(() => setTemplateSaved(false), 2500);
  }

  function handleApplyTemplate(template: CheckoutTemplate) {
    setCart(template.cart);
    setPaymentMethod(template.paymentMethod as PaymentMethod);
    setShippingType(template.shippingType as ShippingType);
    setShippingTransport(template.shippingTransport as Transport);
    setNotes(template.notes);
    setOrderMeta({
      ...createEmptyOrderMeta(),
      ...template.orderMeta,
      branchName: template.branchName,
    });
  }

  function handleDeleteTemplate(templateId: string) {
    setCheckoutTemplates(deleteCheckoutTemplate(userId, templateId));
  }

  // -- Success screen ------------------------------------------------------------
  if (orderSuccess) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${dk("bg-[#0a0a0a]", "bg-[#f5f5f5]")}`}>
        <div className={`w-full max-w-3xl rounded-2xl border px-6 py-8 ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
          <CheckCircle2 size={52} className="text-[#2D9F6A] mx-auto mb-4" />
          <div className="mt-6">
            <OrderStatusTimeline status="pending" compact />
          </div>
          <h2 className={`text-xl font-bold mb-2 text-center ${dk("text-white", "text-[#171717]")}`}>
            ¡Pedido confirmado!
          </h2>
          <p className="text-sm text-gray-500">Redirigiendo a tus pedidos...</p>
        </div>
      </div>
    );
  }

  const hasBlockingErrors = blockingIssues.length > 0;
  const hasWarnings = warningIssues.length > 0;
  const showAdvancedSections = checkoutMode === "advanced";

  // -- Render --------------------------------------------------------------------
  return (
    <div className="dashboard-stage min-h-screen bg-background px-2 py-2 md:px-4 md:py-4">
      <div className="dashboard-canvas min-h-[calc(100vh-1rem)] overflow-hidden">

      {/* -- Header ----------------------------------------------------------- */}
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border/70 bg-card/90 px-4 py-3 backdrop-blur md:px-6">
        <button
          onClick={() => navigate("/b2b-portal")}
          className={`flex items-center gap-1.5 text-sm transition ${dk("text-gray-500 hover:text-white", "text-gray-500 hover:text-[#171717]")}`}
        >
          <ArrowLeft size={15} />
          <span>Catálogo</span>
        </button>
        <div className={`w-px h-4 ${dk("bg-[#262626]", "bg-[#e5e5e5]")}`} />
        <div className="flex items-center gap-2">
          <ShoppingCart size={15} className="text-[#2D9F6A]" />
          <span className="text-sm font-bold">Pedido</span>
          {cartItems.length > 0 && (
            <button
              type="button"
              onClick={() => { void handleClearCart(); }}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${dk("border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/15", "border-red-200 bg-red-50 text-red-700 hover:bg-red-100")}`}
            >
              <Trash2 size={12} />
              Vaciar carrito
            </button>
          )}
          {cartItems.length > 0 && (
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${dk("bg-[#171717] text-[#737373] border-[#222]", "bg-[#f0f0f0] text-[#737373] border-[#e5e5e5]")}`}>
                {cartItems.reduce((s, i) => s + i.quantity, 0)} {cartItems.reduce((s, i) => s + i.quantity, 0) === 1 ? "ítem" : "ítems"} · {cartItems.length} {cartItems.length === 1 ? "ref" : "refs"}
              </span>
          )}
        </div>
        {hasBlockingErrors && (
          <span className="ml-auto flex items-center gap-1 text-xs text-red-400">
            <AlertCircle size={12} /> Stock insuficiente
          </span>
        )}
        {!hasBlockingErrors && hasWarnings && (
          <span className="ml-auto flex items-center gap-1 text-xs text-amber-400">
            <AlertTriangle size={12} /> Revisar stock / mínimos
          </span>
        )}
      </header>

      {/* -- Draft & Templates Bar ------------------------------------------------ */}
      {(checkoutTemplates.length > 0 || savedDraftAt) && (
        <div className="mx-auto max-w-[1680px] px-4 md:px-6 pt-4 flex flex-wrap items-center gap-3">
          {savedDraftAt && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${dk("bg-amber-500/10 border-amber-500/20 text-amber-300", "bg-amber-50 border-amber-200 text-amber-800")} text-[11px] font-medium`}>
              <Save size={13} className="text-amber-500" />
              Borrador recuperable: {new Date(savedDraftAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
              <button type="button" onClick={handleRestoreDraft} className="ml-1 px-2 py-0.5 rounded bg-amber-500 text-white font-bold transition hover:bg-amber-600">Cargar</button>
              <button type="button" onClick={clearSavedDraft} className="ml-1 opacity-70 hover:opacity-100 transition"><Trash2 size={12} /></button>
            </div>
          )}
          {checkoutTemplates.length > 0 && (
            <div className="relative group">
              <button type="button" className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[11px] font-semibold transition ${dk("bg-[#1a1a1a] border-[#2a2a2a] text-white hover:border-[#3a3a3a]", "bg-white border-[#e5e5e5] text-[#171717] hover:border-[#ccc]")}`}>
                <Bookmark size={13} className="text-[#2D9F6A]" />
                Mis Plantillas ({checkoutTemplates.length})
                <ChevronDown size={11} className="opacity-50" />
              </button>
              <div className={`absolute top-full mt-1 w-64 rounded-xl border shadow-xl z-20 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 ${dk("bg-[#111] border-[#222]", "bg-white border-[#e5e5e5]")}`}>
                <div className="py-2 flex flex-col max-h-[300px] overflow-y-auto">
                  {checkoutTemplates.map((t) => (
                    <div key={t.id} className={`px-4 py-2.5 flex flex-col gap-1 border-b last:border-0 cursor-pointer transition ${dk("hover:bg-white/5 border-[#222]", "hover:bg-black/5 border-[#f5f5f5]")}`} onClick={() => { if(window.confirm("¿Reemplazar carrito actual con la plantilla?")) handleApplyTemplate(t); }}>
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-[12px] text-[#2D9F6A] truncate">{t.name}</span>
                        <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(t.id); }} className="text-red-500/70 hover:text-red-500 p-1"><Trash2 size={12}/></button>
                      </div>
                      <span className="text-[10px] text-gray-500 text-left">
                        {Object.keys(t.cart).length} {Object.keys(t.cart).length === 1 ? 'ítem' : 'ítems'} • Creada el {new Date(t.createdAt).toLocaleDateString("es-AR")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* -- Reseller Mode Settings ---------------------------------------------- */}
      <div className={`mx-auto max-w-[1680px] px-4 md:px-6 ${checkoutTemplates.length > 0 || savedDraftAt ? 'mt-3' : 'mt-4'}`}>
        <div className={`flex flex-wrap items-center gap-4 px-4 py-3 rounded-xl border transition-all ${resellerMode ? dk("bg-[#2D9F6A]/10 border-[#2D9F6A]/30", "bg-green-50 border-green-200") : dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className={resellerMode ? "text-[#2D9F6A]" : dk("text-gray-500", "text-gray-400")} />
            <div>
              <p className={`text-sm font-semibold ${resellerMode ? dk("text-white", "text-[#102d1f]") : dk("text-gray-400", "text-[#737373]")}`}>Modo Revendedor / Cotizador</p>
              <p className={`text-[10px] ${resellerMode ? dk("text-gray-400", "text-green-700/70") : dk("text-gray-500", "text-gray-400")}`}>Agrega tu mockup a la opción de exportar PDF.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <button
              onClick={() => setResellerMode(!resellerMode)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${resellerMode ? "bg-[#2D9F6A]" : dk("bg-gray-700", "bg-gray-300")}`}
            >
              <span aria-hidden="true" className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${resellerMode ? "translate-x-2" : "-translate-x-2"}`} />
            </button>
            {resellerMode && (
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-bold ${dk("text-[#2D9F6A]", "text-green-700")}`}>Margen:</span>
                <input
                  type="number"
                  min="0"
                  max="500"
                  value={resellerMargin}
                  onChange={(e) => setResellerMargin(Number(e.target.value))}
                  className={`w-[60px] text-center text-xs font-bold rounded-md px-2 py-1 outline-none border ${dk("bg-black border-[#2D9F6A]/40 text-white", "bg-white border-green-300 text-[#171717]")}`}
                />
                <span className={`text-xs font-bold ${dk("text-[#2D9F6A]", "text-green-700")}`}>%</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1680px] px-4 md:px-6 mt-4">
        {cartProductsLoading ? (
          <div className={`flex flex-col items-center justify-center gap-4 rounded-2xl border py-20 ${dk("border-[#1f1f1f] bg-[#111]", "border-[#e5e5e5] bg-white")}`}>
            <Loader2 size={28} className="animate-spin text-[#2D9F6A]" />
            <p className={`text-sm ${dk("text-gray-400", "text-[#737373]")}`}>Cargando carrito…</p>
          </div>
        ) : Object.keys(cart).length > 0 && cartItems.length === 0 ? (
          <div className={`flex flex-col items-center justify-center gap-4 rounded-2xl border py-20 ${dk("border-[#1f1f1f] bg-[#111]", "border-[#e5e5e5] bg-white")}`}>
            <AlertTriangle size={28} className="text-amber-400" />
            <p className={`text-sm font-medium ${dk("text-gray-300", "text-[#525252]")}`}>Algunos productos del carrito ya no están disponibles.</p>
            <button
              type="button"
              onClick={() => navigate("/b2b-portal")}
              className="rounded-xl bg-[#2D9F6A] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Volver al catálogo
            </button>
          </div>
        ) : (
        <CheckoutWizard
          hasCartItems={cartItems.length > 0}
          hasBlockingErrors={hasBlockingErrors}
          isDark={isDark}
          cartStepProps={{
            cartItems: cartItems as CartStepCartItem[],
            blockingIssues,
            warningIssues,
            orderMeta: {
              internalReference: orderMeta.internalReference,
              branchName: orderMeta.branchName,
              receiverContact: orderMeta.receiverContact,
              requestedDate: orderMeta.requestedDate,
            },
            formatPrice,
            isDark,
            onAddQty: addQty,
            onRemoveQty: removeQty,
            onSetQty: setQty,
            onRemoveItem: removeItem,
            onUpdateMeta: updateOrderMeta,
          }}
          shippingStepProps={{
            shippingType,
            shippingAddress,
            shippingTransport,
            shippingCost,
            postalCode,
            shippingPaymentType,
            shippingEstimates,
            estimating,
            recentAddresses: recentShippingAddresses,
            isAdmin,
            currency,
            exchangeRate: exchangeRate.rate,
            formatPrice,
            isDark,
            onSetShippingType: setShippingType,
            onSetAddress: setShippingAddress,
            onSetTransport: (t) => {
              setShippingTransport(t as Transport);
              const nextEstimate = shippingEstimates.find((estimate) => estimate.carrier === t);
              if (nextEstimate) {
                setShippingCost(String(currency === "ARS" ? Math.round(nextEstimate.price_usd * exchangeRate.rate) : nextEstimate.price_usd));
                setShippingPaymentType("origen");
              }
            },
            onSetCost: setShippingCost,
            onSetPostalCode: (cp) => { setPostalCode(cp); setShippingEstimates([]); },
            onSetPaymentType: setShippingPaymentType,
            onEstimate: handleEstimateShipping,
            onSelectEstimate: (est) => {
              setShippingTransport(est.carrier as Transport);
              setShippingCost(String(currency === "ARS" ? Math.round(est.price_usd * exchangeRate.rate) : est.price_usd));
            },
          }}
          paymentStepProps={{
            baseTotal: cartBaseTotal,
            paymentMethod,
            echeqTermDays,
            currentAccountSharePct,
            creditAvailableDisplay: creditAvailableArs != null ? creditAvailableDisplay : null,
            creditAvailableArs,
            creditLimitArs: creditLimitArs ?? null,
            creditUsedArs,
            maxCurrentAccountSharePct,
            clientPaymentTerms,
            currentAccountAmount,
            transferAmount,
            formatPrice,
            isDark,
            onSetPaymentMethod: (m) => {
              setPaymentMethod(m as PaymentMethod);
              if (m === "echeq" && ECHEQ_TERM_OPTIONS.includes((profile?.payment_terms ?? 30) as EcheqTermDays)) {
                setEcheqTermDays((profile?.payment_terms ?? 30) as EcheqTermDays);
              }
              if (m === "cuenta_corriente") {
                setCurrentAccountSharePct((prev) => Math.min(100, Math.max(0, prev || 100)));
              }
            },
            onSetEcheqTermDays: setEcheqTermDays,
            onSetCurrentAccountSharePct: setCurrentAccountSharePct,
          }}
          confirmStepProps={{
            internalReference: orderMeta.internalReference,
            notes,
            approvalReason: orderMeta.approvalReason,
            showAdvanced: checkoutMode === "advanced",
            cartItemCount: cartItems.length,
            validationErrors,
            blockingIssues,
            orderSubmitting,
            reviewSubmitting,
            listSaved,
            draftSaved,
            templateSaved,
            reviewRequested,
            isDark,
            onSetInternalReference: (r) => updateOrderMeta("internalReference", r),
            onSetNotes: setNotes,
            onSetApprovalReason: (r) => updateOrderMeta("approvalReason", r),
            onConfirmOrder: () => { void handleConfirmOrder(); },
            onSaveQuote: () => { void handleSaveQuote(); },
            onExportPDF: () => { void handleExportPDF(); },
            onSaveDraft: handleSaveDraft,
            onSaveList: handleSaveList,
            onRequestReview: () => { void handleRequestReview(); },
          }}
          summaryProps={{
            cartItemCount: cartItems.length,
            totalUnits,
            totalWeightKg,
            subtotal: cartSubtotal,
            ivaTotal: cartIVATotal,
            surchargePercent: paymentSurchargePct,
            surchargeAmount: surchargeAmt,
            shippingCost: shippingCostBaseUsd,
            shippingType,
            shippingLabel: selectedShippingEstimate?.label || TRANSPORT_LABELS[shippingTransport],
            grandTotal,
            paymentLabel: paymentSummaryLabel,
            creditAvailableDisplay: creditAvailableArs != null ? creditAvailableDisplay : null,
            projectedCreditDisplay: projectedCreditRemainingArs != null ? projectedCreditRemainingDisplay : null,
            projectedCreditLow: projectedCreditRemainingArs != null && projectedCreditRemainingArs <= 0,
            exchangeRate: exchangeRate.rate,
            currency,
            formatPrice,
            formatARS,
            formatUSD,
            isDark,
            shippingETA: shippingType === "envio" && selectedShippingEstimate
              ? `${selectedShippingEstimate.days_min}-${selectedShippingEstimate.days_max} días`
              : undefined,
          }}
        />
        )}
      </div>
      </div>
    </div>
  );
}

