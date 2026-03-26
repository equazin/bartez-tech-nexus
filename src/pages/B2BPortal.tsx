import { useState, useMemo, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { CartDrawer } from "@/components/CartDrawer";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useProducts } from "@/hooks/useProducts";
import { supabase } from "@/lib/supabase";
import { useOrders } from "@/hooks/useOrders";
import { useCurrency } from "@/context/CurrencyContext";
import {
  LogOut, ShoppingCart, Search, LayoutGrid, List, Package,
  ClipboardList, CheckCircle2, XCircle, Clock, X, Plus, Minus,
  ShieldCheck, Check, AlertTriangle, AlertCircle, SlidersHorizontal,
  Star, Sun, Moon, ChevronDown, ChevronRight,
} from "lucide-react";
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
  const map: Record<string, { label: string; className: string; icon: any }> = {
    pending:  { label: "En revisión", className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30", icon: Clock },
    approved: { label: "Aprobado",    className: "bg-green-500/15 text-green-400 border-green-500/30",   icon: CheckCircle2 },
    rejected: { label: "Rechazado",   className: "bg-red-500/15 text-red-400 border-red-500/30",         icon: XCircle },
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
  const { currency, setCurrency, formatPrice, formatUSD, formatARS, exchangeRate } = useCurrency();

  const defaultMargin = profile?.default_margin ?? 20;
  const clientName = profile?.company_name ?? profile?.contact_name ?? "Cliente";
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
  const [activeTab, setActiveTab] = useState<"catalog" | "orders">("catalog");
  const [cartOpen, setCartOpen] = useState(false);
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());

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

  const hasActiveFilters = categoryFilter !== "all" || minPrice !== "" || maxPrice !== "";

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
      return true;
    });
  }, [products, search, categoryFilter, minPrice, maxPrice]);

  const cartItems: CartItem[] = useMemo(() => {
    return Object.entries(cart)
      .map(([id, qty]) => {
        const product = products.find((p) => p.id === Number(id));
        if (!product) return null;
        const margin = productMargins[Number(id)] ?? globalMargin;
        const cost = product.cost_price;
        const unitPrice = cost * (1 + margin / 100);
        const totalPrice = unitPrice * qty;
        const ivaRate = product.iva_rate ?? 21;
        const ivaAmount = totalPrice * (ivaRate / 100);
        return { product, quantity: qty, cost, margin, unitPrice, totalPrice, ivaRate, ivaAmount, totalWithIVA: totalPrice + ivaAmount };
      })
      .filter((i): i is CartItem => i !== null);
  }, [cart, products, productMargins, globalMargin]);

  const cartSubtotal = useMemo(() => cartItems.reduce((s, i) => s + i.totalPrice, 0), [cartItems]);
  const cartIVATotal = useMemo(() => cartItems.reduce((s, i) => s + i.ivaAmount, 0), [cartItems]);
  const cartTotal = useMemo(() => cartSubtotal + cartIVATotal, [cartSubtotal, cartIVATotal]);
  const cartCount = useMemo(() => Object.values(cart).reduce((s, q) => s + q, 0), [cart]);

  // Add to cart with "added" flash feedback
  function handleAddToCart(product: any) {
    setCart((prev) => ({ ...prev, [product.id]: (prev[product.id] || 0) + 1 }));
    setAddedIds((prev) => new Set(prev).add(product.id));
    setTimeout(() => {
      setAddedIds((prev) => { const s = new Set(prev); s.delete(product.id); return s; });
    }, 900);
  }

  const onRemoveFromCart = (product: any) =>
    setCart((prev) => {
      const qty = prev[product.id] || 0;
      if (qty <= 1) { const { [product.id]: _, ...rest } = prev; return rest; }
      return { ...prev, [product.id]: qty - 1 };
    });

  const onMarginChange = (productId: number, margin: number) =>
    setProductMargins((prev) => ({ ...prev, [productId]: margin }));

  const handleConfirmOrder = async () => {
    if (!cartItems.length) return;
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
      created_at: new Date().toISOString(),
    });
    setOrderSubmitting(false);
    if (!error) {
      setOrderSuccess(true);
      setCart({});
      setCartOpen(false);
      setActiveTab("orders");
      setTimeout(() => setOrderSuccess(false), 5000);
    }
  };

  const handleLogout = async () => { await signOut(); navigate("/login"); };

  function clearFilters() {
    setCategoryFilter("all");
    setMinPrice("");
    setMaxPrice("");
    setSearch("");
  }

  // ─── PRODUCT MODAL ────────────────────────────────────────────────────
  const productModal = selectedProduct && (() => {
    const p = selectedProduct;
    const margin = productMargins[p.id] ?? globalMargin;
    const finalPrice = p.cost_price * (1 + margin / 100);  // sin IVA
    const ivaRate = p.iva_rate ?? 21;
    const ivaAmt = finalPrice * (ivaRate / 100);
    const finalWithIVA = finalPrice + ivaAmt;
    const inCart = cart[p.id] || 0;
    const outOfStock = p.stock === 0;

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
            onClick={() => setCartOpen(true)}
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
          </aside>
        )}

        {/* CONTENIDO PRINCIPAL */}
        <main className={`flex-1 p-4 md:p-5 overflow-y-auto`}>

          {/* ── CATÁLOGO ── */}
          {activeTab === "catalog" && (
            <>
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
                  {filteredProducts.map((product) => {
                    const margin = productMargins[product.id] ?? globalMargin;
                    const finalPrice = product.cost_price * (1 + margin / 100);
                    const inCart = cart[product.id] || 0;
                    const outOfStock = product.stock === 0;
                    const wasAdded = addedIds.has(product.id);

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
                          <div className="mb-2"><StockBadge stock={product.stock} /></div>
                          <div className="text-lg text-[#2D9F6A] font-extrabold leading-tight tabular-nums">
                            {formatPrice(finalPrice)}
                          </div>
                          <div className={`text-[10px] ${dk("text-[#525252]", "text-[#a3a3a3]")} mt-0.5`}>sin IVA · {product.iva_rate ?? 21}%</div>
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
                  {filteredProducts.map((product) => {
                    const margin = productMargins[product.id] ?? globalMargin;
                    const finalPrice = product.cost_price * (1 + margin / 100);
                    const inCart = cart[product.id] || 0;
                    const outOfStock = product.stock === 0;
                    const wasAdded = addedIds.has(product.id);

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

                          {/* Stock badge */}
                          <div className="hidden sm:block shrink-0">
                            <StockBadge stock={product.stock} />
                          </div>

                          {/* Price */}
                          <div className="text-right shrink-0 hidden sm:block min-w-[100px]">
                            <div className="text-base font-extrabold text-[#2D9F6A] tabular-nums leading-tight">
                              {formatPrice(finalPrice)}
                            </div>
                            <div className={`text-[10px] ${dk("text-[#525252]", "text-[#a3a3a3]")} mt-0.5`}>sin IVA · {product.iva_rate ?? 21}%</div>
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
            </>
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
                      {/* Total */}
                      <div className={`flex justify-between items-center border-t ${dk("border-[#1a1a1a] bg-[#0a0a0a]", "border-[#e5e5e5] bg-[#f9f9f9]")} px-5 py-3`}>
                        <div>
                          <span className={`text-sm ${dk("text-gray-500", "text-[#737373]")} font-medium`}>Total del pedido</span>
                          <div className="text-[10px] text-gray-700 font-mono">
                            {currency === "USD" ? formatARS(order.total) : formatUSD(order.total)}
                          </div>
                        </div>
                        <span className="text-lg font-extrabold text-[#2D9F6A] tabular-nums">
                          {formatPrice(order.total)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </main>
      </div>

      {/* CARRITO */}
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cartItems={cartItems}
        cartSubtotal={cartSubtotal}
        cartIVATotal={cartIVATotal}
        cartTotal={cartTotal}
        globalMargin={globalMargin}
        profile={profile}
        onAddToCart={handleAddToCart}
        onRemoveFromCart={onRemoveFromCart}
        onMarginChange={onMarginChange}
        onConfirmOrder={handleConfirmOrder}
        confirming={orderSubmitting}
      />

      {/* MODAL PRODUCTO */}
      {productModal}
    </div>
  );
}
