import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { FolderPlus, FolderOpen, MoreVertical, Plus, Briefcase } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
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
}

export function ProjectsPanel({ orders, quotes, profileId }: ProjectsPanelProps) {
  const { currency } = useCurrency();
  const [projects, setProjects] = useState<Project[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  useEffect(() => {
    async function loadProjects() {
      const { data, error } = await supabase.from("projects").select("*").eq("client_id", profileId).order("created_at", { ascending: false });
      if (!error && data) {
        setProjects(
          data.map((project) => ({
            id: project.id,
            name: project.name,
            description: project.description,
            createdAt: project.created_at,
            orderIds: project.order_ids || [],
            quoteIds: project.quote_ids || [],
          })),
        );
      }
    }
    void loadProjects();
  }, [profileId]);

  const handleCreateProject = async () => {
    if (!newName) return;
    const newProject = { client_id: profileId, name: newName, description: newDesc, order_ids: [], quote_ids: [] };
    const { data, error } = await supabase.from("projects").insert(newProject).select().single();
    if (!error && data) {
      const formatted: Project = {
        id: data.id,
        name: data.name,
        description: data.description,
        createdAt: data.created_at,
        orderIds: data.order_ids || [],
        quoteIds: data.quote_ids || [],
      };
      setProjects((prev) => [formatted, ...prev]);
      setNewName("");
      setNewDesc("");
      setShowAdd(false);
    }
  };

  const projectTotals = useMemo(() => {
    return new Map(
      projects.map((project) => {
        const ordersTotal = orders
          .filter((order) => project.orderIds.includes(String(order.id)))
          .reduce((sum, order) => sum + order.total, 0);
        const quotesTotal = quotes
          .filter((quote) => project.quoteIds.includes(String(quote.id)))
          .reduce((sum, quote) => sum + quote.total, 0);
        return [project.id, ordersTotal + quotesTotal] as const;
      })
    );
  }, [projects, orders, quotes]);

  return (
    <div className="max-w-[1680px] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-border/70 bg-card px-5 py-4 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-foreground">Proyectos</h2>
          <p className="mt-1 text-sm text-muted-foreground">Agrupa compras y cotizaciones por obra, sede o cliente final sin salir del portal.</p>
        </div>
        <Button type="button" onClick={() => setShowAdd(true)} className="gap-2 rounded-xl">
          <FolderPlus size={16} /> Nuevo proyecto
        </Button>
      </div>

      {showAdd ? (
        <SurfaceCard tone="default" padding="lg" className="rounded-[24px] border border-border/70 bg-card shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-foreground">
            <Plus size={16} className="text-primary" /> Crear proyecto
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Input placeholder="Nombre del proyecto" value={newName} onChange={(event) => setNewName(event.target.value)} className="h-11 rounded-xl border-border/70 bg-background" />
            <Input placeholder="Descripcion breve" value={newDesc} onChange={(event) => setNewDesc(event.target.value)} className="h-11 rounded-xl border-border/70 bg-background" />
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdd(false)}>Cancelar</Button>
            <Button type="button" size="sm" onClick={handleCreateProject}>Crear proyecto</Button>
          </div>
        </SurfaceCard>
      ) : null}

      {projects.length === 0 ? (
        <EmptyState
          icon={<Briefcase size={22} />}
          title="No tienes proyectos activos"
          description="Crea tu primer proyecto para separar compras, cotizaciones y montos por carpeta comercial."
          className="rounded-[24px] border border-dashed border-border/70 bg-card py-20"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <SurfaceCard key={project.id} tone="default" padding="lg" className="group rounded-[24px] border border-border/70 bg-card shadow-sm transition hover:border-primary/30 hover:shadow-md">
              <div className="mb-4 flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Briefcase size={20} />
                </div>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-muted-foreground">
                  <MoreVertical size={16} />
                </Button>
              </div>

              <h4 className="mb-1 truncate text-base font-bold text-foreground">{project.name}</h4>
              <p className="mb-6 line-clamp-2 text-sm text-muted-foreground">{project.description || "Sin descripcion"}</p>

              <div className="mb-4 grid grid-cols-2 gap-3 border-b border-border/70 pb-4">
                <div className="rounded-xl bg-background px-3 py-3 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Pedidos</p>
                  <p className="text-sm font-bold text-foreground">{project.orderIds.length}</p>
                </div>
                <div className="rounded-xl bg-background px-3 py-3 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Cotizaciones</p>
                  <p className="text-sm font-bold text-foreground">{project.quoteIds.length}</p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Inversion total</p>
                  <p className="text-sm font-bold text-primary">{formatMoneyAmount(projectTotals.get(project.id) ?? 0, currency, 0)}</p>
                </div>
                <Button type="button" variant="toolbar" size="sm" className="rounded-xl text-[11px]" disabled>
                  Administrar <FolderOpen size={12} className="ml-1.5" />
                </Button>
              </div>
            </SurfaceCard>
          ))}
        </div>
      )}
    </div>
  );
}
