import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  FileText, Send, CheckCircle2, XCircle, AlertTriangle,
  RefreshCw, ChevronDown, ChevronUp, Eye, ArrowRight, X,
} from "lucide-react";
import type { QuoteStatus } from "@/models/quote";

interface Props { isDark?: boolean }

interface AdminQuote {
  id: number;
  client_id: string;
  client_name: string;
  items: any[];
  subtotal: number;
  iva_total: number;
  total: number;
  currency: "USD" | "ARS";
  status: QuoteStatus;
  version: number;
  expires_at: string | null;
  converted_to_order_id: number | null;
  created_at: string;
  // joined
  company_name?: string;
  contact_name?: string;
  client_email?: string;
}

const STATUS_CONFIG: Record<QuoteStatus, { label: string; icon: any; cls: string }> = {
  draft:    { label: "Borrador",   icon: FileText,      cls: "bg-gray-500/15 text-gray-400 border-gray-500/30" },
  sent:     { label: "Enviada",    icon: Send,          cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  viewed:   { label: "Vista",      icon: Eye,           cls: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
  approved: { label: "Aprobada",   icon: CheckCircle2,  cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  rejected: { label: "Rechazada",  icon: XCircle,       cls: "bg-red-500/15 text-red-400 border-red-500/30" },
  expired:  { label: "Vencida",    icon: AlertTriangle, cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  // from migration 014 (quotes v2)
  converted: { label: "Convertida", icon: ArrowRight,   cls: "bg-teal-500/15 text-teal-400 border-teal-500/30" },
} as any;

function QuoteStatusBadge({ status }: { status: string }) {
  const cfg = (STATUS_CONFIG as any)[status] ?? STATUS_CONFIG.draft;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.cls}`}>
      <Icon size={10} /> {cfg.label}
    </span>
  );
}

export function QuotesAdminTab({ isDark = true }: Props) {
  const dk = (d: string, l: string) => (isDark ? d : l);

  const [quotes, setQuotes]         = useState<AdminQuote[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterClient, setFilterClient] = useState("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [converting, setConverting] = useState<number | null>(null);
  const [convertError, setConvertError] = useState<Record<number, string>>({});
  const [updatingStatus, setUpdatingStatus] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("quotes")
      .select("*, profiles(company_name, contact_name, email)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (filterStatus !== "all") query = query.eq("status", filterStatus);
    if (filterClient !== "all") query = query.eq("client_id", filterClient);

    const { data } = await query;
    setQuotes(
      (data ?? []).map((q: any) => ({
        ...q,
        iva_total:    q.iva_total ?? 0,
        company_name: q.profiles?.company_name,
        contact_name: q.profiles?.contact_name,
        client_email: q.profiles?.email,
      }))
    );
    setLoading(false);
  }, [filterStatus, filterClient]);

  useEffect(() => { load(); }, [load]);

  // Unique clients from loaded quotes for filter
  const uniqueClients = Array.from(
    new Map(
      quotes.map((q) => [q.client_id, q.company_name || q.contact_name || q.client_id])
    ).entries()
  );

  async function convertToOrder(quote: AdminQuote) {
    setConverting(quote.id);
    setConvertError((p) => ({ ...p, [quote.id]: "" }));
    const { data, error } = await supabase.rpc("convert_quote_to_order", {
      p_quote_id:  String(quote.id),
      p_client_id: quote.client_id,
    });
    if (error) {
      setConvertError((p) => ({ ...p, [quote.id]: error.message }));
    } else {
      load();
    }
    setConverting(null);
  }

  async function updateStatus(quoteId: number, status: string) {
    setUpdatingStatus(quoteId);
    await supabase.from("quotes").update({ status }).eq("id", quoteId);
    setQuotes((prev) => prev.map((q) => q.id === quoteId ? { ...q, status: status as QuoteStatus } : q));
    setUpdatingStatus(null);

    // Fire email notification when approving or rejecting (non-blocking)
    if (status === "approved" || status === "rejected") {
      const quote = quotes.find((q) => q.id === quoteId);
      if (quote?.client_email) {
        void fetch("/api/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: status === "approved" ? "quote_approved" : "quote_rejected",
            orderNumber: `COT-${quoteId}`,
            quoteId,
            clientId: quote.client_id,
            clientEmail: quote.client_email,
            clientName: quote.company_name || quote.contact_name || quote.client_name,
            products: [],
            total: quote.total,
          }),
        }).catch(() => {/* non-critical */});
      }
    }
  }

  const fmt = (n: number, cur: "USD" | "ARS") =>
    new Intl.NumberFormat("es-AR", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n);

  const isExpired = (q: AdminQuote) =>
    q.expires_at ? new Date(q.expires_at) < new Date() : false;

  // Status counts
  const statusCounts = quotes.reduce<Record<string, number>>((acc, q) => {
    acc[q.status] = (acc[q.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className={`text-base font-bold ${dk("text-white", "text-[#171717]")}`}>Cotizaciones</h2>
          <p className="text-xs text-gray-500 mt-0.5">{quotes.length} cotizaciones</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className={`border rounded-lg px-2 py-1.5 text-xs outline-none ${dk("bg-[#111] border-[#2a2a2a] text-gray-300", "bg-white border-[#e5e5e5] text-[#525252]")}`}
          >
            <option value="all">Todos los estados</option>
            {Object.keys(STATUS_CONFIG).map((s) => (
              <option key={s} value={s}>
                {(STATUS_CONFIG as any)[s]?.label ?? s}{statusCounts[s] ? ` (${statusCounts[s]})` : ""}
              </option>
            ))}
          </select>
          <select
            value={filterClient}
            onChange={(e) => setFilterClient(e.target.value)}
            className={`border rounded-lg px-2 py-1.5 text-xs outline-none ${dk("bg-[#111] border-[#2a2a2a] text-gray-300", "bg-white border-[#e5e5e5] text-[#525252]")}`}
          >
            <option value="all">Todos los clientes</option>
            {uniqueClients.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
          <button
            onClick={load}
            className={`p-2 rounded-lg transition ${dk("text-gray-500 hover:text-white hover:bg-[#1c1c1c]", "text-[#737373] hover:text-[#171717] hover:bg-[#e8e8e8]")}`}
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Status summary */}
      <div className="flex gap-2 flex-wrap">
        {Object.entries(STATUS_CONFIG).filter(([s]) => statusCounts[s]).map(([s, cfg]) => (
          <button
            key={s}
            onClick={() => setFilterStatus(filterStatus === s ? "all" : s)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold transition ${
              filterStatus === s ? cfg.cls + " border-current" : dk("border-[#1f1f1f] text-gray-500 hover:border-[#2e2e2e]", "border-[#e5e5e5] text-[#737373] hover:border-[#d4d4d4]")
            }`}
          >
            <cfg.icon size={10} /> {cfg.label} ({statusCounts[s]})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={`h-16 rounded-xl animate-pulse ${dk("bg-[#111]", "bg-white")}`} />
          ))}
        </div>
      ) : quotes.length === 0 ? (
        <div className={`border rounded-xl py-16 text-center text-sm text-gray-500 ${dk("border-[#1f1f1f]", "border-[#e5e5e5]")}`}>
          Sin cotizaciones.
        </div>
      ) : (
        <div className={`border rounded-xl overflow-hidden ${dk("border-[#1f1f1f]", "border-[#e5e5e5]")}`}>
          {quotes.map((q, idx) => {
            const isExpand = expandedId === q.id;
            const clientLabel = q.company_name || q.contact_name || q.client_id.slice(0, 8);
            const expired = isExpired(q);

            return (
              <div key={q.id} className={idx > 0 ? `border-t ${dk("border-[#1a1a1a]", "border-[#f0f0f0]")}` : ""}>
                {/* Quote row */}
                <div
                  onClick={() => setExpandedId(isExpand ? null : q.id)}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition ${dk("hover:bg-[#0f0f0f]", "hover:bg-[#fafafa]")} ${isExpand ? dk("bg-[#0f0f0f]", "bg-[#fafafa]") : ""}`}
                >
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${dk("bg-[#1a1a1a]", "bg-[#f0f0f0]")}`}>
                    <FileText size={13} className="text-[#2D9F6A]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold ${dk("text-gray-300", "text-[#525252]")}`}>{clientLabel}</span>
                      <QuoteStatusBadge status={q.status} />
                      {q.version && q.version > 1 && (
                        <span className="text-[10px] text-gray-500">v{q.version}</span>
                      )}
                      {expired && q.status !== "expired" && (
                        <span className="text-[10px] text-amber-400">· vencida</span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500">
                      {new Date(q.created_at).toLocaleDateString("es-AR")}
                      {q.expires_at && ` · vence ${new Date(q.expires_at).toLocaleDateString("es-AR")}`}
                      {` · ${q.items?.length ?? 0} ítems`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-xs font-bold ${dk("text-white", "text-[#171717]")}`}>
                      {fmt(q.total, q.currency)}
                    </p>
                    <p className="text-[10px] text-gray-500">{q.currency}</p>
                  </div>
                  {isExpand ? <ChevronUp size={13} className="text-gray-500 shrink-0" /> : <ChevronDown size={13} className="text-gray-500 shrink-0" />}
                </div>

                {/* Expanded detail */}
                {isExpand && (
                  <div className={`border-t px-4 py-4 space-y-4 ${dk("border-[#1a1a1a] bg-[#080808]", "border-[#f0f0f0] bg-[#fafafa]")}`}>
                    {/* Items */}
                    {q.items && q.items.length > 0 && (
                      <div className="space-y-1">
                        <p className={`text-[10px] font-bold uppercase tracking-wider ${dk("text-gray-500", "text-[#a3a3a3]")}`}>Ítems</p>
                        {q.items.map((item: any, i: number) => (
                          <div key={i} className="flex items-center justify-between gap-2 py-1">
                            <span className={`text-xs ${dk("text-gray-300", "text-[#525252]")}`}>
                              {item.name ?? item.product_name ?? "—"} × {item.quantity}
                            </span>
                            <span className={`text-xs font-mono ${dk("text-gray-400", "text-[#737373]")}`}>
                              {fmt(item.totalWithIVA ?? item.total_price ?? 0, q.currency)}
                            </span>
                          </div>
                        ))}
                        <div className={`flex justify-between pt-1 border-t ${dk("border-[#1f1f1f]", "border-[#e5e5e5]")}`}>
                          <span className={`text-xs font-bold ${dk("text-white", "text-[#171717]")}`}>Total</span>
                          <span className={`text-xs font-bold ${dk("text-white", "text-[#171717]")}`}>{fmt(q.total, q.currency)}</span>
                        </div>
                      </div>
                    )}

                    {/* Error */}
                    {convertError[q.id] && (
                      <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                        {convertError[q.id]}
                      </p>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Status transitions */}
                      {q.status === "draft" && (
                        <button
                          onClick={() => updateStatus(q.id, "sent")}
                          disabled={updatingStatus === q.id}
                          className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition"
                        >
                          <Send size={11} /> Marcar enviada
                        </button>
                      )}
                      {(q.status === "draft" || q.status === "sent" || q.status === "viewed") && (
                        <button
                          onClick={() => updateStatus(q.id, "approved")}
                          disabled={updatingStatus === q.id}
                          className="flex items-center gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition"
                        >
                          <CheckCircle2 size={11} /> Aprobar
                        </button>
                      )}
                      {!["rejected", "expired", "converted"].includes(q.status) && (
                        <button
                          onClick={() => updateStatus(q.id, "rejected")}
                          disabled={updatingStatus === q.id}
                          className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border transition ${dk("border-[#2a2a2a] text-gray-500 hover:text-red-400 hover:border-red-400/30", "border-[#e5e5e5] text-[#737373] hover:text-red-500 hover:border-red-400/30")}`}
                        >
                          <XCircle size={11} /> Rechazar
                        </button>
                      )}
                      {/* Convert to order */}
                      {(q.status === "sent" || q.status === "approved") && !q.converted_to_order_id && (
                        <button
                          onClick={() => convertToOrder(q)}
                          disabled={converting === q.id}
                          className="flex items-center gap-1 text-xs bg-[#2D9F6A] hover:bg-[#25875a] disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition ml-auto"
                        >
                          <ArrowRight size={11} />
                          {converting === q.id ? "Convirtiendo…" : "Convertir a pedido"}
                        </button>
                      )}
                      {q.converted_to_order_id && (
                        <span className="ml-auto text-[11px] text-teal-400 flex items-center gap-1">
                          <CheckCircle2 size={11} /> Convertida → Pedido #{q.converted_to_order_id}
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
    </div>
  );
}
