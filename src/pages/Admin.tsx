import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { CLIENT_TYPE_MARGINS, ClientType } from "@/lib/supabase";
import { Product } from "@/models/products";
import Layout from "@/components/Layout";
import ProductForm from "@/components/admin/ProductForm";
import ProductImport from "@/components/admin/ProductImport";
import { CheckCircle2, XCircle, Clock, Trash2, RefreshCw, Save, Users } from "lucide-react";

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
  const map: Record<string, { label: string; className: string }> = {
    pending:  { label: "En revisión", className: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30" },
    approved: { label: "Aprobado",    className: "bg-green-500/15 text-green-400 border border-green-500/30" },
    rejected: { label: "Rechazado",   className: "bg-red-500/15 text-red-400 border border-red-500/30" },
  };
  const { label, className } = map[status] ?? map.pending;
  return <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${className}`}>{label}</span>;
}

const Admin = () => {
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
  const [activeTab, setActiveTab] = useState<"products" | "orders" | "clients">("products");

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

  // ── Edición inline de clientes ──
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
      setClients((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...edits } : c))
      );
      setEditingClients((prev) => { const { [id]: _, ...rest } = prev; return rest; });
    }
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

  return (
    <Layout>
      <section className="min-h-[calc(100vh-96px)] py-10 lg:py-14">
        <div className="container mx-auto px-4 lg:px-8">

          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Panel Admin</h1>
            <button onClick={() => { fetchProducts(); fetchOrders(); fetchClients(); }}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition">
              <RefreshCw size={14} /> Actualizar
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border/40 mb-8">
            {[
              { id: "products", label: `Productos (${products.length})` },
              { id: "orders",   label: `Pedidos (${orders.length})` },
              { id: "clients",  label: `Clientes (${clients.length})` },
            ].map(({ id, label }) => (
              <button key={id} onClick={() => setActiveTab(id as any)}
                className={`px-5 py-2.5 text-sm font-medium border-b-2 transition ${
                  activeTab === id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}>
                {label}
              </button>
            ))}
          </div>

          {/* ── PRODUCTOS ── */}
          {activeTab === "products" && (
            <div className="space-y-8">
              <div className="grid md:grid-cols-2 gap-8">
                <div className="card-enterprise rounded-xl p-6">
                  <ProductForm onAdd={(p) => { setProducts((prev) => [p, ...prev]); }} />
                </div>
                <div className="card-enterprise rounded-xl p-6">
                  <ProductImport onImport={(r) => { setImportResult(r); fetchProducts(); }} />
                  {importResult && (
                    <div className="mt-4 text-sm">
                      <span className="text-green-500 font-semibold">Importados: {importResult.imported}</span>
                      {importResult.errors.length > 0 && (
                        <ul className="text-red-500 mt-1 space-y-0.5">
                          {importResult.errors.map((e, i) => <li key={i}>• {e}</li>)}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {loadingProducts ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 bg-secondary/40 rounded-lg animate-pulse" />)}
                </div>
              ) : (
                <div className="rounded-xl border border-border/40 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/50">
                      <tr>
                        {["Nombre", "SKU", "Precio costo", "Categoría", "Stock", "Estado", ""].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((p) => (
                        <tr key={p.id} className="border-t border-border/20 hover:bg-secondary/20 transition">
                          <td className="px-4 py-3 font-medium">{p.name}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{p.sku || "—"}</td>
                          <td className="px-4 py-3">${p.cost_price.toLocaleString()}</td>
                          <td className="px-4 py-3 text-muted-foreground">{p.category}</td>
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
                              className="text-muted-foreground hover:text-red-400 transition">
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
            <div className="grid lg:grid-cols-2 gap-6">
              <div>
                {loadingOrders ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-secondary/40 rounded-xl animate-pulse" />)}
                  </div>
                ) : orders.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground text-sm">No hay pedidos todavía.</div>
                ) : (
                  <div className="space-y-3">
                    {orders.map((order) => (
                      <div
                        key={order.id}
                        onClick={() => setSelectedOrder(order)}
                        className={`card-enterprise rounded-xl p-4 cursor-pointer transition hover:border-primary/40 ${
                          selectedOrder?.id === order.id ? "border-primary/60" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground font-mono">#{String(order.id).slice(-8)}</span>
                          <StatusBadge status={order.status} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-xs text-muted-foreground">{order.products?.length} items</span>
                          <span className="font-bold text-foreground">${order.total.toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedOrder && (
                <div className="card-enterprise rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold">Pedido #{String(selectedOrder.id).slice(-8)}</h3>
                    <StatusBadge status={selectedOrder.status} />
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">
                    {new Date(selectedOrder.created_at).toLocaleDateString("es-AR", { dateStyle: "full" })}
                  </p>

                  <table className="w-full text-sm mb-4">
                    <thead>
                      <tr className="border-b border-border/40">
                        <th className="pb-2 text-left text-xs text-muted-foreground font-medium">Producto</th>
                        <th className="pb-2 text-center text-xs text-muted-foreground font-medium">Cant.</th>
                        <th className="pb-2 text-right text-xs text-muted-foreground font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.products?.map((p: any, i: number) => (
                        <tr key={i} className="border-b border-border/20">
                          <td className="py-2">{p.name}</td>
                          <td className="py-2 text-center text-muted-foreground">{p.quantity}</td>
                          <td className="py-2 text-right font-semibold">${p.total_price?.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="flex justify-between font-bold text-base mb-5">
                    <span>Total</span>
                    <span className="text-primary">${selectedOrder.total.toLocaleString()}</span>
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
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Editá el tipo y margen de cada cliente. Al cambiar el tipo se sugiere el margen por defecto, pero podés ajustarlo manualmente.
              </p>

              {loadingClients ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 bg-secondary/40 rounded-xl animate-pulse" />)}
                </div>
              ) : clients.length === 0 ? (
                <div className="flex flex-col items-center py-16 text-muted-foreground text-sm gap-2">
                  <Users size={36} className="opacity-30" />
                  <p>No hay clientes registrados todavía.</p>
                </div>
              ) : (
                <div className="rounded-xl border border-border/40 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/50">
                      <tr>
                        {["Empresa", "Contacto", "Tipo", "Margen %", ""].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{h}</th>
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
                          <tr key={client.id} className="border-t border-border/20 hover:bg-secondary/10 transition">
                            <td className="px-4 py-3 font-medium">{client.company_name || "—"}</td>
                            <td className="px-4 py-3 text-muted-foreground text-xs">{client.contact_name || "—"}</td>

                            {/* Tipo */}
                            <td className="px-4 py-3">
                              {isEditing ? (
                                <select
                                  value={currentType}
                                  onChange={(e) => applyTypeMargin(client.id, e.target.value as ClientType)}
                                  className="bg-background border border-border rounded-lg px-2 py-1 text-xs outline-none focus:border-primary"
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
                                    className="w-16 bg-background border border-border rounded-lg px-2 py-1 text-xs outline-none focus:border-primary text-center"
                                  />
                                  <span className="text-xs text-muted-foreground">%</span>
                                </div>
                              ) : (
                                <span className="font-semibold text-primary">{client.default_margin}%</span>
                              )}
                            </td>

                            {/* Acciones */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {isEditing ? (
                                  <>
                                    <button
                                      onClick={() => saveClient(client.id)}
                                      disabled={savingClient === client.id}
                                      className="flex items-center gap-1 text-xs bg-primary text-primary-foreground px-2.5 py-1 rounded-lg font-semibold disabled:opacity-50 transition hover:opacity-90"
                                    >
                                      <Save size={12} />
                                      {savingClient === client.id ? "Guardando..." : "Guardar"}
                                    </button>
                                    <button
                                      onClick={() => setEditingClients((prev) => { const { [client.id]: _, ...rest } = prev; return rest; })}
                                      className="text-xs text-muted-foreground hover:text-foreground transition px-2 py-1"
                                    >
                                      Cancelar
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    onClick={() => startEdit(client)}
                                    className="text-xs text-muted-foreground hover:text-foreground transition px-2 py-1 rounded-lg hover:bg-secondary"
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

        </div>
      </section>
    </Layout>
  );
};

export default Admin;
