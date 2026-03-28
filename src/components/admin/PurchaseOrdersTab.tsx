import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  ShoppingBag, Plus, ChevronDown, ChevronUp, Send, CheckCircle2,
  XCircle, Clock, RefreshCw, Trash2, Save, X, Package, AlertTriangle,
} from "lucide-react";

interface Props { isDark?: boolean }

interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: string;
  supplier_name?: string;
  status: "draft" | "sent" | "partial" | "received" | "cancelled";
  items: POItem[];
  subtotal: number;
  notes: string | null;
  expected_date: string | null;
  received_at: string | null;
  created_at: string;
}

interface POItem {
  product_id: number;
  product_name: string;
  sku: string;
  qty_ordered: number;
  unit_cost: number;
}

interface SupplierOption { id: string; name: string }
interface ProductOption { id: number; name: string; sku: string; cost_price: number }

const STATUS_CONFIG = {
  draft:     { label: "Borrador",   cls: "bg-gray-500/15 text-gray-400 border-gray-500/30",     icon: Clock },
  sent:      { label: "Enviada",    cls: "bg-blue-500/15 text-blue-400 border-blue-500/30",      icon: Send },
  partial:   { label: "Parcial",    cls: "bg-amber-500/15 text-amber-400 border-amber-500/30",   icon: AlertTriangle },
  received:  { label: "Recibida",   cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: CheckCircle2 },
  cancelled: { label: "Cancelada",  cls: "bg-red-500/15 text-red-400 border-red-500/30",         icon: XCircle },
};

const EMPTY_ITEM: POItem = { product_id: 0, product_name: "", sku: "", qty_ordered: 1, unit_cost: 0 };

