import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CartDrawer } from "@/components/CartDrawer";
import { products as mockProducts, Product } from "@/models/products";
import { useNavigate } from "react-router-dom";
import { addOrder } from "@/store/orderStore";
import { Order, OrderProduct } from "@/models/order";
import { useAuth } from "@/context/AuthContext";
import { LogOut, ShoppingCart, User } from "lucide-react";

type CartItem = {
  product: Product;
  quantity: number;
  cost: number;
  margin: number;
  unitPrice: number;
  totalPrice: number;
};

export default function B2BPortal() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();

  // Margen por defecto: del perfil del cliente en Supabase, o 20% si no hay perfil
  const defaultMargin = profile?.default_margin ?? 20;
  const clientName = profile?.company_name ?? profile?.contact_name ?? "Cliente";

  const [cart, setCart] = useState<Record<number, number>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [productMargins, setProductMargins] = useState<Record<number, number>>({});
  const [globalMargin, setGlobalMargin] = useState(defaultMargin);
  const [orderConfirmed, setOrderConfirmed] = useState(false);

  // Sincronizar margen cuando carga el perfil
  useEffect(() => {
    if (profile?.default_margin) {
      setGlobalMargin(profile.default_margin);
    }
  }, [profile?.default_margin]);

  // SEO oculto
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => document.head.removeChild(meta);
  }, []);

  const categories = useMemo(() => {
    return ["all", ...Array.from(new Set(mockProducts.map(p => p.category)))];
  }, []);

  const filteredProducts = useMemo(() => {
    return mockProducts.filter(p => {
      const min = Number(minPrice);
      const max = Number(maxPrice);
      if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
      if (!isNaN(min) && p.cost_price < min) return false;
      if (!isNaN(max) && max > 0 && p.cost_price > max) return false;
      return true;
    });
  }, [categoryFilter, minPrice, maxPrice]);

  const cartItems: CartItem[] = useMemo(() => {
    return Object.entries(cart)
      .map(([id, qty]) => {
        const product = mockProducts.find(p => p.id === Number(id));
        if (!product) return null;
        const margin = productMargins[product.id] ?? globalMargin;
        const cost = product.cost_price;
        const unitPrice = cost * (1 + margin / 100);
        return { product, quantity: qty, cost, margin, unitPrice, totalPrice: unitPrice * qty };
      })
      .filter((i): i is CartItem => i !== null);
  }, [cart, productMargins, globalMargin]);

  const cartTotal = useMemo(
    () => cartItems.reduce((sum, i) => sum + i.totalPrice, 0),
    [cartItems]
  );

  const cartCount = useMemo(
    () => Object.values(cart).reduce((s, q) => s + q, 0),
    [cart]
  );

  const onAddToCart = (product: Product) => {
    setCart(prev => ({ ...prev, [product.id]: (prev[product.id] || 0) + 1 }));
  };

  const onRemoveFromCart = (product: Product) => {
    setCart(prev => {
      const qty = prev[product.id] || 0;
      if (qty <= 1) {
        const { [product.id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [product.id]: qty - 1 };
    });
  };

  const handleConfirmOrder = () => {
    if (!cartItems.length) return;
    const orderProducts: OrderProduct[] = cartItems.map(item => ({
      product_id: item.product.id,
      name: item.product.name,
      quantity: item.quantity,
      cost_price: item.cost,
      supplier_id: item.product.supplier_id ?? 0,
      supplier_multiplier: item.product.supplier_multiplier ?? 1,
      sku: item.product.sku ?? "",
    }));
    const order: Order = {
      id: Date.now(),
      client_id: 1,
      products: orderProducts,
      total: cartTotal,
      status: "pending",
      created_at: new Date().toISOString(),
    };
    addOrder(order);
    setOrderConfirmed(true);
    setCart({});
    setCartOpen(false);
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen bg-[#181818] flex-col">

      {/* TOPBAR */}
      <header className="flex items-center justify-between px-6 py-4 bg-[#141414] border-b border-[#222]">
        <div className="flex items-center gap-3">
          <img src="/icon.png" alt="Bartez" className="h-8 w-8 object-contain" />
          <div>
            <span className="font-bold text-white text-sm">Portal B2B</span>
            {clientName && (
              <span className="block text-xs text-[#FF6A00]">{clientName}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Margen global */}
          <div className="hidden md:flex items-center gap-2 bg-[#232323] rounded-lg px-3 py-1.5">
            <span className="text-xs text-gray-400">Margen global:</span>
            <input
              type="number"
              min="0"
              max="100"
              value={globalMargin}
              onChange={e => setGlobalMargin(Number(e.target.value))}
              className="w-14 bg-transparent text-[#FF6A00] font-bold text-sm outline-none text-center"
            />
            <span className="text-xs text-gray-400">%</span>
          </div>

          {/* Carrito */}
          <button
            onClick={() => setCartOpen(true)}
            className="relative flex items-center gap-2 bg-[#FF6A00] hover:bg-[#FF8C1A] text-white rounded-lg px-3 py-2 text-sm font-semibold transition"
          >
            <ShoppingCart size={16} />
            <span className="hidden md:inline">Carrito</span>
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-white text-[#FF6A00] text-[10px] font-black flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>

          {/* Perfil + logout */}
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-1.5 text-xs text-gray-400">
              <User size={13} />
              <span>{profile?.contact_name || "Cliente"}</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition px-2 py-1.5 rounded-lg hover:bg-[#232323]"
            >
              <LogOut size={13} />
              <span className="hidden md:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* SIDEBAR */}
        <aside className="hidden md:flex flex-col w-56 bg-[#181818] border-r border-[#222] p-5 gap-5 shrink-0">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">Categoría</h3>
            <div className="flex flex-col gap-1">
              {categories.map(c => (
                <button
                  key={c}
                  onClick={() => setCategoryFilter(c)}
                  className={`text-left text-sm px-3 py-2 rounded-lg transition ${
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
            <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">Precio costo</h3>
            <div className="flex flex-col gap-2">
              <Input
                type="number"
                placeholder="Mínimo"
                value={minPrice}
                onChange={e => setMinPrice(e.target.value)}
                className="bg-[#232323] border-[#333] text-white text-sm h-9"
              />
              <Input
                type="number"
                placeholder="Máximo"
                value={maxPrice}
                onChange={e => setMaxPrice(e.target.value)}
                className="bg-[#232323] border-[#333] text-white text-sm h-9"
              />
            </div>
          </div>

          {/* Margen mobile */}
          <div className="md:hidden">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">Margen %</h3>
            <input
              type="number"
              min="0"
              max="100"
              value={globalMargin}
              onChange={e => setGlobalMargin(Number(e.target.value))}
              className="w-full bg-[#232323] border border-[#333] text-[#FF6A00] font-bold text-sm rounded-lg px-3 py-2 outline-none"
            />
          </div>
        </aside>

        {/* PRODUCTOS */}
        <main className="flex-1 p-6">
          {orderConfirmed && (
            <div className="mb-6 bg-green-900/30 border border-green-500/40 rounded-xl p-4 text-green-400 text-sm font-medium">
              Pedido confirmado y enviado para aprobación. Te avisaremos cuando esté listo.
              <button className="ml-3 underline text-xs" onClick={() => setOrderConfirmed(false)}>Cerrar</button>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map(product => {
              const margin = productMargins[product.id] ?? globalMargin;
              const finalPrice = product.cost_price * (1 + margin / 100);
              const inCart = cart[product.id] || 0;

              return (
                <Card key={product.id} className="bg-[#232323] border-[#2a2a2a] text-white p-4 rounded-xl hover:border-[#FF6A00]/40 transition-all group">
                  <div className="relative">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="h-32 w-full mx-auto object-contain rounded-lg bg-[#1a1a1a] p-2"
                    />
                    {inCart > 0 && (
                      <span className="absolute top-2 right-2 h-6 w-6 rounded-full bg-[#FF6A00] text-white text-xs font-black flex items-center justify-center">
                        {inCart}
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold mt-3 text-sm leading-tight line-clamp-2">{product.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{product.category}</p>

                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <span className="line-through text-xs text-gray-600">${product.cost_price.toLocaleString()}</span>
                      <div className="text-lg text-[#FF6A00] font-extrabold">${finalPrice.toLocaleString()}</div>
                      <span className="text-[10px] text-gray-500">margen {margin}%</span>
                    </div>
                  </div>

                  <div className="mt-3 flex gap-2">
                    {inCart > 0 ? (
                      <>
                        <button
                          onClick={() => onRemoveFromCart(product)}
                          className="flex-1 bg-[#2a2a2a] hover:bg-[#333] text-white rounded-lg py-2 text-sm font-bold transition"
                        >
                          −
                        </button>
                        <span className="flex items-center justify-center px-3 text-white font-bold text-sm">{inCart}</span>
                        <button
                          onClick={() => onAddToCart(product)}
                          className="flex-1 bg-[#FF6A00] hover:bg-[#FF8C1A] text-white rounded-lg py-2 text-sm font-bold transition"
                        >
                          +
                        </button>
                      </>
                    ) : (
                      <Button
                        className="w-full bg-[#FF6A00] hover:bg-[#FF8C1A] text-white font-bold text-sm h-9"
                        onClick={() => onAddToCart(product)}
                      >
                        Añadir
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </main>
      </div>

      {/* CARRITO */}
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cartItems={cartItems}
        cartTotal={cartTotal}
        onAddToCart={onAddToCart}
        onRemoveFromCart={onRemoveFromCart}
        onConfirmOrder={handleConfirmOrder}
      />
    </div>
  );
}
