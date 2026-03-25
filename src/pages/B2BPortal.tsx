import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CartDrawer } from "@/components/CartDrawer";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useProducts } from "@/hooks/useProducts";
import { useOrders } from "@/hooks/useOrders";
import { useCurrency } from "@/context/CurrencyContext";
import {
  LogOut, ShoppingCart, Search, LayoutGrid, List, Package,
  ClipboardList, CheckCircle2, XCircle, Clock, X, Plus, Minus,
  ShieldCheck, Check, AlertTriangle, AlertCircle, SlidersHorizontal,
  Star,
} from "lucide-react";
import { Link } from "react-router-dom";

type CartItem = {
  product: any;
  quantity: number;
  cost: number;
  margin: number;
  unitPrice: number;
  totalPrice: number;
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
    <div className="flex items-center gap-4 bg-[#1e1e1e] border border-[#262626] rounded-xl px-4 py-3 animate-pulse">
      <div className="h-14 w-14 rounded-xl bg-[#2a2a2a] shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 bg-[#2a2a2a] rounded w-2/3" />
        <div className="h-2.5 bg-[#252525] rounded w-1/3" />
      </div>
      <div className="h-5 w-16 bg-[#252525] rounded-full" />
      <div className="h-6 w-20 bg-[#2a2a2a] rounded" />
      <div className="h-8 w-20 bg-[#2a2a2a] rounded-lg" />
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-[#1e1e1e] border border-[#262626] rounded-xl p-4 animate-pulse">
      <div className="h-32 w-full bg-[#2a2a2a] rounded-lg mb-3" />
      <div className="h-3.5 bg-[#2a2a2a] rounded w-3/4 mb-2" />
      <div className="h-2.5 bg-[#252525] rounded w-1/2 mb-3" />
      <div className="h-6 bg-[#2a2a2a] rounded w-1/3 mb-3" />
      <div className="h-8 bg-[#2a2a2a] rounded-lg" />
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

  const categories = useMemo(
    () => ["all", ...Array.from(new Set(products.map((p) => p.category)))],
    [products]
  );

  // Count per category for sidebar badges
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: products.length };
    products.forEach((p) => { counts[p.category] = (counts[p.category] || 0) + 1; });
    return counts;
  }, [products]);

  const hasActiveFilters = categoryFilter !== "all" || minPrice !== "" || maxPrice !== "";

  const filteredProducts = useMemo(() => {
    const term = search.toLowerCase();
    return products.filter((p) => {
      const min = Number(minPrice);
      const max = Number(maxPrice);
      if (term && !p.name.toLowerCase().includes(term) && !p.sku?.toLowerCase().includes(term)) return false;
      if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
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
        return { product, quantity: qty, cost, margin, unitPrice, totalPrice: unitPrice * qty };
      })
      .filter((i): i is CartItem => i !== null);
  }, [cart, products, productMargins, globalMargin]);

  const cartTotal = useMemo(() => cartItems.reduce((s, i) => s + i.totalPrice, 0), [cartItems]);
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
    const finalPrice = p.cost_price * (1 + margin / 100);
    const inCart = cart[p.id] || 0;
    const outOfStock = p.stock === 0;

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
        onClick={() => setSelectedProduct(null)}
      >
        <div
          className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#242424]">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 bg-[#242424] px-2 py-0.5 rounded-full font-medium">{p.category}</span>
              {p.featured && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                  <Star size={9} fill="currentColor" /> Destacado
                </span>
              )}
            </div>
            <button onClick={() => setSelectedProduct(null)}
              className="text-gray-600 hover:text-white transition p-1 rounded-lg hover:bg-[#2a2a2a]">
              <X size={16} />
            </button>
          </div>

          {/* Image */}
          <div className="bg-[#111] flex items-center justify-center h-56 px-8">
            <img src={p.image} alt={p.name} className="max-h-44 max-w-full object-contain drop-shadow-xl" />
          </div>

          {/* Info */}
          <div className="px-5 py-5">
            <div className="flex items-start justify-between gap-3 mb-1.5">
              <h2 className="text-lg font-extrabold text-white leading-tight">{p.name}</h2>
              <StockBadge stock={p.stock} />
            </div>

            {p.sku && (
              <p className="text-xs text-gray-600 mb-3 font-mono">SKU: {p.sku}</p>
            )}

            {p.description && (
              <p className="text-sm text-gray-400 mb-4 leading-relaxed">{p.description}</p>
            )}

            <div className="mb-5">
              <div className="text-2xl font-extrabold text-[#FF6A00]">{formatPrice(finalPrice)}</div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-xs text-gray-600">precio cliente</span>
                <span className="text-gray-700">·</span>
                <span className="text-xs text-gray-600 font-mono">
                  {currency === "USD" ? formatARS(finalPrice) : formatUSD(finalPrice)}
                </span>
              </div>
            </div>

            {outOfStock ? (
              <div className="w-full bg-[#2a2a2a] text-gray-500 font-bold h-11 rounded-xl text-sm flex items-center justify-center">
                Sin stock disponible
              </div>
            ) : inCart > 0 ? (
              <div className="flex items-center gap-3">
                <button onClick={() => onRemoveFromCart(p)}
                  className="h-11 w-11 bg-[#2a2a2a] hover:bg-[#333] text-white rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center">
                  <Minus size={16} />
                </button>
                <span className="flex-1 text-center text-white font-extrabold text-xl">{inCart}</span>
                <button onClick={() => handleAddToCart(p)}
                  className="h-11 w-11 bg-[#FF6A00] hover:bg-[#FF8C1A] text-white rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center">
                  <Plus size={16} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleAddToCart(p)}
                className="w-full bg-gradient-to-r from-[#FF6A00] to-[#FF8C1A] hover:brightness-110 text-white font-bold h-11 rounded-xl text-sm transition-all active:scale-[0.98]"
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
    <div className="flex min-h-screen bg-[#161616] flex-col">

      {/* TOPBAR */}
      <header className="flex items-center gap-3 px-4 md:px-6 py-2.5 bg-[#111] border-b border-[#1e1e1e] flex-wrap">
        <div className="flex items-center gap-2.5 shrink-0">
          <img src="/icon.png" alt="Bartez" className="h-8 w-8 object-contain" />
          <div>
            <span className="font-bold text-white text-sm leading-none">Portal B2B</span>
            <span className="block text-[11px] text-[#FF6A00] leading-none mt-0.5 font-medium">{clientName}</span>
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
            className="w-full bg-[#1a1a1a] border border-[#272727] text-white text-sm rounded-xl pl-9 pr-8 py-2 outline-none focus:border-[#FF6A00]/60 focus:ring-2 focus:ring-[#FF6A00]/10 placeholder:text-gray-600 transition"
          />
          {search && (
            <button onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-300 transition p-0.5">
              <X size={12} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          {/* Currency selector */}
          <div className="flex items-center bg-[#1a1a1a] border border-[#252525] rounded-lg p-1 gap-0.5">
            {(["USD", "ARS"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={`px-2.5 py-1 rounded text-xs font-bold transition ${
                  currency === c
                    ? "bg-[#FF6A00] text-white"
                    : "text-gray-600 hover:text-gray-300"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Vista */}
          <div className="hidden md:flex items-center bg-[#1a1a1a] border border-[#252525] rounded-lg p-1 gap-0.5">
            <button onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded transition ${viewMode === "grid" ? "bg-[#FF6A00] text-white" : "text-gray-600 hover:text-gray-300"}`}>
              <LayoutGrid size={13} />
            </button>
            <button onClick={() => setViewMode("list")}
              className={`p-1.5 rounded transition ${viewMode === "list" ? "bg-[#FF6A00] text-white" : "text-gray-600 hover:text-gray-300"}`}>
              <List size={13} />
            </button>
          </div>

          {/* Carrito */}
          <button
            onClick={() => setCartOpen(true)}
            className="relative flex items-center gap-2 bg-[#FF6A00] hover:bg-[#FF8C1A] active:scale-95 text-white rounded-xl px-3 py-2 text-sm font-semibold transition-all"
          >
            <ShoppingCart size={15} />
            <span className="hidden md:inline">Carrito</span>
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-white text-[#FF6A00] text-[10px] font-black flex items-center justify-center shadow">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </button>

          {/* Admin */}
          {isAdmin && (
            <Link to="/admin"
              className="flex items-center gap-1.5 text-xs text-[#FF6A00] hover:text-white transition px-2.5 py-2 rounded-lg hover:bg-[#1e1e1e]">
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
      <div className="flex border-b border-[#1e1e1e] bg-[#111] px-4 md:px-6">
        {[
          { id: "catalog", label: "Catálogo", icon: Package },
          { id: "orders",  label: `Mis Pedidos${orders.length ? ` (${orders.length})` : ""}`, icon: ClipboardList },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as any)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition ${
              activeTab === id
                ? "border-[#FF6A00] text-white"
                : "border-transparent text-gray-600 hover:text-gray-400"
            }`}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {/* BANNER ADMIN */}
      {isAdmin && (
        <div className="flex items-center justify-between bg-[#FF6A00]/8 border-b border-[#FF6A00]/15 px-4 md:px-6 py-2">
          <div className="flex items-center gap-2 text-[#FF6A00] text-xs font-medium">
            <ShieldCheck size={13} />
            Vista de administrador
          </div>
          <Link to="/admin"
            className="flex items-center gap-1.5 bg-[#FF6A00] hover:bg-[#FF8C1A] text-white text-xs font-bold px-3 py-1.5 rounded-lg transition">
            <ShieldCheck size={11} /> Panel Admin
          </Link>
        </div>
      )}

      {orderSuccess && (
        <div className="mx-4 mt-3 bg-green-900/20 border border-green-500/30 rounded-xl p-3 text-green-400 text-sm font-medium flex items-center gap-2">
          <CheckCircle2 size={15} />
          Pedido confirmado. Lo estamos revisando y te contactaremos pronto.
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">

        {/* SIDEBAR */}
        {activeTab === "catalog" && (
          <aside className="hidden md:flex flex-col w-52 bg-[#111] border-r border-[#1e1e1e] p-3 gap-4 shrink-0">

            {/* Clear filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 text-xs text-[#FF6A00] hover:text-white border border-[#FF6A00]/30 hover:border-[#FF6A00]/60 bg-[#FF6A00]/5 hover:bg-[#FF6A00]/10 rounded-lg px-3 py-1.5 transition font-medium"
              >
                <SlidersHorizontal size={11} /> Limpiar filtros
              </button>
            )}

            {/* Categorías */}
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-2 px-1">Categoría</h3>
              <div className="flex flex-col gap-0.5">
                {categories.map((c) => {
                  const isActive = categoryFilter === c;
                  const count = categoryCounts[c] || 0;
                  return (
                    <button
                      key={c}
                      onClick={() => setCategoryFilter(c)}
                      className={`flex items-center justify-between text-left text-sm px-2.5 py-1.5 rounded-lg transition group ${
                        isActive
                          ? "bg-[#FF6A00]/12 text-[#FF6A00] font-semibold border-l-2 border-[#FF6A00]"
                          : "text-gray-500 hover:text-gray-200 hover:bg-[#1a1a1a] border-l-2 border-transparent"
                      }`}
                    >
                      <span className="truncate">{c === "all" ? "Todas" : c}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1 shrink-0 ${
                        isActive ? "bg-[#FF6A00]/20 text-[#FF6A00]" : "bg-[#222] text-gray-600 group-hover:bg-[#2a2a2a]"
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Precio */}
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-2 px-1">Precio</h3>
              <div className="flex flex-col gap-1.5">
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600 text-xs">$</span>
                  <input type="number" placeholder="Mínimo" value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    className="w-full bg-[#1a1a1a] border border-[#252525] text-white text-xs rounded-lg pl-6 pr-2 py-1.5 outline-none focus:border-[#FF6A00]/50 placeholder:text-gray-700 transition" />
                </div>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600 text-xs">$</span>
                  <input type="number" placeholder="Máximo" value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    className="w-full bg-[#1a1a1a] border border-[#252525] text-white text-xs rounded-lg pl-6 pr-2 py-1.5 outline-none focus:border-[#FF6A00]/50 placeholder:text-gray-700 transition" />
                </div>
              </div>
            </div>
          </aside>
        )}

        {/* CONTENIDO PRINCIPAL */}
        <main className="flex-1 p-4 md:p-5 overflow-y-auto">

          {/* ── CATÁLOGO ── */}
          {activeTab === "catalog" && (
            <>
              {/* Results info */}
              {!productsLoading && filteredProducts.length > 0 && (
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-gray-600">
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
                      className="mt-3 text-xs text-[#FF6A00] hover:underline">
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
                        className={`bg-[#1a1a1a] border rounded-xl p-4 flex flex-col transition-all duration-200 ${
                          outOfStock
                            ? "border-[#222] opacity-50"
                            : "border-[#252525] hover:border-[#FF6A00]/35 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/40"
                        }`}
                      >
                        <div className="cursor-pointer" onClick={() => setSelectedProduct(product)}>
                          <div className="relative mb-3">
                            <div className="h-32 w-full bg-[#111] rounded-lg flex items-center justify-center overflow-hidden">
                              <img src={product.image} alt={product.name}
                                className="max-h-28 max-w-full object-contain p-2" />
                            </div>
                            {inCart > 0 && (
                              <span className="absolute top-2 right-2 h-5 w-5 rounded-full bg-[#FF6A00] text-white text-[10px] font-black flex items-center justify-center shadow">
                                {inCart}
                              </span>
                            )}
                            {(product as any).featured && (
                              <span className="absolute top-2 left-2 inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">
                                <Star size={8} fill="currentColor" />
                              </span>
                            )}
                          </div>
                          <h3 className="font-bold text-sm text-white leading-tight line-clamp-2 mb-1">{product.name}</h3>
                          <p className="text-[11px] text-gray-600 mb-1.5">
                            {product.category}
                            {product.sku && <span className="font-mono ml-1 text-gray-700">· {product.sku}</span>}
                          </p>
                          <div className="mb-2"><StockBadge stock={product.stock} /></div>
                          <div className="text-lg text-[#FF6A00] font-extrabold leading-tight">
                            {formatPrice(finalPrice)}
                          </div>
                          <div className="text-[10px] text-gray-600 font-mono mt-0.5">
                            {currency === "USD" ? formatARS(finalPrice) : formatUSD(finalPrice)}
                          </div>
                        </div>

                        <div className="mt-3 flex gap-1.5">
                          {inCart > 0 ? (
                            <>
                              <button onClick={() => onRemoveFromCart(product)}
                                className="flex-1 bg-[#252525] hover:bg-[#2e2e2e] active:scale-95 text-white rounded-lg py-1.5 text-sm font-bold transition-all">−</button>
                              <span className="flex items-center justify-center px-3 text-white font-bold text-sm">{inCart}</span>
                              <button onClick={() => handleAddToCart(product)}
                                className="flex-1 bg-[#FF6A00] hover:bg-[#FF8C1A] active:scale-95 text-white rounded-lg py-1.5 text-sm font-bold transition-all">+</button>
                            </>
                          ) : (
                            <button
                              disabled={outOfStock}
                              onClick={() => handleAddToCart(product)}
                              className={`w-full font-bold text-sm h-8 rounded-lg transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none ${
                                wasAdded
                                  ? "bg-green-600 hover:bg-green-600 text-white"
                                  : "bg-[#FF6A00] hover:bg-[#FF8C1A] text-white"
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
                        className={`group flex items-center gap-3 bg-[#1a1a1a] border rounded-xl px-3 py-2.5 transition-all duration-150 ${
                          outOfStock
                            ? "border-[#1e1e1e] opacity-50"
                            : "border-[#252525] hover:border-[#FF6A00]/25 hover:bg-[#1e1e1e]"
                        }`}
                      >
                        {/* Clickable area */}
                        <div
                          className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                          onClick={() => setSelectedProduct(product)}
                        >
                          {/* Thumbnail */}
                          <div className="h-14 w-14 shrink-0 bg-[#111] rounded-xl flex items-center justify-center overflow-hidden border border-[#222] group-hover:border-[#2a2a2a] transition-colors">
                            <img src={product.image} alt={product.name}
                              className="max-h-12 max-w-12 object-contain" />
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="text-sm font-bold text-white truncate leading-tight">{product.name}</p>
                              {(product as any).featured && (
                                <Star size={11} className="text-yellow-500 shrink-0" fill="currentColor" />
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-gray-600">{product.category}</span>
                              {product.sku && (
                                <span className="text-[10px] font-mono text-gray-700 bg-[#222] px-1.5 py-0.5 rounded">{product.sku}</span>
                              )}
                            </div>
                          </div>

                          {/* Stock badge */}
                          <div className="hidden sm:block shrink-0">
                            <StockBadge stock={product.stock} />
                          </div>

                          {/* Price */}
                          <div className="text-right shrink-0 hidden sm:block min-w-[100px]">
                            <div className="text-base font-extrabold text-[#FF6A00] tabular-nums leading-tight">
                              {formatPrice(finalPrice)}
                            </div>
                            <div className="text-[10px] text-gray-600 font-mono mt-0.5">
                              {currency === "USD" ? formatARS(finalPrice) : formatUSD(finalPrice)}
                            </div>
                          </div>
                        </div>

                        {/* Cart controls */}
                        <div className="flex items-center gap-1 shrink-0">
                          {inCart > 0 ? (
                            <>
                              <button onClick={() => onRemoveFromCart(product)}
                                className="h-8 w-8 bg-[#252525] hover:bg-[#2e2e2e] active:scale-95 text-white rounded-lg text-sm font-bold transition-all flex items-center justify-center">
                                <Minus size={12} />
                              </button>
                              <span className="w-7 text-center text-white font-bold text-sm tabular-nums">{inCart}</span>
                              <button onClick={() => handleAddToCart(product)}
                                className="h-8 w-8 bg-[#FF6A00] hover:bg-[#FF8C1A] active:scale-95 text-white rounded-lg text-sm font-bold transition-all flex items-center justify-center">
                                <Plus size={12} />
                              </button>
                            </>
                          ) : (
                            <button
                              disabled={outOfStock}
                              onClick={() => handleAddToCart(product)}
                              className={`text-xs h-8 px-3.5 rounded-lg font-bold transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap ${
                                wasAdded
                                  ? "bg-green-600 hover:bg-green-600 text-white"
                                  : "bg-[#FF6A00] hover:bg-[#FF8C1A] text-white"
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
                    className="mt-3 text-xs text-[#FF6A00] hover:underline">Ver catálogo</button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {orders.map((order) => (
                    <div key={order.id} className="bg-[#1a1a1a] border border-[#252525] rounded-xl overflow-hidden">
                      {/* Order header */}
                      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#222]">
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
                              <span className="text-gray-300 truncate">{p.name}</span>
                              <span className="text-gray-600 shrink-0">×{p.quantity}</span>
                            </div>
                            <span className="text-[#FF6A00] font-semibold tabular-nums shrink-0 ml-4">
                              {formatPrice(p.total_price ?? 0)}
                            </span>
                          </div>
                        ))}
                      </div>
                      {/* Total */}
                      <div className="flex justify-between items-center border-t border-[#1e1e1e] px-5 py-3 bg-[#161616]">
                        <div>
                          <span className="text-sm text-gray-500 font-medium">Total del pedido</span>
                          <div className="text-[10px] text-gray-700 font-mono">
                            {currency === "USD" ? formatARS(order.total) : formatUSD(order.total)}
                          </div>
                        </div>
                        <span className="text-lg font-extrabold text-[#FF6A00] tabular-nums">
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
