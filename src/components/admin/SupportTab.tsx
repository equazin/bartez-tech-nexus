import { useEffect, useMemo, useState } from "react";
import {
  Save,
  Search,
  Ticket,
  Wrench,
  ShieldAlert,
  Clock,
  User,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SurfaceCard } from "@/components/ui/surface-card";
import { cn } from "@/lib/utils";

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
  status: "open" | "in_analysis" | "waiting_customer" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  category: string;
  created_at: string;
  updated_at: string;
}

interface SupportTabProps {
  isDark?: boolean;
  clients: ClientRow[];
}

const STATUS_LABELS: Record<TicketRow["status"], string> = {
  open: "Abierto",
  in_analysis: "En analisis",
  waiting_customer: "Esperando cliente",
  resolved: "Resuelto",
  closed: "Cerrado",
};

const PRIORITY_LABELS: Record<TicketRow["priority"], string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

const PRIORITY_STYLES: Record<TicketRow["priority"], string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  high: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  urgent: "bg-red-500/10 text-red-600 dark:text-red-400",
};

const STATUS_STYLES: Record<TicketRow["status"], string> = {
  open: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  in_analysis: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  waiting_customer: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  resolved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  closed: "bg-muted text-muted-foreground",
};

export function SupportTab({ isDark: _isDark = true, clients }: SupportTabProps) {
  const [query, setQuery] = useState("");
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [category, setCategory] = useState("RECLAMO");
  const [status, setStatus] = useState<TicketRow["status"]>("open");
  const [priority, setPriority] = useState<TicketRow["priority"]>("medium");
  const [orderId, setOrderId] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<TicketRow["status"] | "ALL">("ALL");

  const clientMap = useMemo(() => {
    const map: Record<string, string> = {};
    clients.forEach((client) => {
      map[client.id] = client.company_name || client.contact_name || client.id;
    });
    return map;
  }, [clients]);

  async function load() {
    const { data } = await supabase.from("support_tickets").select("*").order("updated_at", { ascending: false }).limit(200);
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

  async function updateTicketStatus(ticketId: string, nextStatus: TicketRow["status"]) {
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
      return [clientMap[item.client_id] || item.client_id, item.subject, item.description, item.category, String(item.order_id || "")]
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
      { label: "Casos activos", value: String(active.length), accent: "text-primary" },
      { label: "Urgentes", value: String(urgent.length), accent: urgent.length > 0 ? "text-red-500 dark:text-red-400" : "text-muted-foreground" },
      { label: "RMA / devoluciones", value: String(rma.length), accent: "text-amber-600 dark:text-amber-400" },
      { label: "Resueltos", value: String(tickets.filter((ticket) => ticket.status === "resolved").length), accent: "text-blue-600 dark:text-blue-400" },
    ];
  }, [tickets]);

  return (
    <div className="space-y-4">
      <SurfaceCard tone="default" padding="md" className="rounded-[24px] border-border/70">
        <div className="space-y-4 xl:flex xl:items-start xl:justify-between xl:gap-6 xl:space-y-0">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Clientes</p>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Postventa y soporte</h2>
              <p className="text-sm text-muted-foreground">Gestion centralizada de tickets, RMA y reclamos tecnicos.</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:w-[520px] xl:grid-cols-4">
            {metrics.map((metric) => (
              <div key={metric.label} className="rounded-2xl border border-border/70 bg-background px-4 py-3">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{metric.label}</p>
                <p className={cn("text-lg font-semibold", metric.accent)}>{metric.value}</p>
              </div>
            ))}
          </div>
        </div>
      </SurfaceCard>

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <SurfaceCard tone="default" padding="md" className="h-fit space-y-4 rounded-[24px] border-border/70">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Wrench size={15} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Nuevo caso</p>
              <h3 className="text-sm font-semibold text-foreground">Ticket interno</h3>
            </div>
          </div>

          <select value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)} className="h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground outline-none focus:border-primary/40">
            <option value="">Seleccionar cliente</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>{client.company_name || client.contact_name}</option>
            ))}
          </select>

          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Asunto"
            className="h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40"
          />

          <div className="grid grid-cols-2 gap-3">
            <select value={category} onChange={(event) => setCategory(event.target.value)} className="h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground outline-none focus:border-primary/40">
              <option value="RECLAMO">Reclamo</option>
              <option value="DEVOLUCION">Devolucion</option>
              <option value="RMA">RMA</option>
              <option value="FACTURACION">Facturacion</option>
              <option value="LOGISTICA">Logistica</option>
              <option value="STOCKS">Duda stock</option>
            </select>
            <select value={priority} onChange={(event) => setPriority(event.target.value as TicketRow["priority"])} className="h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground outline-none focus:border-primary/40">
              <option value="low">Baja</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
              <option value="urgent">Urgente</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <select value={status} onChange={(event) => setStatus(event.target.value as TicketRow["status"])} className="h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground outline-none focus:border-primary/40">
              <option value="open">Abierto</option>
              <option value="in_analysis">En analisis</option>
              <option value="waiting_customer">Esperando cliente</option>
              <option value="resolved">Resuelto</option>
              <option value="closed">Cerrado</option>
            </select>
            <input
              value={orderId}
              onChange={(event) => setOrderId(event.target.value)}
              placeholder="Orden vinculada"
              className="h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40"
            />
          </div>

          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={5}
            placeholder="Detalle tecnico de la falla o situacion..."
            className="w-full rounded-2xl border border-border/70 bg-background px-3 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40"
          />

          <Button className="w-full" onClick={() => void createTicket()} disabled={saving || !selectedClientId || !description.trim() || !subject.trim()}>
            <Save size={14} />
            {saving ? "Generando..." : "Crear ticket"}
          </Button>
        </SurfaceCard>

        <div className="space-y-3">
          <SurfaceCard tone="default" padding="md" className="rounded-[24px] border-border/70">
            <div className="grid gap-3 md:grid-cols-[1fr_220px]">
              <label className="relative block">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por cliente, asunto o descripcion..."
                  className="h-10 w-full rounded-xl border border-border/70 bg-background pl-10 pr-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40"
                />
              </label>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as TicketRow["status"] | "ALL")} className="h-10 rounded-xl border border-border/70 bg-background px-4 text-sm text-foreground outline-none focus:border-primary/40">
                <option value="ALL">Todos los estados</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </SurfaceCard>

          <SurfaceCard tone="default" padding="none" className="overflow-hidden rounded-[24px] border-border/70">
            {filteredTickets.length === 0 ? (
              <EmptyState className="py-16" title="Sin tickets" description="No hay tickets activos con los filtros seleccionados." icon={<Ticket size={24} />} />
            ) : (
              filteredTickets.map((item, index) => (
                <div key={item.id} className={cn("space-y-4 px-5 py-4", index > 0 && "border-t border-border/70")}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", PRIORITY_STYLES[item.priority])}>
                          {PRIORITY_LABELS[item.priority]}
                        </span>
                        <span className="rounded-full border border-primary/15 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          {item.category}
                        </span>
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", STATUS_STYLES[item.status])}>
                          {STATUS_LABELS[item.status]}
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-foreground">{item.subject}</h4>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1"><User size={10} /> {clientMap[item.client_id] || item.client_id}</span>
                        <span className="flex items-center gap-1"><Clock size={10} /> {new Date(item.created_at).toLocaleDateString("es-AR")}</span>
                        {item.order_id ? <span className="font-mono">ORD: {item.order_id}</span> : null}
                      </div>
                    </div>
                  </div>

                  <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>

                  <div className="flex flex-wrap gap-1.5 border-t border-dashed border-border/70 pt-3">
                    {(["open", "in_analysis", "waiting_customer", "resolved", "closed"] as TicketRow["status"][]).map((nextStatus) => (
                      <Button
                        key={nextStatus}
                        variant={item.status === nextStatus ? "soft" : "ghost"}
                        size="sm"
                        onClick={() => void updateTicketStatus(item.id, nextStatus)}
                      >
                        {STATUS_LABELS[nextStatus]}
                      </Button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </SurfaceCard>

          <SurfaceCard tone="subtle" padding="md" className="rounded-[24px] border border-primary/15 bg-primary/5">
            <div className="flex items-start gap-2 text-primary">
              <ShieldAlert size={14} className="mt-0.5 shrink-0" />
              <p className="text-xs leading-relaxed">
                <strong>Control de calidad:</strong> todos los cambios en tickets se notifican automaticamente al cliente via portal B2B. Los tickets resueltos pueden cerrarse luego desde el portal.
              </p>
            </div>
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}
