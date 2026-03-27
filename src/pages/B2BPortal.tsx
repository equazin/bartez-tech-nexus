import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { OrderPaymentProof } from "@/components/OrderPaymentProof";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useProducts } from "@/hooks/useProducts";
import { supabase } from "@/lib/supabase";
import { useOrders } from "@/hooks/useOrders";
import { useQuotes } from "@/hooks/useQuotes";
import { usePricingRules } from "@/hooks/usePricingRules";
import { usePurchaseLists } from "@/hooks/usePurchaseLists";
import { resolveMarginWithContext } from "@/lib/pricingEngine";
import { Quote } from "@/models/quote";
import { QuoteList } from "@/components/QuoteList";
import { useCurrency } from "@/context/CurrencyContext";
import { PriceSparkline } from "@/components/PriceSparkline";
import {
  LogOut, ShoppingCart, Search, LayoutGrid, List, Package,
  ClipboardList, CheckCircle2, XCircle, Clock, X, Plus, Minus,
  ShieldCheck, Check, AlertTriangle, AlertCircle, SlidersHorizontal,
  Star, Sun, Moon, ChevronDown, ChevronRight, FileText, Truck,
  PackageCheck, RotateCcw, Hash, Bookmark, Trash2,
} from "lucide-react";
import { getAvailableStock, getUnitPrice } from "@/lib/pricing";
import { Link } from "react-router-dom";

type CartItem = {
  product: any;
  quantity: number;
  cost: number;
  margin: number;
  unitPrice: number;       // sin IVA
  totalPrice: number;      // sin IVA × qty
  ivaRate: number;         // 10.5 | 21
  ivaAmount: number;       // IVA total del ítem
  totalWithIVA: number;    // con IVA
};

// ── Stock badge with pill background ──────────────────────────────────────
function StockBadge({ stock }: { stock: number }) {
  if (stock === 0)
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 shrink-0">
        <AlertCircle size={9} /> Sin stock
      </span>
    );
  if (stock <= 3)
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
        <AlertTriangle size={9} /> Últimas {stock}u
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/15 shrink-0">
      <Check size={9} /> En stock
    </span>
  );
}

