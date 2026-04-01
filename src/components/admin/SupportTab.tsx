import { useEffect, useMemo, useState } from "react";
import {
  Save,
  Search,
  Ticket,
  Wrench,
  ShieldAlert,
  Clock,
  User,
  AlertCircle
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface ClientRow {
  id: string;
  company_name: string;
  contact_name: string;
}

interface TicketRow {
  id: string;
  client_id: string;
  order_id?: string | number;
  subject: string;
  description: string;
  status: 'open' | 'in_analysis' | 'waiting_customer' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  created_at: string;
  updated_at: string;
}

interface SupportTabProps {
  isDark?: boolean;
  clients: ClientRow[];
}

const STATUS_LABELS: Record<TicketRow['status'], string> = {
  open: "Abierto",
  in_analysis: "En análisis",
  waiting_customer: "Esperando cliente",
  resolved: "Resuelto",
  closed: "Cerrado",
};

const PRIORITY_LABELS: Record<TicketRow['priority'], string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

export function SupportTab({ isDark = true, clients }: SupportTabProps) {
  const dk = (d: string, l: string) => (isDark ? d : l);
  const [query, setQuery] = useState("");
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [category, setCategory] = useState("RECLAMO");
  const [status, setStatus] = useState<TicketRow['status']>("open");
  const [priority, setPriority] = useState<TicketRow['priority']>("medium");
  const [orderId, setOrderId] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<TicketRow['status'] | "ALL">("ALL");

  const clientMap = useMemo(() => {
    const map: Record<string, string> = {};
    clients.forEach((client) => {
      map[client.id] = client.company_name || client.contact_name || client.id;
    });
    return map;
  }, [clients]);

  async function load() {
    const { data } = await supabase
      .from("support_tickets")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(200);
    setTickets((data as TicketRow[] | null) ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function createTicket() {
    if (!selectedClientId || !description.trim() || !subject.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("support_tickets").insert({
        client_id: selectedClientId,
        order_id: orderId || null,
        subject,
        description,
        category,
        status,
        priority,
      });
      if (error) throw error;
      setSubject("");
      setDescription("");
      setOrderId("");
      setStatus("open");
      setPriority("medium");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function updateTicketStatus(ticketId: string, nextStatus: TicketRow['status']) {
    const { error } = await supabase
      .from("support_tickets")
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq("id", ticketId);
    if (!error) await load();
  }

  const filteredTickets = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return tickets.filter((item) => {
      if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
      if (!normalized) return true;
      return [
        clientMap[item.client_id] || item.client_id,
        item.subject,
        item.description,
        item.category,
        String(item.order_id || ""),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [tickets, clientMap, query, statusFilter]);

  const metrics = useMemo(() => {
    const active = tickets.filter((item) => ["open", "in_analysis", "waiting_customer"].includes(item.status));
    const urgent = tickets.filter((item) => item.priority === "urgent");
    const rma = tickets.filter((item) => item.category === "RMA");
    return [
      { label: "Casos activos", value: String(active.length), accent: "text-[#2D9F6A]" },
      { label: "Urgentes", value: String(urgent.length), accent: urgent.length > 0 ? "text-red-400" : "text-gray-400" },
      { label: "RMA / devoluciones", value: String(rma.length), accent: "text-amber-400" },
      { label: "Resueltos", value: String(tickets.filter(t => t.status === 'resolved').length), accent: "text-blue-400" },
    ];
  }, [tickets]);

  return (
    <div className="space-y-4 max-w-6xl">
      <div>
        <h2 className={`text-base font-bold ${dk("text-white", "text-[#171717]")}`}>Postventa y Soporte Oficial</h2>
        <p className="text-xs text-gray-500 mt-0.5">Gestión centralizada de tickets, RMA y reclamos técnicos (Phase 5.1).</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className={`border rounded-xl px-4 py-3 ${dk("border-[#1f1f1f] bg-[#111]", "border-[#e5e5e5] bg-white")}`}>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 font-bold">{metric.label}</p>
            <p className={`text-lg font-bold ${metric.accent}`}>{metric.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className={`border rounded-2xl p-5 space-y-3 h-fit ${dk("border-[#1f1f1f] bg-[#111]", "border-[#e5e5e5] bg-white")}`}>
          <div className="flex items-center gap-2 mb-2">
            <Wrench size={15} className="text-[#2D9F6A]" />
            <h3 className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>Nuevo Ticket Interno</h3>
          </div>
          
          <select value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)} className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-white border-[#e5e5e5] text-[#171717]")}`}>
            <option value="">Seleccionar cliente</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>{client.company_name || client.contact_name}</option>
            ))}
          </select>

          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Asunto (ej: Falla técnica Corsair)"
            className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-white border-[#e5e5e5] text-[#171717]")}`}
          />

          <div className="grid grid-cols-2 gap-3">
            <select value={category} onChange={(event) => setCategory(event.target.value)} className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-white border-[#e5e5e5] text-[#171717]")}`}>
              <option value="RECLAMO">Reclamo</option>
              <option value="DEVOLUCION">Devolución</option>
              <option value="RMA">RMA</option>
              <option value="FACTURACION">Facturación</option>
              <option value="LOGISTICA">Logística</option>
              <option value="STOCKS">Duda Stock</option>
            </select>
            <select value={priority} onChange={(event) => setPriority(event.target.value as TicketRow['priority'])} className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-white border-[#e5e5e5] text-[#171717]")}`}>
              <option value="low">Baja</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
              <option value="urgent">Urgente</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <select value={status} onChange={(event) => setStatus(event.target.value as TicketRow['status'])} className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-white border-[#e5e5e5] text-[#171717]")}`}>
              <option value="open">Abierto</option>
              <option value="in_analysis">En análisis</option>
              <option value="waiting_customer">Esperando cliente</option>
              <option value="resolved">Resuelto</option>
              <option value="closed">Cerrado</option>
            </select>
            <input
              value={orderId}
              onChange={(event) => setOrderId(event.target.value)}
              placeholder="Orden vinculada"
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-white border-[#e5e5e5] text-[#171717]")}`}
            />
          </div>

          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} placeholder="Detalle técnico de la falla o situación..." className={`w-full rounded-lg border px-3 py-2 text-sm outline-none resize-none ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-white border-[#e5e5e5] text-[#171717]")}`} />
          
          <button onClick={() => void createTicket()} disabled={saving || !selectedClientId || !description.trim() || !subject.trim()} className="w-full inline-flex items-center justify-center gap-2 bg-[#2D9F6A] hover:bg-[#25875a] disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-xs transition font-bold uppercase tracking-widest">
            <Save size={14} />
            {saving ? "Generando..." : "Crear Ticket"}
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-[1fr_200px]">
            <label className="relative block">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por cliente, asunto o descripción..."
                className={`w-full rounded-xl border pl-10 pr-4 py-2.5 text-sm outline-none ${dk("bg-[#111] border-[#1f1f1f] text-white", "bg-white border-[#e5e5e5] text-[#171717]")}`}
              />
            </label>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as TicketRow['status'] | "ALL")} className={`rounded-xl border px-4 py-2.5 text-sm outline-none font-medium ${dk("bg-[#111] border-[#1f1f1f] text-white", "bg-white border-[#e5e5e5] text-[#171717]")}`}>
              <option value="ALL">Todos los estados</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className={`border rounded-2xl overflow-hidden shadow-sm ${dk("border-[#1f1f1f]", "border-[#e5e5e5]")}`}>
            {filteredTickets.map((item) => (
              <div key={item.id} className={`px-5 py-4 border-t first:border-t-0 hover:bg-black/5 transition ${dk("border-[#1a1a1a] bg-[#111]", "border-[#f0f0f0] bg-white")}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-[9px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full ${item.priority === 'urgent' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'}`}>
                         {PRIORITY_LABELS[item.priority]}
                      </span>
                      <span className={`text-[9px] font-bold uppercase text-[#2D9F6A] bg-[#2D9F6A]/10 px-2 py-0.5 rounded-full border border-[#2D9F6A]/20`}>
                        {item.category}
                      </span>
                      <OrderStatusBadge status={item.status} />
                    </div>
                    <h4 className={`text-sm font-bold mt-2 ${dk("text-white", "text-[#171717]")}`}>{item.subject}</h4>
                    <div className="flex items-center gap-3 mt-1 opacity-60">
                       <span className="flex items-center gap-1 text-[10px]"><User size={10} /> {clientMap[item.client_id] || item.client_id}</span>
                       <span className="flex items-center gap-1 text-[10px]"><Clock size={10} /> {new Date(item.created_at).toLocaleDateString("es-AR")}</span>
                       {item.order_id && <span className="flex items-center gap-1 text-[10px] font-mono">ORD: {item.order_id}</span>}
                    </div>
                  </div>
                </div>

                <p className={`text-xs mt-3 leading-relaxed whitespace-pre-wrap ${dk("text-gray-400", "text-[#525252]")}`}>{item.description}</p>
                
                <div className="flex items-center gap-1.5 mt-4 pt-4 border-t border-dashed border-gray-800">
                  {(["open", "in_analysis", "waiting_customer", "resolved", "closed"] as TicketRow['status'][]).map((st) => (
                    <button
                      key={st}
                      onClick={() => void updateTicketStatus(item.id, st)}
                      className={`text-[9px] font-bold uppercase px-3 py-1.5 rounded-lg border transition-all ${
                        item.status === st
                          ? "border-[#2D9F6A] text-white bg-[#2D9F6A]"
                          : dk("border-[#262626] text-gray-500 hover:text-white hover:bg-[#1a1a1a]", "border-[#e5e5e5] text-[#737373] hover:text-[#171717] hover:bg-[#f5f5f5]")
                      }`}
                    >
                      {STATUS_LABELS[st]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {filteredTickets.length === 0 && (
              <div className="px-5 py-20 text-center">
                <Ticket size={32} className="mx-auto mb-4 text-gray-500/20" />
                <p className="text-sm text-gray-500">No hay tickets activos con los filtros seleccionados.</p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[#2D9F6A]/20 bg-[#2D9F6A]/5 px-4 py-3 flex items-start gap-2">
            <ShieldAlert size={14} className="text-[#2D9F6A] mt-0.5 shrink-0" />
            <p className="text-[10px] text-[#2D9F6A]/70 leading-normal">
              <strong>Control de Calidad:</strong> Todos los cambios en los tickets se notifican automáticamente al cliente vía portal B2B. Los tickets marcados como 'Resuelto' permiten al cliente cerrarlos definitivamente.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderStatusBadge({ status }: { status: TicketRow['status'] }) {
  const map: Record<TicketRow['status'], { label: string; className: string }> = {
    open: { label: "ABIERTO", className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
    in_analysis: { label: "ANÁLISIS", className: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
    waiting_customer: { label: "ESPERANDO", className: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
    resolved: { label: "RESUELTO", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
    closed: { label: "CERRADO", className: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" },
  };
  const { label, className } = map[status];
  return <span className={`text-[9px] font-black tracking-widest px-2 py-0.5 rounded border ${className}`}>{label}</span>;
}
