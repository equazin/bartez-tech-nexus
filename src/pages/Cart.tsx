import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Minus, Moon, Plus, Save, ShoppingCart, Sun } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useProducts } from "@/hooks/useProducts";
import { useOrders } from "@/hooks/useOrders";
import { useCurrency } from "@/context/CurrencyContext";
import { useQuotes } from "@/hooks/useQuotes";
import { getUnitPrice, getAvailableStock } from "@/lib/pricing";
import { saveCart } from "@/lib/savedCarts";
import { generateQuotePdfOnDemand } from "@/lib/quotePdfClient";
import type { Product } from "@/models/products";

type CartItem = {
  product: Product;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  ivaRate: number;
  ivaAmount: number;
  totalWithIVA: number;
  available: number;
};

const paymentMethods = [
  "Transferencia bancaria",
  "Echeq",
  "Cuenta corriente",
  "Efectivo",
  "Otro",
] as const;

const transportMethods = ["Andreani", "OCA", "Expreso", "Comisionista", "Otro"] as const;

export default function Cart() {
  const navigate = useNavigate();
  const { profile, isAdmin } = useAuth();
  const { products } = useProducts();
  const { addOrder } = useOrders();
  const { addQuote } = useQuotes(profile?.id || "guest");
  const { formatPrice, formatUSD, formatARS, currency, exchangeRate, convertPrice } = useCurrency();

  const cartKey = `b2b_cart_${profile?.id || "guest"}`;
  const defaultMargin = profile?.default_margin ?? 20;

  const [cart, setCart] = useState<Record<number, number>>({});
  const [productMargins, setProductMargins] = useState<Record<number, number>>({});
  const [globalMargin] = useState(defaultMargin);
  const [confirming, setConfirming] = useState(false);
  const [saveListName, setSaveListName] = useState("");
  const [exportForClient, setExportForClient] = useState(false);
  const [exportMargin, setExportMargin] = useState(12);
  const [paymentMethod, setPaymentMethod] = useState<(typeof paymentMethods)[number]>("Transferencia bancaria");
  const [paymentSurchargePct, setPaymentSurchargePct] = useState(0);
  const [shippingType, setShippingType] = useState<"Retiro en sucursal" | "Envío">("Retiro en sucursal");
  const [shippingAddress, setShippingAddress] = useState("");
  const [shippingTransport, setShippingTransport] = useState<(typeof transportMethods)[number]>("Andreani");
  const [shippingCost, setShippingCost] = useState(0);
  const [notes, setNotes] = useState("");
  const [priceSnapshots, setPriceSnapshots] = useState<Record<number, number>>({});
  const [minOrderTotal, setMinOrderTotal] = useState<number>(() => {
    const raw = localStorage.getItem("b2b_min_order_total");
    return raw ? Number(raw) || 0 : 0;
  });
  const THEME_KEY = "b2b_theme";
  const [theme, setTheme] = useState<"dark" | "light">(() =>
    localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark"
  );
  const isDark = theme === "dark";
  const dk = (d: string, l: string) => (isDark ? d : l);
  const toggleTheme = () => {
    const next = isDark ? "light" : "dark";
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
  };

  useEffect(() => {
    try {
      setCart(JSON.parse(localStorage.getItem(cartKey) || "{}"));
    } catch {
      setCart({});
    }
  }, [cartKey]);

  useEffect(() => {
    localStorage.setItem(cartKey, JSON.stringify(cart));
  }, [cart, cartKey]);

  useEffect(() => {
    const key = `b2b_cart_price_snapshot_${profile?.id || "guest"}`;
    let snapshot: Record<number, number> = {};
    try {
      snapshot = JSON.parse(localStorage.getItem(key) || "{}");
    } catch {
      snapshot = {};
    }
    const nextSnapshot = { ...snapshot };
    Object.keys(cart).forEach((idStr) => {
      const id = Number(idStr);
      if (nextSnapshot[id] != null) return;
      const product = products.find((p) => p.id === id);
      if (!product) return;
      const qty = cart[id] ?? 1;
      const margin = productMargins[id] ?? globalMargin;
      const unit = getUnitPrice(product, qty) * (1 + margin / 100);
      nextSnapshot[id] = Number(unit.toFixed(2));
    });
    localStorage.setItem(key, JSON.stringify(nextSnapshot));
    setPriceSnapshots(nextSnapshot);
  }, [cart, products, profile?.id, productMargins, globalMargin]);

  const cartItems = useMemo<CartItem[]>(() => {
    return Object.entries(cart)
      .map(([id, qty]) => {
        const product = products.find((p) => p.id === Number(id));
        if (!product) return null;
        const margin = productMargins[Number(id)] ?? globalMargin;
        const unitPrice = getUnitPrice(product, qty) * (1 + margin / 100);
        const totalPrice = unitPrice * qty;
        const ivaRate = product.iva_rate ?? 21;
        const ivaAmount = totalPrice * (ivaRate / 100);
        return {
          product,
          quantity: qty,
          unitPrice,
          totalPrice,
          ivaRate,
          ivaAmount,
          totalWithIVA: totalPrice + ivaAmount,
          available: getAvailableStock(product),
        };
      })
      .filter((item): item is CartItem => item !== null);
  }, [cart, products, productMargins, globalMargin]);

  const subtotal = cartItems.reduce((s, i) => s + i.totalPrice, 0);
  const ivaTotal = cartItems.reduce((s, i) => s + i.ivaAmount, 0);
  const baseTotal = subtotal + ivaTotal;
  const surchargeAmount = baseTotal * (paymentSurchargePct / 100);
  const shipping = shippingType === "Envío" ? Math.max(0, shippingCost) : 0;
  const total = baseTotal + surchargeAmount + shipping;

  const resellerTotal = useMemo(() => {
    if (!exportForClient) return 0;
    return cartItems.reduce((sum, item) => {
      const exportUnit = item.unitPrice * (1 + exportMargin / 100);
      return sum + exportUnit * item.quantity;
    }, 0);
  }, [cartItems, exportForClient, exportMargin]);

  const resellerGain = Math.max(0, resellerTotal - subtotal);

  const stockBlockingErrors = cartItems
    .filter((i) => i.quantity > i.available)
    .map((i) => `${i.product.name}: sin stock suficiente (${i.available} disponible)`);
  const minQtyErrors = cartItems
    .filter((i) => i.quantity < (i.product.min_order_qty ?? 1))
    .map((i) => `${i.product.name}: mínimo ${(i.product.min_order_qty ?? 1)} unidades`);
  const minTotalError = minOrderTotal > 0 && total < minOrderTotal
    ? `El pedido mínimo es ${formatPrice(minOrderTotal)}`
    : null;
  const hasBlockingError = stockBlockingErrors.length > 0 || minQtyErrors.length > 0 || !!minTotalError;

  function updateQty(productId: number, nextQty: number) {
    if (nextQty <= 0) {
      setCart((prev) => {
        const { [productId]: _removed, ...rest } = prev;
        return rest;
      });
      return;
    }
    setCart((prev) => ({ ...prev, [productId]: nextQty }));
  }

  function saveAsList() {
    const uid = profile?.id || "guest";
    const rawMargins: Record<number, number> = {};
    cartItems.forEach((i) => {
      rawMargins[i.product.id] = productMargins[i.product.id] ?? globalMargin;
    });
    saveCart(uid, saveListName || "Lista mayorista", cart, rawMargins);
    setSaveListName("");
  }

  async function generateQuote() {
    if (!cartItems.length) return;
    const multiplier = exportForClient ? 1 + exportMargin / 100 : 1;
    const quoteProducts = cartItems.map((item) => {
      const quoteUnit = item.unitPrice * multiplier;
      const quoteTotal = quoteUnit * item.quantity;
      const quoteIva = quoteTotal * (item.ivaRate / 100);
      return {
        name: item.product.name,
        quantity: item.quantity,
        price: Number(convertPrice(quoteUnit).toFixed(2)),
        total: Number(convertPrice(quoteTotal).toFixed(2)),
        ivaRate: item.ivaRate,
        ivaAmount: Number(convertPrice(quoteIva).toFixed(2)),
        totalWithIVA: Number(convertPrice(quoteTotal + quoteIva).toFixed(2)),
      };
    });
    const quoteSubtotal = quoteProducts.reduce((s, p) => s + p.total, 0);
    const quoteIVA = quoteProducts.reduce((s, p) => s + p.ivaAmount, 0);
    await generateQuotePdfOnDemand({
      clientName: profile?.company_name || profile?.contact_name || "Cliente",
      companyName: "Bartez Tecnología",
      currency,
      products: quoteProducts,
      subtotal: Number(quoteSubtotal.toFixed(2)),
      ivaTotal: Number(quoteIVA.toFixed(2)),
      total: Number((quoteSubtotal + quoteIVA).toFixed(2)),
      date: new Date().toLocaleDateString("es-AR"),
      showCost: false,
      iva: true,
    });
  }

  async function confirmOrder() {
    if (!cartItems.length || hasBlockingError) return;
    setConfirming(true);
    const orderProducts = cartItems.map((item) => ({
      product_id: item.product.id,
      name: item.product.name,
      sku: item.product.sku || "",
      quantity: item.quantity,
      cost_price: getUnitPrice(item.product, item.quantity),
      unit_price: Number(item.unitPrice.toFixed(2)),
      total_price: Number(item.totalPrice.toFixed(2)),
      margin: productMargins[item.product.id] ?? globalMargin,
    }));
    // order_number is now generated server-side by the reserve_stock_and_create_order RPC
    const { error } = await addOrder({
      products: orderProducts,
      total: Number(total.toFixed(2)),
      status: "pending",
      payment_method: paymentMethod,
      payment_surcharge_pct: paymentSurchargePct,
      shipping_type: shippingType,
      shipping_address: shippingType === "Envío" ? shippingAddress : "",
      shipping_transport: shippingType === "Envío" ? shippingTransport : "",
      shipping_cost: shipping,
      notes,
      created_at: new Date().toISOString(),
    });
    if (!error) {
      // Stock reservation is handled atomically inside the RPC — no manual update needed

      addQuote({
        client_id: profile?.id || "guest",
        client_name: profile?.company_name || profile?.contact_name || "Cliente",
        items: cartItems.map((item) => ({
          product_id: item.product.id,
          name: item.product.name,
          quantity: item.quantity,
          cost: item.unitPrice,
          margin: productMargins[item.product.id] ?? globalMargin,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          ivaRate: item.ivaRate,
          ivaAmount: item.ivaAmount,
          totalWithIVA: item.totalWithIVA,
        })),
        subtotal,
        ivaTotal,
        total,
        currency,
        status: "draft",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      localStorage.setItem(cartKey, JSON.stringify({}));
      setCart({});
      navigate("/b2b-portal");
    }
    setConfirming(false);
  }

  return (
    <div className={`min-h-screen p-4 md:p-6 ${dk("bg-[#0a0a0a]", "bg-[#f5f5f5]")}`}>
      <div className="mx-auto max-w-[1400px] space-y-4">
        <div className={`flex items-center justify-between rounded-xl border px-4 py-3 ${dk("border-[#1f1f1f] bg-[#111]", "border-[#e5e5e5] bg-white")}`}>
          <div className="flex items-center gap-3">
            <Link to="/b2b-portal" className={`rounded-lg border px-3 py-1.5 text-sm ${dk("border-[#2a2a2a] text-[#a3a3a3] hover:bg-[#1c1c1c]", "border-[#e5e5e5] text-[#525252] hover:bg-[#f5f5f5]")}`}>
              <span className="inline-flex items-center gap-1"><ArrowLeft size={14} /> Volver</span>
            </Link>
            <h1 className={`inline-flex items-center gap-2 text-lg font-bold ${dk("text-white", "text-[#171717]")}`}>
              <ShoppingCart size={18} /> Pedido mayorista
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className={`rounded-lg border px-2.5 py-1.5 text-xs ${dk("border-[#2a2a2a] text-[#a3a3a3] hover:bg-[#1c1c1c]", "border-[#e5e5e5] text-[#525252] hover:bg-[#f5f5f5]")}`}
              title={isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
            >
              <span className="inline-flex items-center gap-1">{isDark ? <Sun size={13} /> : <Moon size={13} />}{isDark ? "Claro" : "Oscuro"}</span>
            </button>
            {isAdmin && (
            <div className="flex items-center gap-2 text-xs">
              <span className={dk("text-[#737373]", "text-[#737373]")}>Mínimo pedido</span>
              <input
                type="number"
                value={minOrderTotal}
                onChange={(e) => {
                  const next = Math.max(0, Number(e.target.value) || 0);
                  setMinOrderTotal(next);
                  localStorage.setItem("b2b_min_order_total", String(next));
                }}
                className={`w-28 rounded border px-2 py-1 text-right ${dk("bg-[#0d0d0d] border-[#2a2a2a] text-white", "bg-white border-[#e5e5e5] text-[#171717]")}`}
              />
            </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.8fr_1fr]">
          <section className={`rounded-xl border ${dk("border-[#1f1f1f] bg-[#111]", "border-[#e5e5e5] bg-white")}`}>
            <div className={`border-b px-4 py-3 text-sm font-semibold ${dk("border-[#1f1f1f] text-white", "border-[#f0f0f0] text-[#171717]")}`}>
              Productos del pedido ({cartItems.length})
            </div>
            <div className="max-h-[540px] overflow-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className={`${dk("bg-[#0d0d0d] text-[#737373]", "bg-[#fafafa] text-[#737373]")} text-[11px] uppercase`}>
                    <th className="px-3 py-2 text-left">SKU</th>
                    <th className="px-3 py-2 text-left">Producto</th>
                    <th className="px-3 py-2 text-center">Cant.</th>
                    <th className="px-3 py-2 text-right">Unitario final</th>
                    <th className="px-3 py-2 text-right">Total línea</th>
                  </tr>
                </thead>
                <tbody>
                  {cartItems.map((item) => {
                    const lowStock = item.available <= Math.max(3, item.product.stock_min ?? 0);
                    const snapshot = priceSnapshots[item.product.id];
                    const priceChanged = snapshot != null && Math.abs(snapshot - item.unitPrice) > 0.01;
                    return (
                      <tr key={item.product.id} className={`border-t ${dk("border-[#1f1f1f]", "border-[#f0f0f0]")}`}>
                        <td className={`px-3 py-2 font-mono text-[11px] ${dk("text-[#a3a3a3]", "text-[#525252]")}`}>{item.product.sku || "—"}</td>
                        <td className="px-3 py-2">
                          <div className={`font-medium ${dk("text-white", "text-[#171717]")}`}>{item.product.name}</div>
                          <div className="mt-0.5 flex flex-wrap gap-2 text-[11px]">
                            <span className={dk("text-[#737373]", "text-[#737373]")}>Disp: {item.available} / Reservado: {item.product.stock_reserved ?? 0}</span>
                            {lowStock && <span className="text-amber-600">Stock bajo</span>}
                            {priceChanged && <span className="text-red-600">Precio actualizado</span>}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="mx-auto flex w-fit items-center gap-1">
                            <button className={`rounded border p-1 ${dk("border-[#2a2a2a] text-white", "border-[#e5e5e5] text-[#171717]")}`} onClick={() => updateQty(item.product.id, item.quantity - 1)}><Minus size={12} /></button>
                            <span className={`w-10 text-center font-semibold ${dk("text-white", "text-[#171717]")}`}>{item.quantity}</span>
                            <button className={`rounded border p-1 ${dk("border-[#2a2a2a] text-white", "border-[#e5e5e5] text-[#171717]")}`} onClick={() => updateQty(item.product.id, item.quantity + 1)}><Plus size={12} /></button>
                          </div>
                        </td>
                        <td className={`px-3 py-2 text-right font-semibold ${dk("text-white", "text-[#171717]")}`}>{formatPrice(item.unitPrice)}</td>
                        <td className={`px-3 py-2 text-right font-bold ${dk("text-white", "text-[#171717]")}`}>{formatPrice(item.totalWithIVA)}</td>
                      </tr>
                    );
                  })}
                  {!cartItems.length && (
                    <tr>
                      <td colSpan={5} className={`px-3 py-10 text-center text-sm ${dk("text-[#737373]", "text-[#737373]")}`}>No hay productos en el carrito.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-4">
            <div className={`rounded-xl border p-4 ${dk("border-[#1f1f1f] bg-[#111]", "border-[#e5e5e5] bg-white")}`}>
              <label className={`flex items-center gap-2 text-sm font-semibold ${dk("text-white", "text-[#171717]")}`}>
                <input type="checkbox" checked={exportForClient} onChange={(e) => setExportForClient(e.target.checked)} />
                Exportar para tu cliente
              </label>
              {exportForClient && (
                <div className="mt-3 space-y-2">
                  <div className={`flex items-center justify-between text-xs ${dk("text-[#737373]", "text-[#737373]")}`}>
                    <span>Margen para exportación (%)</span>
                    <input
                      type="number"
                      value={exportMargin}
                      onChange={(e) => setExportMargin(Math.max(0, Number(e.target.value) || 0))}
                      className={`w-20 rounded border px-2 py-1 text-right ${dk("bg-[#0d0d0d] border-[#2a2a2a] text-white", "bg-white border-[#e5e5e5] text-[#171717]")}`}
                    />
                  </div>
                  <div className="rounded-lg bg-[#f8faf8] px-3 py-2 text-sm font-semibold text-[#1a7a50]">
                    Tu ganancia estimada total: {formatPrice(resellerGain)}
                  </div>
                </div>
              )}
            </div>

            <div className={`rounded-xl border p-4 space-y-3 ${dk("border-[#1f1f1f] bg-[#111]", "border-[#e5e5e5] bg-white")}`}>
              <h3 className={`text-sm font-semibold ${dk("text-white", "text-[#171717]")}`}>Condiciones de pago</h3>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as (typeof paymentMethods)[number])} className={`w-full rounded border px-3 py-2 text-sm ${dk("bg-[#0d0d0d] border-[#2a2a2a] text-white", "bg-white border-[#e5e5e5] text-[#171717]")}`}>
                {paymentMethods.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <div className={`flex items-center justify-between text-xs ${dk("text-[#737373]", "text-[#737373]")}`}>
                <span>Recargo automático (%)</span>
                <input type="number" value={paymentSurchargePct} onChange={(e) => setPaymentSurchargePct(Math.max(0, Number(e.target.value) || 0))} className={`w-20 rounded border px-2 py-1 text-right ${dk("bg-[#0d0d0d] border-[#2a2a2a] text-white", "bg-white border-[#e5e5e5] text-[#171717]")}`} />
              </div>
            </div>

            <div className={`rounded-xl border p-4 space-y-3 ${dk("border-[#1f1f1f] bg-[#111]", "border-[#e5e5e5] bg-white")}`}>
              <h3 className={`text-sm font-semibold ${dk("text-white", "text-[#171717]")}`}>Logística / Envío</h3>
              <select value={shippingType} onChange={(e) => setShippingType(e.target.value as "Retiro en sucursal" | "Envío")} className={`w-full rounded border px-3 py-2 text-sm ${dk("bg-[#0d0d0d] border-[#2a2a2a] text-white", "bg-white border-[#e5e5e5] text-[#171717]")}`}>
                <option>Retiro en sucursal</option>
                <option>Envío</option>
              </select>
              {shippingType === "Envío" && (
                <>
                  <input value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} placeholder="Dirección de entrega" className={`w-full rounded border px-3 py-2 text-sm ${dk("bg-[#0d0d0d] border-[#2a2a2a] text-white", "bg-white border-[#e5e5e5] text-[#171717]")}`} />
                  <select value={shippingTransport} onChange={(e) => setShippingTransport(e.target.value as (typeof transportMethods)[number])} className={`w-full rounded border px-3 py-2 text-sm ${dk("bg-[#0d0d0d] border-[#2a2a2a] text-white", "bg-white border-[#e5e5e5] text-[#171717]")}`}>
                    {transportMethods.map((m) => <option key={m}>{m}</option>)}
                  </select>
                  <div className={`flex items-center justify-between text-xs ${dk("text-[#737373]", "text-[#737373]")}`}>
                    <span>Costo de envío</span>
                    <input type="number" value={shippingCost} onChange={(e) => setShippingCost(Math.max(0, Number(e.target.value) || 0))} className={`w-24 rounded border px-2 py-1 text-right ${dk("bg-[#0d0d0d] border-[#2a2a2a] text-white", "bg-white border-[#e5e5e5] text-[#171717]")}`} />
                  </div>
                </>
              )}
            </div>

            <div className={`rounded-xl border p-4 space-y-3 ${dk("border-[#1f1f1f] bg-[#111]", "border-[#e5e5e5] bg-white")}`}>
              <h3 className={`text-sm font-semibold ${dk("text-white", "text-[#171717]")}`}>Observaciones</h3>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Notas del cliente, condiciones de entrega, aclaraciones..." className={`w-full resize-y rounded border px-3 py-2 text-sm ${dk("bg-[#0d0d0d] border-[#2a2a2a] text-white", "bg-white border-[#e5e5e5] text-[#171717]")}`} />
            </div>

            <div className={`rounded-xl border p-4 space-y-2 ${dk("border-[#1f1f1f] bg-[#111]", "border-[#e5e5e5] bg-white")}`}>
              <h3 className={`text-sm font-semibold ${dk("text-white", "text-[#171717]")}`}>Resumen final</h3>
              <div className={`flex justify-between text-sm ${dk("text-[#e5e5e5]", "text-[#171717]")}`}><span className={dk("text-[#737373]", "text-[#737373]")}>Subtotal</span><span>{formatPrice(subtotal)}</span></div>
              <div className={`flex justify-between text-sm ${dk("text-[#e5e5e5]", "text-[#171717]")}`}><span className={dk("text-[#737373]", "text-[#737373]")}>IVA</span><span>{formatPrice(ivaTotal)}</span></div>
              <div className={`flex justify-between text-sm ${dk("text-[#e5e5e5]", "text-[#171717]")}`}><span className={dk("text-[#737373]", "text-[#737373]")}>Recargo pago</span><span>{formatPrice(surchargeAmount)}</span></div>
              <div className={`flex justify-between text-sm ${dk("text-[#e5e5e5]", "text-[#171717]")}`}><span className={dk("text-[#737373]", "text-[#737373]")}>Envío</span><span>{formatPrice(shipping)}</span></div>
              <div className={`pt-2 flex justify-between text-base font-bold border-t ${dk("border-[#1f1f1f] text-white", "border-[#f0f0f0] text-[#171717]")}`}><span>Total final</span><span>{formatPrice(total)}</span></div>
              <div className={`text-[11px] ${dk("text-[#737373]", "text-[#737373]")}`}>Moneda: {currency} · Cotización: {exchangeRate.rate.toLocaleString("es-AR")} ARS/USD · Ref: {currency === "USD" ? formatARS(total) : formatUSD(total)}</div>
            </div>

            {(stockBlockingErrors.length > 0 || minQtyErrors.length > 0 || minTotalError) && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                <div className="mb-1 flex items-center gap-1 font-semibold"><AlertTriangle size={14} /> Validaciones pendientes</div>
                {stockBlockingErrors.map((e) => <div key={e}>- {e}</div>)}
                {minQtyErrors.map((e) => <div key={e}>- {e}</div>)}
                {minTotalError && <div>- {minTotalError}</div>}
              </div>
            )}

            <div className="space-y-2">
              <button onClick={generateQuote} className={`w-full rounded-lg border px-3 py-2 text-sm font-semibold ${dk("border-[#2a2a2a] bg-[#111] text-white hover:bg-[#1c1c1c]", "border-[#e5e5e5] bg-white text-[#171717] hover:bg-[#f5f5f5]")}`}>Generar cotización (PDF)</button>
              <div className="flex gap-2">
                <input value={saveListName} onChange={(e) => setSaveListName(e.target.value)} placeholder="Nombre de lista" className={`flex-1 rounded border px-3 py-2 text-sm ${dk("bg-[#0d0d0d] border-[#2a2a2a] text-white", "bg-white border-[#e5e5e5] text-[#171717]")}`} />
                <button onClick={saveAsList} className={`inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-semibold ${dk("border-[#2a2a2a] bg-[#111] text-white hover:bg-[#1c1c1c]", "border-[#e5e5e5] bg-white text-[#171717] hover:bg-[#f5f5f5]")}`}><Save size={14} /> Guardar</button>
              </div>
              <button
                disabled={confirming || hasBlockingError || !cartItems.length}
                onClick={confirmOrder}
                className="w-full rounded-lg bg-[#2D9F6A] px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {confirming ? "Confirmando..." : "Confirmar pedido"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
