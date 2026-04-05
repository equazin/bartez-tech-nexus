import { useEffect, useMemo, useState } from "react";
import { Plus, Save, Search, Shield, UserCog, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  ACCESS_ROLE_LABELS,
  ACCESS_STATUS_LABELS,
  extractAccessRecords,
  formatAccessNote,
  type PortalAccessRole,
  type PortalAccessStatus,
} from "@/lib/clientAccess";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SurfaceCard } from "@/components/ui/surface-card";
import { cn } from "@/lib/utils";

interface ClientRow {
  id: string;
  company_name: string;
  contact_name: string;
  role: string;
  phone?: string;
  email?: string;
  active?: boolean;
}

interface UsersPermissionsTabProps {
  isDark?: boolean;
  clients: ClientRow[];
  onRefresh: () => void;
}

interface AccessDraftState {
  fullName: string;
  email: string;
  role: PortalAccessRole;
  status: PortalAccessStatus;
  branches: string;
  orderLimit: string;
  comment: string;
}

function emptyAccessDraft(): AccessDraftState {
  return {
    fullName: "",
    email: "",
    role: "comprador",
    status: "pending",
    branches: "",
    orderLimit: "0",
    comment: "",
  };
}

export function UsersPermissionsTab({ isDark: _isDark = true, clients, onRefresh }: UsersPermissionsTabProps) {
  const [query, setQuery] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { role: string; active: boolean }>>({});
  const [accessDrafts, setAccessDrafts] = useState<Record<string, AccessDraftState>>({});
  const [newAccess, setNewAccess] = useState<AccessDraftState>(emptyAccessDraft);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [accessNotes, setAccessNotes] = useState<Array<{ id: string; client_id: string; body: string; created_at: string }>>([]);
  const [savingAccessId, setSavingAccessId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadAccessNotes() {
      const { data } = await supabase.from("client_notes").select("id, client_id, body, created_at").order("created_at", { ascending: false }).limit(300);
      if (!active) return;
      setAccessNotes((data as Array<{ id: string; client_id: string; body: string; created_at: string }> | null) ?? []);
    }

    void loadAccessNotes();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedClientId && clients[0]?.id) {
      setSelectedClientId(clients[0].id);
    }
  }, [clients, selectedClientId]);

  const filteredClients = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return clients.filter((client) => {
      if (!normalized) return true;
      return [client.company_name, client.contact_name, client.email, client.phone]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [clients, query]);

  const accessRecords = useMemo(() => extractAccessRecords(accessNotes), [accessNotes]);

  const accessByClient = useMemo(() => {
    const map = new Map<string, typeof accessRecords>();
    filteredClients.forEach((client) => {
      map.set(client.id, accessRecords.filter((record) => record.clientId === client.id));
    });
    return map;
  }, [accessRecords, filteredClients]);

  function getDraft(client: ClientRow) {
    return drafts[client.id] ?? { role: client.role ?? "client", active: client.active ?? true };
  }

  function getAccessDraft(noteId: string) {
    const access = accessRecords.find((record) => record.id === noteId);
    if (!access) return emptyAccessDraft();
    return accessDrafts[noteId] ?? {
      fullName: access.fullName,
      email: access.email,
      role: access.role,
      status: access.status,
      branches: access.allowedBranches.join(", "),
      orderLimit: String(access.orderLimit || 0),
      comment: access.comment,
    };
  }

  async function reloadAccessNotes() {
    const { data } = await supabase.from("client_notes").select("id, client_id, body, created_at").order("created_at", { ascending: false }).limit(300);
    setAccessNotes((data as Array<{ id: string; client_id: string; body: string; created_at: string }> | null) ?? []);
  }

  async function saveClient(client: ClientRow) {
    const draft = getDraft(client);
    setSavingId(client.id);
    try {
      const { error } = await supabase.from("profiles").update({ role: draft.role, active: draft.active }).eq("id", client.id);
      if (error) throw error;
      onRefresh();
    } finally {
      setSavingId(null);
    }
  }

  async function saveAccessRecord(noteId: string, clientId: string) {
    const draft = getAccessDraft(noteId);
    setSavingAccessId(noteId);
    try {
      const { error } = await supabase
        .from("client_notes")
        .update({
          body: formatAccessNote({
            fullName: draft.fullName,
            email: draft.email,
            role: draft.role,
            status: draft.status,
            allowedBranches: draft.branches.split(",").map((branch) => branch.trim()).filter(Boolean),
            orderLimit: Number(draft.orderLimit) || 0,
            comment: draft.comment,
          }),
          tipo: "seguimiento",
        })
        .eq("id", noteId)
        .eq("client_id", clientId);
      if (error) throw error;
      await reloadAccessNotes();
    } finally {
      setSavingAccessId(null);
    }
  }

  async function createAccessRecord() {
    if (!selectedClientId || !newAccess.email.trim() || !newAccess.fullName.trim()) return;
    setSavingAccessId("new");
    try {
      const { error } = await supabase.from("client_notes").insert({
        client_id: selectedClientId,
        tipo: "seguimiento",
        body: formatAccessNote({
          fullName: newAccess.fullName,
          email: newAccess.email,
          role: newAccess.role,
          status: newAccess.status,
          allowedBranches: newAccess.branches.split(",").map((branch) => branch.trim()).filter(Boolean),
          orderLimit: Number(newAccess.orderLimit) || 0,
          comment: newAccess.comment,
        }),
      });
      if (error) throw error;
      setNewAccess(emptyAccessDraft());
      await reloadAccessNotes();
    } finally {
      setSavingAccessId(null);
    }
  }

  return (
    <div className="space-y-4">
      <SurfaceCard tone="default" padding="md" className="rounded-[24px] border-border/70">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Clientes</p>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Accesos y permisos</h2>
              <p className="text-sm text-muted-foreground">Roles, delegados del portal, sucursales permitidas y limites por usuario.</p>
            </div>
          </div>
          <label className="relative block xl:w-[340px]">
            <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar cliente, email o telefono"
              className="h-10 w-full rounded-xl border border-border/70 bg-background pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40"
            />
          </label>
        </div>
      </SurfaceCard>

      <SurfaceCard tone="default" padding="none" className="overflow-hidden rounded-[24px] border-border/70">
        <div className="grid grid-cols-[1.3fr_1fr_140px_120px_110px] gap-3 bg-muted/50 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          <span>Cliente</span>
          <span>Contacto</span>
          <span>Rol</span>
          <span>Estado</span>
          <span className="text-right">Guardar</span>
        </div>

        {filteredClients.length === 0 ? (
          <EmptyState className="py-16" title="Sin clientes" description="No hay clientes para el filtro actual." icon={<Users size={24} />} />
        ) : (
          filteredClients.map((client) => {
            const draft = getDraft(client);
            return (
              <div key={client.id} className="grid grid-cols-[1.3fr_1fr_140px_120px_110px] items-center gap-3 border-t border-border/70 bg-card px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{client.company_name || client.contact_name || client.id}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{client.email || "Sin email visible"}</p>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground/80">{client.contact_name || "Sin contacto"}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{client.phone || "Sin telefono"}</p>
                </div>
                <select
                  value={draft.role}
                  onChange={(event) => setDrafts((prev) => ({ ...prev, [client.id]: { ...draft, role: event.target.value } }))}
                  className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground outline-none focus:border-primary/40"
                >
                  <option value="client">Cliente</option>
                  <option value="cliente">Cliente (ES)</option>
                  <option value="sales">Sales</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  onClick={() => setDrafts((prev) => ({ ...prev, [client.id]: { ...draft, active: !draft.active } }))}
                  className={cn(
                    "inline-flex items-center justify-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold border",
                    draft.active
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400",
                  )}
                >
                  {draft.active ? <Shield size={11} /> : <UserCog size={11} />}
                  {draft.active ? "Activa" : "Bloq."}
                </button>
                <div className="text-right">
                  <Button size="sm" onClick={() => void saveClient(client)} disabled={savingId === client.id}>
                    <Save size={11} />
                    {savingId === client.id ? "..." : "Guardar"}
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </SurfaceCard>

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <SurfaceCard tone="default" padding="md" className="space-y-3 rounded-[24px] border-border/70">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Plus size={15} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Nuevo acceso</p>
              <h3 className="text-sm font-semibold text-foreground">Alta por empresa</h3>
            </div>
          </div>
          <select value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)} className="h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground outline-none focus:border-primary/40">
            {clients.map((client) => (
              <option key={client.id} value={client.id}>{client.company_name || client.contact_name || client.id}</option>
            ))}
          </select>
          <input value={newAccess.fullName} onChange={(event) => setNewAccess((prev) => ({ ...prev, fullName: event.target.value }))} placeholder="Nombre completo" className="h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40" />
          <input value={newAccess.email} onChange={(event) => setNewAccess((prev) => ({ ...prev, email: event.target.value }))} placeholder="Email" className="h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40" />
          <div className="grid grid-cols-2 gap-3">
            <select value={newAccess.role} onChange={(event) => setNewAccess((prev) => ({ ...prev, role: event.target.value as PortalAccessRole }))} className="h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground outline-none focus:border-primary/40">
              {Object.entries(ACCESS_ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select value={newAccess.status} onChange={(event) => setNewAccess((prev) => ({ ...prev, status: event.target.value as PortalAccessStatus }))} className="h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground outline-none focus:border-primary/40">
              {Object.entries(ACCESS_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <input value={newAccess.branches} onChange={(event) => setNewAccess((prev) => ({ ...prev, branches: event.target.value }))} placeholder="Sucursales permitidas" className="h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40" />
          <input value={newAccess.orderLimit} onChange={(event) => setNewAccess((prev) => ({ ...prev, orderLimit: event.target.value }))} placeholder="Limite por usuario (ARS)" className="h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40" />
          <textarea rows={3} value={newAccess.comment} onChange={(event) => setNewAccess((prev) => ({ ...prev, comment: event.target.value }))} placeholder="Observaciones internas" className="w-full rounded-2xl border border-border/70 bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40" />
          <Button onClick={() => void createAccessRecord()} disabled={savingAccessId === "new" || !newAccess.email.trim() || !newAccess.fullName.trim()}>
            <Plus size={12} />
            {savingAccessId === "new" ? "Creando..." : "Crear usuario"}
          </Button>
        </SurfaceCard>

        <div className="space-y-3">
          {filteredClients.length === 0 ? (
            <EmptyState title="Sin empresas" description="No hay empresas para administrar accesos." icon={<Users size={24} />} />
          ) : (
            filteredClients.map((client) => {
              const companyAccess = accessByClient.get(client.id) ?? [];
              return (
                <SurfaceCard key={`access-${client.id}`} tone="default" padding="none" className="overflow-hidden rounded-[24px] border-border/70">
                  <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-card px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{client.company_name || client.contact_name || client.id}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Acceso principal: {client.email || "sin email"} ? {companyAccess.filter((entry) => entry.status === "active").length} usuario(s) activo(s)
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full border border-border/70 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                      <Users size={11} />
                      {companyAccess.length} delegado(s)
                    </span>
                  </div>

                  {companyAccess.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-muted-foreground">Todavia no hay usuarios delegados para esta empresa.</div>
                  ) : (
                    companyAccess.map((access) => {
                      const draft = getAccessDraft(access.id);
                      return (
                        <div key={access.id} className="grid gap-3 border-t border-border/70 px-4 py-3 md:grid-cols-[1fr_140px_140px_1fr_150px_110px]">
                          <div className="space-y-2">
                            <input value={draft.fullName} onChange={(event) => setAccessDrafts((prev) => ({ ...prev, [access.id]: { ...draft, fullName: event.target.value } }))} className="h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground outline-none focus:border-primary/40" />
                            <input value={draft.email} onChange={(event) => setAccessDrafts((prev) => ({ ...prev, [access.id]: { ...draft, email: event.target.value } }))} className="h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground outline-none focus:border-primary/40" />
                          </div>
                          <select value={draft.role} onChange={(event) => setAccessDrafts((prev) => ({ ...prev, [access.id]: { ...draft, role: event.target.value as PortalAccessRole } }))} className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground outline-none focus:border-primary/40">
                            {Object.entries(ACCESS_ROLE_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </select>
                          <select value={draft.status} onChange={(event) => setAccessDrafts((prev) => ({ ...prev, [access.id]: { ...draft, status: event.target.value as PortalAccessStatus } }))} className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground outline-none focus:border-primary/40">
                            {Object.entries(ACCESS_STATUS_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </select>
                          <input value={draft.branches} onChange={(event) => setAccessDrafts((prev) => ({ ...prev, [access.id]: { ...draft, branches: event.target.value } }))} placeholder="Sucursales" className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40" />
                          <input value={draft.orderLimit} onChange={(event) => setAccessDrafts((prev) => ({ ...prev, [access.id]: { ...draft, orderLimit: event.target.value } }))} placeholder="Limite" className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40" />
                          <div className="text-right">
                            <Button size="sm" onClick={() => void saveAccessRecord(access.id, client.id)} disabled={savingAccessId === access.id}>
                              <Save size={11} />
                              {savingAccessId === access.id ? "..." : "Guardar"}
                            </Button>
                          </div>
                          <div className="md:col-span-6">
                            <textarea rows={2} value={draft.comment} onChange={(event) => setAccessDrafts((prev) => ({ ...prev, [access.id]: { ...draft, comment: event.target.value } }))} placeholder="Comentario interno" className="w-full rounded-2xl border border-border/70 bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40" />
                          </div>
                        </div>
                      );
                    })
                  )}
                </SurfaceCard>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
