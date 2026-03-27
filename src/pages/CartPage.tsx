import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useProducts } from "@/hooks/useProducts";
import { useOrders } from "@/hooks/useOrders";
import { useQuotes } from "@/hooks/useQuotes";
import { usePricingRules } from "@/hooks/usePricingRules";
import { useCurrency } from "@/context/CurrencyContext";
import { generateQuotePDF } from "@/components/QuotePDF";
import { getAvailableStock } from "@/lib/pricing";
import { resolveMarginWithContext } from "@/lib/pricingEngine";
import type { Product } from "@/models/products";
import {
  ArrowLeft, ShoppingCart, AlertTriangle, AlertCircle, Minus, Plus,
  Trash2, FileDown, Bookmark, CheckCircle2, Loader2, TrendingUp,
  Truck, MapPin, FileText, Package2, CreditCard, ToggleLeft, ToggleRight,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface CartItem {
  product: Product;
  quantity: number;
  cost: number;
  margin: number;
  isVolumePricing?: boolean;
  unitPrice: number;       // sin IVA
  totalPrice: number;      // sin IVA × qty
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

// ── Component ─────────────────────────────────────────────────────────────────

export default function CartPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { products, loading: productsLoading } = useProducts();
  const { addOrder, orders } = useOrders();
  const { addQuote } = useQuotes(profile?.id || "guest");
  const { rules: pricingRules } = usePricingRules();
  const {
    currency, formatPrice, formatUSD, formatARS, exchangeRate, convertPrice,
  } = useCurrency();

  const cartKey     = `b2b_cart_${profile?.id || "guest"}`;
  const globalMargin = profile?.default_margin ?? 20;
  const clientName  = profile?.company_name ?? profile?.contact_name ?? "Cliente";

  // ── Cart state (synced to localStorage) ─────────────────────────────────────
  const [cart, setCart] = useState<Record<number, number>>(() => {
    try { return JSON.parse(localStorage.getItem(cartKey) || "{}"); }
    catch { return {}; }
  });
  useEffect(() => {
    localStorage.setItem(cartKey, JSON.stringify(cart));
  }, [cart, cartKey]);

  // ── Theme (read-only from B2BPortal preference) ──────────────────────────────
  const [theme] = useState<"dark" | "light">(() =>
    localStorage.getItem("b2b_theme") === "light" ? "light" : "dark"
  );
  const isDark = theme === "dark";
  const dk = (d: string, l: string) => (isDark ? d : l);

  // ── Reseller mode ────────────────────────────────────────────────────────────
  const [resellerMode,   setResellerMode]   = useState(false);
  const [resellerMargin, setResellerMargin] = useState(15);

  // ── Payment ──────────────────────────────────────────────────────────────────
  const [paymentMethod,   setPaymentMethod]   = useState<PaymentMethod>("transferencia");
  const [paymentSurcharge, setPaymentSurcharge] = useState("");

  // ── Shipping ─────────────────────────────────────────────────────────────────
  const [shippingType,      setShippingType]      = useState<ShippingType>("retiro");
  const [shippingAddress,   setShippingAddress]   = useState("");
  const [shippingTransport, setShippingTransport] = useState<Transport>("andreani");
  const [shippingCost,      setShippingCost]      = useState("");

  // ── Notes ────────────────────────────────────────────────────────────────────
  const [notes, setNotes] = useState("");

  // ── UI ───────────────────────────────────────────────────────────────────────
  const [orderSubmitting,   setOrderSubmitting]   = useState(false);
  const [orderSuccess,      setOrderSuccess]      = useState(false);
  const [validationErrors,  setValidationErrors]  = useState<string[]>([]);
  const [listSaved,         setListSaved]         = useState(false);

  // ── Cart items — per-product pricing rules applied ───────────────────────────
  const cartItems: CartItem[] = useMemo(() => {
    return Object.entries(cart)
      .map(([id, qty]) => {
        const product = products.find((p) => p.id === Number(id));
        if (!product) return null;
        const cost       = product.cost_price;
        const { margin, isVolumePricing } = resolveMarginWithContext(
          product, pricingRules, globalMargin, profile?.id, qty
        );
        const unitPrice  = cost * (1 + margin / 100);
        const totalPrice = unitPrice * qty;
        const ivaRate    = product.iva_rate ?? 21;
        const ivaAmount  = totalPrice * (ivaRate / 100);
        const availableStock = getAvailableStock(product);
        const minQty = product.min_order_qty ?? product.stock_min ?? 0;
        return {
          product,
          quantity: qty,
          cost,
          margin,
          isVolumePricing,
          unitPrice,
          totalPrice,
          ivaRate,
          ivaAmount,
          totalWithIVA:    totalPrice + ivaAmount,
          availableStock,
          hasStockError:   qty > availableStock && availableStock >= 0,
          hasStockWarning: qty <= availableStock && availableStock > 0 && availableStock <= 3,
          hasMOQError:     minQty > 0 && qty < minQty,
        };
      })
      .filter((i): i is CartItem => i !== null);
  }, [cart, products, globalMargin, pricingRules, profile?.id]);

  const cartSubtotal     = useMemo(() => cartItems.reduce((s, i) => s + i.totalPrice, 0), [cartItems]);
  const cartIVATotal     = useMemo(() => cartItems.reduce((s, i) => s + i.ivaAmount,  0), [cartItems]);
  const cartBaseTotal    = cartSubtotal + cartIVATotal;
  const surchargeNum     = Number(paymentSurcharge || 0);
  const surchargeAmt     = cartBaseTotal * (surchargeNum / 100);
  const shippingCostNum  = shippingType === "envio" ? Number(shippingCost || 0) : 0;
  const grandTotal       = cartBaseTotal + surchargeAmt + shippingCostNum;
  const resellerProfit   = cartSubtotal * (resellerMargin / 100);

  // ── Qty helpers ──────────────────────────────────────────────────────────────
  function addQty(productId: number) {
    setCart((prev) => ({ ...prev, [productId]: (prev[productId] || 0) + 1 }));
  }
  function removeQty(productId: number) {
    setCart((prev) => {
      const qty = prev[productId] || 0;
      if (qty <= 1) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [productId]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [productId]: qty - 1 };
    });
  }
  function setQty(productId: number, qty: number) {
    if (qty <= 0) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [productId]: _removed, ...rest } = cart;
      setCart(rest);
    } else {
      setCart((prev) => ({ ...prev, [productId]: qty }));
    }
  }
  function removeItem(productId: number) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [productId]: _removed, ...rest } = cart;
    setCart(rest);
  }

  // ── Credit limit ─────────────────────────────────────────────────────────────
  const creditLimit  = (profile as any)?.credit_limit as number | undefined;
  const creditUsed   = useMemo(() =>
    orders
      .filter((o) => o.status === "pending" || o.status === "approved")
      .reduce((s, o) => s + (o.total ?? 0), 0),
  [orders]);
  // credit_limit === 0 means "unlimited / not configured" — no restriction applied
  const creditAvailable = (creditLimit != null && creditLimit > 0)
    ? Math.max(0, creditLimit - creditUsed)
    : null;

  // ── Validation ───────────────────────────────────────────────────────────────
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
    if (creditAvailable != null && grandTotal > creditAvailable) {
      errs.push(`Límite de crédito insuficiente. Disponible: USD ${creditAvailable.toFixed(0)}, pedido: USD ${grandTotal.toFixed(0)}.`);
    }
    return errs;
  }

  // ── Confirm order ─────────────────────────────────────────────────────────────
  async function handleConfirmOrder() {
    const errs = validate();
    if (errs.length) { setValidationErrors(errs); return; }
    setValidationErrors([]);
    setOrderSubmitting(true);

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
      payment_surcharge_pct: surchargeNum || undefined,
      shipping_type:         shippingType,
      shipping_address:      shippingType === "envio" ? shippingAddress || undefined : undefined,
      shipping_transport:    shippingType === "envio" ? shippingTransport : undefined,
      shipping_cost:         shippingType === "envio" && shippingCostNum > 0 ? shippingCostNum : undefined,
      notes:                 notes.trim() || undefined,
      created_at:            new Date().toISOString(),
    });

    setOrderSubmitting(false);
    if (!error) {
      setOrderSuccess(true);
      setCart({});
      setTimeout(() => navigate("/b2b-portal"), 2200);
    } else {
      setValidationErrors([`Error al confirmar pedido: ${error}`]);
    }
  }

  // ── Save quote ────────────────────────────────────────────────────────────────
  async function handleSaveQuote() {
    if (!cartItems.length) return;
    await addQuote({
      client_id:   profile?.id || "guest",
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
      created_at:  new Date().toISOString(),
      updated_at:  new Date().toISOString(),
    });
    navigate("/b2b-portal?tab=quotes");
  }

  // ── Export PDF ────────────────────────────────────────────────────────────────
  function handleExportPDF() {
    const extraMarginFactor = resellerMode ? (1 + resellerMargin / 100) : 1;

    generateQuotePDF({
      clientName,
      companyName: "Bartez Tecnología",
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
      showCost: false,
      iva:      true,
    });
  }

  // ── Save as list (template) ───────────────────────────────────────────────────
  function handleSaveList() {
    if (!cartItems.length) return;
    const listsKey = `b2b_saved_lists_${profile?.id || "guest"}`;
    interface SavedList { id: string; name: string; cart: Record<number, number>; created_at: string; }
    let lists: SavedList[] = [];
    try { lists = JSON.parse(localStorage.getItem(listsKey) || "[]"); } catch { /* ignore */ }
    const name = `Lista ${new Date().toLocaleDateString("es-AR")} — ${cartItems.length} productos`;
    lists.unshift({ id: Date.now().toString(), name, cart, created_at: new Date().toISOString() });
    localStorage.setItem(listsKey, JSON.stringify(lists.slice(0, 20)));
    setListSaved(true);
    setTimeout(() => setListSaved(false), 2500);
  }

  // ── Success screen ────────────────────────────────────────────────────────────
  if (orderSuccess) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${dk("bg-[#0a0a0a]", "bg-[#f5f5f5]")}`}>
        <div className="text-center px-6">
          <CheckCircle2 size={52} className="text-[#2D9F6A] mx-auto mb-4" />
          <h2 className={`text-xl font-bold mb-2 ${dk("text-white", "text-[#171717]")}`}>
            ¡Pedido confirmado!
          </h2>
          <p className="text-sm text-gray-500">Redirigiendo a tus pedidos…</p>
        </div>
      </div>
    );
  }

  const hasBlockingErrors = cartItems.some(
    (i) => i.hasStockError || i.product.stock === 0
  );
  const hasWarnings = cartItems.some((i) => i.hasStockWarning || i.hasMOQError);

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className={`min-h-screen ${dk("bg-[#0a0a0a] text-white", "bg-[#f5f5f5] text-[#171717]")}`}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className={`sticky top-0 z-10 ${dk("bg-[#0d0d0d] border-[#1a1a1a]", "bg-white border-[#e5e5e5]")} border-b px-4 md:px-6 py-3 flex items-center gap-3`}>
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
              {cartItems.reduce((s, i) => s + i.quantity, 0)} items · {cartItems.length} refs
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

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="max-w-screen-xl mx-auto px-4 md:px-6 py-6 flex flex-col lg:flex-row gap-6">

        {/* ── LEFT COLUMN ─────────────────────────────────────────────────── */}
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

          {/* ── 1. PRODUCTS TABLE ─────────────────────────────────────────── */}
          {cartItems.length > 0 && (
            <section className={`border rounded-xl overflow-hidden ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
              {/* Section header */}
              <div className={`px-4 py-2.5 border-b flex items-center gap-2 ${dk("border-[#1a1a1a]", "border-[#e5e5e5]")}`}>
                <Package2 size={13} className="text-[#2D9F6A]" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Productos</span>
              </div>
              {/* Column labels — desktop only */}
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
                        <div className={`text-[10px] ${dk("text-[#525252]", "text-[#a3a3a3]")}`}>s/IVA · {item.ivaRate}%</div>
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

          {/* ── 2. MODO REVENDEDOR ─────────────────────────────────────────── */}
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
                  <p className={`text-[10px] sm:ml-auto ${dk("text-[#525252]", "text-[#a3a3a3]")}`}>
                    Solo afecta la exportación PDF — no modifica el pedido real
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

          {/* ── 3. CONDICIONES DE PAGO ────────────────────────────────────── */}
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
                        onChange={() => setPaymentMethod(method)}
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
                <div className="flex items-center gap-3">
                  <label className={`text-xs ${dk("text-gray-500", "text-gray-500")} whitespace-nowrap`}>
                    Recargo (opcional)
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={30}
                      step={0.5}
                      value={paymentSurcharge}
                      onChange={(e) => setPaymentSurcharge(e.target.value)}
                      placeholder="0"
                      className={`w-16 text-center text-sm tabular-nums outline-none rounded-lg px-2 py-1.5 border
                        ${dk("bg-[#1a1a1a] border-[#2a2a2a] text-white focus:border-[#2D9F6A] placeholder-[#525252]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] focus:border-[#2D9F6A]")}`}
                    />
                    <span className="text-sm text-gray-500">%</span>
                  </div>
                  {surchargeNum > 0 && (
                    <span className="text-xs font-semibold text-amber-400 tabular-nums">
                      + {formatPrice(surchargeAmt)}
                    </span>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* ── 4. LOGÍSTICA ──────────────────────────────────────────────── */}
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
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={`text-xs block mb-1.5 ${dk("text-gray-500", "text-gray-500")}`}>Transporte</label>
                        <select
                          value={shippingTransport}
                          onChange={(e) => setShippingTransport(e.target.value as Transport)}
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
                          Costo de envío (opcional)
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

          {/* ── 5. OBSERVACIONES ──────────────────────────────────────────── */}
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
                  placeholder="Notas del pedido, condiciones de entrega, aclaraciones especiales…"
                  className={`w-full text-sm outline-none rounded-lg px-3 py-2.5 border resize-none transition
                    ${dk("bg-[#1a1a1a] border-[#2a2a2a] text-white focus:border-[#2D9F6A] placeholder-[#525252]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] focus:border-[#2D9F6A] placeholder-[#a3a3a3]")}`}
                />
              </div>
            </section>
          )}

        </div>

        {/* ── RIGHT COLUMN — SUMMARY + ACTIONS ──────────────────────────── */}
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
              {surchargeNum > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-amber-400">Recargo pago {surchargeNum}%</span>
                  <span className="text-xs font-semibold text-amber-400 tabular-nums">
                    + {formatPrice(surchargeAmt)}
                  </span>
                </div>
              )}
              {shippingType === "envio" && shippingCostNum > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Envío</span>
                  <span className={`text-xs font-semibold tabular-nums ${dk("text-gray-300", "text-[#525252]")}`}>
                    + {formatPrice(shippingCostNum)}
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

            {/* Validation errors */}
            {validationErrors.length > 0 && (
              <div className="mx-3 my-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <AlertCircle size={12} className="text-red-400 shrink-0" />
                  <span className="text-[11px] font-bold text-red-400">No se puede confirmar</span>
                </div>
                <ul className="space-y-0.5">
                  {validationErrors.map((e, i) => (
                    <li key={i} className="text-[11px] text-red-300">· {e}</li>
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

            {/* Actions */}
            <div className={`px-4 py-4 space-y-2 border-t ${dk("border-[#1a1a1a]", "border-[#e5e5e5]")}`}>
              <button
                onClick={handleExportPDF}
                disabled={cartItems.length === 0}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm border transition-all disabled:opacity-40 disabled:pointer-events-none
                  ${dk("border-[#1f1f1f] hover:border-[#2D9F6A]/40 text-[#737373] hover:text-[#2D9F6A] hover:bg-[#0d1f17]", "border-[#e5e5e5] hover:border-[#2D9F6A]/30 text-gray-500 hover:text-[#2D9F6A] hover:bg-green-50")}`}
              >
                <FileDown size={14} />
                Generar cotización PDF
              </button>
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
                disabled={cartItems.length === 0 || orderSubmitting}
                onClick={handleConfirmOrder}
                className="w-full flex items-center justify-center gap-2 bg-[#2D9F6A] hover:bg-[#25835A] active:scale-[0.98] text-white font-bold rounded-xl py-3 text-sm transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                {orderSubmitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Confirmando pedido…
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
  );
}
