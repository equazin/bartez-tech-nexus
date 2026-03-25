import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CartDrawer } from "@/components/CartDrawer";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useProducts } from "@/hooks/useProducts";
import { useOrders } from "@/hooks/useOrders";
import { LogOut, ShoppingCart, Search, LayoutGrid, List, Package, ClipboardList, CheckCircle2, XCircle, Clock } from "lucide-react";

type CartItem = {
  product: any;
  quantity: number;
  cost: number;
  margin: number;
  unitPrice: number;
  totalPrice: number;
};

function StockBadge({ stock }: { stock: number }) {
  if (stock === 0)
    return <span className="text-[10px] font-semibold text-red-400">Sin stock</span>;
  if (stock <= 3)
    return <span className="text-[10px] font-semibold text-yellow-400">Últimas {stock}u</span>;
  return <span className="text-[10px] font-semibold text-green-400">En stock</span>;
}

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

export default function B2BPortal() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { products, loading: productsLoading } = useProducts();
  const { orders, addOrder } = useOrders();

  const defaultMargin = profile?.default_margin ?? 20;
  const clientName = profile?.company_name ?? profile?.contact_name ?? "Cliente";
  const cartKey = `b2b_cart_${profile?.id || "guest"}`;

  // Estado persistente del carrito
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
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [activeTab, setActiveTab] = useState<"catalog" | "orders">("catalog");
  const [cartOpen, setCartOpen] = useState(false);
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  // Persistir carrito
  useEffect(() => {
    localStorage.setItem(cartKey, JSON.stringify(cart));
  }, [cart, cartKey]);

  // Sincronizar margen del perfil
  useEffect(() => {
    if (profile?.default_margin) setGlobalMargin(profile.default_margin);
  }, [profile?.default_margin]);

  // SEO oculto
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

  const onAddToCart = (product: any) =>
    setCart((prev) => ({ ...prev, [product.id]: (prev[product.id] || 0) + 1 }));

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

  // ─── RENDER ───────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-[#181818] flex-col">

      {/* TOPBAR */}
      <header className="flex items-center gap-3 px-4 md:px-6 py-3 bg-[#141414] border-b border-[#222] flex-wrap">
        {/* Logo + cliente */}
        <div className="flex items-center gap-2.5 shrink-0">
          <img src="/icon.png" alt="Bartez" className="h-8 w-8 object-contain" />
          <div>
            <span className="font-bold text-white text-sm leading-none">Portal B2B</span>
            <span className="block text-xs text-[#FF6A00] leading-none mt-0.5">{clientName}</span>
          </div>
        </div>

        {/* Búsqueda */}
        <div className="flex-1 min-w-[160px] max-w-md relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar por nombre o SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#232323] border border-[#333] text-white text-sm rounded-lg pl-8 pr-3 py-2 outline-none focus:border-[#FF6A00]/50 placeholder:text-gray-600"
          />
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {/* Vista grid/lista */}
          <div className="hidden md:flex items-center bg-[#232323] rounded-lg p-1 gap-0.5">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded transition ${viewMode === "grid" ? "bg-[#FF6A00] text-white" : "text-gray-500 hover:text-white"}`}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded transition ${viewMode === "list" ? "bg-[#FF6A00] text-white" : "text-gray-500 hover:text-white"}`}
            >
              <List size={14} />
            </button>
          </div>

          {/* Margen global */}
          <div className="hidden md:flex items-center gap-1.5 bg-[#232323] rounded-lg px-3 py-1.5">
            <span className="text-xs text-gray-400">Margen:</span>
            <input
              type="number" min="0" max="100" value={globalMargin}
              onChange={(e) => setGlobalMargin(Number(e.target.value))}
              className="w-12 bg-transparent text-[#FF6A00] font-bold text-sm outline-none text-center"
            />
            <span className="text-xs text-gray-400">%</span>
          </div>

          {/* Carrito */}
          <button
            onClick={() => setCartOpen(true)}
            className="relative flex items-center gap-2 bg-[#FF6A00] hover:bg-[#FF8C1A] text-white rounded-lg px-3 py-2 text-sm font-semibold transition"
          >
            <ShoppingCart size={15} />
            <span className="hidden md:inline">Carrito</span>
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-white text-[#FF6A00] text-[10px] font-black flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition px-2 py-2 rounded-lg hover:bg-[#232323]"
          >
            <LogOut size={14} />
          </button>
        </div>
      </header>

      {/* TABS */}
      <div className="flex border-b border-[#222] bg-[#141414] px-4 md:px-6">
        {[
          { id: "catalog", label: "Catálogo", icon: Package },
          { id: "orders",  label: `Mis Pedidos${orders.length ? ` (${orders.length})` : ""}`, icon: ClipboardList },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as any)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
              activeTab === id
                ? "border-[#FF6A00] text-white"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {orderSuccess && (
        <div className="mx-4 mt-4 bg-green-900/30 border border-green-500/40 rounded-xl p-3 text-green-400 text-sm font-medium flex items-center gap-2">
          <CheckCircle2 size={16} />
          Pedido confirmado. Lo estamos revisando y te contactaremos pronto.
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">

        {/* SIDEBAR — solo en catálogo */}
        {activeTab === "catalog" && (
          <aside className="hidden md:flex flex-col w-52 bg-[#181818] border-r border-[#222] p-4 gap-5 shrink-0">
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2">Categoría</h3>
              <div className="flex flex-col gap-0.5">
                {categories.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategoryFilter(c)}
                    className={`text-left text-sm px-3 py-1.5 rounded-lg transition ${
                      categoryFilter === c
                        ? "bg-[#FF6A00]/15 text-[#FF6A00] font-semibold"
                        : "text-gray-400 hover:text-white hover:bg-[#232323]"
                    }`}
                  >
                    {c === "all" ? "Todas" : c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2">Precio costo</h3>
              <div className="flex flex-col gap-2">
                <Input type="number" placeholder="Mínimo" value={minPrice} onChange={(e) => setMinPrice(e.target.value)}
                  className="bg-[#232323] border-[#333] text-white text-sm h-8" />
                <Input type="number" placeholder="Máximo" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)}
                  className="bg-[#232323] border-[#333] text-white text-sm h-8" />
              </div>
            </div>
          </aside>
        )}

        {/* CONTENIDO PRINCIPAL */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">

          {/* ── CATÁLOGO ── */}
          {activeTab === "catalog" && (
            <>
              {productsLoading ? (
                <div className={`grid gap-4 ${viewMode === "grid" ? "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "grid-cols-1"}`}>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="bg-[#232323] rounded-xl h-64 animate-pulse" />
                  ))}
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-gray-500">
                  <Search size={40} className="mb-3 opacity-30" />
                  <p className="text-sm">No se encontraron productos</p>
                </div>
              ) : viewMode === "grid" ? (
                // ── GRID ──
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredProducts.map((product) => {
                    const margin = productMargins[product.id] ?? globalMargin;
                    const finalPrice = product.cost_price * (1 + margin / 100);
                    const inCart = cart[product.id] || 0;
                    const outOfStock = product.stock === 0;

                    return (
                      <div key={product.id} className={`bg-[#232323] border rounded-xl p-4 transition-all flex flex-col ${
                        outOfStock ? "border-[#2a2a2a] opacity-60" : "border-[#2a2a2a] hover:border-[#FF6A00]/40"
                      }`}>
                        <div className="relative">
                          <img src={product.image} alt={product.name}
                            className="h-32 w-full object-contain rounded-lg bg-[#1a1a1a] p-2" />
                          {inCart > 0 && (
                            <span className="absolute top-2 right-2 h-5 w-5 rounded-full bg-[#FF6A00] text-white text-[10px] font-black flex items-center justify-center">
                              {inCart}
                            </span>
                          )}
                        </div>
                        <h3 className="font-bold mt-2 text-sm text-white leading-tight line-clamp-2">{product.name}</h3>
                        <p className="text-[11px] text-gray-500 mt-0.5">{product.category}{product.sku && ` · ${product.sku}`}</p>
                        <div className="mt-1"><StockBadge stock={product.stock} /></div>
                        <div className="mt-auto pt-3">
                          <span className="line-through text-xs text-gray-600">${product.cost_price.toLocaleString()}</span>
                          <div className="text-lg text-[#FF6A00] font-extrabold">${finalPrice.toLocaleString()}</div>
                          <span className="text-[10px] text-gray-600">margen {margin}%</span>
                        </div>
                        <div className="mt-2 flex gap-1.5">
                          {inCart > 0 ? (
                            <>
                              <button onClick={() => onRemoveFromCart(product)}
                                className="flex-1 bg-[#2a2a2a] hover:bg-[#333] text-white rounded-lg py-1.5 text-sm font-bold transition">−</button>
                              <span className="flex items-center justify-center px-2 text-white font-bold text-sm">{inCart}</span>
                              <button onClick={() => onAddToCart(product)}
                                className="flex-1 bg-[#FF6A00] hover:bg-[#FF8C1A] text-white rounded-lg py-1.5 text-sm font-bold transition">+</button>
                            </>
                          ) : (
                            <Button disabled={outOfStock}
                              className="w-full bg-[#FF6A00] hover:bg-[#FF8C1A] text-white font-bold text-sm h-8 disabled:opacity-40 disabled:pointer-events-none"
                              onClick={() => onAddToCart(product)}>
                              {outOfStock ? "Sin stock" : "Añadir"}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                // ── LISTA ──
                <div className="flex flex-col gap-2">
                  {filteredProducts.map((product) => {
                    const margin = productMargins[product.id] ?? globalMargin;
                    const finalPrice = product.cost_price * (1 + margin / 100);
                    const inCart = cart[product.id] || 0;
                    const outOfStock = product.stock === 0;

                    return (
                      <div key={product.id} className={`flex items-center gap-4 bg-[#232323] border rounded-xl px-4 py-3 transition ${
                        outOfStock ? "border-[#2a2a2a] opacity-60" : "border-[#2a2a2a] hover:border-[#FF6A00]/40"
                      }`}>
                        <img src={product.image} alt={product.name}
                          className="h-12 w-12 shrink-0 object-contain rounded-lg bg-[#1a1a1a] p-1" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white truncate">{product.name}</p>
                          <p className="text-xs text-gray-500">{product.category}{product.sku && ` · ${product.sku}`}</p>
                        </div>
                        <StockBadge stock={product.stock} />
                        <div className="text-right shrink-0 hidden sm:block">
                          <span className="line-through text-xs text-gray-600 block">${product.cost_price.toLocaleString()}</span>
                          <span className="text-base font-extrabold text-[#FF6A00]">${finalPrice.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {inCart > 0 ? (
                            <>
                              <button onClick={() => onRemoveFromCart(product)}
                                className="h-8 w-8 bg-[#2a2a2a] hover:bg-[#333] text-white rounded-lg text-sm font-bold transition">−</button>
                              <span className="w-6 text-center text-white font-bold text-sm">{inCart}</span>
                              <button onClick={() => onAddToCart(product)}
                                className="h-8 w-8 bg-[#FF6A00] hover:bg-[#FF8C1A] text-white rounded-lg text-sm font-bold transition">+</button>
                            </>
                          ) : (
                            <Button disabled={outOfStock} size="sm"
                              className="bg-[#FF6A00] hover:bg-[#FF8C1A] text-white text-xs h-8 px-3 disabled:opacity-40 disabled:pointer-events-none"
                              onClick={() => onAddToCart(product)}>
                              Añadir
                            </Button>
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
                <div className="flex flex-col items-center justify-center py-24 text-gray-500">
                  <ClipboardList size={40} className="mb-3 opacity-30" />
                  <p className="text-sm">Todavía no hiciste ningún pedido</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {orders.map((order) => (
                    <div key={order.id} className="bg-[#232323] border border-[#2a2a2a] rounded-xl p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <span className="text-xs text-gray-500">Pedido #{String(order.id).slice(-6)}</span>
                          <p className="text-xs text-gray-600 mt-0.5">
                            {new Date(order.created_at).toLocaleDateString("es-AR", {
                              day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
                            })}
                          </p>
                        </div>
                        <StatusBadge status={order.status} />
                      </div>
                      <div className="space-y-1.5 mb-3">
                        {order.products.map((p, i) => (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <span className="text-gray-300">{p.name} <span className="text-gray-600">×{p.quantity}</span></span>
                            <span className="text-[#FF6A00] font-semibold">${p.total_price?.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between items-center border-t border-[#333] pt-3">
                        <span className="text-sm text-gray-400">Total</span>
                        <span className="text-lg font-extrabold text-[#FF6A00]">${order.total.toLocaleString()}</span>
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
        onAddToCart={onAddToCart}
        onRemoveFromCart={onRemoveFromCart}
        onMarginChange={onMarginChange}
        onConfirmOrder={handleConfirmOrder}
        confirming={orderSubmitting}
      />
    </div>
  );
}
