import { useEffect, useState } from "react";
import {
  LifeBuoy,
  Plus,
  Search,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ChevronRight,
  Package,
  X,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import type { PortalOrder } from "@/hooks/useOrders";

export interface SupportTicket {
  id: string;
  subject: string;
  description: string;
  status: "open" | "in_analysis" | "tech_assigned" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "critical";
  order_id?: string;
  product_id?: number;
  created_at: string;
  updated_at: string;
}

interface SupportCenterProps {
  orders: PortalOrder[];
}

export function SupportCenter({ orders }: SupportCenterProps) {
  const { profile } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [newSubject, setNewSubject] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newOrderId, setNewOrderId] = useState("");
  const [newPriority, setNewPriority] = useState<SupportTicket["priority"]>("medium");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function fetchTickets() {
      if (!profile?.id) return;
      try {
        const { data, error } = await supabase
          .from("support_tickets")
          .select("*")
          .eq("client_id", profile.id)
          .order("updated_at", { ascending: false });
        if (!error && data) setTickets(data as SupportTicket[]);
      } catch (error) {
        void error;
      } finally {
        setLoading(false);
      }
    }
    void fetchTickets();
  }, [profile?.id]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newSubject || !newDesc || !profile?.id) return;

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("support_tickets")
        .insert({
          client_id: profile.id,
          subject: newSubject,
          description: newDesc,
          order_id: newOrderId || null,
          priority: newPriority,
          status: "open",
        })
        .select()
        .single();

      if (!error && data) {
        setTickets((prev) => [data as SupportTicket, ...prev]);
        setShowNewForm(false);
        setNewSubject("");
        setNewDesc("");
        setNewOrderId("");
        toast.success("Ticket creado correctamente. Un asesor te contactara pronto.");
      } else {
        toast.error("Error al crear el ticket.");
      }
    } catch {
      toast.error("Error inesperado al crear el ticket.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: SupportTicket["status"]) => {
    const map: Record<typeof status, { label: string; className: string; icon: typeof Clock }> = {
      open: { label: "Abierto", className: "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400", icon: Clock },
      in_analysis: { label: "En analisis", className: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400", icon: Search },
      tech_assigned: { label: "Tecnico asignado", className: "border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400", icon: Package },
      resolved: { label: "Resuelto", className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", icon: CheckCircle2 },
      closed: { label: "Cerrado", className: "border-border bg-muted/60 text-muted-foreground", icon: X },
    };
    const { label, className, icon: Icon } = map[status];
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${className}`}>
        <Icon size={10} /> {label}
      </span>
    );
  };

  const getPriorityBadge = (priority: SupportTicket["priority"]) => {
    const map: Record<typeof priority, { label: string; className: string }> = {
      low: { label: "Baja", className: "text-muted-foreground" },
      medium: { label: "Normal", className: "text-blue-600 dark:text-blue-400" },
      high: { label: "Alta", className: "text-amber-600 dark:text-amber-400" },
      critical: { label: "Critico", className: "font-extrabold text-destructive" },
    };
    const { label, className } = map[priority];
    return <span className={`text-[10px] font-bold uppercase tracking-[0.14em] ${className}`}>{label}</span>;
  };

  return (
    <div className="max-w-[1680px] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-border/70 bg-card px-5 py-4 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-foreground">Centro de soporte</h2>
          <p className="mt-1 text-sm text-muted-foreground">Consultas operativas, reclamos tecnicos y seguimiento postventa sin salir del portal.</p>
        </div>
        {!showNewForm ? (
          <Button type="button" onClick={() => setShowNewForm(true)} className="gap-2 rounded-xl">
            <Plus size={16} /> Nuevo ticket
          </Button>
        ) : null}
      </div>

      {showNewForm ? (
        <SurfaceCard tone="default" padding="lg" className="rounded-[24px] border border-border/70 bg-card shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-base font-bold text-foreground">Nuevo reclamo o consulta</h3>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => setShowNewForm(false)}>
              <X size={18} />
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Asunto</label>
                <Input value={newSubject} onChange={(event) => setNewSubject(event.target.value)} placeholder="Ej: falla tecnica en monitor" className="h-11 rounded-xl border-border/70 bg-background" required />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Prioridad</label>
                <select value={newPriority} onChange={(event) => setNewPriority(event.target.value as SupportTicket["priority"])} className="h-11 w-full rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground outline-none">
                  <option value="low">Baja</option>
                  <option value="medium">Normal</option>
                  <option value="high">Alta</option>
                  <option value="critical">Critico</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Pedido vinculado</label>
              <select value={newOrderId} onChange={(event) => setNewOrderId(event.target.value)} className="h-11 w-full rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground outline-none">
                <option value="">Ninguno / consulta general</option>
                {orders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.order_number || `#${String(order.id).slice(-6).toUpperCase()}`} - {new Date(order.created_at).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Descripcion</label>
              <textarea value={newDesc} onChange={(event) => setNewDesc(event.target.value)} placeholder="Describe el inconveniente con detalle." rows={4} className="w-full rounded-xl border border-border/70 bg-background px-4 py-3 text-sm text-foreground outline-none" required />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={() => setShowNewForm(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Enviando..." : "Enviar ticket"}</Button>
            </div>
          </form>
        </SurfaceCard>
      ) : null}

      <SurfaceCard tone="default" padding="none" className="overflow-hidden rounded-[24px] border border-border/70 bg-card shadow-sm">
        <div className="border-b border-border/70 px-5 py-4">
          <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Mis tickets</h3>
        </div>

        {loading ? (
          <div className="p-12 text-center text-muted-foreground">Cargando tickets...</div>
        ) : tickets.length === 0 ? (
          <EmptyState icon={<LifeBuoy size={20} />} title="No tenes tickets abiertos" className="py-16" />
        ) : (
          <div className="divide-y divide-border/70">
            {tickets.map((ticket) => (
              <div key={ticket.id} className="group flex cursor-pointer items-center justify-between gap-4 px-5 py-4 transition hover:bg-secondary/30" onClick={() => setSelectedTicket(ticket)}>
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-primary">
                    <MessageSquare size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h4 className="truncate text-sm font-semibold text-foreground">{ticket.subject}</h4>
                      {getPriorityBadge(ticket.priority)}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock size={10} /> Actualizado {new Date(ticket.updated_at).toLocaleDateString()}</span>
                      {ticket.order_id ? <span className="flex items-center gap-1"><Package size={10} /> Pedido vinculado</span> : null}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-5">
                  {getStatusBadge(ticket.status)}
                  <ChevronRight size={16} className="text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                </div>
              </div>
            ))}
          </div>
        )}
      </SurfaceCard>

      {selectedTicket ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setSelectedTicket(null)}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-[24px] border border-border/70 bg-card p-6 text-foreground shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <div className="mb-1 flex flex-wrap items-center gap-3">
                  <h3 className="text-xl font-bold">{selectedTicket.subject}</h3>
                  {getStatusBadge(selectedTicket.status)}
                </div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">ID: {selectedTicket.id}</p>
              </div>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => setSelectedTicket(null)}>
                <X size={20} />
              </Button>
            </div>

            <div className="mb-6 rounded-[20px] bg-muted px-4 py-4">
              <div className="mb-3 flex items-center gap-2 text-muted-foreground">
                <AlertCircle size={14} />
                <span className="text-[10px] font-bold uppercase tracking-[0.16em]">Mensaje original</span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{selectedTicket.description}</p>
            </div>

            {selectedTicket.order_id ? (
              <div className="mb-6 flex items-center justify-between rounded-[20px] border border-border/70 bg-background px-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Package size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold">Pedido vinculado</p>
                    <p className="text-[11px] text-muted-foreground">ID: {selectedTicket.order_id}</p>
                  </div>
                </div>
                <Button type="button" variant="toolbar" size="sm">Ver pedido</Button>
              </div>
            ) : null}

            <div className="rounded-[20px] border border-border/70 bg-background px-6 py-6 text-center">
              <AlertTriangle size={24} className="mx-auto mb-3 text-amber-500" />
              <h4 className="mb-1 text-sm font-bold">Un tecnico esta revisando tu caso</h4>
              <p className="mb-4 text-xs text-muted-foreground">Recibiras una notificacion cuando haya una respuesta. Evita abrir multiples tickets para el mismo asunto.</p>
              <Button type="button" onClick={() => setSelectedTicket(null)}>Entendido</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
