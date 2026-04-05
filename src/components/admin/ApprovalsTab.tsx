import { useEffect, useMemo, useState } from "react";
import { EmailNotificationService } from "@/lib/api/emailNotifications";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  FileText,
  MessageSquare,
  RefreshCw,
  Save,
  ShieldAlert,
  XCircle,
  UserPlus,
  Users,
  Mail,
  Check,
  X,
  BellRing,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fetchInvoices, type Invoice } from "@/lib/api/invoices";

interface OrderRow {
  id: string | number;
  client_id: string;
  total: number;
  status: string;
  order_number?: string;
  created_at: string;
}

interface ClientRow {
  id: string;
  company_name: string;
  contact_name: string;
  email?: string;
  phone?: string;
  estado?: string;
  cuit?: string;
  created_at?: string;
}

interface QuoteRow {
  id: number;
  client_id: string;
  total: number;
  status: string;
  created_at: string;
}

interface ClientRiskRow {
  id: string;
  estado: string;
  credit_limit: number;
  credit_used: number;
  max_order_value: number;
}

interface ApprovalLogRow {
  id: string;
  action: string;
  entity_id?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

interface ApprovalNoteRow {
  id: string;
  client_id: string;
  body: string;
  created_at: string;
}

interface ApprovalRuleConfig {
  orderAmountArs: number;
  quoteAmountArs: number;
  maxOverdueInvoices: number;
  maxCreditUsagePct: number;
}

interface ApprovalActionPayload {
  note?: string;
  approverLabel?: string;
  ruleReasons?: string[];
  requiresException?: boolean;
}

interface ApprovalsTabProps {
  isDark?: boolean;
  orders: OrderRow[];
  clients: ClientRow[];
  approverLabel?: string;
  onApproveOrder: (orderId: string, payload?: ApprovalActionPayload) => Promise<void> | void;
  onRejectOrder: (orderId: string, payload?: ApprovalActionPayload) => Promise<void> | void;
  onOpenTab: (tab: string) => void;
}

const DEFAULT_RULES: ApprovalRuleConfig = {
  orderAmountArs: 1500000,
  quoteAmountArs: 1000000,
  maxOverdueInvoices: 0,
  maxCreditUsagePct: 80,
};

const RULES_STORAGE_KEY = "admin_approval_rules_v1";

function readRules(): ApprovalRuleConfig {
  try {
    const raw = localStorage.getItem(RULES_STORAGE_KEY);
    if (!raw) return DEFAULT_RULES;
    return { ...DEFAULT_RULES, ...(JSON.parse(raw) as Partial<ApprovalRuleConfig>) };
  } catch {
    return DEFAULT_RULES;
  }
}

function fmtMoney(value: number) {
  return `$${Math.round(value).toLocaleString("es-AR")}`;
}

export function ApprovalsTab({
  isDark = true,
  orders,
  clients,
  approverLabel = "Admin",
  onApproveOrder,
  onRejectOrder,
  onOpenTab,
}: ApprovalsTabProps) {
  const dk = (d: string, l: string) => (isDark ? d : l);
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [overdueInvoices, setOverdueInvoices] = useState<Invoice[]>([]);
  const [clientRiskRows, setClientRiskRows] = useState<ClientRiskRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<ApprovalLogRow[]>([]);
  const [approvalNotes, setApprovalNotes] = useState<ApprovalNoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingRules, setSavingRules] = useState(false);
  const [rules, setRules] = useState<ApprovalRuleConfig>(() => readRules());
  const [orderNotes, setOrderNotes] = useState<Record<string, string>>({});
  const [quoteNotes, setQuoteNotes] = useState<Record<string, string>>({});

  const clientMap = useMemo(() => {
    const map: Record<string, string> = {};
    clients.forEach((client) => {
      map[client.id] = client.company_name || client.contact_name || client.id;
    });
    return map;
  }, [clients]);

  const riskMap = useMemo(() => {
    const map = new Map<string, ClientRiskRow>();
    clientRiskRows.forEach((row) => map.set(row.id, row));
    return map;
  }, [clientRiskRows]);

