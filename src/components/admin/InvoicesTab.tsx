import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  FileText, CheckCircle2, Clock, Send, DollarSign,
  AlertTriangle, XCircle, ChevronDown, Plus, RefreshCw, X,
} from "lucide-react";
import {
  fetchInvoices,
  markInvoicePaid,
  sendInvoice,
  createInvoiceFromOrder,
  type Invoice,
  type InvoiceStatus,
} from "@/lib/api/invoices";

interface Props { isDark?: boolean }

interface OrderOption {
  id: number;
  order_number: string;
  client_name: string;
  total: number;
}

const STATUS_MAP: Record<InvoiceStatus, { label: string; icon: any; cls: string }> = {
  draft:     { label: "Borrador",   icon: Clock,         cls: "bg-gray-500/15 text-gray-400 border-gray-500/30" },
  sent:      { label: "Enviada",    icon: Send,          cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  paid:      { label: "Pagada",     icon: CheckCircle2,  cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  overdue:   { label: "Vencida",    icon: AlertTriangle, cls: "bg-red-500/15 text-red-400 border-red-500/30" },
  cancelled: { label: "Cancelada",  icon: XCircle,       cls: "bg-gray-500/15 text-gray-400 border-gray-400/30" },
};

function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const { label, icon: Icon, cls } = STATUS_MAP[status] ?? STATUS_MAP.draft;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cls}`}>
      <Icon size={10} /> {label}
    </span>
  );
}

export function InvoicesTab({ isDark = true }: Props) {
  const dk = (d: string, l: string) => (isDark ? d : l);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filterStatus, setFilterStatus] = useState<InvoiceStatus | "all">("all");
  const [clientMap, setClientMap] = useState<Record<string, string>>({});

  // create-from-order modal
  const [showCreate, setShowCreate] = useState(false);
  const [orders, setOrders]         = useState<OrderOption[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [createForm, setCreateForm] = useState({
    orderId: "" as string,
    dueDays: 30,
    currency: "ARS" as "ARS" | "USD",
    exchangeRate: "" as string,
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // selected invoice detail
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchInvoices(filterStatus !== "all" ? { status: filterStatus } : {});
    setInvoices(data);
    setLoading(false);
  }, [filterStatus]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    // Fetch client names for display
    supabase.from("profiles").select("id, company_name, contact_name")
      .then(({ data }) => {
        const map: Record<string, string> = {};
        (data ?? []).forEach((p: any) => { map[p.id] = p.company_name || p.contact_name || p.id; });
        setClientMap(map);
      });
  }, []);

  async function openCreate() {
    setShowCreate(true);
    setCreateError("");
    setCreateForm({ orderId: "", dueDays: 30, currency: "ARS", exchangeRate: "" });
    setLoadingOrders(true);
    // Only orders that don't already have an invoice
    const { data } = await supabase
      .from("orders")
      .select("id, order_number, client_id, total, profiles(company_name, contact_name)")
      .not("status", "in", '("rejected","cancelled")')
      .order("created_at", { ascending: false })
      .limit(100);
    setOrders(
      (data ?? []).map((o: any) => ({
        id: o.id,
        order_number: o.order_number ?? `#${String(o.id).slice(-6)}`,
        client_name:  o.profiles?.company_name || o.profiles?.contact_name || o.client_id,
        total:        o.total,
      }))
    );
    setLoadingOrders(false);
  }

  async function handleCreate() {
    if (!createForm.orderId) { setCreateError("Seleccioná un pedido."); return; }
    setCreating(true);
    setCreateError("");
    try {
      await createInvoiceFromOrder(Number(createForm.orderId), {
        dueDays:      createForm.dueDays,
        currency:     createForm.currency,
        exchangeRate: createForm.exchangeRate ? Number(createForm.exchangeRate) : undefined,
      });
      setShowCreate(false);
      load();
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : "Error al crear factura.");
    } finally {
      setCreating(false);
    }
  }

  async function handleMarkPaid(invoiceId: string) {
    setActionLoading(invoiceId + "-paid");
    await markInvoicePaid(invoiceId);
    setActionLoading(null);
    load();
  }

  async function handleSend(invoiceId: string) {
    setActionLoading(invoiceId + "-send");
    await sendInvoice(invoiceId);
    setActionLoading(null);
    load();
  }

  const fmt = (n: number, cur: "ARS" | "USD") =>
    new Intl.NumberFormat("es-AR", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n);

  const selectedInvoice = invoices.find((i) => i.id === selectedId);

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className={`text-base font-bold ${dk("text-white", "text-[#171717]")}`}>Facturación</h2>
          <p className="text-xs text-gray-500 mt-0.5">{invoices.length} facturas</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className={`border rounded-lg px-2 py-1.5 text-xs outline-none ${dk("bg-[#111] border-[#2a2a2a] text-gray-300", "bg-white border-[#e5e5e5] text-[#525252]")}`}
          >
            <option value="all">Todos los estados</option>
            {(Object.keys(STATUS_MAP) as InvoiceStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_MAP[s].label}</option>
            ))}
          </select>
          <button
            onClick={load}
            className={`p-2 rounded-lg transition ${dk("text-gray-500 hover:text-white hover:bg-[#1c1c1c]", "text-[#737373] hover:text-[#171717] hover:bg-[#e8e8e8]")}`}
          >
            <RefreshCw size={13} />
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 text-xs bg-[#2D9F6A] hover:bg-[#25875a] text-white px-3 py-2 rounded-lg transition"
          >
            <Plus size={12} /> Nueva factura
          </button>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Invoice list */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className={`h-16 rounded-xl animate-pulse ${dk("bg-[#111]", "bg-white")}`} />
              ))}
            </div>
          ) : invoices.length === 0 ? (
            <div className={`border rounded-xl py-16 text-center text-sm text-gray-500 ${dk("border-[#1f1f1f]", "border-[#e5e5e5]")}`}>
              No hay facturas.
            </div>
          ) : (
            <div className={`border rounded-xl overflow-hidden ${dk("border-[#1f1f1f]", "border-[#e5e5e5]")}`}>
              {invoices.map((inv, idx) => {
                const clientName = inv.client_snapshot?.company_name
                  || clientMap[inv.client_id]
                  || inv.client_id.slice(0, 8);
                const isSelected = selectedId === inv.id;

                return (
                  <div
                    key={inv.id}
                    onClick={() => setSelectedId(isSelected ? null : inv.id)}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition ${idx > 0 ? `border-t ${dk("border-[#1a1a1a]", "border-[#f0f0f0]")}` : ""} ${
                      isSelected
                        ? dk("bg-[#111]", "bg-[#f0faf5]")
                        : dk("hover:bg-[#0f0f0f]", "hover:bg-[#fafafa]")
                    }`}
                  >
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${dk("bg-[#1a1a1a]", "bg-[#f0f0f0]")}`}>
                      <FileText size={13} className="text-[#2D9F6A]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold font-mono ${dk("text-white", "text-[#171717]")}`}>{inv.invoice_number}</span>
                        <InvoiceStatusBadge status={inv.status} />
                      </div>
                      <p className="text-[11px] text-gray-500 truncate">{clientName}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-xs font-bold ${dk("text-white", "text-[#171717]")}`}>
                        {fmt(inv.total, inv.currency)}
                      </p>
                      {inv.due_date && (
                        <p className="text-[11px] text-gray-500">
                          Vence {new Date(inv.due_date).toLocaleDateString("es-AR")}
                        </p>
                      )}
                    </div>
                    <ChevronDown size={13} className={`text-gray-500 shrink-0 transition-transform ${isSelected ? "rotate-180" : ""}`} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selectedInvoice && (
          <div className={`w-72 shrink-0 border rounded-xl p-4 space-y-3 self-start ${dk("border-[#1f1f1f] bg-[#0d0d0d]", "border-[#e5e5e5] bg-white")}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className={`text-xs font-bold font-mono ${dk("text-white", "text-[#171717]")}`}>{selectedInvoice.invoice_number}</p>
                <InvoiceStatusBadge status={selectedInvoice.status} />
              </div>
              <button onClick={() => setSelectedId(null)} className="text-gray-500 hover:text-gray-300 transition">
                <X size={14} />
              </button>
            </div>

            <div className="space-y-1.5">
              {[
                { label: "Cliente", value: selectedInvoice.client_snapshot?.company_name || clientMap[selectedInvoice.client_id] || "—" },
                { label: "Contacto", value: selectedInvoice.client_snapshot?.contact_name || "—" },
                { label: "Moneda", value: selectedInvoice.currency },
                { label: "Subtotal", value: fmt(selectedInvoice.subtotal, selectedInvoice.currency) },
                { label: "IVA", value: fmt(selectedInvoice.iva_total, selectedInvoice.currency) },
                { label: "Total", value: fmt(selectedInvoice.total, selectedInvoice.currency), bold: true },
                { label: "Vencimiento", value: selectedInvoice.due_date ? new Date(selectedInvoice.due_date).toLocaleDateString("es-AR") : "—" },
                { label: "Pagada", value: selectedInvoice.paid_at ? new Date(selectedInvoice.paid_at).toLocaleDateString("es-AR") : "—" },
                { label: "Creada", value: new Date(selectedInvoice.created_at).toLocaleDateString("es-AR") },
              ].map(({ label, value, bold }) => (
                <div key={label} className="flex justify-between gap-2">
                  <span className="text-[11px] text-gray-500">{label}</span>
                  <span className={`text-[11px] text-right ${bold ? `font-bold ${dk("text-white", "text-[#171717]")}` : dk("text-gray-300", "text-[#525252]")}`}>
                    {value}
                  </span>
                </div>
              ))}
            </div>

            {selectedInvoice.notes && (
              <p className={`text-[11px] italic ${dk("text-gray-500", "text-[#737373]")}`}>{selectedInvoice.notes}</p>
            )}

            {/* Actions */}
            <div className="space-y-1.5 pt-1">
              {selectedInvoice.status === "draft" && (
                <button
                  onClick={() => handleSend(selectedInvoice.id)}
                  disabled={actionLoading === selectedInvoice.id + "-send"}
                  className="w-full flex items-center justify-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-2 rounded-lg transition"
                >
                  <Send size={11} /> Marcar como enviada
                </button>
              )}
              {(selectedInvoice.status === "sent" || selectedInvoice.status === "overdue") && (
                <button
                  onClick={() => handleMarkPaid(selectedInvoice.id)}
                  disabled={actionLoading === selectedInvoice.id + "-paid"}
                  className="w-full flex items-center justify-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-3 py-2 rounded-lg transition"
                >
                  <DollarSign size={11} /> Marcar como pagada
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create from order modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className={`border rounded-2xl w-full max-w-md shadow-2xl ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
            <div className={`flex items-center justify-between px-6 py-4 border-b ${dk("border-[#1a1a1a]", "border-[#e5e5e5]")}`}>
              <h3 className={`font-bold text-sm ${dk("text-white", "text-[#171717]")}`}>Nueva Factura desde Pedido</h3>
              <button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-gray-300 transition">
                <X size={16} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className={`text-xs mb-1 block ${dk("text-gray-400", "text-[#737373]")}`}>Pedido *</label>
                {loadingOrders ? (
                  <div className="text-xs text-gray-500">Cargando pedidos…</div>
                ) : (
                  <select
                    value={createForm.orderId}
                    onChange={(e) => setCreateForm((p) => ({ ...p, orderId: e.target.value }))}
                    className={`w-full border rounded-lg px-3 py-2 text-xs outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717]")}`}
                  >
                    <option value="">Seleccioná un pedido…</option>
                    {orders.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.order_number} — {o.client_name} — {fmt(o.total, "ARS")}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`text-xs mb-1 block ${dk("text-gray-400", "text-[#737373]")}`}>Vence en (días)</label>
                  <input
                    type="number"
                    value={createForm.dueDays}
                    onChange={(e) => setCreateForm((p) => ({ ...p, dueDays: Number(e.target.value) }))}
                    className={`w-full border rounded-lg px-3 py-2 text-xs outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717]")}`}
                  />
                </div>
                <div>
                  <label className={`text-xs mb-1 block ${dk("text-gray-400", "text-[#737373]")}`}>Moneda</label>
                  <select
                    value={createForm.currency}
                    onChange={(e) => setCreateForm((p) => ({ ...p, currency: e.target.value as "ARS" | "USD" }))}
                    className={`w-full border rounded-lg px-3 py-2 text-xs outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717]")}`}
                  >
                    <option value="ARS">ARS</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                {createForm.currency === "USD" && (
                  <div className="col-span-2">
                    <label className={`text-xs mb-1 block ${dk("text-gray-400", "text-[#737373]")}`}>Tipo de cambio (ARS/USD)</label>
                    <input
                      type="number"
                      value={createForm.exchangeRate}
                      onChange={(e) => setCreateForm((p) => ({ ...p, exchangeRate: e.target.value }))}
                      placeholder="Ej: 1250"
                      className={`w-full border rounded-lg px-3 py-2 text-xs outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717]")}`}
                    />
                  </div>
                )}
              </div>

              {createError && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{createError}</p>
              )}
            </div>
            <div className={`flex justify-end gap-2 px-6 py-4 border-t ${dk("border-[#1a1a1a]", "border-[#e5e5e5]")}`}>
              <button onClick={() => setShowCreate(false)} className="text-xs text-gray-500 hover:text-gray-300 px-3 py-2 transition">
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !createForm.orderId}
                className="flex items-center gap-1.5 text-xs bg-[#2D9F6A] hover:bg-[#25875a] disabled:opacity-50 text-white px-4 py-2 rounded-lg transition"
              >
                <FileText size={11} /> {creating ? "Creando…" : "Crear factura"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