export function PurchaseOrdersTab({ isDark = true }: Props) {
  const dk = (d: string, l: string) => (isDark ? d : l);

  const [orders, setOrders]         = useState<PurchaseOrder[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filterStatus, setFilter]   = useState<string>("all");
  const [expandedId, setExpanded]   = useState<string | null>(null);
  const [suppliers, setSuppliers]   = useState<SupplierOption[]>([]);
  const [products, setProducts]     = useState<ProductOption[]>([]);
  const [showNew, setShowNew]       = useState(false);
  const [actionLoading, setAction]  = useState<string | null>(null);

  // New PO form
  const [newForm, setNewForm] = useState({
    supplier_id: "",
    expected_date: "",
    notes: "",
    items: [{ ...EMPTY_ITEM }] as POItem[],
  });
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("purchase_orders")
      .select("*, suppliers(name)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (filterStatus !== "all") query = query.eq("status", filterStatus);
    const { data } = await query;
    setOrders(
      (data ?? []).map((o: any) => ({
        ...o,
        supplier_name: o.suppliers?.name,
      }))
    );
    setLoading(false);
  }, [filterStatus]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    supabase.from("suppliers").select("id, name").eq("active", true).order("name")
      .then(({ data }) => setSuppliers((data ?? []) as SupplierOption[]));
    supabase.from("products").select("id, name, sku, cost_price").eq("active", true).order("name").limit(500)
      .then(({ data }) => setProducts((data ?? []) as ProductOption[]));
  }, []);

  // ── Form helpers ────────────────────────────────────────────────────────────
  function addItem() {
    setNewForm((p) => ({ ...p, items: [...p.items, { ...EMPTY_ITEM }] }));
  }

  function removeItem(i: number) {
    setNewForm((p) => ({ ...p, items: p.items.filter((_, idx) => idx !== i) }));
  }

  function updateItem(i: number, field: keyof POItem, value: string | number) {
    setNewForm((p) => {
      const items = p.items.map((it, idx) => idx === i ? { ...it, [field]: value } : it);
      return { ...p, items };
    });
  }

  function pickProduct(i: number, productId: number) {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;
    setNewForm((p) => {
      const items = p.items.map((it, idx) =>
        idx === i
          ? { ...it, product_id: prod.id, product_name: prod.name, sku: prod.sku, unit_cost: prod.cost_price }
          : it
      );
      return { ...p, items };
    });
  }

  const subtotal = newForm.items.reduce((s, it) => s + (it.qty_ordered * it.unit_cost), 0);

  async function createPO() {
    setCreateError("");
    if (!newForm.supplier_id) { setCreateError("Seleccioná un proveedor."); return; }
    const validItems = newForm.items.filter((it) => it.product_id && it.qty_ordered > 0);
    if (!validItems.length) { setCreateError("Agregá al menos un producto."); return; }
    setSaving(true);
    const { error } = await supabase.from("purchase_orders").insert({
      supplier_id:   newForm.supplier_id,
      expected_date: newForm.expected_date || null,
      notes:         newForm.notes || null,
      items:         validItems,
      subtotal,
    });
    if (error) { setCreateError(error.message); setSaving(false); return; }
    setShowNew(false);
    setNewForm({ supplier_id: "", expected_date: "", notes: "", items: [{ ...EMPTY_ITEM }] });
    setSaving(false);
    load();
  }

  // ── Status transitions ──────────────────────────────────────────────────────
  async function updateStatus(poId: string, status: string) {
    setAction(poId + status);
    await supabase.from("purchase_orders").update({ status }).eq("id", poId);
    setOrders((prev) => prev.map((o) => o.id === poId ? { ...o, status: status as any } : o));
    setAction(null);
  }

  async function receiveOrder(poId: string) {
    if (!confirm("¿Confirmar recepción? Esto actualizará el stock de los productos.")) return;
    setAction(poId + "receive");
    const { error } = await supabase.rpc("receive_purchase_order", { p_po_id: poId });
    if (error) alert(error.message);
    else load();
    setAction(null);
  }

  async function deleteOrder(poId: string) {
    if (!confirm("¿Eliminar esta orden de compra?")) return;
    await supabase.from("purchase_orders").delete().eq("id", poId);
    setOrders((prev) => prev.filter((o) => o.id !== poId));
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className={`text-base font-bold ${dk("text-white", "text-[#171717]")}`}>Órdenes de Compra</h2>
          <p className="text-xs text-gray-500 mt-0.5">{orders.length} órdenes</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilter(e.target.value)}
            className={`border rounded-lg px-2 py-1.5 text-xs outline-none ${dk("bg-[#111] border-[#2a2a2a] text-gray-300", "bg-white border-[#e5e5e5] text-[#525252]")}`}
          >
            <option value="all">Todos los estados</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <button onClick={load} className={`p-2 rounded-lg transition ${dk("text-gray-500 hover:text-white hover:bg-[#1c1c1c]", "text-[#737373] hover:text-[#171717] hover:bg-[#e8e8e8]")}`}>
            <RefreshCw size={13} />
          </button>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 text-xs bg-[#2D9F6A] hover:bg-[#25875a] text-white px-3 py-2 rounded-lg transition"
          >
            <Plus size={12} /> Nueva OC
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`h-14 rounded-xl animate-pulse ${dk("bg-[#111]", "bg-white")}`} />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className={`border rounded-xl py-16 text-center text-sm text-gray-500 ${dk("border-[#1f1f1f]", "border-[#e5e5e5]")}`}>
          No hay órdenes de compra.
        </div>
      ) : (
        <div className={`border rounded-xl overflow-hidden ${dk("border-[#1f1f1f]", "border-[#e5e5e5]")}`}>
          {orders.map((po, idx) => {
            const isExpanded = expandedId === po.id;
            const cfg = STATUS_CONFIG[po.status];

            return (
              <div key={po.id} className={idx > 0 ? `border-t ${dk("border-[#1a1a1a]", "border-[#f0f0f0]")}` : ""}>
                {/* Row */}
                <div
                  onClick={() => setExpanded(isExpanded ? null : po.id)}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition ${dk("hover:bg-[#0f0f0f]", "hover:bg-[#fafafa]")} ${isExpanded ? dk("bg-[#0f0f0f]", "bg-[#fafafa]") : ""}`}
                >
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${dk("bg-[#1a1a1a]", "bg-[#f0f0f0]")}`}>
                    <ShoppingBag size={13} className="text-[#2D9F6A]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-bold font-mono ${dk("text-white", "text-[#171717]")}`}>{po.po_number}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.cls}`}>
                        <cfg.icon size={9} /> {cfg.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500">
                      {po.supplier_name} · {po.items?.length ?? 0} ítems
                      {po.expected_date && ` · Llega ${new Date(po.expected_date).toLocaleDateString("es-AR")}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-xs font-bold ${dk("text-white", "text-[#171717]")}`}>{fmt(po.subtotal)}</p>
                    <p className="text-[11px] text-gray-500">{new Date(po.created_at).toLocaleDateString("es-AR")}</p>
                  </div>
                  {isExpanded ? <ChevronUp size={13} className="text-gray-500 shrink-0" /> : <ChevronDown size={13} className="text-gray-500 shrink-0" />}
                </div>

                {/* Detail */}
                {isExpanded && (
                  <div className={`border-t px-4 py-4 space-y-4 ${dk("border-[#1a1a1a] bg-[#080808]", "border-[#f0f0f0] bg-[#fafafa]")}`}>
                    {/* Items table */}
                    {po.items?.length > 0 && (
                      <div className="space-y-1">
                        <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${dk("text-gray-500", "text-[#a3a3a3]")}`}>Ítems</p>
                        <div className={`grid grid-cols-[1fr_60px_80px_90px_90px] gap-2 text-[10px] font-bold uppercase tracking-wider pb-1 ${dk("text-gray-600", "text-[#b4b4b4]")}`}>
                          <span>Producto</span><span>SKU</span><span className="text-center">Cant.</span><span className="text-right">Costo u.</span><span className="text-right">Total</span>
                        </div>
                        {po.items.map((item, i) => (
                          <div key={i} className={`grid grid-cols-[1fr_60px_80px_90px_90px] gap-2 items-center py-1 border-t ${dk("border-[#1a1a1a]", "border-[#f0f0f0]")}`}>
                            <span className={`text-xs truncate ${dk("text-gray-300", "text-[#525252]")}`}>{item.product_name}</span>
                            <span className={`text-[10px] font-mono ${dk("text-gray-500", "text-[#737373]")}`}>{item.sku}</span>
                            <span className={`text-xs text-center ${dk("text-gray-400", "text-[#737373]")}`}>{item.qty_ordered}</span>
                            <span className={`text-xs text-right font-mono ${dk("text-gray-400", "text-[#737373]")}`}>{fmt(item.unit_cost)}</span>
                            <span className={`text-xs text-right font-mono font-bold ${dk("text-white", "text-[#171717]")}`}>{fmt(item.qty_ordered * item.unit_cost)}</span>
                          </div>
                        ))}
                        <div className={`flex justify-end pt-1 border-t ${dk("border-[#1f1f1f]", "border-[#e5e5e5]")}`}>
                          <span className={`text-xs font-bold ${dk("text-white", "text-[#171717]")}`}>Total: {fmt(po.subtotal)}</span>
                        </div>
                      </div>
                    )}
                    {po.notes && (
                      <p className={`text-[11px] italic ${dk("text-gray-500", "text-[#737373]")}`}>{po.notes}</p>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {po.status === "draft" && (
                        <>
                          <button
                            onClick={() => updateStatus(po.id, "sent")}
                            disabled={actionLoading === po.id + "sent"}
                            className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition"
                          >
                            <Send size={11} /> Marcar enviada
                          </button>
                          <button
                            onClick={() => deleteOrder(po.id)}
                            className={`flex items-center gap-1 text-xs border px-3 py-1.5 rounded-lg transition ${dk("border-[#2a2a2a] text-gray-500 hover:text-red-400 hover:border-red-400/30", "border-[#e5e5e5] text-[#737373] hover:text-red-500 hover:border-red-400/30")}`}
                          >
                            <Trash2 size={11} /> Eliminar
                          </button>
                        </>
                      )}
                      {(po.status === "sent" || po.status === "partial") && (
                        <>
                          <button
                            onClick={() => receiveOrder(po.id)}
                            disabled={actionLoading === po.id + "receive"}
                            className="flex items-center gap-1 text-xs bg-[#2D9F6A] hover:bg-[#25875a] disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition ml-auto"
                          >
                            <CheckCircle2 size={11} />
                            {actionLoading === po.id + "receive" ? "Procesando…" : "Confirmar recepción"}
                          </button>
                          <button
                            onClick={() => updateStatus(po.id, "cancelled")}
                            className={`flex items-center gap-1 text-xs border px-3 py-1.5 rounded-lg transition ${dk("border-[#2a2a2a] text-gray-500 hover:text-red-400 hover:border-red-400/30", "border-[#e5e5e5] text-[#737373] hover:text-red-500")}`}
                          >
                            <XCircle size={11} /> Cancelar
                          </button>
                        </>
                      )}
                      {po.status === "received" && (
                        <span className="flex items-center gap-1 text-xs text-emerald-400">
                          <CheckCircle2 size={11} />
                          Recibida {po.received_at ? new Date(po.received_at).toLocaleDateString("es-AR") : ""}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New PO modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className={`border rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
            <div className={`flex items-center justify-between px-6 py-4 border-b shrink-0 ${dk("border-[#1a1a1a]", "border-[#e5e5e5]")}`}>
              <h3 className={`font-bold text-sm ${dk("text-white", "text-[#171717]")}`}>Nueva Orden de Compra</h3>
              <button onClick={() => setShowNew(false)} className="text-gray-500 hover:text-gray-300 transition">
                <X size={16} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
              {/* Supplier + date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`text-xs mb-1 block ${dk("text-gray-400", "text-[#737373]")}`}>Proveedor *</label>
                  <select
                    value={newForm.supplier_id}
                    onChange={(e) => setNewForm((p) => ({ ...p, supplier_id: e.target.value }))}
                    className={`w-full border rounded-lg px-3 py-2 text-xs outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717]")}`}
                  >
                    <option value="">Seleccionar…</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={`text-xs mb-1 block ${dk("text-gray-400", "text-[#737373]")}`}>Fecha estimada de llegada</label>
                  <input
                    type="date"
                    value={newForm.expected_date}
                    onChange={(e) => setNewForm((p) => ({ ...p, expected_date: e.target.value }))}
                    className={`w-full border rounded-lg px-3 py-2 text-xs outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717]")}`}
                  />
                </div>
              </div>

              {/* Items */}
              <div>
                <div className={`grid grid-cols-[1fr_90px_80px_70px] gap-2 text-[10px] font-bold uppercase tracking-wider mb-1 ${dk("text-gray-500", "text-[#a3a3a3]")}`}>
                  <span>Producto</span><span>Costo unit.</span><span>Cantidad</span><span></span>
                </div>
                {newForm.items.map((item, i) => (
                  <div key={i} className="grid grid-cols-[1fr_90px_80px_70px] gap-2 mb-2">
                    <select
                      value={item.product_id || ""}
                      onChange={(e) => pickProduct(i, Number(e.target.value))}
                      className={`border rounded-lg px-2 py-1.5 text-xs outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717]")}`}
                    >
                      <option value="">Producto…</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                    </select>
                    <input
                      type="number"
                      placeholder="Costo"
                      value={item.unit_cost || ""}
                      onChange={(e) => updateItem(i, "unit_cost", Number(e.target.value))}
                      className={`border rounded-lg px-2 py-1.5 text-xs outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717]")}`}
                    />
                    <input
                      type="number"
                      min={1}
                      value={item.qty_ordered}
                      onChange={(e) => updateItem(i, "qty_ordered", Number(e.target.value))}
                      className={`border rounded-lg px-2 py-1.5 text-xs outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717]")}`}
                    />
                    <button
                      onClick={() => removeItem(i)}
                      disabled={newForm.items.length === 1}
                      className="text-gray-500 hover:text-red-400 transition disabled:opacity-30 flex items-center justify-center"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={addItem}
                  className={`flex items-center gap-1 text-xs transition px-3 py-1.5 rounded-lg border ${dk("border-[#2a2a2a] text-gray-500 hover:text-white hover:border-[#3a3a3a]", "border-[#e5e5e5] text-[#737373] hover:text-[#171717] hover:border-[#d4d4d4]")}`}
                >
                  <Plus size={11} /> Agregar ítem
                </button>
              </div>

              {/* Subtotal */}
              <div className={`flex justify-end text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>
                Subtotal: {new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(subtotal)}
              </div>

              {/* Notes */}
              <div>
                <label className={`text-xs mb-1 block ${dk("text-gray-400", "text-[#737373]")}`}>Notas</label>
                <textarea
                  value={newForm.notes}
                  onChange={(e) => setNewForm((p) => ({ ...p, notes: e.target.value }))}
                  rows={2}
                  className={`w-full border rounded-lg px-3 py-2 text-xs outline-none resize-none ${dk("bg-[#0d0d0d] border-[#262626] text-white placeholder:text-[#444]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] placeholder:text-[#b4b4b4]")}`}
                  placeholder="Referencia, condiciones, etc."
                />
              </div>

              {createError && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{createError}</p>
              )}
            </div>

            <div className={`flex justify-end gap-2 px-6 py-4 border-t shrink-0 ${dk("border-[#1a1a1a]", "border-[#e5e5e5]")}`}>
              <button onClick={() => setShowNew(false)} className="text-xs text-gray-500 hover:text-gray-300 px-3 py-2 transition">
                Cancelar
              </button>
              <button
                onClick={createPO}
                disabled={saving}
                className="flex items-center gap-1.5 text-xs bg-[#2D9F6A] hover:bg-[#25875a] disabled:opacity-50 text-white px-4 py-2 rounded-lg transition"
              >
                <Save size={11} /> {saving ? "Creando…" : "Crear OC"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