// ── Order status badge ─────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string; icon: React.ElementType }> = {
    pending:    { label: "En revisión",  className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",  icon: Clock },
    approved:   { label: "Aprobado",     className: "bg-green-500/15 text-green-400 border-green-500/30",    icon: CheckCircle2 },
    rejected:   { label: "Rechazado",    className: "bg-red-500/15 text-red-400 border-red-500/30",          icon: XCircle },
    preparing:  { label: "Preparando",   className: "bg-orange-500/15 text-orange-400 border-orange-500/30", icon: Package },
    shipped:    { label: "Enviado",      className: "bg-blue-500/15 text-blue-400 border-blue-500/30",       icon: Truck },
    delivered:  { label: "Entregado",    className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: PackageCheck },
    dispatched: { label: "Despachado",   className: "bg-gray-500/15 text-gray-400 border-gray-500/30",       icon: Truck },
  };
  const { label, className, icon: Icon } = map[status] ?? map.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${className}`}>
      <Icon size={11} /> {label}
    </span>
  );
}

// ── Skeleton row ───────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 bg-[#111] border border-[#1a1a1a] rounded-xl px-4 py-3 animate-pulse">
      <div className="h-14 w-14 rounded-xl bg-[#1c1c1c] shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 bg-[#1c1c1c] rounded w-2/3" />
        <div className="h-2.5 bg-[#171717] rounded w-1/3" />
      </div>
      <div className="h-5 w-16 bg-[#171717] rounded-full" />
      <div className="h-6 w-20 bg-[#1c1c1c] rounded" />
      <div className="h-8 w-20 bg-[#1c1c1c] rounded-lg" />
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4 animate-pulse">
      <div className="h-32 w-full bg-[#1c1c1c] rounded-lg mb-3" />
      <div className="h-3.5 bg-[#1c1c1c] rounded w-3/4 mb-2" />
      <div className="h-2.5 bg-[#171717] rounded w-1/2 mb-3" />
      <div className="h-6 bg-[#1c1c1c] rounded w-1/3 mb-3" />
      <div className="h-8 bg-[#1c1c1c] rounded-lg" />
    </div>
  );
}

export default function B2BPortal() {
  const navigate = useNavigate();
  const { profile, isAdmin, signOut } = useAuth();
  const { products, loading: productsLoading } = useProducts();
  const { orders, addOrder } = useOrders();
  const { quotes, updateStatus: updateQuoteStatus, deleteQuote, duplicateQuote, linkOrderToQuote } = useQuotes(profile?.id || "guest");
  const { rules: pricingRules } = usePricingRules();
  const { lists: purchaseLists, createList: createPurchaseList, deleteList: deletePurchaseList } = usePurchaseLists(profile?.id || "guest");
  const { currency, setCurrency, formatPrice, formatUSD, formatARS, exchangeRate } = useCurrency();

  const defaultMargin = profile?.default_margin ?? 20;
  const clientName = profile?.company_name ?? profile?.contact_name ?? "Cliente";
  const creditLimit = (profile as any)?.credit_limit as number | undefined;
  const creditUsed = useMemo(() =>
    orders
      .filter((o) => o.status === "pending" || o.status === "approved")
      .reduce((s, o) => s + (o.total ?? 0), 0),
  [orders]);
  // credit_limit === 0 means "unlimited / not configured" — no restriction applied
  const creditAvailable = (creditLimit != null && creditLimit > 0)
    ? Math.max(0, creditLimit - creditUsed)
    : null;
  const cartKey = `b2b_cart_${profile?.id || "guest"}`;

  const [cart, setCart] = useState<Record<number, number>>(() => {
    try { return JSON.parse(localStorage.getItem(cartKey) || "{}"); }
    catch { return {}; }
  });
  const [productMargins, setProductMargins] = useState<Record<number, number>>({});
  const [globalMargin, setGlobalMargin] = useState(defaultMargin);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [activeTab, setActiveTab] = useState<"catalog" | "orders" | "quotes" | "lists">("catalog");
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
  const [visibleCount, setVisibleCount] = useState(50);
  const [stockFilter, setStockFilter] = useState<"all" | "in_stock" | "low_stock" | "out_of_stock">("all");
  const [ivaFilter, setIvaFilter] = useState<"all" | "10.5" | "21">("all");

  // ─── QUICK ORDER ──────────────────────────────────────────────────────
  const [quickSku, setQuickSku] = useState("");
  const [quickQty, setQuickQty] = useState(1);
  const [quickError, setQuickError] = useState("");
  const quickSkuRef = useRef<HTMLInputElement>(null);

  // ─── DB CATEGORIES (hierarchy) ────────────────────────────────────────
  type DbCat = { id: number; name: string; parent_id: number | null };
  const [dbCats, setDbCats] = useState<DbCat[]>([]);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase.from("categories").select("*").order("name").then(({ data }) => {
      if (data) setDbCats(data as DbCat[]);
    });
  }, []);

  const THEME_KEY = "b2b_theme";
  const [theme, setTheme] = useState<"dark" | "light">(() =>
    localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark"
  );
  const isDark = theme === "dark";
  const toggleTheme = () => {
    const next = isDark ? "light" : "dark";
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
  };
  // dk(darkClass, lightClass) — inline theme token helper
  const dk = (d: string, l: string) => isDark ? d : l;

  useEffect(() => {
    localStorage.setItem(cartKey, JSON.stringify(cart));
  }, [cart, cartKey]);

  useEffect(() => {
    if (profile?.default_margin) setGlobalMargin(profile.default_margin);
  }, [profile?.default_margin]);

  useEffect(() => {
    setVisibleCount(50);
  }, [search, categoryFilter, stockFilter, ivaFilter, minPrice, maxPrice]);

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => document.head.removeChild(meta);
  }, []);

  // ── Build category tree from DB ─────────────────────────────────────────
  // parentTree: [{parent, children: string[]}] for parents with products
  // leafOnly: category names that have no parent in DB (standalone)
  const categoryTree = useMemo(() => {
    const parentNodes = dbCats.filter((c) => c.parent_id === null);
    const childrenOf  = (parentId: number) =>
      dbCats.filter((c) => c.parent_id === parentId).map((c) => c.name);

    // All subcategory names that belong to some parent
    const allSubNames = new Set(dbCats.filter((c) => c.parent_id !== null).map((c) => c.name));

    // Product category names (what products actually store)
    const productCats = new Set(products.map((p) => p.category));

    // Parents that have at least one subcategory or direct product matching
    const parents = parentNodes
      .map((p) => ({ name: p.name, children: childrenOf(p.id) }))
      .filter((p) =>
        p.children.some((ch) => productCats.has(ch)) || productCats.has(p.name)
      );

    // Leaf categories: product categories NOT covered by any parent's children
    const coveredByParent = new Set(parents.flatMap((p) => p.children));
    const leaves = [...productCats].filter(
      (c) => !coveredByParent.has(c) && !parents.some((p) => p.name === c)
    );

    return { parents, leaves };
  }, [dbCats, products]);

  // ── Count per category ───────────────────────────────────────────────────
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: products.length };
    products.forEach((p) => { counts[p.category] = (counts[p.category] || 0) + 1; });
    // Parent count = sum of its children's counts
    categoryTree.parents.forEach(({ name, children }) => {
      counts[name] = children.reduce((s, ch) => s + (counts[ch] || 0), 0);
    });
    return counts;
  }, [products, categoryTree]);

  // ── Children lookup for filtering ───────────────────────────────────────
  const parentChildrenMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    categoryTree.parents.forEach(({ name, children }) => { map[name] = children; });
    return map;
  }, [categoryTree]);

  const hasActiveFilters = categoryFilter !== "all" || minPrice !== "" || maxPrice !== "" || stockFilter !== "all" || ivaFilter !== "all";

  const filteredProducts = useMemo(() => {
    const term = search.toLowerCase();
    return products.filter((p) => {
      const min = Number(minPrice);
      const max = Number(maxPrice);
      if (term && !p.name.toLowerCase().includes(term) && !p.sku?.toLowerCase().includes(term)) return false;
      if (categoryFilter !== "all") {
        const children = parentChildrenMap[categoryFilter];
        if (children?.length) {
          if (!children.includes(p.category)) return false;
        } else {
          if (p.category !== categoryFilter) return false;
        }
      }
      if (!isNaN(min) && min > 0 && p.cost_price < min) return false;
      if (!isNaN(max) && max > 0 && p.cost_price > max) return false;
      if (stockFilter !== "all") {
        const avail = (p.stock ?? 0) - (p.stock_reserved ?? 0);
        if (stockFilter === "in_stock"       && avail <= 3) return false;
        if (stockFilter === "low_stock"      && (avail === 0 || avail > 3)) return false;
        if (stockFilter === "out_of_stock"   && avail > 0) return false;
      }
      if (ivaFilter !== "all" && String(p.iva_rate ?? 21) !== ivaFilter) return false;
      return true;
    });
  }, [products, search, categoryFilter, minPrice, maxPrice, stockFilter, ivaFilter, parentChildrenMap]);

  const cartItems: CartItem[] = useMemo(() => {
    return Object.entries(cart)
      .map(([id, qty]) => {
        const product = products.find((p) => p.id === Number(id));
        if (!product) return null;
        const { margin } = resolveMarginWithContext(product, pricingRules, globalMargin, profile?.id, qty);
        const cost = getUnitPrice(product, qty);
        const unitPrice = cost * (1 + margin / 100);
        const totalPrice = unitPrice * qty;
        const ivaRate = product.iva_rate ?? 21;
        const ivaAmount = totalPrice * (ivaRate / 100);
        return { product, quantity: qty, cost, margin, unitPrice, totalPrice, ivaRate, ivaAmount, totalWithIVA: totalPrice + ivaAmount };
      })
      .filter((i): i is CartItem => i !== null);
  }, [cart, products, globalMargin, pricingRules, profile?.id]);

  const cartSubtotal = useMemo(() => cartItems.reduce((s, i) => s + i.totalPrice, 0), [cartItems]);
  const cartIVATotal = useMemo(() => cartItems.reduce((s, i) => s + i.ivaAmount, 0), [cartItems]);
  const cartTotal = useMemo(() => cartSubtotal + cartIVATotal, [cartSubtotal, cartIVATotal]);
  const cartCount = useMemo(() => Object.values(cart).reduce((s, q) => s + q, 0), [cart]);

  // ─── PURCHASE HISTORY — units bought per product ───────────────────────
  const purchasedQty = useMemo<Record<number, number>>(() => {
    const counts: Record<number, number> = {};
    orders.forEach((order) => {
      order.products.forEach((p) => {
        const pid = p.product_id;
        counts[pid] = (counts[pid] ?? 0) + p.quantity;
      });
    });
    return counts;
  }, [orders]);

  // Add to cart — respects min_order_qty and available stock
  function handleAddToCart(product: any) {
    const available = getAvailableStock(product);
    const minQty = product.min_order_qty ?? 1;
    setCart((prev) => {
      const current = prev[product.id] ?? 0;
      const next = current === 0 ? minQty : current + 1;
      if (next > available) return prev;
      return { ...prev, [product.id]: next };
    });
    setAddedIds((prev) => new Set(prev).add(product.id));
    setTimeout(() => {
      setAddedIds((prev) => { const s = new Set(prev); s.delete(product.id); return s; });
    }, 900);
  }

  // Quick Order by SKU
  function handleQuickOrder(e: React.FormEvent) {
    e.preventDefault();
    const sku = quickSku.trim();
    if (!sku) return;
    const found = products.find((p) => p.sku?.toLowerCase() === sku.toLowerCase());
    if (!found) {
      setQuickError(`SKU "${sku}" no encontrado`);
      return;
    }
    const available = getAvailableStock(found);
    if (available === 0) {
      setQuickError(`${found.name}: sin stock`);
      return;
    }
    const qty = Math.max(1, quickQty);
    setCart((prev) => ({ ...prev, [found.id]: (prev[found.id] ?? 0) + qty }));
    setAddedIds((prev) => new Set(prev).add(found.id));
    setTimeout(() => setAddedIds((prev) => { const s = new Set(prev); s.delete(found.id); return s; }), 900);
    setQuickSku("");
    setQuickQty(1);
    setQuickError("");
    quickSkuRef.current?.focus();
  }

  const onRemoveFromCart = (product: any) =>
    setCart((prev) => {
      const qty = prev[product.id] || 0;
      if (qty <= 1) { const { [product.id]: _, ...rest } = prev; return rest; }
      return { ...prev, [product.id]: qty - 1 };
    });

  const onMarginChange = (productId: number, margin: number) =>
    setProductMargins((prev) => ({ ...prev, [productId]: margin }));

  async function handleConvertToOrder(quote: Quote) {
    if (!confirm(`¿Convertir la cotización COT-${String(quote.id).padStart(4, "0")} en un pedido?`)) return;
    const orderProducts = quote.items.map((item) => ({
      product_id:  item.product_id,
      name:        item.name,
      sku:         "",
      quantity:    item.quantity,
      cost_price:  item.cost,
      unit_price:  Number(item.unitPrice.toFixed(2)),
      total_price: Number(item.totalPrice.toFixed(2)),
      margin:      item.margin,
    }));
    const { error, data } = await addOrder({
      products:   orderProducts,
      total:      Number(quote.total.toFixed(2)),
      status:     "pending",
      created_at: new Date().toISOString(),
    }) as any;
    if (!error && data?.id) {
      linkOrderToQuote(quote.id, data.id);
    } else if (!error) {
      linkOrderToQuote(quote.id, "converted");
    }
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
  }

  function handleReorder(orderProducts: Array<{ product_id: number; quantity: number }>) {
    const newCart: Record<number, number> = {};
    orderProducts.forEach((p) => { newCart[p.product_id] = p.quantity; });
    setCart(newCart);
    navigate("/cart");
  }

  const handleLogout = async () => { await signOut(); navigate("/login"); };

  function clearFilters() {
    setCategoryFilter("all");
    setMinPrice("");
    setMaxPrice("");
    setSearch("");
    setStockFilter("all");
    setIvaFilter("all");
    setVisibleCount(50);
  }

  // ─── PRODUCT MODAL ────────────────────────────────────────────────────
  const productModal = selectedProduct && (() => {
    const p = selectedProduct;
    const inCartQty = cart[p.id] || 1;
    const { margin } = resolveMarginWithContext(p, pricingRules, globalMargin, profile?.id, inCartQty);
    const finalPrice = getUnitPrice(p, inCartQty) * (1 + margin / 100);  // sin IVA
    const ivaRate = p.iva_rate ?? 21;
    const ivaAmt = finalPrice * (ivaRate / 100);
    const finalWithIVA = finalPrice + ivaAmt;
    const inCart = cart[p.id] || 0;
    const outOfStock = getAvailableStock(p) === 0;

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
        onClick={() => setSelectedProduct(null)}
      >
        <div
          className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-2xl w-full max-w-lg shadow-2xl shadow-black/30 flex flex-col max-h-[90vh]`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header — fixed */}
          <div className={`flex items-center justify-between px-5 py-3.5 border-b ${dk("border-[#1a1a1a]", "border-[#e5e5e5]")} shrink-0`}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs ${dk("text-gray-500 bg-[#242424]", "text-[#737373] bg-[#f0f0f0]")} px-2 py-0.5 rounded-full font-medium`}>{p.category}</span>
              {p.featured && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                  <Star size={9} fill="currentColor" /> Destacado
                </span>
              )}
            </div>
            <button onClick={() => setSelectedProduct(null)}
              className={`${dk("text-gray-600 hover:text-white hover:bg-[#2a2a2a]", "text-[#a3a3a3] hover:text-[#171717] hover:bg-[#f0f0f0]")} transition p-1 rounded-lg shrink-0`}>
              <X size={16} />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="overflow-y-auto flex-1">
            {/* Image */}
            <div className={`${dk("bg-[#0a0a0a]", "bg-[#f9f9f9]")} flex items-center justify-center h-52 px-8 shrink-0`}>
              <img src={p.image} alt={p.name} className="max-h-40 max-w-full object-contain drop-shadow-xl" />
            </div>

            {/* Info */}
            <div className="px-5 pt-4 pb-2">
              <div className="flex items-start justify-between gap-3 mb-1">
                <h2 className={`text-base font-extrabold ${dk("text-white", "text-[#171717]")} leading-tight`}>{p.name}</h2>
                <StockBadge stock={p.stock} />
              </div>

              <div className="flex items-center gap-3 mb-4">
                {p.sku && <span className={`text-[11px] font-mono ${dk("text-[#525252] bg-[#171717] border-[#222]", "text-[#737373] bg-[#f0f0f0] border-[#e5e5e5]")} border px-2 py-0.5 rounded`}>SKU: {p.sku}</span>}
                {p.stock > 0 && (
                  <span className="text-[11px] text-gray-600">{p.stock} en depósito</span>
                )}
                {p.stock_min > 0 && (
                  <span className="text-[11px] text-gray-700">mín. {p.stock_min}</span>
                )}
              </div>

              {/* Price breakdown */}
              <div className={`${dk("bg-[#0d0d0d] border-[#1f1f1f]", "bg-[#f9f9f9] border-[#e5e5e5]")} border rounded-xl px-4 py-3 mb-4`}>
                <div className="flex items-start justify-between gap-3">
                  {/* Price rows */}
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] ${dk("text-[#737373]", "text-[#a3a3a3]")}`}>Precio unitario</span>
                      <span className="text-base font-extrabold text-[#2D9F6A] tabular-nums">{formatPrice(finalPrice)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] ${dk("text-[#737373]", "text-[#a3a3a3]")}`}>IVA ({ivaRate}%)</span>
                      <span className={`text-sm font-semibold tabular-nums ${dk("text-[#a3a3a3]", "text-[#737373]")}`}>+ {formatPrice(ivaAmt)}</span>
                    </div>
                    <div className={`flex items-center justify-between pt-1.5 border-t ${dk("border-[#222]", "border-[#e5e5e5]")}`}>
                      <span className={`text-[11px] font-semibold ${dk("text-white", "text-[#171717]")}`}>Precio final</span>
                      <span className={`text-base font-extrabold tabular-nums ${dk("text-white", "text-[#171717]")}`}>{formatPrice(finalWithIVA)}</span>
                    </div>
                    <div className={`text-[10px] ${dk("text-[#525252]", "text-[#a3a3a3]")} font-mono`}>
                      {currency === "USD" ? formatARS(finalWithIVA) : formatUSD(finalWithIVA)}
                    </div>
                  </div>
                  {/* Currency toggle */}
                  <div className="text-right shrink-0">
                    <div className={`text-[10px] ${dk("text-[#525252]", "text-[#a3a3a3]")} mb-1`}>Moneda</div>
                    <div className={`flex items-center ${dk("bg-[#171717] border-[#262626]", "bg-[#f0f0f0] border-[#e5e5e5]")} border rounded-lg p-0.5 gap-0.5`}>
                      {(["USD", "ARS"] as const).map((c) => (
                        <button key={c} onClick={() => setCurrency(c)}
                          className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${currency === c ? "bg-[#2D9F6A] text-white" : dk("text-[#525252] hover:text-[#a3a3a3]", "text-[#737373] hover:text-[#171717]")}`}>
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              {p.description && (
                <div className="mb-4">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Descripción</p>
                  <p className={`text-sm ${dk("text-gray-400", "text-[#525252]")} leading-relaxed whitespace-pre-line`}>{p.description}</p>
                </div>
              )}

              {/* Specs */}
              {p.specs && Object.keys(p.specs).length > 0 && (
                <div className="mb-4">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Especificaciones</p>
                  <div className={`rounded-xl border ${dk("border-[#1f1f1f]", "border-[#e5e5e5]")} overflow-hidden`}>
                    {Object.entries(p.specs).map(([k, v], i) => (
                      <div key={k} className={`flex text-xs ${i % 2 === 0 ? dk("bg-[#0d0d0d]", "bg-[#f9f9f9]") : dk("bg-[#0a0a0a]", "bg-white")}`}>
                        <span className={`${dk("text-gray-500", "text-[#737373]")} px-3 py-2 w-2/5 shrink-0 font-medium`}>{k}</span>
                        <span className={`${dk("text-gray-300", "text-[#525252]")} px-3 py-2 flex-1`}>{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {p.tags && p.tags.length > 0 && (
                <div className="mb-4">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {p.tags.map((t: string) => (
                      <span key={t} className={`text-[11px] px-2 py-0.5 rounded-full ${dk("bg-[#1c1c1c] text-[#a3a3a3] border-[#262626]", "bg-[#f0f0f0] text-[#525252] border-[#e5e5e5]")} border font-medium`}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Price history sparkline */}
              <div className="mb-4">
                <PriceSparkline productId={p.id} currentPrice={p.cost_price} isDark={isDark} />
              </div>
            </div>
          </div>

          {/* Footer — cart controls, fixed */}
          <div className={`px-5 py-4 border-t ${dk("border-[#1a1a1a]", "border-[#e5e5e5]")} shrink-0`}>
            {outOfStock ? (
              <div className={`w-full ${dk("bg-[#1c1c1c] text-[#525252] border-[#222]", "bg-[#f5f5f5] text-[#737373] border-[#e5e5e5]")} font-medium h-11 rounded-xl text-sm flex items-center justify-center border`}>
                Sin stock disponible
              </div>
            ) : inCart > 0 ? (
              <div className="flex items-center gap-3">
                <button onClick={() => onRemoveFromCart(p)}
                  className={`h-11 w-11 ${dk("bg-[#1c1c1c] hover:bg-[#252525] text-white border-[#262626]", "bg-[#f5f5f5] hover:bg-[#ebebeb] text-[#171717] border-[#e5e5e5]")} rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center border`}>
                  <Minus size={16} />
                </button>
                <span className={`flex-1 text-center ${dk("text-white", "text-[#171717]")} font-extrabold text-xl`}>{inCart}</span>
                <button onClick={() => handleAddToCart(p)}
                  className="h-11 w-11 bg-[#2D9F6A] hover:bg-[#25835A] text-white rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center">
                  <Plus size={16} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleAddToCart(p)}
                className="w-full bg-[#2D9F6A] hover:bg-[#25835A] text-white font-bold h-11 rounded-xl text-sm transition-all active:scale-[0.98]"
              >
                Agregar al carrito
              </button>
            )}
          </div>
        </div>
      </div>
    );
  })();

  // ─── RENDER ───────────────────────────────────────────────────────────
  return (
    <div className={`flex min-h-screen ${dk("bg-[#0a0a0a]", "bg-[#f5f5f5]")} flex-col`}>

      {/* TOPBAR */}
      <header className={`flex items-center gap-3 px-4 md:px-6 py-2.5 ${dk("bg-[#0d0d0d] border-[#1a1a1a]", "bg-white border-[#e5e5e5]")} border-b flex-wrap`}>
        <div className="flex items-center gap-2.5 shrink-0">
          <img src="/icon.png" alt="Bartez" className="h-8 w-8 object-contain" />
          <div>
            <span className={`font-bold ${dk("text-white", "text-[#171717]")} text-sm leading-none`}>Portal B2B</span>
            <span className="block text-[11px] text-[#737373] leading-none mt-0.5 font-medium">{clientName}</span>
          </div>
        </div>
        {creditAvailable != null && (
          <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs ${
            creditAvailable < creditLimit! * 0.1
              ? dk("border-red-500/30 bg-red-500/10 text-red-400", "border-red-200 bg-red-50 text-red-600")
              : dk("border-[#1f1f1f] bg-[#0d0d0d] text-gray-400", "border-[#e5e5e5] bg-white text-[#737373]")
          }`}>
            <span className="font-semibold">Crédito:</span>
            <span className="font-bold tabular-nums">
              USD {creditAvailable.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </span>
          </div>
        )}

        {/* Search — more prominent */}
        <div className="flex-1 min-w-[200px] max-w-lg relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar productos, SKU, marca..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full ${dk("bg-[#0d0d0d] border-[#222] text-white focus:border-[#404040] focus:ring-white/5 placeholder:text-[#525252]", "bg-white border-[#e5e5e5] text-[#171717] focus:border-[#d4d4d4] focus:ring-black/5 placeholder:text-[#a3a3a3]")} border text-sm rounded-xl pl-9 pr-8 py-2 outline-none focus:ring-1 transition`}
          />
          {search && (
            <button onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-300 transition p-0.5">
              <X size={12} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          {/* Vista + Moneda + Tema — agrupados */}
          <div className={`hidden md:flex items-center ${dk("bg-[#0d0d0d] border-[#1f1f1f]", "bg-[#f0f0f0] border-[#e5e5e5]")} border rounded-lg p-1 gap-0.5`}>
            <button onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded transition ${viewMode === "grid" ? dk("bg-[#262626] text-white", "bg-white text-[#171717] shadow-sm") : dk("text-[#525252] hover:text-[#a3a3a3]", "text-[#737373] hover:text-[#171717]")}`}>
              <LayoutGrid size={13} />
            </button>
            <button onClick={() => setViewMode("list")}
              className={`p-1.5 rounded transition ${viewMode === "list" ? dk("bg-[#262626] text-white", "bg-white text-[#171717] shadow-sm") : dk("text-[#525252] hover:text-[#a3a3a3]", "text-[#737373] hover:text-[#171717]")}`}>
              <List size={13} />
            </button>
            <div className={`w-px h-4 ${dk("bg-[#262626]", "bg-[#e5e5e5]")} mx-0.5`} />
            {(["USD", "ARS"] as const).map((c) => (
              <button key={c} onClick={() => setCurrency(c)}
                className={`px-2 py-1 rounded text-[11px] font-bold transition ${currency === c ? dk("bg-[#262626] text-white", "bg-white text-[#171717] shadow-sm") : dk("text-[#525252] hover:text-[#a3a3a3]", "text-[#737373] hover:text-[#171717]")}`}>
                {c}
              </button>
            ))}
            <div className={`w-px h-4 ${dk("bg-[#262626]", "bg-[#e5e5e5]")} mx-0.5`} />
            <button onClick={toggleTheme}
              className={`p-1.5 rounded transition ${dk("text-[#525252] hover:text-[#a3a3a3] hover:bg-[#1c1c1c]", "text-[#737373] hover:text-[#171717] hover:bg-white")}`}
              title={isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}>
              {isDark ? <Sun size={13} /> : <Moon size={13} />}
            </button>
          </div>

          {/* Carrito */}
          <button
            onClick={() => navigate("/cart")}
            className="relative flex items-center gap-2 bg-[#2D9F6A] hover:bg-[#25835A] active:scale-95 text-white rounded-xl px-3 py-2 text-sm font-semibold transition-all"
          >
            <ShoppingCart size={15} />
            <span className="hidden md:inline">Carrito</span>
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-white text-[#2D9F6A] text-[10px] font-black flex items-center justify-center shadow">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </button>

          {/* Admin */}
          {isAdmin && (
            <Link to="/admin"
              className="flex items-center gap-1.5 text-xs text-[#2D9F6A] hover:text-white transition px-2.5 py-2 rounded-lg hover:bg-[#1e1e1e]">
              <ShieldCheck size={14} />
              <span className="hidden md:inline">Admin</span>
            </Link>
          )}

          {/* Logout */}
          <button onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-300 transition px-2 py-2 rounded-lg hover:bg-[#1e1e1e]">
            <LogOut size={14} />
          </button>
        </div>
      </header>

      {/* TABS */}
      <div className={`flex border-b ${dk("border-[#1a1a1a] bg-[#0d0d0d]", "border-[#e5e5e5] bg-white")} px-4 md:px-6`}>
        {[
          { id: "catalog", label: "Catálogo", icon: Package },
          { id: "orders",  label: `Mis Pedidos${orders.length ? ` (${orders.length})` : ""}`, icon: ClipboardList },
          { id: "quotes",  label: `Cotizaciones${quotes.length ? ` (${quotes.length})` : ""}`, icon: FileText },
          { id: "lists",   label: `Listas${purchaseLists.length ? ` (${purchaseLists.length})` : ""}`, icon: Bookmark },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as any)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition ${
              activeTab === id
                ? `border-[#2D9F6A] ${dk("text-white", "text-[#171717]")}`
                : `border-transparent ${dk("text-[#525252] hover:text-[#a3a3a3]", "text-[#737373] hover:text-[#525252]")}`
            }`}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {/* BANNER ADMIN */}
      {isAdmin && (
        <div className={`flex items-center justify-between ${dk("bg-[#111] border-[#1a1a1a]", "bg-[#f9f9f9] border-[#e5e5e5]")} border-b px-4 md:px-6 py-2`}>
          <div className="flex items-center gap-2 text-[#737373] text-xs font-medium">
            <ShieldCheck size={13} />
            Vista de administrador
          </div>
          <Link to="/admin"
            className={`flex items-center gap-1.5 ${dk("bg-[#1c1c1c] hover:bg-[#262626] text-[#a3a3a3] hover:text-white border-[#262626] hover:border-[#333]", "bg-white hover:bg-[#f5f5f5] text-[#525252] hover:text-[#171717] border-[#e5e5e5] hover:border-[#d4d4d4]")} text-xs font-medium px-3 py-1.5 rounded-lg border transition`}>
            <ShieldCheck size={11} /> Panel Admin
          </Link>
        </div>
      )}

      {/* CLIENT BANNER */}
      {!isAdmin && profile && (
        <div className={`flex items-center gap-3 px-4 md:px-6 py-2 ${dk("bg-[#0d0d0d] border-[#1a1a1a]", "bg-white border-[#e5e5e5]")} border-b text-xs flex-wrap`}>
          {profile.client_type && (
            <span className={`px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${dk("bg-[#2D9F6A]/15 text-[#2D9F6A] border border-[#2D9F6A]/25", "bg-green-50 text-green-700 border border-green-200")}`}>
              {profile.client_type}
            </span>
          )}
          {creditLimit != null && (
            <>
              <span className={`${dk("text-[#525252]", "text-[#737373]")}`}>
                Crédito: <span className="font-semibold tabular-nums">USD {creditLimit.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
              </span>
              <span className={`${creditAvailable != null && creditAvailable < creditLimit * 0.2
                ? "text-red-400 font-bold"
                : dk("text-[#525252]", "text-[#737373]")}`}>
                Disponible: <span className="font-semibold tabular-nums">USD {(creditAvailable ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
              </span>
              <div className={`flex-1 min-w-[80px] max-w-[120px] h-1.5 rounded-full ${dk("bg-[#1f1f1f]", "bg-[#e5e5e5]")} overflow-hidden`}>
                <div
                  className={`h-full rounded-full transition-all ${creditAvailable != null && creditAvailable < creditLimit * 0.2 ? "bg-red-500" : "bg-[#2D9F6A]"}`}
                  style={{ width: `${creditLimit > 0 ? Math.max(0, Math.min(100, ((creditAvailable ?? 0) / creditLimit) * 100)) : 0}%` }}
                />
              </div>
            </>
          )}
        </div>
      )}

      {orderSuccess && (
        <div className={`mx-4 mt-3 ${dk("bg-green-900/20 border-green-500/30 text-green-400", "bg-green-50 border-green-200 text-green-700")} border rounded-xl p-3 text-sm font-medium flex items-center gap-2`}>
          <CheckCircle2 size={15} />
          Pedido confirmado. Lo estamos revisando y te contactaremos pronto.
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">

        {/* SIDEBAR */}
        {activeTab === "catalog" && (
          <aside className={`hidden md:flex flex-col w-52 ${dk("bg-[#0d0d0d] border-[#1a1a1a]", "bg-white border-[#e5e5e5]")} border-r p-3 gap-4 shrink-0`}>

            {/* Clear filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className={`flex items-center gap-1.5 text-xs ${dk("text-[#a3a3a3] hover:text-white border-[#262626] hover:border-[#333] hover:bg-[#1c1c1c]", "text-[#525252] hover:text-[#171717] border-[#e5e5e5] hover:border-[#d4d4d4] hover:bg-[#f5f5f5]")} border bg-transparent rounded-lg px-3 py-1.5 transition font-medium`}
              >
                <SlidersHorizontal size={11} /> Limpiar filtros
              </button>
            )}

            {/* Categorías */}
            <div>
              <h3 className={`text-[10px] font-bold uppercase tracking-widest ${dk("text-[#525252]", "text-[#a3a3a3]")} mb-2 px-1`}>Categoría</h3>
              <div className="flex flex-col gap-0.5">

                {/* "Todas" */}
                {(() => {
                  const isActive = categoryFilter === "all";
                  return (
                    <button
                      onClick={() => setCategoryFilter("all")}
                      className={`flex items-center justify-between text-left text-sm px-2.5 py-1.5 rounded-lg transition group border-l-2 ${
                        isActive
                          ? `${dk("bg-[#171717] text-white", "bg-[#f0faf5] text-[#1a7a50]")} font-medium border-[#2D9F6A]`
                          : `${dk("text-[#737373] hover:text-[#e5e5e5] hover:bg-[#171717]", "text-[#737373] hover:text-[#171717] hover:bg-[#f5f5f5]")} border-transparent`
                      }`}
                    >
                      <span>Todas</span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ml-1 shrink-0 ${
                        isActive ? dk("bg-[#262626] text-white", "bg-[#2D9F6A]/20 text-[#1a7a50]")
                          : dk("bg-[#1a1a1a] text-[#525252] group-hover:bg-[#222]", "bg-[#f0f0f0] text-[#737373] group-hover:bg-[#e8e8e8]")
                      }`}>{categoryCounts["all"]}</span>
                    </button>
                  );
                })()}

                {/* Parent categories with children */}
                {categoryTree.parents.map(({ name: parent, children }) => {
                  const isParentActive  = categoryFilter === parent;
                  const isChildActive   = children.includes(categoryFilter);
                  const isExpanded      = expandedParents.has(parent) || isParentActive || isChildActive;
                  const parentCount     = categoryCounts[parent] || 0;

                  return (
                    <div key={parent}>
                      {/* Parent row */}
                      <div className="flex items-center gap-0">
                        {/* Expand/collapse chevron */}
                        <button
                          onClick={() => setExpandedParents((prev) => {
                            const next = new Set(prev);
                            next.has(parent) ? next.delete(parent) : next.add(parent);
                            return next;
                          })}
                          className={`p-1 rounded transition shrink-0 ${dk("text-[#525252] hover:text-[#a3a3a3]", "text-[#a3a3a3] hover:text-[#525252]")}`}
                        >
                          {isExpanded
                            ? <ChevronDown size={11} />
                            : <ChevronRight size={11} />}
                        </button>
                        {/* Parent label (also clickable as filter) */}
                        <button
                          onClick={() => setCategoryFilter(parent)}
                          className={`flex-1 flex items-center justify-between text-left text-sm px-1.5 py-1.5 rounded-lg transition group border-l-2 ${
                            isParentActive
                              ? `${dk("bg-[#171717] text-white", "bg-[#f0faf5] text-[#1a7a50]")} font-medium border-[#2D9F6A]`
                              : `${dk("text-[#737373] hover:text-[#e5e5e5] hover:bg-[#171717]", "text-[#737373] hover:text-[#171717] hover:bg-[#f5f5f5]")} border-transparent`
                          }`}
                        >
                          <span className="truncate font-medium">{parent}</span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ml-1 shrink-0 ${
                            isParentActive ? dk("bg-[#262626] text-white", "bg-[#2D9F6A]/20 text-[#1a7a50]")
                              : dk("bg-[#1a1a1a] text-[#525252] group-hover:bg-[#222]", "bg-[#f0f0f0] text-[#737373] group-hover:bg-[#e8e8e8]")
                          }`}>{parentCount}</span>
                        </button>
                      </div>

                      {/* Subcategories (indented) */}
                      {isExpanded && (
                        <div className="ml-5 flex flex-col gap-0.5 mt-0.5 mb-1">
                          {children.map((child) => {
                            const isActive = categoryFilter === child;
                            const count    = categoryCounts[child] || 0;
                            return (
                              <button
                                key={child}
                                onClick={() => setCategoryFilter(child)}
                                className={`flex items-center justify-between text-left text-xs px-2.5 py-1.5 rounded-lg transition group border-l-2 ${
                                  isActive
                                    ? `${dk("bg-[#171717] text-white", "bg-[#f0faf5] text-[#1a7a50]")} font-medium border-[#2D9F6A]`
                                    : `${dk("text-[#525252] hover:text-[#e5e5e5] hover:bg-[#171717]", "text-[#a3a3a3] hover:text-[#171717] hover:bg-[#f5f5f5]")} border-transparent`
                                }`}
                              >
                                <span className="truncate">{child}</span>
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ml-1 shrink-0 ${
                                  isActive ? dk("bg-[#262626] text-white", "bg-[#2D9F6A]/20 text-[#1a7a50]")
                                    : dk("bg-[#1a1a1a] text-[#525252] group-hover:bg-[#222]", "bg-[#f0f0f0] text-[#737373] group-hover:bg-[#e8e8e8]")
                                }`}>{count}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Standalone leaf categories (not under any parent) */}
                {categoryTree.leaves.map((c) => {
                  const isActive = categoryFilter === c;
                  return (
                    <button
                      key={c}
                      onClick={() => setCategoryFilter(c)}
                      className={`flex items-center justify-between text-left text-sm px-2.5 py-1.5 rounded-lg transition group border-l-2 ${
                        isActive
                          ? `${dk("bg-[#171717] text-white", "bg-[#f0faf5] text-[#1a7a50]")} font-medium border-[#2D9F6A]`
                          : `${dk("text-[#737373] hover:text-[#e5e5e5] hover:bg-[#171717]", "text-[#737373] hover:text-[#171717] hover:bg-[#f5f5f5]")} border-transparent`
                      }`}
                    >
                      <span className="truncate">{c}</span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ml-1 shrink-0 ${
                        isActive ? dk("bg-[#262626] text-white", "bg-[#2D9F6A]/20 text-[#1a7a50]")
                          : dk("bg-[#1a1a1a] text-[#525252] group-hover:bg-[#222]", "bg-[#f0f0f0] text-[#737373] group-hover:bg-[#e8e8e8]")
                      }`}>{categoryCounts[c] || 0}</span>
                    </button>
                  );
                })}

              </div>
            </div>

            {/* Precio */}
            <div>
              <h3 className={`text-[10px] font-bold uppercase tracking-widest ${dk("text-[#525252]", "text-[#a3a3a3]")} mb-2 px-1`}>Precio</h3>
              <div className="flex flex-col gap-1.5">
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#737373] text-xs">$</span>
                  <input type="number" placeholder="Mínimo" value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    className={`w-full ${dk("bg-[#0d0d0d] border-[#222] text-white focus:border-[#404040] placeholder:text-[#404040]", "bg-white border-[#e5e5e5] text-[#171717] focus:border-[#d4d4d4] placeholder:text-[#c4c4c4]")} border text-xs rounded-lg pl-6 pr-2 py-1.5 outline-none transition`} />
                </div>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#737373] text-xs">$</span>
                  <input type="number" placeholder="Máximo" value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    className={`w-full ${dk("bg-[#0d0d0d] border-[#222] text-white focus:border-[#404040] placeholder:text-[#404040]", "bg-white border-[#e5e5e5] text-[#171717] focus:border-[#d4d4d4] placeholder:text-[#c4c4c4]")} border text-xs rounded-lg pl-6 pr-2 py-1.5 outline-none transition`} />
                </div>
              </div>
            </div>

            {/* Stock */}
            <div>
              <h3 className={`text-[10px] font-bold uppercase tracking-widest ${dk("text-[#525252]", "text-[#a3a3a3]")} mb-2 px-1`}>Stock</h3>
              <div className="flex flex-col gap-0.5">
                {([
                  { value: "all",           label: "Todos" },
                  { value: "in_stock",      label: "Disponible" },
                  { value: "low_stock",     label: "Stock bajo (≤3)" },
                  { value: "out_of_stock",  label: "Sin stock" },
                ] as const).map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setStockFilter(value)}
                    className={`text-left text-xs px-2.5 py-1.5 rounded-lg transition border-l-2 ${
                      stockFilter === value
                        ? `${dk("bg-[#171717] text-white", "bg-[#f0faf5] text-[#1a7a50]")} font-medium border-[#2D9F6A]`
                        : `${dk("text-[#737373] hover:text-[#e5e5e5] hover:bg-[#171717]", "text-[#737373] hover:text-[#171717] hover:bg-[#f5f5f5]")} border-transparent`
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* IVA */}
            <div>
              <h3 className={`text-[10px] font-bold uppercase tracking-widest ${dk("text-[#525252]", "text-[#a3a3a3]")} mb-2 px-1`}>IVA</h3>
              <div className="flex flex-col gap-0.5">
                {([
                  { value: "all",   label: "Todos" },
                  { value: "10.5",  label: "10.5%" },
                  { value: "21",    label: "21%" },
                ] as const).map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setIvaFilter(value)}
                    className={`text-left text-xs px-2.5 py-1.5 rounded-lg transition border-l-2 ${
                      ivaFilter === value
                        ? `${dk("bg-[#171717] text-white", "bg-[#f0faf5] text-[#1a7a50]")} font-medium border-[#2D9F6A]`
                        : `${dk("text-[#737373] hover:text-[#e5e5e5] hover:bg-[#171717]", "text-[#737373] hover:text-[#171717] hover:bg-[#f5f5f5]")} border-transparent`
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </aside>
        )}

        {/* CONTENIDO PRINCIPAL */}
        <main className={`flex-1 p-4 md:p-5 overflow-y-auto`}>

          {/* ── CATÁLOGO ── */}
          {activeTab === "catalog" && (
            <>
              {/* QUICK ORDER */}
              <form
                onSubmit={handleQuickOrder}
                className={`flex items-center gap-2 mb-4 p-2.5 rounded-xl border ${dk("bg-[#0d0d0d] border-[#1a1a1a]", "bg-white border-[#e5e5e5]")}`}
              >
                <Hash size={13} className="text-[#525252] shrink-0" />
                <input
                  ref={quickSkuRef}
                  type="text"
                  placeholder="SKU exacto..."
                  value={quickSku}
                  onChange={(e) => { setQuickSku(e.target.value); setQuickError(""); }}
                  className={`flex-1 min-w-0 bg-transparent text-sm outline-none ${dk("text-white placeholder:text-[#404040]", "text-[#171717] placeholder:text-[#c4c4c4]")}`}
                />
                <input
                  type="number"
                  min={1}
                  value={quickQty}
                  onChange={(e) => setQuickQty(Math.max(1, Number(e.target.value)))}
                  className={`w-14 text-center text-sm font-bold bg-transparent outline-none border rounded-lg px-1 py-0.5 ${dk("text-white border-[#262626]", "text-[#171717] border-[#e5e5e5]")}`}
                />
                <button
                  type="submit"
                  className="bg-[#2D9F6A] hover:bg-[#25835A] text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all active:scale-95 whitespace-nowrap"
                >
                  + Agregar
                </button>
                {quickError && (
                  <span className="text-[11px] text-red-400 shrink-0">{quickError}</span>
                )}
              </form>

              {/* Results info */}
              {!productsLoading && filteredProducts.length > 0 && (
                <div className="flex items-center justify-between mb-3">
                  <p className={`text-xs ${dk("text-gray-600", "text-[#737373]")}`}>
                    {filteredProducts.length} producto{filteredProducts.length !== 1 ? "s" : ""}
                    {search && <> para "<span className="text-gray-400">{search}</span>"</>}
                  </p>
                </div>
              )}

              {productsLoading ? (
                viewMode === "list" ? (
                  <div className="flex flex-col gap-2">
                    {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
                  </div>
                )
              ) : filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-gray-600">
                  <Search size={36} className="mb-3 opacity-20" />
                  <p className="text-sm font-medium text-gray-500">No se encontraron productos</p>
                  {(search || hasActiveFilters) && (
                    <button onClick={clearFilters}
                      className="mt-3 text-xs text-[#2D9F6A] hover:underline">
                      Limpiar filtros
                    </button>
                  )}
                </div>
              ) : viewMode === "grid" ? (

                // ── GRID ──────────────────────────────────────────────
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredProducts.slice(0, visibleCount).map((product) => {
                    const inCart = cart[product.id] || 0;
                    const displayQty = inCart || 1;
                    const { margin } = resolveMarginWithContext(product, pricingRules, globalMargin, profile?.id, displayQty);
                    const finalPrice = getUnitPrice(product, displayQty) * (1 + margin / 100);
                    const outOfStock = getAvailableStock(product) === 0;
                    const wasAdded = addedIds.has(product.id);
                    const boughtQty = purchasedQty[product.id] ?? 0;

                    return (
                      <div
                        key={product.id}
                        className={`${dk("bg-[#111]", "bg-white")} border rounded-xl p-4 flex flex-col transition-all duration-200 ${
                          outOfStock
                            ? dk("border-[#1a1a1a]", "border-[#e5e5e5]") + " opacity-40"
                            : dk("border-[#1f1f1f] hover:border-[#2a2a2a] hover:bg-[#141414] hover:shadow-black/30", "border-[#e5e5e5] hover:border-[#d4d4d4] hover:bg-[#fafafa] hover:shadow-black/5") + " hover:-translate-y-px hover:shadow-lg"
                        }`}
                      >
                        <div className="cursor-pointer" onClick={() => setSelectedProduct(product)}>
                          <div className="relative mb-3">
                            <div className={`h-32 w-full ${dk("bg-[#0a0a0a]", "bg-[#f9f9f9]")} rounded-lg flex items-center justify-center overflow-hidden`}>
                              <img src={product.image} alt={product.name}
                                className="max-h-28 max-w-full object-contain p-2" />
                            </div>
                            {inCart > 0 && (
                              <span className="absolute top-2 right-2 h-5 w-5 rounded-full bg-[#2D9F6A] text-white text-[10px] font-black flex items-center justify-center shadow">
                                {inCart}
                              </span>
                            )}
                            {(product as any).featured && (
                              <span className="absolute top-2 left-2 inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">
                                <Star size={8} fill="currentColor" />
                              </span>
                            )}
                          </div>
                          <h3 className={`font-bold text-sm ${dk("text-white", "text-[#171717]")} leading-tight line-clamp-2 mb-1`}>{product.name}</h3>
                          <p className={`text-[11px] ${dk("text-gray-600", "text-[#737373]")} mb-1.5`}>
                            {product.category}
                            {product.sku && <span className="font-mono ml-1 text-gray-700">· {product.sku}</span>}
                          </p>
                          <div className="mb-2 flex flex-wrap gap-1">
                            <StockBadge stock={getAvailableStock(product)} />
                            {boughtQty > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                <RotateCcw size={8} /> ×{boughtQty}
                              </span>
                            )}
                          </div>
                          <div className="text-lg text-[#2D9F6A] font-extrabold leading-tight tabular-nums">
                            {formatPrice(finalPrice)}
                          </div>
                          <div className={`text-[10px] ${dk("text-[#525252]", "text-[#a3a3a3]")} mt-0.5`}>sin IVA · {product.iva_rate ?? 21}%</div>
                          {product.price_tiers && product.price_tiers.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {product.price_tiers.map((t, i) => (
                                <span key={i}
                                  title={`Precio por volumen: mín. ${t.min} u.${t.max ? ` — máx. ${t.max} u.` : "+"} → ${formatPrice(t.price * (1 + margin / 100))} s/IVA`}
                                  className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#2D9F6A]/10 text-[#2D9F6A] border border-[#2D9F6A]/20 cursor-help">
                                  {t.min}{t.max ? `–${t.max}` : "+"} → {formatPrice(t.price * (1 + margin / 100))}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="mt-3 flex gap-1.5">
                          {inCart > 0 ? (
                            <>
                              <button onClick={() => onRemoveFromCart(product)}
                                className={`flex-1 ${dk("bg-[#1c1c1c] hover:bg-[#252525] text-white border-[#262626]", "bg-[#f5f5f5] hover:bg-[#ebebeb] text-[#171717] border-[#e5e5e5]")} active:scale-95 rounded-lg py-1.5 text-sm font-bold transition-all border`}>−</button>
                              <span className={`flex items-center justify-center px-3 ${dk("text-white", "text-[#171717]")} font-bold text-sm`}>{inCart}</span>
                              <button onClick={() => handleAddToCart(product)}
                                className="flex-1 bg-[#2D9F6A] hover:bg-[#25835A] active:scale-95 text-white rounded-lg py-1.5 text-sm font-bold transition-all">+</button>
                            </>
                          ) : (
                            <button
                              disabled={outOfStock}
                              onClick={() => handleAddToCart(product)}
                              className={`w-full font-bold text-sm h-8 rounded-lg transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none ${
                                wasAdded
                                  ? "bg-green-600 hover:bg-green-600 text-white"
                                  : "bg-[#2D9F6A] hover:bg-[#25835A] text-white"
                              }`}
                            >
                              {outOfStock ? "Sin stock" : wasAdded ? "✓ Añadido" : "Añadir"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

              ) : (

                // ── LISTA ─────────────────────────────────────────────
                <div className="flex flex-col gap-1.5">
                  {filteredProducts.slice(0, visibleCount).map((product) => {
                    const inCart = cart[product.id] || 0;
                    const displayQty = inCart || 1;
                    const { margin } = resolveMarginWithContext(product, pricingRules, globalMargin, profile?.id, displayQty);
                    const finalPrice = getUnitPrice(product, displayQty) * (1 + margin / 100);
                    const outOfStock = getAvailableStock(product) === 0;
                    const wasAdded = addedIds.has(product.id);
                    const boughtQty = purchasedQty[product.id] ?? 0;

                    return (
                      <div
                        key={product.id}
                        className={`group flex items-center gap-3 ${dk("bg-[#111]", "bg-white")} border rounded-xl px-3 py-2.5 transition-all duration-150 ${
                          outOfStock
                            ? dk("border-[#1a1a1a]", "border-[#e5e5e5]") + " opacity-40"
                            : dk("border-[#1f1f1f] hover:border-[#252525] hover:bg-[#161616]", "border-[#e5e5e5] hover:border-[#d4d4d4] hover:bg-[#fafafa]")
                        }`}
                      >
                        {/* Clickable area */}
                        <div
                          className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                          onClick={() => setSelectedProduct(product)}
                        >
                          {/* Thumbnail */}
                          <div className={`h-14 w-14 shrink-0 ${dk("bg-[#0a0a0a] border-[#1a1a1a] group-hover:border-[#222]", "bg-[#f9f9f9] border-[#e5e5e5] group-hover:border-[#d4d4d4]")} rounded-xl flex items-center justify-center overflow-hidden border transition-colors`}>
                            <img src={product.image} alt={product.name}
                              className="max-h-12 max-w-12 object-contain" />
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className={`text-sm font-bold ${dk("text-white", "text-[#171717]")} truncate leading-tight`}>{product.name}</p>
                              {(product as any).featured && (
                                <Star size={11} className="text-yellow-500 shrink-0" fill="currentColor" />
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-gray-600">{product.category}</span>
                              {product.sku && (
                                <span className={`text-[10px] font-mono ${dk("text-[#525252] bg-[#171717]", "text-[#737373] bg-[#f0f0f0]")} px-1.5 py-0.5 rounded`}>{product.sku}</span>
                              )}
                            </div>
                          </div>

                          {/* Stock badge + purchase history */}
                          <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
                            <StockBadge stock={getAvailableStock(product)} />
                            {boughtQty > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                <RotateCcw size={8} /> ×{boughtQty}
                              </span>
                            )}
                          </div>

                          {/* Price + tiers */}
                          <div className="text-right shrink-0 hidden sm:block min-w-[110px]">
                            <div className="text-base font-extrabold text-[#2D9F6A] tabular-nums leading-tight">
                              {formatPrice(finalPrice)}
                            </div>
                            <div className={`text-[10px] ${dk("text-[#525252]", "text-[#a3a3a3]")} mt-0.5`}>sin IVA · {product.iva_rate ?? 21}%</div>
                            {product.price_tiers && product.price_tiers.length > 0 && (
                              <div className="flex flex-wrap gap-0.5 mt-1 justify-end">
                                {product.price_tiers.map((t, i) => (
                                  <span key={i}
                                    title={`Precio por volumen: mín. ${t.min} u.${t.max ? ` — máx. ${t.max} u.` : "+"} → ${formatPrice(t.price * (1 + margin / 100))} s/IVA`}
                                    className="text-[8px] font-mono px-1 py-0.5 rounded bg-[#2D9F6A]/10 text-[#2D9F6A] border border-[#2D9F6A]/20 cursor-help">
                                    {t.min}{t.max ? `–${t.max}` : "+"}u
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Cart controls */}
                        <div className="flex items-center gap-1 shrink-0">
                          {inCart > 0 ? (
                            <>
                              <button onClick={() => onRemoveFromCart(product)}
                                className={`h-8 w-8 ${dk("bg-[#1c1c1c] hover:bg-[#252525] text-white border-[#262626]", "bg-[#f5f5f5] hover:bg-[#ebebeb] text-[#171717] border-[#e5e5e5]")} active:scale-95 rounded-lg text-sm font-bold transition-all flex items-center justify-center border`}>
                                <Minus size={12} />
                              </button>
                              <span className={`w-7 text-center ${dk("text-white", "text-[#171717]")} font-bold text-sm tabular-nums`}>{inCart}</span>
                              <button onClick={() => handleAddToCart(product)}
                                className="h-8 w-8 bg-[#2D9F6A] hover:bg-[#25835A] active:scale-95 text-white rounded-lg text-sm font-bold transition-all flex items-center justify-center">
                                <Plus size={12} />
                              </button>
                            </>
                          ) : (
                            <button
                              disabled={outOfStock}
                              onClick={() => handleAddToCart(product)}
                              className={`text-xs h-8 px-3.5 rounded-lg font-bold transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap ${
                                wasAdded
                                  ? "bg-green-600/90 text-white"
                                  : "bg-[#2D9F6A] hover:bg-[#25835A] text-white"
                              }`}
                            >
                              {outOfStock ? "Sin stock" : wasAdded ? "✓ Añadido" : "Añadir"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Load more — L1 pagination */}
              {visibleCount < filteredProducts.length && (
                <div className="flex justify-center mt-4">
                  <button
                    onClick={() => setVisibleCount((n) => n + 50)}
                    className={`px-5 py-2 text-sm font-semibold rounded-xl border transition ${dk("border-[#2a2a2a] text-[#a3a3a3] hover:text-white hover:border-[#3a3a3a] hover:bg-[#1a1a1a]", "border-[#e5e5e5] text-[#525252] hover:text-[#171717] hover:border-[#d4d4d4] hover:bg-[#f5f5f5]")}`}
                  >
                    Cargar más ({filteredProducts.length - visibleCount} restantes)
                  </button>
                </div>
              )}
            </>
          )}

          {/* ── COTIZACIONES ── */}
          {activeTab === "quotes" && (
            <QuoteList
              quotes={quotes}
              isDark={isDark}
              onLoad={handleLoadQuote}
              onUpdateStatus={updateQuoteStatus}
              onDelete={deleteQuote}
              onGoToCatalog={() => setActiveTab("catalog")}
              onDuplicate={(id) => duplicateQuote(id)}
              onConvertToOrder={handleConvertToOrder}
            />
          )}

          {/* ── MIS PEDIDOS ── */}
          {activeTab === "orders" && (
            <div className="max-w-3xl">
              {orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-gray-600">
                  <ClipboardList size={36} className="mb-3 opacity-20" />
                  <p className="text-sm font-medium text-gray-500">Todavía no hiciste ningún pedido</p>
                  <button onClick={() => setActiveTab("catalog")}
                    className="mt-3 text-xs text-[#2D9F6A] hover:underline">Ver catálogo</button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {orders.map((order) => (
                    <div key={order.id} className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-xl overflow-hidden`}>
                      {/* Order header */}
                      <div className={`flex items-center justify-between px-5 py-3.5 border-b ${dk("border-[#1a1a1a]", "border-[#e5e5e5]")}`}>
                        <div>
                          <span className="text-xs font-bold text-gray-400">Pedido #{String(order.id).slice(-6).toUpperCase()}</span>
                          <p className="text-[11px] text-gray-600 mt-0.5">
                            {new Date(order.created_at).toLocaleDateString("es-AR", {
                              day: "2-digit", month: "long", year: "numeric",
                              hour: "2-digit", minute: "2-digit"
                            })}
                          </p>
                        </div>
                        <StatusBadge status={order.status} />
                      </div>
                      {/* Products */}
                      <div className="px-5 py-3 space-y-1.5">
                        {order.products.map((p, i) => (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`${dk("text-gray-300", "text-[#525252]")} truncate`}>{p.name}</span>
                              <span className="text-gray-600 shrink-0">×{p.quantity}</span>
                            </div>
                            <span className="text-[#2D9F6A] font-semibold tabular-nums shrink-0 ml-4">
                              {formatPrice(p.total_price ?? 0)}
                            </span>
                          </div>
                        ))}
                      </div>
                      {/* Total + reorder */}
                      <div className={`flex justify-between items-center border-t ${dk("border-[#1a1a1a] bg-[#0a0a0a]", "border-[#e5e5e5] bg-[#f9f9f9]")} px-5 py-3`}>
                        <div>
                          <span className={`text-sm ${dk("text-gray-500", "text-[#737373]")} font-medium`}>Total del pedido</span>
                          <div className="text-[10px] text-gray-700 font-mono">
                            {currency === "USD" ? formatARS(order.total) : formatUSD(order.total)}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleReorder(order.products)}
                            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition
                              ${dk("border-[#262626] text-[#737373] hover:text-[#2D9F6A] hover:border-[#2D9F6A]/40 hover:bg-[#0d1f17]", "border-[#e5e5e5] text-gray-500 hover:text-[#2D9F6A] hover:border-[#2D9F6A]/30 hover:bg-green-50")}`}
                          >
                            Repetir pedido
                          </button>
                          <span className="text-lg font-extrabold text-[#2D9F6A] tabular-nums">
                            {formatPrice(order.total)}
                          </span>
                        </div>
                      </div>
                      {/* Payment proof upload */}
                      <OrderPaymentProof
                        orderId={order.id}
                        existingProofs={order.payment_proofs ?? []}
                        isDark={isDark}
                        onProofsUpdated={(proofs) => {
                          // Optimistic update reflected by refetch on next render
                          void proofs;
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── LISTAS DE COMPRA ── */}
          {activeTab === "lists" && (
            <div className="max-w-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h2 className={`text-base font-bold ${dk("text-white", "text-[#171717]")}`}>
                  Listas de compra frecuente
                </h2>
                {cartItems.length > 0 && (
                  <button
                    onClick={async () => {
                      const name = `Lista ${new Date().toLocaleDateString("es-AR")} — ${cartItems.length} prod.`;
                      const prods = cartItems.map((i) => ({
                        product_id: i.product.id,
                        name:       i.product.name,
                        sku:        i.product.sku,
                        quantity:   i.quantity,
                      }));
                      await createPurchaseList(name, prods);
                    }}
                    className="flex items-center gap-1.5 bg-[#2D9F6A] hover:bg-[#25835A] text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
                  >
                    <Bookmark size={12} /> Guardar carrito actual
                  </button>
                )}
              </div>

              {purchaseLists.length === 0 ? (
                <div className={`flex flex-col items-center py-20 gap-3 ${dk("text-[#525252]", "text-[#737373]")}`}>
                  <Bookmark size={32} className="opacity-20" />
                  <p className="text-sm font-medium">No tenés listas guardadas</p>
                  <p className="text-xs">Guardá tu carrito como lista para repetir pedidos rápidamente</p>
                  <button
                    onClick={() => setActiveTab("catalog")}
                    className="mt-2 text-xs text-[#2D9F6A] hover:underline"
                  >
                    Ir al catálogo
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {purchaseLists.map((list) => (
                    <div
                      key={list.id}
                      className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-xl overflow-hidden`}
                    >
                      <div className={`flex items-center justify-between px-4 py-3 border-b ${dk("border-[#1a1a1a]", "border-[#e5e5e5]")}`}>
                        <div>
                          <p className={`text-sm font-semibold ${dk("text-white", "text-[#171717]")}`}>{list.name}</p>
                          <p className="text-[11px] text-[#525252] mt-0.5">
                            {new Date(list.updated_at).toLocaleDateString("es-AR")} · {list.products.length} producto{list.products.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              const newCart: Record<number, number> = {};
                              list.products.forEach((p) => { newCart[p.product_id] = p.quantity; });
                              setCart(newCart);
                              setActiveTab("catalog");
                            }}
                            className="text-xs bg-[#2D9F6A] hover:bg-[#25835A] text-white font-bold px-3 py-1.5 rounded-lg transition"
                          >
                            Cargar en carrito
                          </button>
                          <button
                            onClick={() => deletePurchaseList(list.id)}
                            className={`p-1.5 rounded-lg transition ${dk("text-[#525252] hover:text-red-400 hover:bg-red-500/10", "text-[#a3a3a3] hover:text-red-500 hover:bg-red-50")}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                      <div className={`px-4 py-2.5 flex flex-wrap gap-1.5`}>
                        {list.products.slice(0, 5).map((p) => (
                          <span key={p.product_id} className={`text-[11px] px-2 py-0.5 rounded-full ${dk("bg-[#1c1c1c] text-[#a3a3a3] border-[#262626]", "bg-[#f0f0f0] text-[#525252] border-[#e5e5e5]")} border`}>
                            {p.quantity}× {p.name}
                          </span>
                        ))}
                        {list.products.length > 5 && (
                          <span className="text-[11px] text-[#525252]">+{list.products.length - 5} más</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </main>
      </div>

      {/* MODAL PRODUCTO */}
      {productModal}
    </div>
  );
}
