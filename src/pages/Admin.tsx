import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { CLIENT_TYPE_MARGINS, ClientType } from "@/lib/supabase";
import { Product } from "@/models/products";
import ProductForm from "@/components/admin/ProductForm";
import ProductImport from "@/components/admin/ProductImport";
import ProductTable from "@/components/admin/ProductTable";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useCurrency } from "@/context/CurrencyContext";
import {
  CheckCircle2, XCircle, Clock, Trash2, RefreshCw, Save,
  Users, Package, ClipboardList, LogOut, ShieldCheck, UserPlus, X,
  DollarSign, Pencil, Check, LayoutDashboard,
} from "lucide-react";
import { SalesDashboard } from "@/components/admin/SalesDashboard";

interface SupabaseOrder {
  id: string;
  client_id: string;
  products: any[];
  total: number;
  status: string;
  created_at: string;
}

interface ClientProfile {
  id: string;
  company_name: string;
  contact_name: string;
  client_type: ClientType;
  default_margin: number;
  role: string;
}

const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  mayorista: "Mayorista",
  reseller:  "Revendedor",
  empresa:   "Empresa",
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; icon: any; className: string }> = {
    pending:  { label: "En revisión", icon: Clock,         className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
    approved: { label: "Aprobado",    icon: CheckCircle2,  className: "bg-green-500/15 text-green-400 border-green-500/30" },
    rejected: { label: "Rechazado",   icon: XCircle,       className: "bg-red-500/15 text-red-400 border-red-500/30" },
  };
  const { label, icon: Icon, className } = map[status] ?? map.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${className}`}>
      <Icon size={11} /> {label}
    </span>
  );
}

type Tab = "dashboard" | "products" | "orders" | "clients";

const Admin = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { exchangeRate, setExchangeRate, fetchExchangeRate } = useCurrency();
  const [editingRate, setEditingRate] = useState(false);
  const [rateInput, setRateInput] = useState(String(exchangeRate.rate));
  const [fetchingRate, setFetchingRate] = useState(false);
  const [fetchRateError, setFetchRateError] = useState("");

  async function handleFetchRate() {
    setFetchingRate(true);
    setFetchRateError("");
    try {
      await fetchExchangeRate();
    } catch {
      setFetchRateError("No se pudo obtener la cotización. Intentá de nuevo.");
    } finally {
      setFetchingRate(false);
    }
  }

  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<SupabaseOrder[]>([]);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string; parent_id: number | null }[]>([]);
  const [newCatName, setNewCatName] = useState("");
  const [newCatParent, setNewCatParent] = useState("");
  const [savingCat, setSavingCat] = useState(false);
  const [editingClients, setEditingClients] = useState<Record<string, Partial<ClientProfile>>>({});
  const [savingClient, setSavingClient] = useState<string | null>(null);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClient, setNewClient] = useState({ email: "", password: "", company_name: "", contact_name: "", client_type: "reseller" as ClientType, default_margin: 20, role: "client" as "client" | "admin" });
  const [creatingClient, setCreatingClient] = useState(false);
  const [createError, setCreateError] = useState("");

  function generatePassword() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
    const pwd = Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    setNewClient((p) => ({ ...p, password: pwd }));
  }

  function downloadSampleCSV() {
    const header = "name,sku,cost_price,category,stock,stock_min,description,image,supplier_id,supplier_multiplier,featured,active,tags,external_id";
    const rows = [
      'Laptop Dell Latitude 5540,LAT5540,850000,Equipamiento,10,3,Laptop empresarial Intel i5 13va gen,https://example.com/img.jpg,,1,false,true,"laptop,dell,i5",',
      'Switch TP-Link 24 Puertos,TL-SG1024,45000,Redes,5,2,Switch no administrable Gigabit 24 puertos,,,,false,true,"switch,gigabit,tp-link",',
      'UPS 1500VA APC,SMC1500I,120000,Infraestructura,3,1,UPS línea interactiva 1500VA/900W,,,,true,true,"ups,apc,rack",SMC1500I-AR',
    ];
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "productos_ejemplo.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  const [selectedOrder, setSelectedOrder] = useState<SupabaseOrder | null>(null);
  const [importResult, setImportResult] = useState<{ imported: number; errors: string[] } | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadingClients, setLoadingClients] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");

  async function fetchProducts() {
    setLoadingProducts(true);
    const { data } = await supabase.from("products").select("*").order("name");
    if (data) setProducts(data as Product[]);
    setLoadingProducts(false);
  }

  async function fetchOrders() {
    setLoadingOrders(true);
    const { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    if (data) setOrders(data as SupabaseOrder[]);
    setLoadingOrders(false);
  }

  async function fetchClients() {
    setLoadingClients(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, company_name, contact_name, client_type, default_margin, role")
      .order("company_name");
    if (data) setClients(data as ClientProfile[]);
    setLoadingClients(false);
  }

  async function fetchCategories() {
    const { data } = await supabase.from("categories").select("*").order("parent_id", { ascending: true }).order("name");
    if (data) setCategories(data);
  }

  useEffect(() => { fetchProducts(); fetchOrders(); fetchClients(); fetchCategories(); }, []);

  async function addCategory() {
    if (!newCatName.trim()) return;
    setSavingCat(true);
    await supabase.from("categories").insert({ name: newCatName.trim(), parent_id: newCatParent ? Number(newCatParent) : null });
    setNewCatName(""); setNewCatParent("");
    setSavingCat(false);
    fetchCategories();
  }

  async function deleteCategory(id: number) {
    if (!confirm("¿Eliminar esta categoría?")) return;
    await supabase.from("categories").delete().eq("id", id);
    fetchCategories();
  }

  const pendingOrders = orders.filter((o) => o.status === "pending").length;

  // ── Crear cliente ──
  async function handleCreateClient() {
    setCreateError("");
    if (!newClient.email || !newClient.password) {
      setCreateError("Email y contraseña son obligatorios.");
      return;
    }
    setCreatingClient(true);
    const { data, error } = await supabase.auth.signUp({
      email: newClient.email,
      password: newClient.password,
    });
    if (error || !data.user) {
      setCreateError(error?.message || "Error al crear el usuario.");
      setCreatingClient(false);
      return;
    }
    // Actualizar el perfil creado por el trigger
    await supabase.from("profiles").update({
      company_name: newClient.company_name,
      contact_name: newClient.contact_name,
      client_type: newClient.client_type,
      default_margin: newClient.default_margin,
      role: newClient.role,
    }).eq("id", data.user.id);

    setCreatingClient(false);
    setShowNewClient(false);
    setNewClient({ email: "", password: "", company_name: "", contact_name: "", client_type: "reseller", default_margin: 20, role: "client" });
    fetchClients();
  }

  // ── Clientes ──
  function startEdit(client: ClientProfile) {
    setEditingClients((prev) => ({
      ...prev,
      [client.id]: { client_type: client.client_type, default_margin: client.default_margin },
    }));
  }

  function updateEdit(id: string, field: keyof ClientProfile, value: any) {
    setEditingClients((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  function applyTypeMargin(id: string, type: ClientType) {
    setEditingClients((prev) => ({
      ...prev,
      [id]: { ...prev[id], client_type: type, default_margin: CLIENT_TYPE_MARGINS[type] },
    }));
  }

  async function saveClient(id: string) {
    const edits = editingClients[id];
    if (!edits) return;
    setSavingClient(id);
    const { error } = await supabase.from("profiles").update(edits).eq("id", id);
    setSavingClient(null);
    if (!error) {
      setClients((prev) => prev.map((c) => (c.id === id ? { ...c, ...edits } : c)));
      setEditingClients((prev) => { const { [id]: _, ...rest } = prev; return rest; });
    }
  }

  // ── Productos ──
  async function deleteProduct(id: number) {
    if (!confirm("¿Eliminar este producto?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (!error) setProducts((prev) => prev.filter((p) => p.id !== id));
  }

  async function toggleActive(product: Product) {
    const { error } = await supabase
      .from("products")
      .update({ active: !(product as any).active })
      .eq("id", product.id);
    if (!error) fetchProducts();
  }

  // ── Órdenes ──
  async function updateOrderStatus(orderId: string, status: "approved" | "rejected") {
    const { error } = await supabase
      .from("orders")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", orderId);
    if (!error) {
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status } : o));
      if (selectedOrder?.id === orderId) setSelectedOrder((o) => o ? { ...o, status } : o);
    }
  }

  const handleLogout = async () => { await signOut(); navigate("/login"); };

  const tabs: { id: Tab; label: string; icon: any; badge?: number }[] = [
    { id: "dashboard", label: "Dashboard",  icon: LayoutDashboard },
    { id: "products",  label: "Productos",  icon: Package,       badge: products.length },
    { id: "orders",    label: "Pedidos",    icon: ClipboardList, badge: pendingOrders || undefined },
    { id: "clients",   label: "Clientes",   icon: Users,         badge: clients.length },
  ];

  return (
    <div className="flex min-h-screen bg-[#0a0a0a] flex-col">

      {/* TOPBAR */}
      <header className="flex items-center gap-3 px-4 md:px-6 py-3 bg-[#0d0d0d] border-b border-[#1a1a1a]">
        <div className="flex items-center gap-2.5">
          <img src="/icon.png" alt="Bartez" className="h-8 w-8 object-contain" />
          <div>
            <span className="font-bold text-white text-sm leading-none">Panel Admin</span>
            <span className="block text-xs text-[#2D9F6A] leading-none mt-0.5">Bartez Tecnología</span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => { fetchProducts(); fetchOrders(); fetchClients(); }}
            className="flex items-center gap-1.5 text-xs text-[#737373] hover:text-white transition px-3 py-2 rounded-lg hover:bg-[#1c1c1c]"
          >
            <RefreshCw size={13} /> Actualizar
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-[#737373] hover:text-white transition px-3 py-2 rounded-lg hover:bg-[#1c1c1c]"
          >
            <LogOut size={13} /> Salir
          </button>
        </div>
      </header>

      {/* TABS */}
      <div className="flex border-b border-[#1a1a1a] bg-[#0d0d0d] px-4 md:px-6">
        {tabs.map(({ id, label, icon: Icon, badge }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
              activeTab === id
                ? "border-[#2D9F6A] text-white"
                : "border-transparent text-[#525252] hover:text-[#a3a3a3]"
            }`}
          >
            <Icon size={14} />
            {label}
            {badge !== undefined && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                id === "orders" && pendingOrders > 0
                  ? "bg-[#2D9F6A] text-white"
                  : "bg-[#1c1c1c] text-[#525252]"
              }`}>
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <main className="flex-1 p-4 md:p-6 overflow-y-auto">

        {/* ── DASHBOARD ── */}
        {activeTab === "dashboard" && (
          <SalesDashboard orders={orders} clients={clients} />
        )}

        {/* ── PRODUCTOS ── */}
        {activeTab === "products" && (
          <div className="space-y-6 max-w-6xl">

            {/* ── Cotización del dólar ── */}
            <div className="bg-[#111] border border-[#1f1f1f] rounded-xl px-5 py-4 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 shrink-0">
                <div className="h-8 w-8 rounded-lg bg-[#2D9F6A]/10 border border-[#2D9F6A]/20 flex items-center justify-center">
                  <DollarSign size={14} className="text-[#2D9F6A]" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Cotización USD</p>
                  <p className="text-[10px] text-gray-700">
                    {exchangeRate.source === "api" ? "API" : "Manual"} ·{" "}
                    {new Date(exchangeRate.updatedAt).toLocaleDateString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>

              {editingRate ? (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-sm">1 USD =</span>
                  <input
                    type="number"
                    value={rateInput}
                    onChange={(e) => setRateInput(e.target.value)}
                    className="w-28 bg-[#0d0d0d] border border-[#2D9F6A]/40 rounded-lg px-2 py-1 text-white text-sm font-mono outline-none focus:border-[#2D9F6A]"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const r = Number(rateInput);
                        if (r > 0) { setExchangeRate({ rate: r, source: "manual", updatedAt: new Date().toISOString() }); }
                        setEditingRate(false);
                      }
                      if (e.key === "Escape") setEditingRate(false);
                    }}
                  />
                  <span className="text-gray-500 text-sm">ARS</span>
                  <button
                    onClick={() => {
                      const r = Number(rateInput);
                      if (r > 0) { setExchangeRate({ rate: r, source: "manual", updatedAt: new Date().toISOString() }); }
                      setEditingRate(false);
                    }}
                    className="h-7 w-7 bg-green-600 hover:bg-green-500 text-white rounded-lg flex items-center justify-center transition"
                  >
                    <Check size={13} />
                  </button>
                  <button onClick={() => setEditingRate(false)}
                    className="h-7 w-7 bg-[#2a2a2a] hover:bg-[#333] text-gray-400 rounded-lg flex items-center justify-center transition">
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-extrabold text-white tabular-nums">
                      {exchangeRate.rate.toLocaleString("es-AR")}
                    </span>
                    <span className="text-sm text-gray-500">ARS / USD</span>
                  </div>
                  <button
                    onClick={() => { setRateInput(String(exchangeRate.rate)); setEditingRate(true); }}
                    className="flex items-center gap-1.5 text-xs text-[#737373] hover:text-white border border-[#262626] hover:border-[#333] bg-[#0d0d0d] hover:bg-[#1c1c1c] px-2.5 py-1.5 rounded-lg transition"
                  >
                    <Pencil size={11} /> Editar
                  </button>
                </div>
              )}

              <div className="ml-auto flex items-center gap-2.5">
                {fetchRateError && (
                  <span className="text-[11px] text-red-400">{fetchRateError}</span>
                )}
                <button
                  onClick={handleFetchRate}
                  disabled={fetchingRate}
                  className="flex items-center gap-1.5 text-xs text-[#737373] hover:text-white disabled:opacity-50 transition px-2.5 py-1.5 rounded-lg hover:bg-[#1c1c1c] border border-transparent hover:border-[#262626]"
                >
                  <RefreshCw size={11} className={fetchingRate ? "animate-spin" : ""} />
                  {fetchingRate ? "Actualizando..." : "Cotización oficial"}
                </button>
                <div
                  className={`h-2 w-2 rounded-full ${exchangeRate.source === "api" ? "bg-green-400" : "bg-amber-400"}`}
                  title={exchangeRate.source === "api" ? "Cotización via API" : "Cotización manual"}
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-[#111] border border-[#1f1f1f] rounded-xl p-5">
                <h2 className="text-sm font-bold text-white mb-4">Agregar producto</h2>
                <ProductForm onAdd={(p) => setProducts((prev) => [p, ...prev])} />
              </div>
              <div className="bg-[#111] border border-[#1f1f1f] rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-white">Importar CSV</h2>
                  <button onClick={downloadSampleCSV}
                    className="text-xs text-gray-400 hover:text-[#2D9F6A] transition flex items-center gap-1">
                    ↓ Descargar CSV de ejemplo
                  </button>
                </div>
                <ProductImport onImport={(r) => { setImportResult(r); fetchProducts(); }} />
                {importResult && (
                  <div className="mt-3 text-sm">
                    <span className="text-green-400 font-semibold">Importados: {importResult.imported}</span>
                    {importResult.errors.length > 0 && (
                      <ul className="text-red-400 mt-1 space-y-0.5 text-xs">
                        {importResult.errors.map((e, i) => <li key={i}>• {e}</li>)}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Categorías */}
            <div className="bg-[#111] border border-[#1f1f1f] rounded-xl p-5">
              <h2 className="text-sm font-bold text-white mb-4">Categorías y Subcategorías</h2>
              <div className="flex gap-2 mb-4">
                <input
                  value={newCatName} onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="Nombre de categoría"
                  className="flex-1 bg-[#0d0d0d] border border-[#262626] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#404040] placeholder:text-[#404040]"
                />
                <select value={newCatParent} onChange={(e) => setNewCatParent(e.target.value)}
                  className="bg-[#0d0d0d] border border-[#262626] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#404040]">
                  <option value="">Categoría raíz</option>
                  {categories.filter((c) => c.parent_id === null).map((c) => (
                    <option key={c.id} value={c.id}>Sub de: {c.name}</option>
                  ))}
                </select>
                <button onClick={addCategory} disabled={savingCat || !newCatName.trim()}
                  className="bg-[#2D9F6A] hover:bg-[#25835A] text-white text-sm font-bold px-4 rounded-lg transition disabled:opacity-40">
                  + Agregar
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {categories.filter((c) => c.parent_id === null).map((parent) => (
                  <div key={parent.id} className="bg-[#0d0d0d] border border-[#1f1f1f] rounded-lg px-3 py-2 min-w-[140px]">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm font-semibold text-white">{parent.name}</span>
                      <button onClick={() => deleteCategory(parent.id)} className="text-gray-600 hover:text-red-400 transition"><Trash2 size={12} /></button>
                    </div>
                    {categories.filter((c) => c.parent_id === parent.id).map((sub) => (
                      <div key={sub.id} className="flex items-center justify-between text-xs text-[#737373] pl-2 border-l border-[#262626] mt-1">
                        <span>↳ {sub.name}</span>
                        <button onClick={() => deleteCategory(sub.id)} className="text-gray-600 hover:text-red-400 transition ml-2"><Trash2 size={11} /></button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {loadingProducts ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-10 bg-[#111] rounded-lg animate-pulse" />)}
              </div>
            ) : (
              <ProductTable products={products} categories={categories} onRefresh={fetchProducts} />
            )}
          </div>
        )}

        {/* ── PEDIDOS ── */}
        {activeTab === "orders" && (
          <div className="grid lg:grid-cols-2 gap-5 max-w-5xl">
            <div>
              {loadingOrders ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-[#111] rounded-xl animate-pulse" />)}
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center py-20 text-gray-500 text-sm">No hay pedidos todavía.</div>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => (
                    <div
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      className={`bg-[#111] border rounded-xl p-4 cursor-pointer transition hover:border-[#2e2e2e] hover:bg-[#141414] ${
                        selectedOrder?.id === order.id ? "border-[#333] bg-[#141414]" : "border-[#1f1f1f]"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-500 font-mono">#{String(order.id).slice(-8)}</span>
                        <StatusBadge status={order.status} />
                      </div>
                      <p className="text-xs text-gray-600">
                        {new Date(order.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-xs text-gray-500">{order.products?.length} items</span>
                        <span className="font-bold text-white">${order.total.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedOrder && (
              <div className="bg-[#111] border border-[#1f1f1f] rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-white">Pedido #{String(selectedOrder.id).slice(-8)}</h3>
                  <StatusBadge status={selectedOrder.status} />
                </div>
                <p className="text-xs text-gray-500 mb-4">
                  {new Date(selectedOrder.created_at).toLocaleDateString("es-AR", { dateStyle: "full" })}
                </p>

                <table className="w-full text-sm mb-4">
                  <thead>
                    <tr className="border-b border-[#333]">
                      <th className="pb-2 text-left text-xs text-gray-500 font-medium">Producto</th>
                      <th className="pb-2 text-center text-xs text-gray-500 font-medium">Cant.</th>
                      <th className="pb-2 text-right text-xs text-gray-500 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.products?.map((p: any, i: number) => (
                      <tr key={i} className="border-b border-[#2a2a2a]">
                        <td className="py-2 text-gray-300">{p.name}</td>
                        <td className="py-2 text-center text-gray-500">{p.quantity}</td>
                        <td className="py-2 text-right font-semibold text-white">${p.total_price?.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="flex justify-between font-bold text-base mb-5 pt-2 border-t border-[#333]">
                  <span className="text-gray-400">Total</span>
                  <span className="text-[#2D9F6A]">${selectedOrder.total.toLocaleString()}</span>
                </div>

                {selectedOrder.status === "pending" && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => updateOrderStatus(selectedOrder.id, "approved")}
                      className="flex-1 flex items-center justify-center gap-2 bg-green-500/15 text-green-400 border border-green-500/30 rounded-lg py-2 text-sm font-semibold hover:bg-green-500/25 transition"
                    >
                      <CheckCircle2 size={15} /> Aprobar
                    </button>
                    <button
                      onClick={() => updateOrderStatus(selectedOrder.id, "rejected")}
                      className="flex-1 flex items-center justify-center gap-2 bg-red-500/15 text-red-400 border border-red-500/30 rounded-lg py-2 text-sm font-semibold hover:bg-red-500/25 transition"
                    >
                      <XCircle size={15} /> Rechazar
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── CLIENTES ── */}
        {activeTab === "clients" && (
          <div className="space-y-4 max-w-4xl">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">Editá el tipo y margen de cada cliente.</p>
              <button
                onClick={() => { setShowNewClient(true); setCreateError(""); }}
                className="flex items-center gap-2 bg-[#2D9F6A] hover:bg-[#25835A] text-white text-sm font-bold px-4 py-2 rounded-lg transition"
              >
                <UserPlus size={15} /> Nuevo Cliente
              </button>
            </div>

            {/* Modal nuevo cliente */}
            {showNewClient && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl w-full max-w-md shadow-2xl shadow-black/60">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a1a1a]">
                    <h3 className="font-bold text-white">Nuevo Cliente</h3>
                    <button onClick={() => setShowNewClient(false)} className="text-gray-500 hover:text-white transition">
                      <X size={18} />
                    </button>
                  </div>
                  <div className="px-6 py-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="text-xs text-gray-400 mb-1 block">Email *</label>
                        <input type="email" value={newClient.email}
                          onChange={(e) => setNewClient((p) => ({ ...p, email: e.target.value }))}
                          className="w-full bg-[#0d0d0d] border border-[#262626] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#404040]"
                          placeholder="cliente@empresa.com" />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-gray-400 mb-1 block">Contraseña *</label>
                        <div className="flex gap-2">
                          <input type="text" value={newClient.password}
                            onChange={(e) => setNewClient((p) => ({ ...p, password: e.target.value }))}
                            className="flex-1 bg-[#0d0d0d] border border-[#262626] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#404040] font-mono placeholder:text-[#404040]"
                            placeholder="Mínimo 6 caracteres" />
                          <button type="button" onClick={generatePassword}
                            className="shrink-0 bg-[#2a2a2a] hover:bg-[#333] text-[#2D9F6A] text-xs font-bold px-3 rounded-lg border border-[#333] transition">
                            Generar
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Empresa</label>
                        <input type="text" value={newClient.company_name}
                          onChange={(e) => setNewClient((p) => ({ ...p, company_name: e.target.value }))}
                          className="w-full bg-[#0d0d0d] border border-[#262626] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#404040]"
                          placeholder="Distribuidora XYZ" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Contacto</label>
                        <input type="text" value={newClient.contact_name}
                          onChange={(e) => setNewClient((p) => ({ ...p, contact_name: e.target.value }))}
                          className="w-full bg-[#0d0d0d] border border-[#262626] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#404040]"
                          placeholder="Juan Pérez" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Tipo</label>
                        <select value={newClient.client_type}
                          onChange={(e) => {
                            const t = e.target.value as ClientType;
                            setNewClient((p) => ({ ...p, client_type: t, default_margin: CLIENT_TYPE_MARGINS[t] }));
                          }}
                          className="w-full bg-[#0d0d0d] border border-[#262626] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#404040]">
                          <option value="reseller">Revendedor</option>
                          <option value="mayorista">Mayorista</option>
                          <option value="empresa">Empresa</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Margen %</label>
                        <input type="number" min="0" max="100" value={newClient.default_margin}
                          onChange={(e) => setNewClient((p) => ({ ...p, default_margin: Number(e.target.value) }))}
                          className="w-full bg-[#0d0d0d] border border-[#262626] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#404040] text-center placeholder:text-[#404040]" />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-gray-400 mb-1 block">Rol</label>
                        <select value={newClient.role}
                          onChange={(e) => setNewClient((p) => ({ ...p, role: e.target.value as "client" | "admin" }))}
                          className="w-full bg-[#0d0d0d] border border-[#262626] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#404040]">
                          <option value="client">Cliente</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                    </div>

                    {createError && (
                      <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{createError}</p>
                    )}

                    <button
                      onClick={handleCreateClient}
                      disabled={creatingClient}
                      className="w-full bg-[#2D9F6A] hover:bg-[#25835A] text-white font-bold py-2.5 rounded-lg text-sm transition disabled:opacity-50"
                    >
                      {creatingClient ? "Creando..." : "Crear Cliente"}
                    </button>
                  </div>
                </div>
              </div>
            )}


            {loadingClients ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 bg-[#111] rounded-xl animate-pulse" />)}
              </div>
            ) : clients.length === 0 ? (
              <div className="flex flex-col items-center py-20 text-gray-500 text-sm gap-2">
                <Users size={36} className="opacity-30" />
                <p>No hay clientes registrados todavía.</p>
              </div>
            ) : (
              <div className="bg-[#111] border border-[#1f1f1f] rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-[#0d0d0d]">
                    <tr>
                      {["Empresa", "Contacto / Email", "Tipo", "Margen %", "Rol", ""].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((client) => {
                      const isEditing = !!editingClients[client.id];
                      const edits = editingClients[client.id] ?? {};
                      const currentType = (edits.client_type ?? client.client_type) as ClientType;
                      const currentMargin = edits.default_margin ?? client.default_margin;

                      return (
                        <tr key={client.id} className="border-t border-[#1a1a1a] hover:bg-[#161616] transition">
                          <td className="px-4 py-3 font-medium text-white">{client.company_name || "—"}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{client.contact_name || "—"}</td>

                          {/* Tipo */}
                          <td className="px-4 py-3">
                            {isEditing ? (
                              <select
                                value={currentType}
                                onChange={(e) => applyTypeMargin(client.id, e.target.value as ClientType)}
                                className="bg-[#0d0d0d] border border-[#262626] rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-[#404040]"
                              >
                                {(Object.keys(CLIENT_TYPE_LABELS) as ClientType[]).map((t) => (
                                  <option key={t} value={t}>{CLIENT_TYPE_LABELS[t]}</option>
                                ))}
                              </select>
                            ) : (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${
                                currentType === "mayorista"
                                  ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                                  : currentType === "empresa"
                                  ? "bg-purple-500/15 text-purple-400 border-purple-500/30"
                                  : "bg-orange-500/15 text-orange-400 border-orange-500/30"
                              }`}>
                                {CLIENT_TYPE_LABELS[currentType] ?? currentType}
                              </span>
                            )}
                          </td>

                          {/* Margen */}
                          <td className="px-4 py-3">
                            {isEditing ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="number" min="0" max="100"
                                  value={currentMargin}
                                  onChange={(e) => updateEdit(client.id, "default_margin", Number(e.target.value))}
                                  className="w-16 bg-[#181818] border border-[#333] rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-[#2D9F6A] text-center"
                                />
                                <span className="text-xs text-gray-500">%</span>
                              </div>
                            ) : (
                              <span className="font-semibold text-[#2D9F6A]">{client.default_margin}%</span>
                            )}
                          </td>

                          {/* Rol */}
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${
                              client.role === "admin"
                                ? "bg-[#2D9F6A]/15 text-[#2D9F6A] border-[#2D9F6A]/30"
                                : "bg-[#2a2a2a] text-gray-400 border-[#333]"
                            }`}>
                              {client.role === "admin" ? "Admin" : "Cliente"}
                            </span>
                          </td>

                          {/* Acciones */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {isEditing ? (
                                <>
                                  <button
                                    onClick={() => saveClient(client.id)}
                                    disabled={savingClient === client.id}
                                    className="flex items-center gap-1 text-xs bg-[#2D9F6A] text-white px-2.5 py-1 rounded-lg font-semibold disabled:opacity-50 transition hover:bg-[#25835A]"
                                  >
                                    <Save size={12} />
                                    {savingClient === client.id ? "Guardando..." : "Guardar"}
                                  </button>
                                  <button
                                    onClick={() => setEditingClients((prev) => { const { [client.id]: _, ...rest } = prev; return rest; })}
                                    className="text-xs text-gray-500 hover:text-white transition px-2 py-1"
                                  >
                                    Cancelar
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => startEdit(client)}
                                  className="text-xs text-[#737373] hover:text-white transition px-2 py-1 rounded-lg hover:bg-[#1c1c1c]"
                                >
                                  Editar
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
};

export default Admin;
