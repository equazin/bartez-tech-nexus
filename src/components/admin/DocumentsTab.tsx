import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CircleDollarSign, FileText, Search, Truck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fetchInvoices, type Invoice } from "@/lib/api/invoices";
import {
  buildCommercialStories,
  buildCommercialTimeline,
  type CommercialPayment,
} from "@/lib/commercialOps";

interface OrderRow {
  id: string | number;
  client_id: string;
  total: number;
  status: string;
  order_number?: string;
  numero_remito?: string;
  created_at: string;
}

interface ClientRow {
  id: string;
  company_name: string;
  contact_name: string;
}

interface QuoteRow {
  id: number;
  client_id: string;
  total: number;
  status: string;
  created_at: string;
  order_id?: string | number;
}

interface DocumentsTabProps {
  isDark?: boolean;
  orders: OrderRow[];
  clients: ClientRow[];
  onOpenTab: (tab: string) => void;
}

export function DocumentsTab({
  isDark = true,
  orders,
  clients,
}: DocumentsTabProps) {
  const dk = (d: string, l: string) => (isDark ? d : l);
  const [query, setQuery] = useState("");
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<CommercialPayment[]>([]);

  const clientMap = useMemo(() => {
    const map: Record<string, string> = {};
    clients.forEach((client) => {
      map[client.id] = client.company_name || client.contact_name || client.id;
    });
    return map;
  }, [clients]);

  useEffect(() => {
    let active = true;

    async function load() {
      const [{ data: quoteRows }, invoiceRows, { data: paymentRows }] = await Promise.all([
        supabase
          .from("quotes")
          .select("id, client_id, total, status, created_at, order_id")
          .order("created_at", { ascending: false })
          .limit(100),
        fetchInvoices({ limit: 100 }),
        supabase
          .from("account_movements")
          .select("id, client_id, monto, fecha, tipo, descripcion, reference_id, reference_type")
          .eq("tipo", "pago")
          .order("fecha", { ascending: false })
          .limit(100),
      ]);
      if (!active) return;
      setQuotes((quoteRows as QuoteRow[] | null) ?? []);
      setInvoices(invoiceRows);
      setPayments((paymentRows as CommercialPayment[] | null) ?? []);
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  const stories = useMemo(
    () => buildCommercialStories({ orders, quotes, invoices, payments, clientMap }),
    [orders, quotes, invoices, payments, clientMap]
  );

  const filteredStories = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return stories;
    return stories.filter((story) =>
      [
        story.clientName,
        story.quote?.label,
        story.order?.label,
        story.order?.remito,
        story.invoices.map((invoice) => invoice.label).join(" "),
        story.invoices.map((invoice) => invoice.status).join(" "),
        story.stage,
        story.nextAction,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  }, [stories, query]);

  return (
    <div className="space-y-4 max-w-6xl">
      <div>
        <h2 className={`text-base font-bold ${dk("text-white", "text-[#171717]")}`}>Centro documental</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Cada historia une cotización, pedido, remito, factura y pagos en una sola línea comercial.
        </p>
      </div>

      <label className="relative block max-w-md">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por cliente, pedido, factura, remito o próximo paso"
          className={`w-full rounded-lg border pl-9 pr-3 py-2 text-sm outline-none ${dk("bg-[#111] border-[#262626] text-white placeholder:text-[#404040]", "bg-white border-[#e5e5e5] text-[#171717] placeholder:text-[#a3a3a3]")}`}
        />
      </label>

      <div className={`border rounded-2xl overflow-hidden ${dk("border-[#1f1f1f]", "border-[#e5e5e5]")}`}>
        <div className={`grid grid-cols-[1.1fr_1.6fr_1fr_170px] gap-3 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider ${dk("bg-[#0d0d0d] text-[#525252]", "bg-[#f5f5f5] text-[#a3a3a3]")}`}>
          <span>Historia</span>
          <span>Documentos</span>
          <span>Cliente</span>
          <span className="text-right">Próximo paso</span>
        </div>

        {filteredStories.length === 0 ? (
          <div className={`px-4 py-12 text-center text-sm ${dk("bg-[#111] text-[#525252]", "bg-white text-[#737373]")}`}>
            No hay historias que coincidan con esa búsqueda.
          </div>
        ) : (
          filteredStories.map((story) => {
            const timeline = buildCommercialTimeline(story);
            return (
              <div
                key={story.id}
                className={`grid grid-cols-[1.1fr_1.6fr_1fr_170px] gap-3 px-4 py-3 items-center border-t ${dk("border-[#1a1a1a] bg-[#111]", "border-[#f0f0f0] bg-white")}`}
              >
                <div className="min-w-0">
                  <p className={`text-sm font-semibold truncate ${dk("text-white", "text-[#171717]")}`}>
                    {story.order?.label || story.quote?.label || story.invoices[0]?.label || story.id}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {new Date(story.createdAt).toLocaleDateString("es-AR")} · {story.stage} · saldo ${Math.round(story.balance).toLocaleString("es-AR")}
                  </p>
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap gap-1.5">
                    {story.quote && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-1 text-[10px] font-semibold text-blue-400">
                        <FileText size={10} /> {story.quote.label}
                      </span>
                    )}
                    {story.order && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-[#2D9F6A]/20 bg-[#2D9F6A]/10 px-2 py-1 text-[10px] font-semibold text-[#2D9F6A]">
                        <CircleDollarSign size={10} /> {story.order.label}
                      </span>
                    )}
                    {story.order?.remito && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-400">
                        <Truck size={10} /> {story.order.remito}
                      </span>
                    )}
                    {story.invoices.map((invoice) => (
                      <span key={invoice.id} className="inline-flex items-center gap-1 rounded-full border border-purple-500/20 bg-purple-500/10 px-2 py-1 text-[10px] font-semibold text-purple-400">
                        <FileText size={10} /> {invoice.label}
                      </span>
                    ))}
                  </div>
                  <p className="text-[11px] text-gray-500 truncate mt-1">
                    {story.payments.length > 0
                      ? `${story.payments.length} pago(s) · cobrados $${Math.round(story.paidAmount).toLocaleString("es-AR")}`
                      : "Sin pagos registrados"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {timeline.map((entry) => (
                      <span
                        key={entry.id}
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] border ${dk("border-[#262626] text-gray-400 bg-[#0d0d0d]", "border-[#ececec] text-[#737373] bg-[#fafafa]")}`}
                      >
                        {entry.type === "shipment"
                          ? "Remito"
                          : entry.type === "payment"
                            ? "Pago"
                            : entry.type === "quote"
                              ? "Cotización"
                              : entry.type === "invoice"
                                ? "Factura"
                                : "Pedido"}
                        {" · "}
                        {entry.label}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="min-w-0">
                  <p className={`text-sm truncate ${dk("text-gray-300", "text-[#525252]")}`}>{story.clientName}</p>
                  <p className="text-[11px] text-gray-500 truncate">
                    {story.overdue ? "Factura vencida" : story.delayed ? "Pedido demorado" : "Estado al día"}
                  </p>
                </div>

                <div className="text-right space-y-1">
                  <p className={`text-xs font-semibold ${story.overdue ? "text-red-400" : story.delayed ? "text-amber-400" : "text-[#2D9F6A]"}`}>
                    {story.nextAction}
                  </p>
                  {story.overdue && <p className="text-[10px] text-red-400/80">Prioridad cobranza</p>}
                  {story.delayed && !story.overdue && (
                    <p className="text-[10px] text-amber-400/80 inline-flex items-center gap-1 justify-end">
                      <AlertTriangle size={10} /> Revisar hoy
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
