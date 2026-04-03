import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { FolderPlus, FolderOpen, MoreVertical, Plus, Briefcase, FileText, CheckCircle2, TrendingUp, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoneyAmount } from "@/lib/money";
import { useCurrency } from "@/context/CurrencyContext";
import type { PortalOrder } from "@/hooks/useOrders";
import type { Quote } from "@/models/quote";

interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  orderIds: string[];
  quoteIds: string[];
}

interface ProjectsPanelProps {
  orders: PortalOrder[];
  quotes: Quote[];
  profileId: string;
  isDark: boolean;
}

export function ProjectsPanel({ orders, quotes, profileId, isDark }: ProjectsPanelProps) {
  const { currency } = useCurrency();
  const dk = (d: string, l: string) => isDark ? d : l;
  const [projects, setProjects] = useState<Project[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  useEffect(() => {
    async function loadProjects() {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("client_id", profileId)
        .order("created_at", { ascending: false });
      
      if (!error && data) {
        setProjects(data.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          createdAt: p.created_at,
          orderIds: p.order_ids || [],
          quoteIds: p.quote_ids || []
        })));
      }
    }
    loadProjects();
  }, [profileId]);

  const handleCreateProject = async () => {
    if (!newName) return;
    const newProj = {
      client_id: profileId,
      name: newName,
      description: newDesc,
      order_ids: [],
      quote_ids: []
    };

    const { data, error } = await supabase
      .from("projects")
      .insert(newProj)
      .select()
      .single();

    if (!error && data) {
      const formatted: Project = {
        id: data.id,
        name: data.name,
        description: data.description,
        createdAt: data.created_at,
        orderIds: data.order_ids || [],
        quoteIds: data.quote_ids || []
      };
      setProjects([formatted, ...projects]);
      setNewName("");
      setNewDesc("");
      setShowAdd(false);
    }
  };

  const getProjectTotal = (project: Project) => {
    const pOrders = orders.filter(o => project.orderIds.includes(String(o.id)));
    const pQuotes = quotes.filter(q => project.quoteIds.includes(String(q.id)));
    
    return pOrders.reduce((s, o) => s + o.total, 0) + pQuotes.reduce((s, q) => s + q.total, 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-xl font-bold ${dk("text-white", "text-foreground")}`}>Panel de Proyectos</h2>
          <p className="text-xs text-muted-foreground mt-1">Organice sus compras y cotizaciones por carpetas de obra o cliente final.</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="bg-primary text-white gap-2">
          <FolderPlus size={16} /> Nuevo Proyecto
        </Button>
      </div>

      {showAdd && (
        <div className={`p-6 rounded-2xl border ${dk("bg-[#0d0d0d] border-white/10", "bg-white border-black/5 shadow-lg")}`}>
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <Plus size={16} className="text-primary" /> Crear Carpeta de Proyecto
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Input 
              placeholder="Nombre del Proyecto (ej: Sede Central Rosario)" 
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className={dk("bg-[#1a1a1a]", "bg-gray-50")}
            />
            <Input 
              placeholder="Descripción breve" 
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              className={dk("bg-[#1a1a1a]", "bg-gray-50")}
            />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleCreateProject}>Crear Proyecto</Button>
          </div>
        </div>
      )}

      {projects.length === 0 ? (
        <div className={`text-center py-20 rounded-3xl border border-dashed ${dk("border-white/10", "border-black/10 bg-gray-50/50")}`}>
          <Briefcase size={40} className="mx-auto mb-4 text-muted-foreground/30" />
          <h3 className="text-base font-bold text-muted-foreground">No tiene proyectos activos.</h3>
          <p className="text-xs text-muted-foreground/60 mt-1">Cree su primer proyecto para empezar a agrupar sus cotizaciones.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <div key={project.id} className={`group p-5 rounded-2xl border transition-all hover:border-primary/40 ${dk("bg-[#0d0d0d] border-white/5", "bg-white border-black/5 shadow-sm")}`}>
               <div className="flex items-start justify-between mb-4">
                  <div className={`p-2 rounded-xl bg-primary/10 text-primary`}>
                    <Briefcase size={20} />
                  </div>
                  <button className="text-muted-foreground/40 hover:text-white transition">
                    <MoreVertical size={16} />
                  </button>
               </div>
               
               <h4 className="font-bold text-base mb-1 truncate">{project.name}</h4>
               <p className="text-xs text-muted-foreground line-clamp-1 mb-6">{project.description || "Sin descripción"}</p>
               
               <div className="grid grid-cols-2 gap-3 pb-4 mb-4 border-b border-white/5">
                  <div className="text-center p-2 rounded-lg bg-surface/50">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Pedidos</p>
                    <p className="text-sm font-bold">{project.orderIds.length}</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-surface/50">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Cotizac.</p>
                    <p className="text-sm font-bold">{project.quoteIds.length}</p>
                  </div>
               </div>

               <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Inversión Total</p>
                    <p className="text-sm font-black text-primary">{formatMoneyAmount(getProjectTotal(project), currency, 0)}</p>
                  </div>
                  <Button variant="outline" size="sm" className="rounded-lg h-8 text-[10px]">
                    Administrar <FolderOpen size={12} className="ml-1.5" />
                  </Button>
               </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