  const overdueByClient = useMemo(() => {
    const map = new Map<string, Invoice[]>();
    overdueInvoices.forEach((invoice) => {
      const current = map.get(invoice.client_id) ?? [];
      current.push(invoice);
      map.set(invoice.client_id, current);
    });
    return map;
  }, [overdueInvoices]);

  const [pendingAccounts, setPendingAccounts] = useState<ClientRow[]>([]);

  async function load() {
    setLoading(true);
    try {
      const [{ data: quoteRows }, invoiceRows, { data: riskRows }, { data: logs }, { data: notes }, { data: accounts }] = await Promise.all([
        supabase
          .from("quotes")
          .select("id, client_id, total, status, created_at")
          .in("status", ["sent", "viewed"])
          .order("created_at", { ascending: false })
          .limit(50),
        fetchInvoices({ status: "overdue", limit: 50 }),
        supabase
          .from("profiles")
          .select("id, estado, credit_limit, credit_used, max_order_value")
          .limit(200),
        supabase
          .from("activity_logs")
          .select("id, action, entity_id, metadata, created_at")
          .eq("action", "order_status_change")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("client_notes")
          .select("id, client_id, body, created_at")
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("profiles")
          .select("id, company_name, contact_name, email, phone, cuit, created_at, estado")
          .eq("estado", "pendiente")
          .order("created_at", { ascending: false }),
      ]);
      setQuotes((quoteRows as QuoteRow[] | null) ?? []);
      setOverdueInvoices(invoiceRows);
      setClientRiskRows((riskRows as ClientRiskRow[] | null) ?? []);
      setAuditLogs((logs as ApprovalLogRow[] | null) ?? []);
      setApprovalNotes(((notes as ApprovalNoteRow[] | null) ?? []).filter((note) => note.body.startsWith("[APPROVAL:")));
      setPendingAccounts((accounts as ClientRow[] | null) ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function saveRules() {
    setSavingRules(true);
    localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules));
    window.setTimeout(() => setSavingRules(false), 400);
  }

  function orderReasons(order: OrderRow) {
    const reasons: string[] = [];
    const risk = riskMap.get(order.client_id);
    const overdueCount = overdueByClient.get(order.client_id)?.length ?? 0;

    if (order.total >= rules.orderAmountArs) reasons.push(`Monto alto (${fmtMoney(order.total)})`);
    if (risk?.estado === "bloqueado") reasons.push("Cuenta bloqueada");
    if ((risk?.max_order_value ?? 0) > 0 && order.total > (risk?.max_order_value ?? 0)) reasons.push("Supera máximo por pedido");
    if ((risk?.credit_limit ?? 0) > 0) {
      const usagePct = ((risk?.credit_used ?? 0) / (risk?.credit_limit ?? 1)) * 100;
      if (usagePct >= rules.maxCreditUsagePct) reasons.push(`Crédito usado al ${Math.round(usagePct)}%`);
    }
    if (overdueCount > rules.maxOverdueInvoices) reasons.push(`${overdueCount} factura(s) vencida(s)`);

    return reasons;
  }

  function quoteReasons(quote: QuoteRow) {
    const reasons: string[] = [];
    const overdueCount = overdueByClient.get(quote.client_id)?.length ?? 0;
    const risk = riskMap.get(quote.client_id);

    if (quote.total >= rules.quoteAmountArs) reasons.push(`Monto alto (${fmtMoney(quote.total)})`);
    if (overdueCount > rules.maxOverdueInvoices) reasons.push(`${overdueCount} factura(s) vencida(s)`);
    if (risk?.estado === "bloqueado") reasons.push("Cuenta bloqueada");

    return reasons;
  }

  async function handleOrderDecision(order: OrderRow, status: "approved" | "rejected") {
    const reasons = orderReasons(order);
    const note = orderNotes[String(order.id)]?.trim();
    const payload: ApprovalActionPayload = {
      note,
      approverLabel,
      ruleReasons: reasons,
      requiresException: reasons.length > 0,
    };

    if (status === "approved") await onApproveOrder(String(order.id), payload);
    else await onRejectOrder(String(order.id), payload);

    setOrderNotes((prev) => ({ ...prev, [String(order.id)]: "" }));
    await load();
  }

  async function updateQuoteStatus(quote: QuoteRow, status: "approved" | "rejected") {
    const note = quoteNotes[String(quote.id)]?.trim();
    const reasons = quoteReasons(quote);
    const { error } = await supabase
      .from("quotes")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", quote.id);
    if (error) return;

    await supabase.from("client_notes").insert({
      client_id: quote.client_id,
      tipo: "seguimiento",
      body: `[APPROVAL:QUOTE:${status.toUpperCase()}] ${approverLabel} · ${reasons.join(", ") || "sin alertas"}${note ? ` · ${note}` : ""}`,
    });

    setQuoteNotes((prev) => ({ ...prev, [String(quote.id)]: "" }));
    await load();
  }

  // ── Corporate pending_approval orders (from buyers waiting for manager/admin) ──
  const [corporatePending, setCorporatePending] = useState<(OrderRow & { buyer_name?: string; b2b_role?: string; approval_threshold?: number })[]>([]);
  const [corporateLoading, setCorporateLoading] = useState(false);
  const [corporateNotes, setCorporateNotes] = useState<Record<string, string>>({});

  async function loadCorporatePending() {
    setCorporateLoading(true);
    const { data } = await supabase
      .from("orders")
      .select("id, client_id, total, status, order_number, created_at")
      .eq("status", "pending_approval")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) {
      const enriched = await Promise.all((data as OrderRow[]).map(async (o) => {
        const { data: prof } = await supabase
          .from("profiles")
          .select("company_name, contact_name, b2b_role, approval_threshold")
          .eq("id", o.client_id)
          .single();
        return { ...o, buyer_name: (prof as any)?.company_name || (prof as any)?.contact_name || o.client_id, b2b_role: (prof as any)?.b2b_role, approval_threshold: (prof as any)?.approval_threshold };
      }));
      setCorporatePending(enriched);
    }
    setCorporateLoading(false);
  }

