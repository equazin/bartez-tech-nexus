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
  DollarSign, Pencil, Check, LayoutDashboard, Sun, Moon, Phone, Tag, Truck,
} from "lucide-react";
import { SalesDashboard } from "@/components/admin/SalesDashboard";
import { ClientCRM } from "@/components/admin/ClientCRM";
import { PricingRulesTab } from "@/components/admin/PricingRulesTab";

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
  credit_limit?: number;
}

const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  mayorista: "Mayorista",
  reseller:  "Revendedor",
  empresa:   "Empresa",
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; icon: any; className: string }> = {
    pending:    { label: "En revisión", icon: Clock,         className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
    approved:   { label: "Aprobado",    icon: CheckCircle2,  className: "bg-green-500/15 text-green-400 border-green-500/30" },
    rejected:   { label: "Rechazado",   icon: XCircle,       className: "bg-red-500/15 text-red-400 border-red-500/30" },
    dispatched: { label: "Despachado",  icon: Truck,         className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  };
  const { label, icon: Icon, className } = map[status] ?? map.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${className}`}>
      <Icon size={11} /> {label}
    </span>
  );
}

type Tab = "dashboard" | "products" | "orders" | "clients" | "pricing";

const Admin = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { exchangeRate, setExchangeRate, fetchExchangeRate, formatPrice, formatARS, formatUSD, currency } = useCurrency();

  const ADMIN_THEME_KEY = "admin_theme";
  const [theme, setTheme] = useState<"dark" | "light">(() =>
    localStorage.getItem(ADMIN_THEME_KEY) === "light" ? "light" : "dark"
  );
  const isDark = theme === "dark";
  const toggleTheme = () => {
    const next = isDark ? "light" : "dark";
    setTheme(next);
    localStorage.setItem(ADMIN_THEME_KEY, next);
  };
  const dk = (d: string, l: string) => isDark ? d : l;

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
  const [newClient, setNewClient] = useState({ email: "", password: "", phone: "", company_name: "", contact_name: "", client_type: "reseller" as ClientType, default_margin: 20, role: "client" as "client" | "admin" });
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
      .select("id, company_name, contact_name, client_type, default_margin, role, credit_limit")
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

  // ── Phone sidecar (localStorage) ──
  const PHONES_KEY = "admin_client_phones";
  function getPhones(): Record<string, string> {
    try { return JSON.parse(localStorage.getItem(PHONES_KEY) || "{}"); } catch { return {}; }
  }
  function savePhone(clientId: string, phone: string) {
    if (!phone.trim()) return;
    const phones = getPhones();
    phones[clientId] = phone.trim();
    localStorage.setItem(PHONES_KEY, JSON.stringify(phones));
  }
  function getPhone(clientId: string): string {
    return getPhones()[clientId] || "";
  }

  // ── Crear cliente ──
  async function handleCreateClient() {
    setCreateError("");
    if (!newClient.email || !newClient.password) {
      setCreateError("Email y contraseña son obligatorios.");
      return;
    }
    if (!newClient.phone.trim()) {
      setCreateError("El celular es obligatorio.");
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
    await supabase.from("profiles").update({
      company_name: newClient.company_name,
      contact_name: newClient.contact_name,
      client_type: newClient.client_type,
      default_margin: newClient.default_margin,
      role: newClient.role,
    }).eq("id", data.user.id);

    savePhone(data.user.id, newClient.phone);

    setCreatingClient(false);
    setShowNewClient(false);
    setNewClient({ email: "", password: "", phone: "", company_name: "", contact_name: "", client_type: "reseller", default_margin: 20, role: "client" });
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

  async function saveClientFields(id: string, changes: { client_type?: ClientType; default_margin?: number }) {
    await supabase.from("profiles").update(changes).eq("id", id);
    setClients((prev) => prev.map((c) => (c.id === id ? { ...c, ...changes } : c)));
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
    const order = orders.find((o) => o.id === orderId);
    const { error } = await supabase
      .from("orders")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", orderId);
    if (!error) {
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status } : o));
      if (selectedOrder?.id === orderId) setSelectedOrder((o) => o ? { ...o, status } : o);

      // Reserve stock on approve; release on reject
      if (order?.products?.length) {
        for (const p of order.products as any[]) {
          const productId = p.product_id ?? p.id;
          if (!productId) continue;
          const { data: prod } = await supabase.from("products").select("stock_reserved").eq("id", productId).single();
          if (!prod) continue;
          const current = prod.stock_reserved ?? 0;
          const delta = status === "approved" ? (p.quantity ?? 0) : -(p.quantity ?? 0);
          await supabase.from("products").update({ stock_reserved: Math.max(0, current + delta) }).eq("id", productId);
        }
      }
    }
  }

  async function dispatchOrder(orderId: string) {
    if (!confirm("¿Confirmar despacho? Esto descontará el stock definitivamente.")) return;
    const order = orders.find((o) => o.id === orderId);
    const { error } = await supabase
      .from("orders")
      .update({ status: "dispatched", updated_at: new Date().toISOString() })
      .eq("id", orderId);
    if (!error) {
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: "dispatched" } : o));
      if (selectedOrder?.id === orderId) setSelectedOrder((o) => o ? { ...o, status: "dispatched" } : o);

      // Deduct stock and release reservation
      if (order?.products?.length) {
        for (const p of order.products as any[]) {
          const productId = p.product_id ?? p.id;
          if (!productId) continue;
          const { data: prod } = await supabase.from("products").select("stock, stock_reserved").eq("id", productId).single();
          if (!prod) continue;
          await supabase.from("products").update({
            stock:          Math.max(0, (prod.stock ?? 0) - (p.quantity ?? 0)),
            stock_reserved: Math.max(0, (prod.stock_reserved ?? 0) - (p.quantity ?? 0)),
          }).eq("id", productId);
        }
      }
    }
  }

  const handleLogout = async () => { await signOut(); navigate("/login"); };

  const tabs: { id: Tab; label: string; icon: any; badge?: number }[] = [
    { id: "dashboard", label: "Dashboard",  icon: LayoutDashboard },
    { id: "products",  label: "Productos",  icon: Package,       badge: products.length },
    { id: "orders",    label: "Pedidos",    icon: ClipboardList, badge: pendingOrders || undefined },
    { id: "clients",   label: "Clientes",   icon: Users,         badge: clients.length },
    { id: "pricing",   label: "Precios",    icon: Tag },
  ];

  return (
    <div className={`flex min-h-screen flex-col ${dk("bg-[#0a0a0a]", "bg-[#f0f0f0]")}`}>

      {/* TOPBAR */}
      <header className={`flex items-center gap-3 px-4 md:px-6 py-3 border-b ${dk("bg-[#0d0d0d] border-[#1a1a1a]", "bg-white border-[#e5e5e5]")}`}>
        <div className="flex items-center gap-2.5">
          <img src="/icon.png" alt="Bartez" className="h-8 w-8 object-contain" />
          <div>
            <span className={`font-bold text-sm leading-none ${dk("text-white", "text-[#171717]")}`}>Panel Admin</span>
            <span className="block text-xs text-[#2D9F6A] leading-none mt-0.5">Bartez Tecnología</span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => { fetchProducts(); fetchOrders(); fetchClients(); }}
            className={`flex items-center gap-1.5 text-xs transition px-3 py-2 rounded-lg ${dk("text-[#737373] hover:text-white hover:bg-[#1c1c1c]", "text-[#737373] hover:text-[#171717] hover:bg-[#e8e8e8]")}`}
          >
            <RefreshCw size={13} /> Actualizar
          </button>
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-lg transition ${dk("text-[#525252] hover:text-white hover:bg-[#1c1c1c]", "text-[#737373] hover:text-[#171717] hover:bg-[#e8e8e8]")}`}
            title={isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
          >
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <button
            onClick={handleLogout}
            className={`flex items-center gap-1.5 text-xs transition px-3 py-2 rounded-lg ${dk("text-[#737373] hover:text-white hover:bg-[#1c1c1c]", "text-[#737373] hover:text-[#171717] hover:bg-[#e8e8e8]")}`}
          >
            <LogOut size={13} /> Salir
          </button>
        </div>
      </header>

      {/* TABS */}
      <div className={`flex border-b px-4 md:px-6 ${dk("border-[#1a1a1a] bg-[#0d0d0d]", "border-[#e5e5e5] bg-white")}`}>
        {tabs.map(({ id, label, icon: Icon, badge }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
              activeTab === id
                ? `border-[#2D9F6A] ${dk("text-white", "text-[#171717]")}`
                : `border-transparent ${dk("text-[#525252] hover:text-[#a3a3a3]", "text-[#737373] hover:text-[#525252]")}`
            }`}
          >
            <Icon size={14} />
            {label}
            {badge !== undefined && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                id === "orders" && pendingOrders > 0
                  ? "bg-[#2D9F6A] text-white"
                  : dk("bg-[#1c1c1c] text-[#525252]", "bg-[#e8e8e8] text-[#737373]")
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
          <SalesDashboard orders={orders} clients={clients} isDark={isDark} onRefreshOrders={fetchOrders} />
        )}

        {/* ── PRODUCTOS ── */}
        {activeTab === "products" && (
          <div className="space-y-6 max-w-6xl">

            {/* ── Cotización del dólar ── */}
            <div className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-xl px-5 py-4 flex flex-wrap items-center gap-4`}>
              <div className="flex items-center gap-2 shrink-0">
                <div className="h-8 w-8 rounded-lg bg-[#2D9F6A]/10 border border-[#2D9F6A]/20 flex items-center justify-center">
                  <DollarSign size={14} className="text-[#2D9F6A]" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Cotización USD</p>
                  <p className="text-[10px] text-gray-500">
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
                    className={`w-28 border border-[#2D9F6A]/40 rounded-lg px-2 py-1 text-sm font-mono outline-none focus:border-[#2D9F6A] ${dk("bg-[#0d0d0d] text-white", "bg-white text-[#171717]")}`}
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
                    className={`h-7 w-7 rounded-lg flex items-center justify-center transition ${dk("bg-[#2a2a2a] hover:bg-[#333] text-gray-400", "bg-[#e8e8e8] hover:bg-[#d4d4d4] text-gray-600")}`}>
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex items-baseline gap-1.5">
                    <span className={`text-2xl font-extrabold tabular-nums ${dk("text-white", "text-[#171717]")}`}>
                      {exchangeRate.rate.toLocaleString("es-AR")}
                    </span>
                    <span className="text-sm text-gray-500">ARS / USD</span>
                  </div>
                  <button
                    onClick={() => { setRateInput(String(exchangeRate.rate)); setEditingRate(true); }}
                    className={`flex items-center gap-1.5 text-xs transition px-2.5 py-1.5 rounded-lg border ${dk("text-[#737373] hover:text-white border-[#262626] hover:border-[#333] bg-[#0d0d0d] hover:bg-[#1c1c1c]", "text-[#737373] hover:text-[#171717] border-[#e5e5e5] hover:border-[#d4d4d4] bg-white hover:bg-[#f5f5f5]")}`}
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
                  className={`flex items-center gap-1.5 text-xs disabled:opacity-50 transition px-2.5 py-1.5 rounded-lg border border-transparent ${dk("text-[#737373] hover:text-white hover:bg-[#1c1c1c] hover:border-[#262626]", "text-[#737373] hover:text-[#171717] hover:bg-[#f5f5f5] hover:border-[#e5e5e5]")}`}
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
              <div className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-xl p-5`}>
                <h2 className={`text-sm font-bold mb-4 ${dk("text-white", "text-[#171717]")}`}>Agregar producto</h2>
                <ProductForm isDark={isDark} onAdd={(p) => setProducts((prev) => [p, ...prev])} />
              </div>
              <div className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-xl p-5`}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>Importar CSV</h2>
                  <button onClick={downloadSampleCSV}
                    className="text-xs text-gray-400 hover:text-[#2D9F6A] transition flex items-center gap-1">
                    ↓ Descargar CSV de ejemplo
                  </button>
                </div>
                <ProductImport isDark={isDark} onImport={(r) => { setImportResult(r); fetchProducts(); }} />
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
            <div className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-xl p-5`}>
              <h2 className={`text-sm font-bold mb-4 ${dk("text-white", "text-[#171717]")}`}>Categorías y Subcategorías</h2>
              <div className="flex gap-2 mb-4">
                <input
                  value={newCatName} onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="Nombre de categoría"
                  className={`flex-1 border rounded-lg px-3 py-2 text-sm outline-none transition ${dk("bg-[#0d0d0d] border-[#262626] text-white focus:border-[#404040] placeholder:text-[#404040]", "bg-[#f9f9f9] border-[#d4d4d4] text-[#171717] focus:border-[#2D9F6A] placeholder:text-gray-400")}`}
                />
                <select value={newCatParent} onChange={(e) => setNewCatParent(e.target.value)}
                  className={`border rounded-lg px-3 py-2 text-sm outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white focus:border-[#404040]", "bg-[#f9f9f9] border-[#d4d4d4] text-[#171717] focus:border-[#2D9F6A]")}`}>
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
                  <div key={parent.id} className={`${dk("bg-[#0d0d0d] border-[#1f1f1f]", "bg-[#f5f5f5] border-[#e5e5e5]")} border rounded-lg px-3 py-2 min-w-[140px]`}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className={`text-sm font-semibold ${dk("text-white", "text-[#171717]")}`}>{parent.name}</span>
                      <button onClick={() => deleteCategory(parent.id)} className="text-gray-500 hover:text-red-400 transition"><Trash2 size={12} /></button>
                    </div>
                    {categories.filter((c) => c.parent_id === parent.id).map((sub) => (
                      <div key={sub.id} className={`flex items-center justify-between text-xs text-[#737373] pl-2 border-l mt-1 ${dk("border-[#262626]", "border-[#d4d4d4]")}`}>
                        <span>↳ {sub.name}</span>
                        <button onClick={() => deleteCategory(sub.id)} className="text-gray-500 hover:text-red-400 transition ml-2"><Trash2 size={11} /></button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {loadingProducts ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => <div key={i} className={`h-10 ${dk("bg-[#111]", "bg-[#e8e8e8]")} rounded-lg animate-pulse`} />)}
              </div>
            ) : (
              <ProductTable isDark={isDark} products={products} categories={categories} onRefresh={fetchProducts} />
            )}
          </div>
        )}

        {/* ── PEDIDOS ── */}
        {activeTab === "orders" && (
          <div className="grid lg:grid-cols-2 gap-5 max-w-5xl">
            <div className="space-y-3">
              {/* Currency notice */}
              <div className={`flex items-start gap-2.5 rounded-xl px-4 py-3 border text-xs ${dk("bg-blue-500/8 border-blue-500/20 text-blue-300", "bg-blue-50 border-blue-200 text-blue-700")}`}>
                <DollarSign size={13} className="mt-0.5 shrink-0" />
                <span>
                  Los importes se muestran en <strong>USD</strong> (moneda base del portal).
                  El cliente puede confirmar pedidos en ARS — revisá el tipo de cambio vigente.
                  1 USD = <strong>{exchangeRate.rate.toLocaleString("es-AR")} ARS</strong>
                </span>
              </div>

              {loadingOrders ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => <div key={i} className={`h-20 rounded-xl animate-pulse ${dk("bg-[#111]", "bg-white")}`} />)}
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center py-20 text-gray-500 text-sm">No hay pedidos todavía.</div>
              ) : (
                <div className="space-y-2">
                  {orders.map((order) => (
                    <div
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      className={`border rounded-xl p-4 cursor-pointer transition ${
                        selectedOrder?.id === order.id
                          ? dk("border-[#333] bg-[#141414]", "border-[#2D9F6A]/30 bg-[#f0faf5]")
                          : dk("border-[#1f1f1f] bg-[#111] hover:border-[#2e2e2e] hover:bg-[#141414]", "border-[#e5e5e5] bg-white hover:border-[#d4d4d4] hover:bg-[#f9f9f9]")
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-mono ${dk("text-gray-500", "text-[#737373]")}`}>#{String(order.id).slice(-8)}</span>
                        <StatusBadge status={order.status} />
                      </div>
                      <p className={`text-xs ${dk("text-gray-600", "text-[#a3a3a3]")}`}>
                        {new Date(order.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                      <div className="flex justify-between items-center mt-2">
                        <span className={`text-xs ${dk("text-gray-500", "text-[#a3a3a3]")}`}>{order.products?.length} items</span>
                        <div className="text-right">
                          <span className={`font-bold text-sm ${dk("text-white", "text-[#171717]")}`}>
                            USD {order.total.toLocaleString("en-US", { minimumFractionDigits: 0 })}
                          </span>
                          <span className={`block text-[10px] font-mono ${dk("text-[#525252]", "text-[#a3a3a3]")}`}>
                            ≈ {(order.total * exchangeRate.rate).toLocaleString("es-AR", { maximumFractionDigits: 0 })} ARS
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedOrder && (
              <div className={`border rounded-xl p-6 ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className={`font-bold ${dk("text-white", "text-[#171717]")}`}>Pedido #{String(selectedOrder.id).slice(-8)}</h3>
                  <StatusBadge status={selectedOrder.status} />
                </div>
                <p className={`text-xs mb-4 ${dk("text-gray-500", "text-[#737373]")}`}>
                  {new Date(selectedOrder.created_at).toLocaleDateString("es-AR", { dateStyle: "full" })}
                </p>

                <table className="w-full text-sm mb-4">
                  <thead>
                    <tr className={`border-b ${dk("border-[#333]", "border-[#e5e5e5]")}`}>
                      <th className={`pb-2 text-left text-xs font-medium ${dk("text-gray-500", "text-[#a3a3a3]")}`}>Producto</th>
                      <th className={`pb-2 text-center text-xs font-medium ${dk("text-gray-500", "text-[#a3a3a3]")}`}>Cant.</th>
                      <th className={`pb-2 text-right text-xs font-medium ${dk("text-gray-500", "text-[#a3a3a3]")}`}>USD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.products?.map((p: any, i: number) => (
                      <tr key={i} className={`border-b ${dk("border-[#2a2a2a]", "border-[#f0f0f0]")}`}>
                        <td className={`py-2 ${dk("text-gray-300", "text-[#525252]")}`}>{p.name}</td>
                        <td className={`py-2 text-center ${dk("text-gray-500", "text-[#a3a3a3]")}`}>{p.quantity}</td>
                        <td className={`py-2 text-right font-semibold ${dk("text-white", "text-[#171717]")}`}>
                          {p.total_price?.toLocaleString("en-US", { minimumFractionDigits: 0 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className={`mb-5 pt-3 border-t ${dk("border-[#333]", "border-[#e5e5e5]")}`}>
                  <div className="flex justify-between font-bold text-base">
                    <span className={dk("text-gray-400", "text-[#737373]")}>Total</span>
                    <div className="text-right">
                      <span className="text-[#2D9F6A]">USD {selectedOrder.total.toLocaleString("en-US", { minimumFractionDigits: 0 })}</span>
                      <p className={`text-[11px] font-normal font-mono mt-0.5 ${dk("text-[#525252]", "text-[#a3a3a3]")}`}>
                        ≈ {(selectedOrder.total * exchangeRate.rate).toLocaleString("es-AR", { maximumFractionDigits: 0 })} ARS
                        <span className={`ml-1.5 ${dk("text-[#3a3a3a]", "text-[#c4c4c4]")}`}>@ {exchangeRate.rate.toLocaleString("es-AR")} ARS/USD</span>
                      </p>
                    </div>
                  </div>
                </div>

                {selectedOrder.status === "pending" && (() => {
                  const phone = getPhone(selectedOrder.client_id);
                  const waMsg = encodeURIComponent(
                    `Hola! Te escribimos de Bartez Tecnología sobre tu pedido #${String(selectedOrder.id).slice(-8).toUpperCase()}. ¿Podemos coordinar la confirmación?`
                  );
                  const waUrl = phone ? `https://wa.me/${phone.replace(/\D/g, "")}?text=${waMsg}` : null;
                  return (
                    <div className="space-y-2">
                      {waUrl && (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center justify-center gap-2 bg-[#25D366]/15 text-[#25D366] border border-[#25D366]/30 rounded-lg py-2 text-sm font-semibold hover:bg-[#25D366]/25 transition"
                        >
                          <Phone size={15} /> Contactar por WhatsApp
                        </a>
                      )}
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
                      {!waUrl && (
                        <p className={`text-[11px] text-center ${dk("text-[#525252]", "text-[#a3a3a3]")}`}>
                          Sin celular registrado para este cliente — no se puede enviar WhatsApp
                        </p>
                      )}
                    </div>
                  );
                })()}

                {selectedOrder.status === "approved" && (
                  <button
                    onClick={() => dispatchOrder(selectedOrder.id)}
                    className="w-full flex items-center justify-center gap-2 bg-blue-500/15 text-blue-400 border border-blue-500/30 rounded-lg py-2 text-sm font-semibold hover:bg-blue-500/25 transition"
                  >
                    <Truck size={15} /> Despachar pedido
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── CLIENTES ── */}
        {activeTab === "clients" && (
          <>
          <ClientCRM
            clients={clients}
            orders={orders}
            loading={loadingClients}
            isDark={isDark}
            onSave={saveClientFields}
            onNewClient={() => { setShowNewClient(true); setCreateError(""); }}
          />

            {/* Modal nuevo cliente */}
            {showNewClient && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                <div className={`border rounded-2xl w-full max-w-md shadow-2xl shadow-black/60 ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
                  <div className={`flex items-center justify-between px-6 py-4 border-b ${dk("border-[#1a1a1a]", "border-[#e5e5e5]")}`}>
                    <h3 className={`font-bold ${dk("text-white", "text-[#171717]")}`}>Nuevo Cliente</h3>
                    <button onClick={() => setShowNewClient(false)} className={`transition ${dk("text-gray-500 hover:text-white", "text-[#a3a3a3] hover:text-[#171717]")}`}>
                      <X size={18} />
                    </button>
                  </div>
                  <div className="px-6 py-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className={`text-xs mb-1 block ${dk("text-gray-400", "text-[#737373]")}`}>Email *</label>
                        <input type="email" value={newClient.email}
                          onChange={(e) => setNewClient((p) => ({ ...p, email: e.target.value }))}
                          className={`w-full border rounded-lg px-3 py-2 text-sm outline-none transition ${dk("bg-[#0d0d0d] border-[#262626] text-white focus:border-[#404040]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] focus:border-[#d4d4d4]")}`}
                          placeholder="cliente@empresa.com" />
                      </div>
                      <div className="col-span-2">
                        <label className={`text-xs mb-1 block ${dk("text-gray-400", "text-[#737373]")}`}>Contraseña *</label>
                        <div className="flex gap-2">
                          <input type="text" value={newClient.password}
                            onChange={(e) => setNewClient((p) => ({ ...p, password: e.target.value }))}
                            className={`flex-1 border rounded-lg px-3 py-2 text-sm font-mono outline-none transition ${dk("bg-[#0d0d0d] border-[#262626] text-white focus:border-[#404040] placeholder:text-[#404040]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] focus:border-[#d4d4d4] placeholder:text-[#c4c4c4]")}`}
                            placeholder="Mínimo 6 caracteres" />
                          <button type="button" onClick={generatePassword}
                            className={`shrink-0 text-[#2D9F6A] text-xs font-bold px-3 rounded-lg border transition ${dk("bg-[#2a2a2a] hover:bg-[#333] border-[#333]", "bg-[#f0f0f0] hover:bg-[#e8e8e8] border-[#e5e5e5]")}`}>
                            Generar
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className={`text-xs mb-1 block ${dk("text-gray-400", "text-[#737373]")}`}>Empresa</label>
                        <input type="text" value={newClient.company_name}
                          onChange={(e) => setNewClient((p) => ({ ...p, company_name: e.target.value }))}
                          className={`w-full border rounded-lg px-3 py-2 text-sm outline-none transition ${dk("bg-[#0d0d0d] border-[#262626] text-white focus:border-[#404040]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] focus:border-[#d4d4d4]")}`}
                          placeholder="Distribuidora XYZ" />
                      </div>
                      <div>
                        <label className={`text-xs mb-1 block ${dk("text-gray-400", "text-[#737373]")}`}>Contacto</label>
                        <input type="text" value={newClient.contact_name}
                          onChange={(e) => setNewClient((p) => ({ ...p, contact_name: e.target.value }))}
                          className={`w-full border rounded-lg px-3 py-2 text-sm outline-none transition ${dk("bg-[#0d0d0d] border-[#262626] text-white focus:border-[#404040]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] focus:border-[#d4d4d4]")}`}
                          placeholder="Juan Pérez" />
                      </div>
                      <div className="col-span-2">
                        <label className={`text-xs mb-1 flex items-center gap-1 ${dk("text-gray-400", "text-[#737373]")}`}>
                          <Phone size={11} /> Celular * <span className="text-[#525252] font-normal">(con código de país, ej: 5491122334455)</span>
                        </label>
                        <input type="tel" value={newClient.phone}
                          onChange={(e) => setNewClient((p) => ({ ...p, phone: e.target.value }))}
                          className={`w-full border rounded-lg px-3 py-2 text-sm font-mono outline-none transition ${dk("bg-[#0d0d0d] border-[#262626] text-white focus:border-[#2D9F6A]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] focus:border-[#2D9F6A]")}`}
                          placeholder="5491122334455" />
                      </div>
                      <div>
                        <label className={`text-xs mb-1 block ${dk("text-gray-400", "text-[#737373]")}`}>Tipo</label>
                        <select value={newClient.client_type}
                          onChange={(e) => {
                            const t = e.target.value as ClientType;
                            setNewClient((p) => ({ ...p, client_type: t, default_margin: CLIENT_TYPE_MARGINS[t] }));
                          }}
                          className={`w-full border rounded-lg px-3 py-2 text-sm outline-none transition ${dk("bg-[#0d0d0d] border-[#262626] text-white focus:border-[#404040]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] focus:border-[#d4d4d4]")}`}>
                          <option value="reseller">Revendedor</option>
                          <option value="mayorista">Mayorista</option>
                          <option value="empresa">Empresa</option>
                        </select>
                      </div>
                      <div>
                        <label className={`text-xs mb-1 block ${dk("text-gray-400", "text-[#737373]")}`}>Margen %</label>
                        <input type="number" min="0" max="100" value={newClient.default_margin}
                          onChange={(e) => setNewClient((p) => ({ ...p, default_margin: Number(e.target.value) }))}
                          className={`w-full border rounded-lg px-3 py-2 text-sm text-center outline-none transition ${dk("bg-[#0d0d0d] border-[#262626] text-white focus:border-[#404040]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] focus:border-[#d4d4d4]")}`} />
                      </div>
                      <div className="col-span-2">
                        <label className={`text-xs mb-1 block ${dk("text-gray-400", "text-[#737373]")}`}>Rol</label>
                        <select value={newClient.role}
                          onChange={(e) => setNewClient((p) => ({ ...p, role: e.target.value as "client" | "admin" }))}
                          className={`w-full border rounded-lg px-3 py-2 text-sm outline-none transition ${dk("bg-[#0d0d0d] border-[#262626] text-white focus:border-[#404040]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] focus:border-[#d4d4d4]")}`}>
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


          </>
        )}

        {/* ── PRECIOS ── */}
        {activeTab === "pricing" && (
          <PricingRulesTab
            isDark={isDark}
            categories={categories.filter((c) => c.parent_id === null).map((c) => c.name)}
          />
        )}

      </main>
    </div>
  );
};

export default Admin;
