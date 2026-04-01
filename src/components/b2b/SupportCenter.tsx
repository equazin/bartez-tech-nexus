import { useState, useEffect } from "react";
import { 
  LifeBuoy, Plus, Search, MessageSquare, Clock, CheckCircle2, 
  AlertCircle, AlertTriangle, ChevronRight, FileText, Package, X 
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import type { PortalOrder } from "@/hooks/useOrders";

export interface SupportTicket {
  id: string;
  subject: string;
  description: string;
  status: 'open' | 'in_analysis' | 'tech_assigned' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  order_id?: string;
  product_id?: number;
  created_at: string;
  updated_at: string;
}

interface SupportCenterProps {
  isDark: boolean;
  orders: PortalOrder[];
}

export function SupportCenter({ isDark, orders }: SupportCenterProps) {
  const { profile } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);

  // Form states
  const [newSubject, setNewSubject] = useState("");
  const [newDesc, setNewDesc]       = useState("");
  const [newOrderId, setNewOrderId] = useState("");
  const [newPriority, setNewPriority] = useState<SupportTicket['priority']>("medium");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const dk = (d: string, l: string) => (isDark ? d : l);

  useEffect(() => {
    async function fetchTickets() {
      if (!profile?.id) return;
      try {
        const { data, error } = await supabase
          .from("support_tickets")
          .select("*")
          .order("updated_at", { ascending: false });

        if (!error && data) {
          setTickets(data as SupportTicket[]);
        }
      } catch (err) {
        console.error("Error fetching tickets:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchTickets();
  }, [profile?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
          status: 'open'
        })
        .select()
        .single();

      if (!error && data) {
        setTickets([data as SupportTicket, ...tickets]);
        setShowNewForm(false);
        setNewSubject("");
        setNewDesc("");
        setNewOrderId("");
        toast.success("Ticket creado correctamente. Un asesor te contactará pronto.");
      } else {
        toast.error("Error al crear el ticket.");
      }
    } catch (err) {
      toast.error("Error inesperado al crear el ticket.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: SupportTicket['status']) => {
    const map: Record<typeof status, { label: string; class: string; icon: any }> = {
      open:          { label: "Abierto",       class: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: Clock },
      in_analysis:   { label: "En análisis",   class: "bg-amber-500/10 text-amber-400 border-amber-500/20", icon: Search },
      tech_assigned: { label: "Técnico asignado", class: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20", icon: Package },
      resolved:      { label: "Resuelto",      class: "bg-green-500/10 text-green-400 border-green-500/20", icon: CheckCircle2 },
      closed:        { label: "Cerrado",       class: "bg-gray-500/10 text-gray-400 border-gray-500/20", icon: X },
    };
    const { label, class: className, icon: Icon } = map[status];
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${className}`}>
        <Icon size={10} /> {label}
      </span>
    );
  };

  const getPriorityBadge = (prio: SupportTicket['priority']) => {
    const map: Record<typeof prio, { label: string; class: string }> = {
      low:      { label: "Baja", class: "text-gray-500" },
      medium:   { label: "Normal", class: "text-blue-500" },
      high:     { label: "Alta", class: "text-orange-500" },
      critical: { label: "CRÍTICO", class: "text-red-500 font-extrabold animate-pulse" },
    };
    const { label, class: className } = map[prio];
    return <span className={`text-[10px] font-bold uppercase ${className}`}>{label}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header Area */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className={`text-xl font-extrabold ${dk("text-white", "text-[#171717]")}`}>Centro de Soporte & RMA</h2>
          <p className={`text-xs mt-1 ${dk("text-gray-500", "text-[#737373]")}`}>Gestiona tus reclamos técnicos y consultas administrativas de manera profesional.</p>
        </div>
        {!showNewForm && (
          <button 
            onClick={() => setShowNewForm(true)}
            className="flex items-center gap-2 bg-[#2D9F6A] hover:bg-[#25835A] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg shadow-green-500/10"
          >
            <Plus size={16} /> Abrir nuevo Ticket
          </button>
        )}
      </div>

      {/* New Ticket Form */}
      {showNewForm && (
        <div className={`p-6 rounded-2xl border ${dk("bg-[#0d0d0d] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} shadow-xl animate-in fade-in slide-in-from-top-4 duration-300`}>
          <div className="flex items-center justify-between mb-6">
             <h3 className={`text-lg font-bold ${dk("text-white", "text-[#171717]")}`}>Nuevo Reclamo / Consulta</h3>
             <button onClick={() => setShowNewForm(false)} className="text-gray-500 hover:text-white transition"><X size={18} /></button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className={`text-[10px] font-bold uppercase tracking-wider ${dk("text-gray-500", "text-[#737373]")}`}>Asunto del Ticket</label>
                <input 
                  type="text" 
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="Ej: Falla técnica en monitor LG-24BP"
                  className={`w-full px-4 py-2.5 rounded-xl text-sm border focus:ring-2 focus:ring-[#2D9F6A] outline-none transition-all ${dk("bg-[#171717] border-[#222] text-white", "bg-white border-[#e5e5e5] text-[#171717]")}`}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className={`text-[10px] font-bold uppercase tracking-wider ${dk("text-gray-500", "text-[#737373]")}`}>Prioridad</label>
                <select 
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as any)}
                  className={`w-full px-4 py-2.5 rounded-xl text-sm border focus:ring-2 focus:ring-[#2D9F6A] outline-none transition-all ${dk("bg-[#171717] border-[#222] text-white", "bg-white border-[#e5e5e5] text-[#171717]")}`}
                >
                  <option value="low">Baja (Consultas generales)</option>
                  <option value="medium">Normal (Dudas de pedidos)</option>
                  <option value="high">Alta (Fallas de producto)</option>
                  <option value="critical">CRÍTICO (Bloqueo operacional)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className={`text-[10px] font-bold uppercase tracking-wider ${dk("text-gray-500", "text-[#737373]")}`}>Vincular a Pedido (Opcional)</label>
              <select 
                value={newOrderId}
                onChange={(e) => setNewOrderId(e.target.value)}
                className={`w-full px-4 py-2.5 rounded-xl text-sm border focus:ring-2 focus:ring-[#2D9F6A] outline-none transition-all ${dk("bg-[#171717] border-[#222] text-white", "bg-white border-[#e5e5e5] text-[#171717]")}`}
              >
                <option value="">Ninguno / Consulta General</option>
                {orders.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.order_number || `#${String(o.id).slice(-6).toUpperCase()}`} - {new Date(o.created_at).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className={`text-[10px] font-bold uppercase tracking-wider ${dk("text-gray-500", "text-[#737373]")}`}>Descripción Detallada</label>
              <textarea 
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Por favor describe el inconveniente lo más detallado posible..."
                rows={4}
                className={`w-full px-4 py-2.5 rounded-xl text-sm border focus:ring-2 focus:ring-[#2D9F6A] outline-none transition-all ${dk("bg-[#171717] border-[#222] text-white", "bg-white border-[#e5e5e5] text-[#171717]")}`}
                required
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
               <button 
                 type="button" 
                 onClick={() => setShowNewForm(false)}
                 className={`px-4 py-2 rounded-xl text-xs font-bold ${dk("text-gray-400 hover:text-white", "text-gray-500 hover:text-black")}`}
               >
                 Cancelar
               </button>
               <button 
                 type="submit"
                 disabled={isSubmitting}
                 className="bg-[#2D9F6A] hover:bg-[#25835A] text-white px-6 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
               >
                 {isSubmitting ? "Enviando..." : "Enviar Ticket"}
               </button>
            </div>
          </form>
        </div>
      )}

      {/* Tickets List */}
      <div className={`rounded-2xl border ${dk("bg-[#0d0d0d] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} overflow-hidden shadow-xl`}>
        <div className="px-5 py-4 border-b border-gray-100 dark:border-[#1a1a1a]">
          <h3 className={`text-xs font-bold uppercase tracking-widest ${dk("text-gray-500", "text-[#737373]")}`}>Mis Tickets Recientes</h3>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-500">Cargando tickets...</div>
        ) : tickets.length === 0 ? (
          <div className="p-12 text-center">
            <LifeBuoy size={32} className="mx-auto mb-3 opacity-20" />
            <p className={`text-sm font-medium ${dk("text-gray-500", "text-[#737373]")}`}>No tienes tickets abiertos.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-[#1a1a1a]">
            {tickets.map((ticket) => (
              <div 
                key={ticket.id} 
                className={`p-5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[#121212] transition-colors cursor-pointer group`}
                onClick={() => setSelectedTicket(ticket)}
              >
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${dk("bg-[#171717] text-[#2D9F6A]", "bg-[#f0f9f4] text-[#2D9F6A]")}`}>
                    <MessageSquare size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                       <h4 className={`text-sm font-bold truncate ${dk("text-white", "text-[#171717]")}`}>{ticket.subject}</h4>
                       {getPriorityBadge(ticket.priority)}
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-gray-500">
                      <span className="flex items-center gap-1"><Clock size={10} /> Actualizado {new Date(ticket.updated_at).toLocaleDateString()}</span>
                      {ticket.order_id && (
                        <span className="flex items-center gap-1"><Package size={10} /> Pedido vinculado</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 shrink-0">
                  {getStatusBadge(ticket.status)}
                  <ChevronRight size={16} className={`text-gray-400 group-hover:text-[#2D9F6A] transition-transform group-hover:translate-x-1`} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ticket Details Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" onClick={() => setSelectedTicket(null)}>
          <div 
             className={`w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border shadow-2xl p-6 ${dk("bg-[#0d0d0d] border-[#1f1f1f] text-white", "bg-white border-[#e5e5e5] text-[#171717]")}`}
             onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-xl font-extrabold">{selectedTicket.subject}</h3>
                  {getStatusBadge(selectedTicket.status)}
                </div>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">ID: {selectedTicket.id}</p>
              </div>
              <button onClick={() => setSelectedTicket(null)} className="text-gray-500 hover:text-white transition"><X size={20} /></button>
            </div>

            <div className={`p-4 rounded-xl mb-6 ${dk("bg-[#171717]", "bg-[#f9f9f9]")}`}>
              <div className="flex items-center gap-2 mb-3 grayscale opacity-60">
                 <AlertCircle size={14} />
                 <span className="text-[10px] font-bold uppercase">Mensaje Original del Cliente</span>
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{selectedTicket.description}</p>
            </div>

            {selectedTicket.order_id && (
               <div className={`p-4 rounded-xl mb-6 border border-dashed flex items-center justify-between ${dk("border-[#222] bg-[#0a0a0a]", "border-gray-200 bg-white")}`}>
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-[#2D9F6A]/10 text-[#2D9F6A] flex items-center justify-center">
                      <Package size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-bold">Pedido Vinculado</p>
                      <p className="text-[10px] text-gray-500">ID: {selectedTicket.order_id}</p>
                    </div>
                  </div>
                  <button className="text-[10px] font-bold text-[#2D9F6A] hover:underline">Ver pedido</button>
               </div>
            )}

            <div className={`p-6 rounded-xl text-center border ${dk("bg-[#111] border-[#1f1f1f]", "bg-[#f8fcf9] border-green-100")}`}>
               <AlertTriangle size={24} className="mx-auto mb-3 text-amber-500" />
               <h4 className="text-sm font-bold mb-1">Un técnico está revisando tu caso</h4>
               <p className="text-xs text-gray-500 mb-4">Recibirás una notificación cuando haya una respuesta. Por favor, no abras múltiples tickets para el mismo asunto.</p>
               <button 
                 onClick={() => setSelectedTicket(null)}
                 className="bg-[#2D9F6A] hover:bg-[#25835A] text-white px-6 py-2 rounded-lg text-xs font-bold transition-all"
               >
                 Entendido
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
