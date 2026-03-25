import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { CLIENT_TYPE_MARGINS, ClientType } from "@/lib/supabase";
import { Product } from "@/models/products";
import ProductForm from "@/components/admin/ProductForm";
import ProductImport from "@/components/admin/ProductImport";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2, XCircle, Clock, Trash2, RefreshCw, Save,
  Users, Package, ClipboardList, LogOut, LayoutGrid, ShieldCheck,
} from "lucide-react";

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

type Tab = "products" | "orders" | "clients";

const Admin = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<SupabaseOrder[]>([]);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [editingClients, setEditingClients] = useState<Record<string, Partial<ClientProfile>>>({});
  const [savingClient, setSavingClient] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<SupabaseOrder | null>(null);
  const [importResult, setImportResult] = useState<{ imported: number; errors: string[] } | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadingClients, setLoadingClients] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("products");

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

  useEffect(() => { fetchProducts(); fetchOrders(); fetchClients(); }, []);

  const pendingOrders = orders.filter((o) => o.status === "pending").length;

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
    { id: "products", label: "Productos",  icon: Package,      badge: products.length },
    { id: "orders",   label: "Pedidos",    icon: ClipboardList, badge: pendingOrders || undefined },
    { id: "clients",  label: "Clientes",   icon: Users,         badge: clients.length },
  ];

  return (
    <div className="flex min-h-screen bg-[#181818] flex-col">

      {/* TOPBAR */}
      <header className="flex items-center gap-3 px-4 md:px-6 py-3 bg-[#141414] border-b border-[#222]">
        <div className="flex items-center gap-2.5">
          <img src="/icon.png" alt="Bartez" className="h-8 w-8 object-contain" />
          <div>
            <span className="font-bold text-white text-sm leading-none">Panel Admin</span>
            <span className="block text-xs text-[#FF6A00] leading-none mt-0.5">Bartez Tecnología</span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => { fetchProducts(); fetchOrders(); fetchClients(); }}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition px-3 py-2 rounded-lg hover:bg-[#232323]"
          >
            <RefreshCw size={13} /> Actualizar
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition px-3 py-2 rounded-lg hover:bg-[#232323]"
          >
            <LogOut size={13} /> Salir
          </button>
        </div>
      </header>

      {/* TABS */}
      <div className="flex border-b border-[#222] bg-[#141414] px-4 md:px-6">
        {tabs.map(({ id, label, icon: Icon, badge }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
              activeTab === id
                ? "border-[#FF6A00] text-white"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            <Icon size={14} />
            {label}
            {badge !== undefined && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                id === "orders" && pendingOrders > 0
                  ? "bg-[#FF6A00] text-white"
                  : "bg-[#2a2a2a] text-gray-400"
              }`}>
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <main className="flex-1 p-4 md:p-6 overflow-y-auto">

        {/* ── PRODUCTOS ── */}
        {activeTab === "products" && (
          <div className="space-y-6 max-w-6xl">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-[#232323] border border-[#2a2a2a] rounded-xl p-5">
                <h2 className="text-sm font-bold text-white mb-4">Agregar producto</h2>
                <ProductForm onAdd={(p) => setProducts((prev) => [p, ...prev])} />
              </div>
              <div className="bg-[#232323] border border-[#2a2a2a] rounded-xl p-5">
                <h2 className="text-sm font-bold text-white mb-4">Importar CSV</h2>
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

            {loadingProducts ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-10 bg-[#232323] rounded-lg animate-pulse" />)}
              </div>
            ) : (
              <div className="bg-[#232323] border border-[#2a2a2a] rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-[#1a1a1a]">
                    <tr>
                      {["Nombre", "SKU", "Precio costo", "Categoría", "Stock", "Estado", ""].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => (
                      <tr key={p.id} className="border-t border-[#2a2a2a] hover:bg-[#2a2a2a]/40 transition">
                        <td className="px-4 py-3 font-medium text-white">{p.name}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs font-mono">{p.sku || "—"}</td>
                        <td className="px-4 py-3 text-gray-300">${p.cost_price.toLocaleString()}</td>
                        <td className="px-4 py-3 text-gray-500">{p.category}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold ${
                            p.stock === 0 ? "text-red-400" : p.stock <= 3 ? "text-yellow-400" : "text-green-400"
                          }`}>{p.stock}u</span>
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => toggleActive(p)}
                            className={`text-xs px-2 py-0.5 rounded-full font-semibold border transition ${
                              (p as any).active !== false
                                ? "bg-green-500/15 text-green-400 border-green-500/30 hover:bg-red-500/15 hover:text-red-400 hover:border-red-500/30"
                                : "bg-red-500/15 text-red-400 border-red-500/30 hover:bg-green-500/15 hover:text-green-400 hover:border-green-500/30"
                            }`}>
                            {(p as any).active !== false ? "Activo" : "Inactivo"}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => deleteProduct(p.id)}
                            className="text-gray-600 hover:text-red-400 transition">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── PEDIDOS ── */}
        {activeTab === "orders" && (
          <div className="grid lg:grid-cols-2 gap-5 max-w-5xl">
            <div>
              {loadingOrders ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-[#232323] rounded-xl animate-pulse" />)}
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center py-20 text-gray-500 text-sm">No hay pedidos todavía.</div>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => (
                    <div
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      className={`bg-[#232323] border rounded-xl p-4 cursor-pointer transition hover:border-[#FF6A00]/40 ${
                        selectedOrder?.id === order.id ? "border-[#FF6A00]/60" : "border-[#2a2a2a]"
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
              <div className="bg-[#232323] border border-[#2a2a2a] rounded-xl p-6">
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
                  <span className="text-[#FF6A00]">${selectedOrder.total.toLocaleString()}</span>
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
            <p className="text-sm text-gray-500">
              Editá el tipo y margen de cada cliente. Al cambiar el tipo se sugiere el margen por defecto.
            </p>

            {loadingClients ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 bg-[#232323] rounded-xl animate-pulse" />)}
              </div>
            ) : clients.length === 0 ? (
              <div className="flex flex-col items-center py-20 text-gray-500 text-sm gap-2">
                <Users size={36} className="opacity-30" />
                <p>No hay clientes registrados todavía.</p>
              </div>
            ) : (
              <div className="bg-[#232323] border border-[#2a2a2a] rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-[#1a1a1a]">
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
                        <tr key={client.id} className="border-t border-[#2a2a2a] hover:bg-[#2a2a2a]/40 transition">
                          <td className="px-4 py-3 font-medium text-white">{client.company_name || "—"}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{client.contact_name || "—"}</td>

                          {/* Tipo */}
                          <td className="px-4 py-3">
                            {isEditing ? (
                              <select
                                value={currentType}
                                onChange={(e) => applyTypeMargin(client.id, e.target.value as ClientType)}
                                className="bg-[#181818] border border-[#333] rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-[#FF6A00]"
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
                                  className="w-16 bg-[#181818] border border-[#333] rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-[#FF6A00] text-center"
                                />
                                <span className="text-xs text-gray-500">%</span>
                              </div>
                            ) : (
                              <span className="font-semibold text-[#FF6A00]">{client.default_margin}%</span>
                            )}
                          </td>

                          {/* Rol */}
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${
                              client.role === "admin"
                                ? "bg-[#FF6A00]/15 text-[#FF6A00] border-[#FF6A00]/30"
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
                                    className="flex items-center gap-1 text-xs bg-[#FF6A00] text-white px-2.5 py-1 rounded-lg font-semibold disabled:opacity-50 transition hover:bg-[#FF8C1A]"
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
                                  className="text-xs text-gray-500 hover:text-white transition px-2 py-1 rounded-lg hover:bg-[#2a2a2a]"
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