  useEffect(() => { void loadCorporatePending(); }, []);

  async function approveCorporateOrder(orderId: string | number) {
    await supabase.rpc("approve_b2b_order", { p_order_id: String(orderId) });
    setCorporatePending(prev => prev.filter(o => String(o.id) !== String(orderId)));
    await load();
  }

  async function rejectCorporateOrder(orderId: string | number) {
    const note = corporateNotes[String(orderId)]?.trim();
    await supabase.from("orders").update({ status: "rejected" }).eq("id", orderId);
    if (note) await supabase.from("client_notes").insert({ client_id: corporatePending.find(o => String(o.id) === String(orderId))?.client_id, tipo: "seguimiento", body: `[APPROVAL:ORDER:REJECTED] ${approverLabel}${note ? ` · ${note}` : ""}` });
    setCorporatePending(prev => prev.filter(o => String(o.id) !== String(orderId)));
    await load();
  }

  const pendingOrders = useMemo(() => orders.filter((order) => order.status === "pending"), [orders]);
  const orderExceptions = pendingOrders.filter((order) => orderReasons(order).length > 0);
  const quoteExceptions = quotes.filter((quote) => quoteReasons(quote).length > 0);

  const timelineItems = useMemo(() => {
    const quoteEvents = approvalNotes.map((note) => ({
      id: `quote-note-${note.id}`,
      title: note.body.match(/^\[APPROVAL:QUOTE:([A-Z_]+)\]/)?.[1]?.replace(/_/g, " ") ?? "QUOTE",
      subtitle: `${clientMap[note.client_id] || note.client_id} · ${note.body.replace(/^\[APPROVAL:[^\]]+\]\s*/i, "")}`,
      date: note.created_at,
    }));

    const orderEvents = auditLogs.map((log) => ({
      id: `order-log-${log.id}`,
      title: String(log.metadata?.status ?? "actualizado"),
      subtitle: `${String(log.metadata?.approver ?? "admin")} · ${String(log.metadata?.note ?? "sin comentario")}`,
      date: log.created_at,
    }));

    return [...orderEvents, ...quoteEvents]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 12);
  }, [approvalNotes, auditLogs, clientMap]);

  return (
    <div className="space-y-4">

      {/* ── Aprobaciones Corporativas (pending_approval) ── */}
      {(corporateLoading || corporatePending.length > 0) && (
        <div className={`rounded-[24px] border p-5 shadow-sm ${dk("bg-amber-500/5 border-amber-500/20", "bg-amber-50 border-amber-200")}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-amber-400">
              <ShieldAlert size={16} />
              <h3 className="text-sm font-bold uppercase tracking-widest">Aprobaciones Corporativas Pendientes</h3>
              {corporatePending.length > 0 && (
                <span className="ml-1 rounded-full bg-amber-400 text-black text-[10px] font-bold px-2 py-0.5">{corporatePending.length}</span>
              )}
            </div>
            <button onClick={() => void loadCorporatePending()} className="text-[10px] text-gray-400 hover:text-white flex items-center gap-1">
              <RefreshCw size={11} /> Actualizar
            </button>
          </div>
          <p className="text-[11px] text-gray-500 mb-4">Órdenes de compradores (buyer) que superan su umbral de aprobación y requieren revisión del manager o admin.</p>
          {corporateLoading ? (
            <p className="text-xs text-gray-500 py-2">Cargando...</p>
          ) : (
            <div className="space-y-3">
              {corporatePending.map(order => (
                <div key={String(order.id)} className={`rounded-[22px] border p-4 shadow-sm ${dk("bg-[#111] border-[#2a2a2a]", "bg-white border-[#e5e5e5]")}`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>
                        {order.order_number || `#${String(order.id).slice(-6).toUpperCase()}`}
                        <span className="ml-2 text-[10px] font-normal text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">
                          Pendiente aprobación corporativa
                        </span>
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Comprador: <span className={dk("text-gray-300", "text-gray-700")}>{order.buyer_name}</span>
                        {order.approval_threshold ? ` · Umbral: ${fmtMoney(order.approval_threshold)}` : ""}
                      </p>
                    </div>
                    <p className="text-sm font-extrabold text-amber-400 shrink-0">{fmtMoney(order.total)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Nota de aprobación (opcional)"
                      value={corporateNotes[String(order.id)] ?? ""}
                      onChange={e => setCorporateNotes(prev => ({ ...prev, [String(order.id)]: e.target.value }))}
                      className={`flex-1 text-xs px-3 py-1.5 rounded-lg border outline-none ${dk("bg-[#1a1a1a] border-[#333] text-white placeholder-gray-600", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717]")}`}
                    />
                    <button onClick={() => void approveCorporateOrder(order.id)}
                      className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition">
                      <CheckCircle2 size={12} /> Aprobar
                    </button>
                    <button onClick={() => void rejectCorporateOrder(order.id)}
                      className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition">
                      <XCircle size={12} /> Rechazar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Solicitudes de Registro Pendientes ── */}
      {pendingAccounts.length > 0 && (
        <div className={`rounded-[24px] border p-5 shadow-sm ${dk("bg-blue-500/5 border-blue-500/20", "bg-blue-50 border-blue-200")}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-blue-400">
              <UserPlus size={16} />
              <h3 className="text-sm font-bold uppercase tracking-widest">Nuevas Solicitudes de Cuenta B2B</h3>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pendingAccounts.map((account) => (
              <div key={account.id} className={`rounded-[22px] border p-4 shadow-sm ${dk("bg-[#0d0d0d] border-white/5", "bg-white border-black/5")}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase">Onboarding VIP</span>
                  <span className="text-[10px] text-gray-500">{account.created_at ? new Date(account.created_at).toLocaleDateString() : ""}</span>
                </div>
                <h4 className={`font-bold text-sm ${dk("text-white", "text-black")}`}>{account.company_name || "Empresa s/n"}</h4>
                <div className="space-y-1.5 mt-2 mb-4">
                   <p className="text-[11px] text-gray-500 flex items-center gap-1.5">
                     <FileText size={12} /> CUIT: <span className={dk("text-gray-300", "text-gray-700")}>{account.cuit || "No validado"}</span>
                   </p>
                   <p className="text-[11px] text-gray-500 flex items-center gap-1.5">
                     <Users size={12} /> Contacto: <span className={dk("text-gray-300", "text-gray-700")}>{account.contact_name}</span>
                   </p>
                   <p className="text-[11px] text-gray-500 flex items-center gap-1.5">
                     <Mail size={12} /> {account.email}
                   </p>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                   <button
                     onClick={async () => {
                        const credit = prompt("Definir límite de crédito inicial en ARS:", "500000");
                        if (credit === null) return;
                        const { error } = await supabase.from("profiles").update({ 
                          estado: "activo", 
                          active: true,
                          credit_limit: Number(credit),
                          client_type: "reseller"
                        }).eq("id", account.id);
                        
                        if (!error) {
                          // [Vínculo Proactivo] Notificación por Email
                          await EmailNotificationService.notifyCreditUpdate(
                            account.email || "", 
                            Number(credit), 
                            account.company_name || account.contact_name
                          );
                          load();
                        }
                     }}
                     className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#2D9F6A] text-white text-[10px] font-bold uppercase transition hover:bg-[#25835A]"
                   >
                     <Check size={12} /> Aprobar
                   </button>
                   <button
                     onClick={async () => {
                        if (!confirm("¿Rechazar solicitud de partner?")) return;
                        const { error } = await supabase.from("profiles").update({ estado: "rechazado" }).eq("id", account.id);
                        if (!error) load();
                     }}
                     className={`flex items-center justify-center gap-1.5 py-2 rounded-lg border text-[10px] font-bold uppercase transition ${dk("border-white/10 text-gray-400 hover:bg-white/5", "border-black/10 text-gray-500 hover:bg-black/5")}`}
                   >
                     <X size={12} /> Rechazar
                   </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className={`text-base font-bold ${dk("text-white", "text-[#171717]")}`}>Centro de Aprobaciones</h2>
          <p className="text-xs text-gray-500 mt-0.5">Reglas por monto, excepción comercial, aprobación por usuario y trazabilidad.</p>
        </div>
        <button
          onClick={() => void load()}
          className={`inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition ${dk("border-[#262626] text-gray-400 hover:text-white hover:bg-[#1a1a1a]", "border-[#e5e5e5] text-[#737373] hover:text-[#171717] hover:bg-[#f5f5f5]")}`}
        >
          <RefreshCw size={12} />
          Actualizar
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: "Solicitudes B2B", value: String(pendingAccounts.length), accent: "text-blue-400" },
          { label: "Pedidos pendientes", value: String(pendingOrders.length), accent: "text-[#2D9F6A]" },
          { label: "Con excepción", value: String(orderExceptions.length + quoteExceptions.length), accent: "text-amber-400" },
          { label: "Facturas vencidas", value: String(overdueInvoices.length), accent: overdueInvoices.length > 0 ? "text-red-400" : "text-emerald-400" },
          { label: "Trazas recientes", value: String(timelineItems.length), accent: "text-blue-400" },
        ].map((card) => (
          <div key={card.label} className={`border rounded-[22px] px-4 py-3 shadow-sm ${dk("border-[#1f1f1f] bg-[#111]", "border-[#e5e5e5] bg-white")}`}>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{card.label}</p>
            <p className={`text-lg font-bold ${card.accent}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <section className={`border rounded-[24px] p-5 shadow-sm ${dk("border-[#1f1f1f] bg-[#111]", "border-[#e5e5e5] bg-white")}`}>
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert size={15} className="text-amber-400" />
            <h3 className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>Reglas de aprobación</h3>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              ["Monto pedido (ARS)", "orderAmountArs"],
              ["Monto cotización (ARS)", "quoteAmountArs"],
              ["Facturas vencidas permitidas", "maxOverdueInvoices"],
              ["Uso de crédito máximo (%)", "maxCreditUsagePct"],
            ].map(([label, key]) => (
              <label key={key} className="space-y-1">
                <span className={`text-xs ${dk("text-gray-400", "text-[#737373]")}`}>{label}</span>
                <input
                  type="number"
                  min={0}
                  value={rules[key as keyof ApprovalRuleConfig]}
                  onChange={(event) =>
                    setRules((prev) => ({
                      ...prev,
                      [key]: Number(event.target.value),
                    }))
                  }
                  className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717]")}`}
                />
              </label>
            ))}
          </div>
          <button
            onClick={saveRules}
            className="inline-flex items-center gap-2 mt-4 bg-[#2D9F6A] hover:bg-[#25875a] text-white px-4 py-2 rounded-lg text-sm transition"
          >
            <Save size={12} />
            {savingRules ? "Guardado" : "Guardar reglas"}
          </button>
        </section>

        <section className={`border rounded-[24px] p-5 shadow-sm ${dk("border-[#1f1f1f] bg-[#111]", "border-[#e5e5e5] bg-white")}`}>
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare size={15} className="text-blue-400" />
            <h3 className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>Trazabilidad</h3>
          </div>
          {timelineItems.length === 0 ? (
            <p className="text-sm text-gray-500">Todavía no hay decisiones registradas.</p>
          ) : (
            <div className="space-y-3">
              {timelineItems.map((item) => (
                <div key={item.id} className={`rounded-xl border px-3 py-3 ${dk("border-[#262626] bg-[#0d0d0d]", "border-[#ececec] bg-[#fafafa]")}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm font-semibold ${dk("text-white", "text-[#171717]")}`}>{item.title}</p>
                    <span className="text-[10px] text-gray-500">{new Date(item.date).toLocaleDateString("es-AR")}</span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">{item.subtitle}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className={`border rounded-[24px] overflow-hidden shadow-sm ${dk("border-[#1f1f1f] bg-[#111]", "border-[#e5e5e5] bg-white")}`}>
          <div className={`px-4 py-3 border-b flex items-center justify-between ${dk("border-[#1a1a1a]", "border-[#f0f0f0]")}`}>
            <div className="flex items-center gap-2">
              <ClipboardList size={14} className="text-[#2D9F6A]" />
              <h3 className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>Pedidos</h3>
            </div>
            <button onClick={() => onOpenTab("orders")} className="text-xs text-[#2D9F6A] hover:underline">Ver todos</button>
          </div>
          {pendingOrders.length === 0 ? (
            <p className="px-4 py-8 text-sm text-gray-500">No hay pedidos pendientes.</p>
          ) : (
            pendingOrders.slice(0, 8).map((order) => {
              const reasons = orderReasons(order);
              return (
                <div key={order.id} className={`px-4 py-3 border-t space-y-2 ${dk("border-[#1a1a1a]", "border-[#f0f0f0]")}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={`text-sm font-semibold ${dk("text-white", "text-[#171717]")}`}>{order.order_number ?? `#${String(order.id).slice(-6).toUpperCase()}`}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">{clientMap[order.client_id] || order.client_id}</p>
                    </div>
                    <span className="text-xs text-[#2D9F6A] font-semibold">{fmtMoney(order.total)}</span>
                  </div>

                  {reasons.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {reasons.map((reason) => (
                        <span key={reason} className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <AlertTriangle size={10} />
                          {reason}
                        </span>
                      ))}
                    </div>
                  )}

                  <textarea
                    value={orderNotes[String(order.id)] ?? ""}
                    onChange={(event) => setOrderNotes((prev) => ({ ...prev, [String(order.id)]: event.target.value }))}
                    placeholder="Comentario de aprobación / excepción comercial"
                    rows={2}
                    className={`w-full rounded-lg border px-3 py-2 text-sm outline-none resize-none ${dk("bg-[#0d0d0d] border-[#262626] text-white placeholder:text-[#404040]", "bg-[#fafafa] border-[#ececec] text-[#171717] placeholder:text-[#a3a3a3]")}`}
                  />

                  <div className="flex gap-2">
                    <button onClick={() => void handleOrderDecision(order, "approved")} className="text-xs text-emerald-400 hover:underline">
                      Aprobar
                    </button>
                    <button onClick={() => void handleOrderDecision(order, "rejected")} className="text-xs text-red-400 hover:underline">
                      Rechazar
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </section>

        <section className={`border rounded-[24px] overflow-hidden shadow-sm ${dk("border-[#1f1f1f] bg-[#111]", "border-[#e5e5e5] bg-white")}`}>
          <div className={`px-4 py-3 border-b flex items-center justify-between ${dk("border-[#1a1a1a]", "border-[#f0f0f0]")}`}>
            <div className="flex items-center gap-2">
              <MessageSquare size={14} className="text-blue-400" />
              <h3 className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>Cotizaciones</h3>
            </div>
            <button onClick={() => onOpenTab("quotes_admin")} className="text-xs text-[#2D9F6A] hover:underline">Ver todas</button>
          </div>
          {loading ? (
            <p className="px-4 py-8 text-sm text-gray-500">Cargando…</p>
          ) : quotes.length === 0 ? (
            <p className="px-4 py-8 text-sm text-gray-500">No hay cotizaciones para decidir.</p>
          ) : (
            quotes.map((quote) => {
              const reasons = quoteReasons(quote);
              return (
                <div key={quote.id} className={`px-4 py-3 border-t space-y-2 ${dk("border-[#1a1a1a]", "border-[#f0f0f0]")}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={`text-sm font-semibold ${dk("text-white", "text-[#171717]")}`}>COT-{String(quote.id).padStart(5, "0")}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">{clientMap[quote.client_id] || quote.client_id}</p>
                    </div>
                    <span className="text-xs text-[#2D9F6A] font-semibold">{fmtMoney(quote.total)}</span>
                  </div>
                  {reasons.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {reasons.map((reason) => (
                        <span key={reason} className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <AlertTriangle size={10} />
                          {reason}
                        </span>
                      ))}
                    </div>
                  )}
                  <textarea
                    value={quoteNotes[String(quote.id)] ?? ""}
                    onChange={(event) => setQuoteNotes((prev) => ({ ...prev, [String(quote.id)]: event.target.value }))}
                    placeholder="Comentario de decisión comercial"
                    rows={2}
                    className={`w-full rounded-lg border px-3 py-2 text-sm outline-none resize-none ${dk("bg-[#0d0d0d] border-[#262626] text-white placeholder:text-[#404040]", "bg-[#fafafa] border-[#ececec] text-[#171717] placeholder:text-[#a3a3a3]")}`}
                  />
                  <div className="flex gap-2">
                    <button onClick={() => void updateQuoteStatus(quote, "approved")} className="text-xs text-emerald-400 hover:underline">
                      Aprobar
                    </button>
                    <button onClick={() => void updateQuoteStatus(quote, "rejected")} className="text-xs text-red-400 hover:underline">
                      Rechazar
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </section>

        <section className={`border rounded-[24px] overflow-hidden shadow-sm ${dk("border-[#1f1f1f] bg-[#111]", "border-[#e5e5e5] bg-white")}`}>
          <div className={`px-4 py-3 border-b flex items-center justify-between ${dk("border-[#1a1a1a]", "border-[#f0f0f0]")}`}>
            <div className="flex items-center gap-2">
              <FileText size={14} className="text-amber-400" />
              <h3 className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>Cobranza</h3>
            </div>
            <button onClick={() => onOpenTab("invoices")} className="text-xs text-[#2D9F6A] hover:underline">Ver facturas</button>
          </div>
          {loading ? (
            <p className="px-4 py-8 text-sm text-gray-500">Cargando…</p>
          ) : overdueInvoices.length === 0 ? (
            <p className="px-4 py-8 text-sm text-gray-500">No hay facturas vencidas.</p>
          ) : (
            overdueInvoices.map((invoice) => (
              <div key={invoice.id} className={`px-4 py-3 border-t ${dk("border-[#1a1a1a]", "border-[#f0f0f0]")}`}>
                <p className={`text-sm font-semibold ${dk("text-white", "text-[#171717]")}`}>{invoice.invoice_number}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{clientMap[invoice.client_id] || invoice.client_id}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs font-semibold text-red-400">{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString("es-AR") : "Sin vencimiento"}</span>
                  <span className="text-xs text-[#2D9F6A] font-semibold">{fmtMoney(invoice.total)}</span>
                </div>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
