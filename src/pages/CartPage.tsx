import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useProducts } from "@/hooks/useProducts";
import { useOrders } from "@/hooks/useOrders";
import { useQuotes } from "@/hooks/useQuotes";
import { usePricingRules } from "@/hooks/usePricingRules";
import { useCurrency } from "@/context/CurrencyContext";
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
import type { Product } from "@/models/products";
import {
  ArrowLeft, ShoppingCart, AlertTriangle, AlertCircle, Minus, Plus,
  Trash2, FileDown, Bookmark, CheckCircle2, Loader2, TrendingUp,
  Truck, MapPin, FileText, Package2, CreditCard, ToggleLeft, ToggleRight,
  Building2, CalendarDays, UserRound, ShieldAlert, Sparkles, Clock3, Save,
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
type EcheqTermDays = 30 | 60 | 90 | 120;

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

const ECHEQ_TERM_OPTIONS: EcheqTermDays[] = [30, 60, 90, 120];
const ECHEQ_SURCHARGE_BY_TERM: Record<EcheqTermDays, number> = {
  30: 4.5,
  60: 9,
  90: 13.5,
  120: 18.5,
};

// -- Component -----------------------------------------------------------------

export default function CartPage() {
  const navigate = useNavigate();
  const { profile, isAdmin } = useAuth();
  const { products, loading: productsLoading } = useProducts({ isAdmin });
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

  // -- Cart items - per-product pricing rules applied ---------------------------
  const cartItems: CartItem[] = useMemo(() => {
    return Object.entries(cart)
      .map(([id, qty]) => {
        const product = products.find((p) => p.id === Number(id));
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
  }, [cart, products, computePrice]);

  const cartSubtotal     = useMemo(() => cartItems.reduce((s, i) => s + i.totalPrice, 0), [cartItems]);
  const cartIVATotal     = useMemo(() => cartItems.reduce((s, i) => s + i.ivaAmount,  0), [cartItems]);
  const cartBaseTotal    = cartSubtotal + cartIVATotal;
  const paymentSurchargePct = paymentMethod === "echeq" ? ECHEQ_SURCHARGE_BY_TERM[echeqTermDays] : 0;
  const surchargeAmt     = cartBaseTotal * (paymentSurchargePct / 100);
  const shippingCostInputNum = Number(shippingCost || 0);
  const shippingCostBaseUsd = shippingType === "envio"
    ? convertPrice(shippingCostInputNum, currency === "ARS" ? "ARS" : "USD")
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
    const compiledNotes = [paymentDetailNote, buildOrderNotes(notes, orderMeta)].filter(Boolean).join("\n\n");

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

      {/* -- Body ------------------------------------------------------------- */}
      <div className="mx-auto flex max-w-[1680px] flex-col gap-6 px-4 py-6 md:px-6 lg:flex-row">

        {/* -- LEFT COLUMN --------------------------------------------------- */}
        <div className="flex-1 min-w-0 flex flex-col gap-5">

          {/* Empty state */}
          {!productsLoading && cartItems.length === 0 && (
            <div className={`border rounded-xl flex flex-col items-center justify-center py-20 text-center ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
              <ShoppingCart size={34} className="mb-3 text-gray-700" />
              <p className="text-sm font-medium text-gray-500">El carrito está vacío</p>
              <button
                onClick={() => navigate("/b2b-portal")}
                className="mt-3 text-xs text-[#2D9F6A] hover:underline"
              >
                Ir al catálogo
              </button>
            </div>
          )}

          {/* -- 1. PRODUCTS TABLE ------------------------------------------- */}
          {cartItems.length > 0 && (
            <section className={`border rounded-xl overflow-hidden ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
              <div className={`px-4 py-2.5 border-b flex items-center gap-2 ${dk("border-[#1a1a1a]", "border-[#e5e5e5]")}`}>
                <ShieldAlert size={13} className={hasBlockingErrors ? "text-red-400" : "text-amber-400"} />
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Alertas del pedido</span>
              </div>
              <div className="px-4 py-4 grid gap-3 lg:grid-cols-[1.2fr_1fr]">
                <div className={`rounded-xl border px-3 py-3 ${hasBlockingErrors ? dk("border-red-500/30 bg-red-500/10", "border-red-200 bg-red-50") : dk("border-[#2a2a2a] bg-[#171717]", "border-[#e5e5e5] bg-[#fafafa]")}`}>
                  <p className={`text-xs font-semibold mb-2 ${hasBlockingErrors ? "text-red-400" : dk("text-gray-300", "text-[#525252]")}`}>
                    Bloqueantes {blockingIssues.length > 0 ? `(${blockingIssues.length})` : "(0)"}
                  </p>
                  {blockingIssues.length === 0 ? (
                    <p className="text-xs text-[#2D9F6A]">No hay bloqueos para confirmar el pedido.</p>
                  ) : (
                    <div className="space-y-1">
                      {blockingIssues.map((issue) => (
                        <p key={issue} className={`text-xs ${hasBlockingErrors ? "text-red-300" : dk("text-gray-300", "text-[#525252]")}`}>- {issue}</p>
                      ))}
                    </div>
                  )}
                </div>
                <div className={`rounded-xl border px-3 py-3 ${dk("border-[#2a2a2a] bg-[#171717]", "border-[#e5e5e5] bg-[#fafafa]")}`}>
                  <p className="text-xs font-semibold mb-2 text-amber-400">
                    Atención comercial {warningIssues.length > 0 ? `(${warningIssues.length})` : "(0)"}
                  </p>
                  {warningIssues.length === 0 ? (
                    <p className={`text-xs ${dk("text-gray-400", "text-[#737373]")}`}>El pedido está limpio y listo para procesar.</p>
                  ) : (
                    <div className="space-y-1">
                      {warningIssues.slice(0, 4).map((issue) => (
                        <p key={issue} className={`text-xs ${dk("text-gray-300", "text-[#525252]")}`}>- {issue}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {cartItems.length > 0 && (
            <section className={`border rounded-xl overflow-hidden ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
              <div className={`px-4 py-2.5 border-b flex items-center gap-2 ${dk("border-[#1a1a1a]", "border-[#e5e5e5]")}`}>
                <Building2 size={13} className="text-[#2D9F6A]" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Datos del pedido</span>
              </div>
              <div className="px-4 py-4 grid gap-3 md:grid-cols-2">
                <div>
                  <label className={`text-xs block mb-1.5 ${dk("text-gray-500", "text-gray-500")}`}>Referencia / OC interna</label>
                  <input
                    type="text"
                    value={orderMeta.internalReference}
                    onChange={(e) => updateOrderMeta("internalReference", e.target.value)}
                    placeholder="Ej: OC-45892 / proyecto cliente"
                    className={`w-full text-sm outline-none rounded-lg px-3 py-2 border transition ${dk("bg-[#1a1a1a] border-[#2a2a2a] text-white focus:border-[#2D9F6A]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] focus:border-[#2D9F6A]")}`}
                  />
                </div>
                <div>
                  <label className={`text-xs block mb-1.5 ${dk("text-gray-500", "text-gray-500")}`}>Sucursal / destino</label>
                  <input
                    type="text"
                    value={orderMeta.branchName}
                    onChange={(e) => updateOrderMeta("branchName", e.target.value)}
                    placeholder="Casa central, sucursal norte, depósito..."
                    className={`w-full text-sm outline-none rounded-lg px-3 py-2 border transition ${dk("bg-[#1a1a1a] border-[#2a2a2a] text-white focus:border-[#2D9F6A]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] focus:border-[#2D9F6A]")}`}
                  />
                </div>
                <div>
                  <label className={`text-xs block mb-1.5 ${dk("text-gray-500", "text-gray-500")}`}>Contacto receptor</label>
                  <div className="relative">
                    <UserRound size={13} className={`absolute left-3 top-1/2 -translate-y-1/2 ${dk("text-[#525252]", "text-[#a3a3a3]")}`} />
                    <input
                      type="text"
                      value={orderMeta.receiverContact}
                      onChange={(e) => updateOrderMeta("receiverContact", e.target.value)}
                      placeholder="Quién recibe o coordina"
                      className={`w-full text-sm outline-none rounded-lg pl-9 pr-3 py-2 border transition ${dk("bg-[#1a1a1a] border-[#2a2a2a] text-white focus:border-[#2D9F6A]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] focus:border-[#2D9F6A]")}`}
                    />
                  </div>
                </div>
                <div>
                  <label className={`text-xs block mb-1.5 ${dk("text-gray-500", "text-gray-500")}`}>Fecha requerida</label>
                  <div className="relative">
                    <CalendarDays size={13} className={`absolute left-3 top-1/2 -translate-y-1/2 ${dk("text-[#525252]", "text-[#a3a3a3]")}`} />
                    <input
                      type="date"
                      value={orderMeta.requestedDate}
                      onChange={(e) => updateOrderMeta("requestedDate", e.target.value)}
                      className={`w-full text-sm outline-none rounded-lg pl-9 pr-3 py-2 border transition ${dk("bg-[#1a1a1a] border-[#2a2a2a] text-white focus:border-[#2D9F6A]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] focus:border-[#2D9F6A]")}`}
                    />
                  </div>
                </div>
              </div>
            </section>
          )}

          {cartItems.length > 0 && (
            <section className={`border rounded-xl overflow-hidden ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
              {/* Section header */}
              <div className={`px-4 py-2.5 border-b flex items-center gap-2 ${dk("border-[#1a1a1a]", "border-[#e5e5e5]")}`}>
                <Package2 size={13} className="text-[#2D9F6A]" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Productos</span>
              </div>
              {/* Column labels - desktop only */}
              <div className={`hidden md:grid grid-cols-[96px_1fr_64px_100px_96px_100px_32px] gap-x-3 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-600 border-b ${dk("border-[#1a1a1a]", "border-[#f0f0f0]")}`}>
                <span>SKU</span>
                <span>Producto</span>
                <span className="text-center">Stock</span>
                <span className="text-center">Cantidad</span>
                <span className="text-right">Precio unit.</span>
                <span className="text-right">Total c/IVA</span>
                <span />
              </div>

              {/* Rows */}
              <div className={`divide-y ${dk("divide-[#1a1a1a]", "divide-[#f0f0f0]")}`}>
                {cartItems.map((item) => {
                  const {
                    product, quantity, unitPrice, totalWithIVA,
                    availableStock, hasStockError, hasStockWarning, hasMOQError,
                  } = item;
                  const outOfStock = product.stock === 0;
                  const minQty = product.min_order_qty ?? product.stock_min ?? 0;

                  return (
                    <div
                      key={product.id}
                      className={`px-4 py-3 flex flex-col gap-2 md:grid md:grid-cols-[96px_1fr_64px_100px_96px_100px_32px] md:gap-x-3 md:items-center transition-colors
                        ${(hasStockError || outOfStock) ? dk("bg-red-950/20", "bg-red-50/60") : ""}
                      `}
                    >
                      {/* SKU */}
                      <div>
                        {product.sku ? (
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${dk("bg-[#1a1a1a] text-[#737373]", "bg-[#f0f0f0] text-[#525252]")}`}>
                            {product.sku}
                          </span>
                        ) : (
                          <span className={`text-[10px] font-mono ${dk("text-[#525252]", "text-[#a3a3a3]")}`}>—</span>
                        )}
                      </div>

                      {/* Name + alerts */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`hidden md:flex h-9 w-9 shrink-0 rounded-lg items-center justify-center border ${dk("bg-[#0a0a0a] border-[#1a1a1a]", "bg-[#f9f9f9] border-[#e5e5e5]")}`}>
                          <img src={product.image} alt={product.name} className="max-h-7 max-w-7 object-contain" />
                        </div>
                        <div className="min-w-0">
                          <p className={`text-sm font-semibold truncate ${dk("text-white", "text-[#171717]")}`}>
                            {product.name}
                          </p>
                          <p className="text-[11px] text-gray-600">{product.category}</p>
                          {outOfStock && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-red-400 mt-0.5">
                              <AlertCircle size={9} /> Sin stock
                            </span>
                          )}
                          {!outOfStock && hasStockError && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-red-400 mt-0.5">
                              <AlertCircle size={9} /> Solo {availableStock} disponibles
                            </span>
                          )}
                          {!hasStockError && hasStockWarning && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 mt-0.5">
                              <AlertTriangle size={9} /> Últimas {availableStock}u
                            </span>
                          )}
                          {hasMOQError && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 mt-0.5">
                              <AlertTriangle size={9} /> Mín. {minQty}u por pedido
                            </span>
                          )}
                          {/* Mobile totals */}
                          <div className="flex items-center justify-between mt-1 md:hidden">
                            <span className="text-xs text-[#2D9F6A] font-bold tabular-nums">
                              {formatPrice(unitPrice)} c/u s/IVA
                            </span>
                            <span className={`text-sm font-extrabold tabular-nums ${dk("text-white", "text-[#171717]")}`}>
                              {formatPrice(totalWithIVA)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Available stock */}
                      <div className="hidden md:flex flex-col items-center justify-center">
                        <span className={`text-[11px] font-semibold tabular-nums
                          ${outOfStock ? "text-red-400" : hasStockError ? "text-red-400" : hasStockWarning ? "text-amber-400" : dk("text-gray-400", "text-gray-500")}`}>
                          {availableStock}
                        </span>
                        {(product.stock_reserved ?? 0) > 0 && (
                          <span className="text-[9px] text-gray-600 tabular-nums">
                            {product.stock_reserved} res.
                          </span>
                        )}
                      </div>

                      {/* Qty controls */}
                      <div className="flex items-center gap-1 md:justify-center">
                        <button
                          onClick={() => removeQty(product.id)}
                          className={`h-7 w-7 rounded-lg flex items-center justify-center border active:scale-95 transition
                            ${dk("bg-[#1c1c1c] hover:bg-[#252525] text-white border-[#262626]", "bg-[#f5f5f5] hover:bg-[#ebebeb] text-[#171717] border-[#e5e5e5]")}`}
                        >
                          <Minus size={11} />
                        </button>
                        <input
                          type="number"
                          min={1}
                          value={quantity}
                          onChange={(e) => setQty(product.id, parseInt(e.target.value) || 0)}
                          className={`w-10 text-center text-sm font-bold tabular-nums bg-transparent outline-none ${dk("text-white", "text-[#171717]")}`}
                        />
                        <button
                          onClick={() => addQty(product.id)}
                          className="h-7 w-7 rounded-lg bg-[#2D9F6A] hover:bg-[#25835A] text-white flex items-center justify-center active:scale-95 transition"
                        >
                          <Plus size={11} />
                        </button>
                      </div>

                      {/* Unit price */}
                      <div className="hidden md:block text-right">
                        <div className="text-sm font-bold text-[#2D9F6A] tabular-nums">{formatPrice(unitPrice)}</div>
                        <div className={`text-[10px] ${dk("text-[#525252]", "text-[#a3a3a3]")}`}>s/IVA - {item.ivaRate}%</div>
                      </div>

                      {/* Line total */}
                      <div className="hidden md:block text-right">
                        <div className={`text-sm font-extrabold tabular-nums ${dk("text-white", "text-[#171717]")}`}>
                          {formatPrice(totalWithIVA)}
                        </div>
                        <div className={`text-[10px] tabular-nums ${dk("text-[#525252]", "text-[#a3a3a3]")}`}>
                          s/IVA {formatPrice(item.totalPrice)}
                        </div>
                      </div>

                      {/* Remove */}
                      <div className="hidden md:flex items-center justify-center">
                        <button
                          onClick={() => removeItem(product.id)}
                          className={`p-1 rounded transition ${dk("text-[#525252] hover:text-red-400 hover:bg-red-500/10", "text-[#a3a3a3] hover:text-red-500 hover:bg-red-50")}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      {/* Mobile remove */}
                      <div className="flex md:hidden">
                        <button
                          onClick={() => removeItem(product.id)}
                          className={`flex items-center gap-1 text-xs transition ${dk("text-[#525252] hover:text-red-400", "text-[#a3a3a3] hover:text-red-500")}`}
                        >
                          <Trash2 size={12} /> Eliminar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* -- 2. MODO REVENDEDOR ------------------------------------------- */}
          {cartItems.length > 0 && (
            <section className={`border rounded-xl overflow-hidden ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
              <div className={`px-4 py-2.5 border-b flex items-center justify-between ${dk("border-[#1a1a1a]", "border-[#e5e5e5]")}`}>
                <div className="flex items-center gap-2">
                  <TrendingUp size={13} className="text-[#2D9F6A]" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    Exportar para tu cliente
                  </span>
                </div>
                <button
                  onClick={() => setResellerMode((v) => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition
                    ${resellerMode
                      ? "bg-[#2D9F6A]/15 text-[#2D9F6A] border-[#2D9F6A]/30"
                      : dk("text-gray-500 border-[#222] hover:border-[#333] hover:text-gray-300", "text-gray-500 border-[#e5e5e5] hover:text-gray-700")
                    }`}
                >
                  {resellerMode ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                  {resellerMode ? "Activado" : "Activar"}
                </button>
              </div>
              {resellerMode ? (
                <div className="px-4 py-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center flex-wrap">
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-gray-500 whitespace-nowrap">Margen adicional</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        max={300}
                        value={resellerMargin}
                        onChange={(e) => setResellerMargin(Math.max(0, Number(e.target.value)))}
                        className={`w-16 text-center text-sm font-bold tabular-nums outline-none rounded-lg px-2 py-1.5 border
                          ${dk("bg-[#1a1a1a] border-[#2a2a2a] text-white focus:border-[#2D9F6A]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] focus:border-[#2D9F6A]")}`}
                      />
                      <span className="text-sm text-gray-500">%</span>
                    </div>
                  </div>
                  <div className={`flex items-center gap-2.5 px-4 py-2 rounded-xl border
                    ${dk("bg-[#0d1f17] border-[#1a3a28]", "bg-green-50 border-green-200")}`}>
                    <TrendingUp size={13} className="text-[#2D9F6A]" />
                    <span className="text-xs text-gray-500">Tu ganancia estimada:</span>
                    <span className="text-sm font-extrabold text-[#2D9F6A] tabular-nums">
                      {formatPrice(resellerProfit)}
                    </span>
                  </div>
                  <div className="grid w-full gap-3 md:grid-cols-3">
                    <div>
                      <label className={`text-xs block mb-1.5 ${dk("text-gray-500", "text-gray-500")}`}>Cliente final</label>
                      <input
                        type="text"
                        value={orderMeta.finalClientName}
                        onChange={(e) => updateOrderMeta("finalClientName", e.target.value)}
                        placeholder="Nombre comercial del cliente final"
                        className={`w-full text-sm outline-none rounded-lg px-3 py-2 border transition ${dk("bg-[#1a1a1a] border-[#2a2a2a] text-white focus:border-[#2D9F6A]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] focus:border-[#2D9F6A]")}`}
                      />
                    </div>
                    <div>
                      <label className={`text-xs block mb-1.5 ${dk("text-gray-500", "text-gray-500")}`}>Validez (días)</label>
                      <input
                        type="number"
                        min={1}
                        max={90}
                        value={orderMeta.quoteValidityDays}
                        onChange={(e) => updateOrderMeta("quoteValidityDays", Math.max(1, Number(e.target.value) || 1))}
                        className={`w-full text-sm outline-none rounded-lg px-3 py-2 border transition ${dk("bg-[#1a1a1a] border-[#2a2a2a] text-white focus:border-[#2D9F6A]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] focus:border-[#2D9F6A]")}`}
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className={`text-xs block mb-1.5 ${dk("text-gray-500", "text-gray-500")}`}>Mensaje comercial</label>
                      <textarea
                        value={orderMeta.commercialMessage}
                        onChange={(e) => updateOrderMeta("commercialMessage", e.target.value)}
                        rows={2}
                        placeholder="Aclaraciones para la cotización del cliente final"
                        className={`w-full text-sm outline-none rounded-lg px-3 py-2 border resize-none transition ${dk("bg-[#1a1a1a] border-[#2a2a2a] text-white focus:border-[#2D9F6A]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] focus:border-[#2D9F6A]")}`}
                      />
                    </div>
                  </div>
                  <p className={`text-[10px] sm:ml-auto ${dk("text-[#525252]", "text-[#a3a3a3]")}`}>
                    Solo afecta la exportación PDF - no modifica el pedido real
                  </p>
                </div>
              ) : (
                <div className="px-4 py-3">
                  <p className={`text-xs ${dk("text-[#525252]", "text-[#a3a3a3]")}`}>
                    Activá para generar cotizaciones con tus propios precios para el cliente final.
                    La ganancia estimada se calcula sobre el subtotal sin IVA.
                  </p>
                </div>
              )}
            </section>
          )}

          {/* -- 3. CONDICIONES DE PAGO -------------------------------------- */}
          {cartItems.length > 0 && (
            <section className={`border rounded-xl overflow-hidden ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
              <div className={`px-4 py-2.5 border-b flex items-center gap-2 ${dk("border-[#1a1a1a]", "border-[#e5e5e5]")}`}>
                <CreditCard size={13} className="text-[#2D9F6A]" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Condiciones de pago
                </span>
              </div>
              <div className="px-4 py-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                  {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((method) => (
                    <label
                      key={method}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition
                        ${paymentMethod === method
                          ? "border-[#2D9F6A] bg-[#2D9F6A]/10 text-[#2D9F6A]"
                          : dk("border-[#1f1f1f] hover:border-[#2a2a2a] text-gray-400", "border-[#e5e5e5] hover:border-[#d4d4d4] text-gray-500")
                        }`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={method}
                        checked={paymentMethod === method}
                        onChange={() => {
                          setPaymentMethod(method);
                          if (method === "echeq" && ECHEQ_TERM_OPTIONS.includes((profile?.payment_terms ?? 30) as EcheqTermDays)) {
                            setEcheqTermDays((profile?.payment_terms ?? 30) as EcheqTermDays);
                          }
                          if (method === "cuenta_corriente") {
                            setCurrentAccountSharePct((prev) => Math.min(100, Math.max(0, prev || 100)));
                          }
                        }}
                        className="sr-only"
                      />
                      <div className={`h-3 w-3 rounded-full border-2 shrink-0 flex items-center justify-center transition
                        ${paymentMethod === method ? "border-[#2D9F6A]" : dk("border-[#404040]", "border-[#d4d4d4]")}`}>
                        {paymentMethod === method && (
                          <div className="h-1.5 w-1.5 rounded-full bg-[#2D9F6A]" />
                        )}
                      </div>
                      <span className="text-xs font-medium leading-tight">{PAYMENT_LABELS[method]}</span>
                    </label>
                  ))}
                </div>
                {paymentMethod === "echeq" && (
                  <div className={`rounded-xl border p-3 ${dk("border-[#1f1f1f] bg-[#171717]", "border-[#e5e5e5] bg-[#fafafa]")}`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className={`text-xs font-semibold ${dk("text-white", "text-[#171717]")}`}>Plazo de echeq</p>
                        <p className={`text-[11px] ${dk("text-gray-400", "text-[#737373]")}`}>Recargo fijo del 4,5% por tramo de 30 días.</p>
                      </div>
                      <span className="text-sm font-bold text-amber-400">+ {paymentSurchargePct.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                      {ECHEQ_TERM_OPTIONS.map((days) => (
                        <button
                          key={days}
                          type="button"
                          onClick={() => setEcheqTermDays(days)}
                          className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                            echeqTermDays === days
                              ? "border-[#2D9F6A] bg-[#2D9F6A]/10 text-[#2D9F6A]"
                              : dk("border-[#262626] text-gray-300 hover:border-[#2D9F6A]/40", "border-[#e5e5e5] text-[#525252] hover:border-[#2D9F6A]/30")
                          }`}
                        >
                          {days} días
                        </button>
                      ))}
                    </div>
                    <p className={`mt-3 text-xs ${dk("text-gray-400", "text-[#737373]")}`}>
                      Recargo aplicado: {formatPrice(surchargeAmt)} sobre el total con IVA.
                    </p>
                  </div>
                )}
                {paymentMethod === "cuenta_corriente" && (
                  <div className={`rounded-xl border p-3 ${dk("border-[#1f1f1f] bg-[#171717]", "border-[#e5e5e5] bg-[#fafafa]")}`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className={`text-xs font-semibold ${dk("text-white", "text-[#171717]")}`}>Cuenta corriente disponible</p>
                        <p className={`text-[11px] ${dk("text-gray-400", "text-[#737373]")}`}>Plazo comercial: {clientPaymentTerms === 0 ? "contado" : `${clientPaymentTerms} días`}.</p>
                      </div>
                      <span className="text-sm font-bold text-[#2D9F6A]">{creditAvailableDisplay}</span>
                    </div>
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className={dk("text-gray-400", "text-[#737373]")}>Cuenta corriente {currentAccountSharePct}%</span>
                        <span className={dk("text-gray-400", "text-[#737373]")}>Transferencia {100 - currentAccountSharePct}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={currentAccountSharePct}
                        onChange={(e) => setCurrentAccountSharePct(Number(e.target.value))}
                        className="w-full accent-[#2D9F6A]"
                      />
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        <div className={`rounded-lg border px-3 py-2 ${dk("border-[#262626] bg-[#0d0d0d]", "border-[#e5e5e5] bg-white")}`}>
                          <p className="text-[11px] text-gray-500">Monto por cuenta corriente</p>
                          <p className="text-sm font-bold text-[#2D9F6A]">{formatPrice(currentAccountAmount)}</p>
                        </div>
                        <div className={`rounded-lg border px-3 py-2 ${dk("border-[#262626] bg-[#0d0d0d]", "border-[#e5e5e5] bg-white")}`}>
                          <p className="text-[11px] text-gray-500">Monto por transferencia</p>
                          <p className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>{formatPrice(transferAmount)}</p>
                        </div>
                      </div>
                      {creditAvailableArs != null && (
                        <p className={`mt-3 text-[11px] ${currentAccountSharePct > maxCurrentAccountSharePct ? "text-amber-400" : dk("text-gray-400", "text-[#737373]")}`}>
                          Máximo cubrible con tu disponible actual: {maxCurrentAccountSharePct}% del pedido.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* -- 4. LOGÍSTICA ------------------------------------------------ */}
          {cartItems.length > 0 && (
            <section className={`border rounded-xl overflow-hidden ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
              <div className={`px-4 py-2.5 border-b flex items-center gap-2 ${dk("border-[#1a1a1a]", "border-[#e5e5e5]")}`}>
                <Truck size={13} className="text-[#2D9F6A]" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Logística / Envío
                </span>
              </div>
              <div className="px-4 py-4">
                <div className="flex gap-3 mb-4">
                  {[
                    { value: "retiro" as ShippingType, label: "Retiro en sucursal" },
                    { value: "envio"  as ShippingType, label: "Envío a destino"    },
                  ].map(({ value, label }) => (
                    <label
                      key={value}
                      className={`flex-1 flex items-center gap-2.5 px-4 py-2.5 rounded-xl border cursor-pointer transition
                        ${shippingType === value
                          ? "border-[#2D9F6A] bg-[#2D9F6A]/10 text-[#2D9F6A]"
                          : dk("border-[#1f1f1f] hover:border-[#2a2a2a] text-gray-400", "border-[#e5e5e5] hover:border-[#d4d4d4] text-gray-500")
                        }`}
                    >
                      <input
                        type="radio"
                        name="shippingType"
                        value={value}
                        checked={shippingType === value}
                        onChange={() => setShippingType(value)}
                        className="sr-only"
                      />
                      <div className={`h-3 w-3 rounded-full border-2 shrink-0 flex items-center justify-center transition
                        ${shippingType === value ? "border-[#2D9F6A]" : dk("border-[#404040]", "border-[#d4d4d4]")}`}>
                        {shippingType === value && <div className="h-1.5 w-1.5 rounded-full bg-[#2D9F6A]" />}
                      </div>
                      <span className="text-xs font-medium">{label}</span>
                    </label>
                  ))}
                </div>

                {shippingType === "envio" && (
                  <div className="flex flex-col gap-3">
                    {/* Postal code + estimate */}
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className={`text-xs block mb-1.5 ${dk("text-gray-500", "text-gray-500")}`}>
                          Código postal destino
                        </label>
                        <input
                          type="text"
                          value={postalCode}
                          onChange={(e) => { setPostalCode(e.target.value); setShippingEstimates([]); }}
                          placeholder="Ej: 1425"
                          className={`w-full text-sm outline-none rounded-lg px-3 py-2 border transition
                            ${dk("bg-[#1a1a1a] border-[#2a2a2a] text-white focus:border-[#2D9F6A] placeholder-[#525252]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] focus:border-[#2D9F6A] placeholder-[#a3a3a3]")}`}
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={handleEstimateShipping}
                          disabled={!postalCode.trim() || estimating}
                          className="h-[38px] px-3 bg-[#2D9F6A] hover:bg-[#25835A] text-white text-xs font-bold rounded-lg transition disabled:opacity-40 whitespace-nowrap flex items-center gap-1.5"
                        >
                          <Truck size={12} /> Estimar
                        </button>
                      </div>
                    </div>

                    {/* Carrier estimate cards */}
                    {shippingEstimates.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Tarifas estimadas</p>
                        <div className="grid grid-cols-2 gap-2">
                          {shippingEstimates.map((est) => {
                            const isSelected = shippingTransport === est.carrier;
                            return (
                              <button
                                key={est.carrier}
                                type="button"
                                onClick={() => {
                                  setShippingTransport(est.carrier as Transport);
                                  setShippingCost(String(currency === "ARS" ? Math.round(est.price_usd * exchangeRate.rate) : est.price_usd));
                                }}
                                className={`text-left p-2.5 rounded-lg border transition text-xs ${
                                  isSelected
                                    ? "border-[#2D9F6A] bg-[#2D9F6A]/10"
                                    : dk("border-[#2a2a2a] hover:border-[#3a3a3a]", "border-[#e5e5e5] hover:border-[#d4d4d4]")
                                }`}
                              >
                                <p className={`font-bold mb-0.5 ${isSelected ? "text-[#2D9F6A]" : dk("text-white", "text-[#171717]")}`}>
                                  {est.label}
                                </p>
                                <p className="text-[#2D9F6A] font-semibold tabular-nums">
                                  {formatPrice(est.price_usd)}
                                </p>
                                <p className={`text-[10px] mt-0.5 ${dk("text-gray-500", "text-gray-500")}`}>
                                  {est.days_min}-{est.days_max} días h-biles
                                </p>
                                {est.notes && (
                                  <p className="text-[9px] text-amber-400 mt-0.5">{est.notes}</p>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div>
                      <label className={`text-xs block mb-1.5 ${dk("text-gray-500", "text-gray-500")}`}>
                        <MapPin size={11} className="inline mr-1" />
                        Dirección de entrega
                      </label>
                      <input
                        type="text"
                        value={shippingAddress}
                        onChange={(e) => setShippingAddress(e.target.value)}
                        placeholder="Calle, número, ciudad, provincia"
                        className={`w-full text-sm outline-none rounded-lg px-3 py-2 border transition
                          ${dk("bg-[#1a1a1a] border-[#2a2a2a] text-white focus:border-[#2D9F6A] placeholder-[#525252]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] focus:border-[#2D9F6A] placeholder-[#a3a3a3]")}`}
                      />
                      {recentShippingAddresses.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {recentShippingAddresses.map((address) => (
                            <button
                              key={address}
                              type="button"
                              onClick={() => setShippingAddress(address)}
                              className={`text-[11px] px-2.5 py-1 rounded-full border transition ${dk("border-[#2a2a2a] text-gray-400 hover:text-white hover:border-[#3a3a3a]", "border-[#e5e5e5] text-[#737373] hover:text-[#171717] hover:border-[#d4d4d4]")}`}
                            >
                              {address}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={`text-xs block mb-1.5 ${dk("text-gray-500", "text-gray-500")}`}>Transporte</label>
                        <select
                          value={shippingTransport}
                          onChange={(e) => {
                            const nextTransport = e.target.value as Transport;
                            setShippingTransport(nextTransport);
                            const nextEstimate = shippingEstimates.find((estimate) => estimate.carrier === nextTransport);
                            if (nextEstimate) {
                              setShippingCost(String(currency === "ARS" ? Math.round(nextEstimate.price_usd * exchangeRate.rate) : nextEstimate.price_usd));
                            }
                          }}
                          className={`w-full text-sm outline-none rounded-lg px-3 py-2 border transition
                            ${dk("bg-[#1a1a1a] border-[#2a2a2a] text-white focus:border-[#2D9F6A]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] focus:border-[#2D9F6A]")}`}
                        >
                          {(Object.keys(TRANSPORT_LABELS) as Transport[]).map((t) => (
                            <option key={t} value={t}>{TRANSPORT_LABELS[t]}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={`text-xs block mb-1.5 ${dk("text-gray-500", "text-gray-500")}`}>
                          Costo de envío ({currency})
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={shippingCost}
                          onChange={(e) => setShippingCost(e.target.value)}
                          placeholder="0"
                          className={`w-full text-sm outline-none rounded-lg px-3 py-2 border transition
                            ${dk("bg-[#1a1a1a] border-[#2a2a2a] text-white focus:border-[#2D9F6A] placeholder-[#525252]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] focus:border-[#2D9F6A]")}`}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* -- 5. OBSERVACIONES -------------------------------------------- */}
          {cartItems.length > 0 && (
            <section className={`border rounded-xl overflow-hidden ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
              <div className={`px-4 py-2.5 border-b flex items-center gap-2 ${dk("border-[#1a1a1a]", "border-[#e5e5e5]")}`}>
                <FileText size={13} className="text-[#2D9F6A]" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Observaciones
                </span>
              </div>
              <div className="px-4 py-4">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Notas del pedido, condiciones de entrega, aclaraciones especiales..."
                  className={`w-full text-sm outline-none rounded-lg px-3 py-2.5 border resize-none transition
                    ${dk("bg-[#1a1a1a] border-[#2a2a2a] text-white focus:border-[#2D9F6A] placeholder-[#525252]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] focus:border-[#2D9F6A] placeholder-[#a3a3a3]")}`}
                />
                <div className="mt-3">
                  <label className={`text-xs block mb-1.5 ${dk("text-gray-500", "text-gray-500")}`}>Motivo de revisión / excepción comercial</label>
                  <textarea
                    value={orderMeta.approvalReason}
                    onChange={(e) => updateOrderMeta("approvalReason", e.target.value)}
                    rows={2}
                    placeholder="Explicá acá si necesitás una condición especial antes de confirmar"
                    className={`w-full text-sm outline-none rounded-lg px-3 py-2.5 border resize-none transition
                      ${dk("bg-[#1a1a1a] border-[#2a2a2a] text-white focus:border-[#2D9F6A] placeholder-[#525252]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] focus:border-[#2D9F6A] placeholder-[#a3a3a3]")}`}
                  />
                </div>
              </div>
            </section>
          )}

          {suggestionSections.length > 0 && (
            <section className={`border rounded-xl overflow-hidden ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
              <div className={`px-4 py-2.5 border-b flex items-center gap-2 ${dk("border-[#1a1a1a]", "border-[#e5e5e5]")}`}>
                <Sparkles size={13} className="text-[#2D9F6A]" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Recompra inteligente</span>
              </div>
              <div className="space-y-4 p-4">
                {suggestionSections.map((section) => (
                  <div key={section.key}>
                    <div className="mb-2">
                      <p className={`text-xs font-semibold ${dk("text-white", "text-[#171717]")}`}>{section.title}</p>
                      <p className="text-[11px] text-gray-500">{section.helper}</p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {section.products.map((product) => (
                        <div
                          key={`${section.key}-${product.id}`}
                          className={`rounded-xl border p-3 flex gap-3 ${dk("border-[#1f1f1f] bg-[#171717]", "border-[#e5e5e5] bg-[#fafafa]")}`}
                        >
                          <div className={`h-12 w-12 shrink-0 rounded-lg border flex items-center justify-center ${dk("border-[#262626] bg-[#0d0d0d]", "border-[#e5e5e5] bg-white")}`}>
                            <img src={product.image} alt={product.name} className="max-h-9 max-w-9 object-contain" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm font-semibold truncate ${dk("text-white", "text-[#171717]")}`}>{product.name}</p>
                            <p className="text-[11px] text-gray-500">{product.category}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <span className="text-xs font-bold text-[#2D9F6A]">{formatPrice(product.cost_price * (1 + globalMargin / 100))}</span>
                              {(purchaseHistory[product.id] ?? 0) > 0 && (
                                <span className="text-[10px] text-blue-400">Ya lo compraste</span>
                              )}
                              {favoriteProductIds.includes(product.id) && (
                                <span className="text-[10px] text-amber-400">Favorito</span>
                              )}
                            </div>
                            <div className="mt-2 flex gap-2">
                              <button
                                type="button"
                                onClick={() => addQty(product.id)}
                                className="flex-1 rounded-lg bg-[#2D9F6A] hover:bg-[#25835A] text-white text-xs font-bold px-3 py-2 transition"
                              >
                                Agregar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleFavorite(product.id)}
                                className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${dk("border-[#262626] text-gray-300 hover:bg-[#1f1f1f]", "border-[#e5e5e5] text-[#525252] hover:bg-white")}`}
                              >
                                {favoriteProductIds.includes(product.id) ? "Quitar fav" : "Favorito"}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

        </div>

        {/* -- RIGHT COLUMN - SUMMARY + ACTIONS ---------------------------- */}
        <aside className="lg:w-[300px] shrink-0">
          <div className={`sticky top-[57px] border rounded-xl overflow-hidden ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>

            {/* Summary header */}
            <div className={`px-4 py-2.5 border-b ${dk("border-[#1a1a1a]", "border-[#e5e5e5]")}`}>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Resumen del pedido</span>
            </div>

            {/* Rows */}
            <div className="px-4 py-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Subtotal s/IVA</span>
                <span className={`text-xs font-semibold tabular-nums ${dk("text-gray-300", "text-[#525252]")}`}>
                  {formatPrice(cartSubtotal)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">IVA</span>
                <span className={`text-xs font-semibold tabular-nums ${dk("text-gray-300", "text-[#525252]")}`}>
                  + {formatPrice(cartIVATotal)}
                </span>
              </div>
              {paymentSurchargePct > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-amber-400">Recargo pago {paymentSurchargePct.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</span>
                  <span className="text-xs font-semibold text-amber-400 tabular-nums">
                    + {formatPrice(surchargeAmt)}
                  </span>
                </div>
              )}
              {shippingType === "envio" && shippingCostBaseUsd > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Envío</span>
                  <span className={`text-xs font-semibold tabular-nums ${dk("text-gray-300", "text-[#525252]")}`}>
                    + {formatPrice(shippingCostBaseUsd)}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Unidades / peso</span>
                <span className={`text-xs font-semibold tabular-nums ${dk("text-gray-300", "text-[#525252]")}`}>
                  {totalUnits} u - {totalWeightKg.toFixed(1)} kg
                </span>
              </div>
              {creditAvailableArs != null && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Crédito disponible</span>
                    <span className={`text-xs font-semibold tabular-nums ${dk("text-gray-300", "text-[#525252]")}`}>
                      {creditAvailableDisplay}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Disponible post pedido</span>
                    <span className={`text-xs font-semibold tabular-nums ${projectedCreditRemainingArs != null && projectedCreditRemainingArs <= 0 ? "text-red-400" : dk("text-gray-300", "text-[#525252]")}`}>
                      {projectedCreditRemainingDisplay}
                    </span>
                  </div>
                </>
              )}
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Pago</span>
                <span className={`text-xs font-semibold ${dk("text-gray-300", "text-[#525252]")}`}>
                  {paymentSummaryLabel}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Logística</span>
                <span className={`text-xs font-semibold ${dk("text-gray-300", "text-[#525252]")}`}>
                  {shippingType === "envio" ? (selectedShippingEstimate?.label || TRANSPORT_LABELS[shippingTransport]) : "Retiro"}
                </span>
              </div>
              {shippingType === "envio" && selectedShippingEstimate && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">ETA estimado</span>
                  <span className={`text-xs font-semibold ${dk("text-gray-300", "text-[#525252]")}`}>
                    {selectedShippingEstimate.days_min}-{selectedShippingEstimate.days_max} días
                  </span>
                </div>
              )}
              <div className={`flex justify-between items-start pt-3 mt-1 border-t ${dk("border-[#1a1a1a]", "border-[#e5e5e5]")}`}>
                <div>
                  <p className={`text-sm font-semibold ${dk("text-gray-300", "text-[#525252]")}`}>Total c/IVA</p>
                  <p className="text-[10px] text-gray-600 font-mono mt-0.5">
                    @ {exchangeRate.rate.toLocaleString("es-AR")} ARS/USD
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-extrabold text-[#2D9F6A] tabular-nums">
                    {formatPrice(grandTotal)}
                  </p>
                  <p className="text-[10px] text-gray-600 font-mono">
                    {currency === "USD" ? formatARS(grandTotal) : formatUSD(grandTotal)}
                  </p>
                </div>
              </div>
            </div>

            {/* Currency strip */}
            <div className={`px-4 py-2 border-t flex items-center justify-between ${dk("border-[#1a1a1a] bg-[#0a0a0a]", "border-[#e5e5e5] bg-[#f9f9f9]")}`}>
              <span className="text-[10px] text-gray-600">
                Moneda: <span className="font-bold text-gray-500">{currency}</span>
              </span>
              <span className="text-[10px] text-gray-700 font-mono">
                1 USD = {exchangeRate.rate.toLocaleString("es-AR")} ARS
              </span>
            </div>

            {(orderMeta.internalReference || orderMeta.branchName || orderMeta.receiverContact || orderMeta.requestedDate || orderMeta.finalClientName || orderMeta.approvalReason) && (
              <div className={`mx-3 my-2 rounded-xl border px-3 py-3 ${dk("border-[#1f1f1f] bg-[#0a0a0a]", "border-[#e5e5e5] bg-[#fafafa]")}`}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">Contexto operativo</p>
                {orderMeta.internalReference && (
                  <p className={`text-[11px] ${dk("text-gray-300", "text-[#525252]")}`}>OC / referencia: <span className="font-semibold">{orderMeta.internalReference}</span></p>
                )}
                {orderMeta.branchName && (
                  <p className={`text-[11px] ${dk("text-gray-300", "text-[#525252]")}`}>Sucursal: <span className="font-semibold">{orderMeta.branchName}</span></p>
                )}
                {orderMeta.receiverContact && (
                  <p className={`text-[11px] ${dk("text-gray-300", "text-[#525252]")}`}>Recibe: <span className="font-semibold">{orderMeta.receiverContact}</span></p>
                )}
                {orderMeta.requestedDate && (
                  <p className={`text-[11px] ${dk("text-gray-300", "text-[#525252]")}`}>Fecha requerida: <span className="font-semibold">{new Date(orderMeta.requestedDate).toLocaleDateString("es-AR")}</span></p>
                )}
                {orderMeta.finalClientName && (
                  <p className={`text-[11px] ${dk("text-gray-300", "text-[#525252]")}`}>Cliente final: <span className="font-semibold">{orderMeta.finalClientName}</span></p>
                )}
                {orderMeta.approvalReason && (
                  <p className={`text-[11px] ${dk("text-gray-300", "text-[#525252]")}`}>Revisión comercial solicitada</p>
                )}
              </div>
            )}

            {/* Validation errors */}
            {validationErrors.length > 0 && (
              <div className="mx-3 my-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <AlertCircle size={12} className="text-red-400 shrink-0" />
                  <span className="text-[11px] font-bold text-red-400">No se puede confirmar</span>
                </div>
                <ul className="space-y-0.5">
                  {validationErrors.map((e, i) => (
                    <li key={i} className="text-[11px] text-red-300">• {e}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* List saved feedback */}
            {listSaved && (
              <div className="mx-3 mb-2 p-2.5 rounded-lg bg-[#2D9F6A]/10 border border-[#2D9F6A]/20 flex items-center gap-2">
                <CheckCircle2 size={12} className="text-[#2D9F6A] shrink-0" />
                <span className="text-[11px] text-[#2D9F6A]">Lista guardada correctamente</span>
              </div>
            )}

            {templateSaved && (
              <div className="mx-3 mb-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2">
                <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                <span className="text-[11px] text-emerald-300">Plantilla de compra guardada</span>
              </div>
            )}

            {draftSaved && (
              <div className="mx-3 mb-2 p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center gap-2">
                <CheckCircle2 size={12} className="text-blue-400 shrink-0" />
                <span className="text-[11px] text-blue-300">Borrador del checkout guardado</span>
              </div>
            )}

            {reviewRequested && (
              <div className="mx-3 mb-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-2">
                <Clock3 size={12} className="text-amber-400 shrink-0" />
                <span className="text-[11px] text-amber-300">Se envió a revisión comercial como cotización</span>
              </div>
            )}

            {cartItems.length > 0 && (
              <div className={`mx-3 mb-2 rounded-xl border px-3 py-3 ${dk("border-[#1f1f1f] bg-[#0a0a0a]", "border-[#e5e5e5] bg-[#fafafa]")}`}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">Plantillas de compra</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={templateName}
                    onChange={(event) => setTemplateName(event.target.value)}
                    placeholder="Nombre de plantilla"
                    className={`w-full min-w-0 sm:flex-1 rounded-lg border px-3 py-2 text-sm outline-none ${dk("bg-[#111] border-[#262626] text-white placeholder:text-[#404040]", "bg-white border-[#e5e5e5] text-[#171717] placeholder:text-[#a3a3a3]")}`}
                  />
                  <button
                    onClick={handleSaveTemplate}
                    className="w-full sm:w-auto sm:shrink-0 rounded-lg bg-[#2D9F6A] hover:bg-[#25835A] text-white text-xs font-bold px-3 py-2 transition"
                  >
                    Guardar
                  </button>
                </div>
                {checkoutTemplates.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {checkoutTemplates.slice(0, 4).map((template) => (
                      <div key={template.id} className={`rounded-lg border px-3 py-2 ${dk("border-[#1f1f1f] bg-[#111]", "border-[#e5e5e5] bg-white")}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className={`text-xs font-semibold ${dk("text-white", "text-[#171717]")}`}>{template.name}</p>
                            <p className="text-[11px] text-gray-500">
                              {template.branchName} - {template.clientType} - {template.paymentMethod}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApplyTemplate(template)}
                              className="text-[11px] font-semibold text-[#2D9F6A]"
                            >
                              Aplicar
                            </button>
                            <button
                              onClick={() => handleDeleteTemplate(template.id)}
                              className="text-[11px] font-semibold text-red-400"
                            >
                              Borrar
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className={`px-4 py-4 space-y-2 border-t ${dk("border-[#1a1a1a]", "border-[#e5e5e5]")}`}>
              <button
                onClick={() => { void handleExportPDF(); }}
                disabled={cartItems.length === 0}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm border transition-all disabled:opacity-40 disabled:pointer-events-none
                  ${dk("border-[#1f1f1f] hover:border-[#2D9F6A]/40 text-[#737373] hover:text-[#2D9F6A] hover:bg-[#0d1f17]", "border-[#e5e5e5] hover:border-[#2D9F6A]/30 text-gray-500 hover:text-[#2D9F6A] hover:bg-green-50")}`}
              >
                <FileDown size={14} />
                Generar cotización PDF
              </button>
              <button
                onClick={handleSaveDraft}
                disabled={cartItems.length === 0}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm border transition-all disabled:opacity-40 disabled:pointer-events-none
                  ${dk("border-[#1f1f1f] hover:border-blue-500/40 text-[#737373] hover:text-blue-300 hover:bg-[#101826]", "border-[#e5e5e5] hover:border-blue-300 text-gray-500 hover:text-blue-600 hover:bg-blue-50")}`}
              >
                <Save size={14} />
                Guardar borrador
              </button>
              {savedDraftAt && (
                <div className={`rounded-xl border px-3 py-2 ${dk("border-[#1f1f1f] bg-[#0a0a0a]", "border-[#e5e5e5] bg-[#fafafa]")}`}>
                  <p className="text-[11px] text-gray-500">
                    Borrador guardado {new Date(savedDraftAt).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={handleRestoreDraft}
                      className={`flex-1 rounded-lg border px-2.5 py-2 text-xs font-semibold transition ${dk("border-[#262626] text-gray-300 hover:bg-[#171717]", "border-[#e5e5e5] text-[#525252] hover:bg-white")}`}
                    >
                      Restaurar
                    </button>
                    <button
                      onClick={clearSavedDraft}
                      className={`flex-1 rounded-lg border px-2.5 py-2 text-xs font-semibold transition ${dk("border-[#262626] text-gray-400 hover:text-red-400 hover:bg-[#171717]", "border-[#e5e5e5] text-[#737373] hover:text-red-600 hover:bg-white")}`}
                    >
                      Limpiar
                    </button>
                  </div>
                </div>
              )}
              <button
                onClick={handleSaveList}
                disabled={cartItems.length === 0}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm border transition-all disabled:opacity-40 disabled:pointer-events-none
                  ${dk("border-[#1f1f1f] hover:border-[#2e2e2e] text-[#737373] hover:text-gray-200 hover:bg-[#171717]", "border-[#e5e5e5] hover:border-[#d4d4d4] text-gray-500 hover:text-gray-700")}`}
              >
                <Bookmark size={14} />
                Guardar como lista
              </button>
              <button
                onClick={handleSaveQuote}
                disabled={cartItems.length === 0}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm border transition-all disabled:opacity-40 disabled:pointer-events-none
                  ${dk("border-[#1f1f1f] hover:border-[#2e2e2e] text-[#737373] hover:text-gray-200 hover:bg-[#171717]", "border-[#e5e5e5] hover:border-[#d4d4d4] text-gray-500 hover:text-gray-700")}`}
              >
                <FileText size={14} />
                Guardar cotización
              </button>
              <button
                onClick={handleRequestReview}
                disabled={cartItems.length === 0 || reviewSubmitting}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm border transition-all disabled:opacity-40 disabled:pointer-events-none
                  ${dk("border-[#3a2c10] hover:border-amber-500/40 text-amber-300 hover:text-amber-200 hover:bg-[#241a08]", "border-amber-200 hover:border-amber-300 text-amber-700 hover:text-amber-800 hover:bg-amber-50")}`}
              >
                {reviewSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Solicitar revisión comercial
              </button>
              <button
                disabled={cartItems.length === 0 || orderSubmitting}
                onClick={handleConfirmOrder}
                className="w-full flex items-center justify-center gap-2 bg-[#2D9F6A] hover:bg-[#25835A] active:scale-[0.98] text-white font-bold rounded-xl py-3 text-sm transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                {orderSubmitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Confirmando pedido...
                  </>
                ) : (
                  "Confirmar pedido"
                )}
              </button>
            </div>

          </div>
        </aside>

      </div>
      </div>
    </div>
  );
}


