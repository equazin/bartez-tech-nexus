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

export function UsersPermissionsTab({
  isDark = true,
  clients,
  onRefresh,
}: UsersPermissionsTabProps) {
  const dk = (d: string, l: string) => (isDark ? d : l);
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
      const { data } = await supabase
        .from("client_notes")
        .select("id, client_id, body, created_at")
        .order("created_at", { ascending: false })
        .limit(300);
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
      return [
        client.company_name,
        client.contact_name,
        client.email,
        client.phone,
      ]
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
    return drafts[client.id] ?? {
      role: client.role ?? "client",
      active: client.active ?? true,
    };
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
    const { data } = await supabase
      .from("client_notes")
      .select("id, client_id, body, created_at")
      .order("created_at", { ascending: false })
      .limit(300);
    setAccessNotes((data as Array<{ id: string; client_id: string; body: string; created_at: string }> | null) ?? []);
  }

  async function saveClient(client: ClientRow) {
    const draft = getDraft(client);
    setSavingId(client.id);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          role: draft.role,
          active: draft.active,
        })
        .eq("id", client.id);
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
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className={`text-base font-bold ${dk("text-white", "text-[#171717]")}`}>Accesos y permisos</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Roles, acceso al portal, sucursales permitidas y límites por usuario.
          </p>
        </div>
      </div>

      <label className="relative block max-w-md">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar cliente, email o teléfono"
          className={`w-full rounded-lg border pl-9 pr-3 py-2 text-sm outline-none ${dk("bg-[#111] border-[#262626] text-white placeholder:text-[#404040]", "bg-white border-[#e5e5e5] text-[#171717] placeholder:text-[#a3a3a3]")}`}
        />
      </label>

      <div className={`border rounded-2xl overflow-hidden ${dk("border-[#1f1f1f]", "border-[#e5e5e5]")}`}>
        <div className={`grid grid-cols-[1.3fr_1fr_120px_100px_100px] gap-3 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider ${dk("bg-[#0d0d0d] text-[#525252]", "bg-[#f5f5f5] text-[#a3a3a3]")}`}>
          <span>Cliente</span>
          <span>Contacto</span>
          <span>Rol</span>
          <span>Estado</span>
          <span className="text-right">Guardar</span>
        </div>

        {filteredClients.map((client) => {
          const draft = getDraft(client);
          return (
            <div key={client.id} className={`grid grid-cols-[1.3fr_1fr_120px_100px_100px] gap-3 px-4 py-3 items-center border-t ${dk("border-[#1a1a1a] bg-[#111]", "border-[#f0f0f0] bg-white")}`}>
              <div className="min-w-0">
                <p className={`text-sm font-semibold truncate ${dk("text-white", "text-[#171717]")}`}>{client.company_name || client.contact_name || client.id}</p>
                <p className="text-[11px] text-gray-500 truncate">{client.email || "Sin email visible"}</p>
              </div>
              <div className="min-w-0">
                <p className={`text-sm truncate ${dk("text-gray-300", "text-[#525252]")}`}>{client.contact_name || "Sin contacto"}</p>
                <p className="text-[11px] text-gray-500 truncate">{client.phone || "Sin teléfono"}</p>
              </div>
              <select
                value={draft.role}
                onChange={(event) =>
                  setDrafts((prev) => ({
                    ...prev,
                    [client.id]: { ...draft, role: event.target.value },
                  }))
                }
                className={`rounded-lg border px-2 py-2 text-xs outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717]")}`}
              >
                <option value="client">Cliente</option>
                <option value="cliente">Cliente (ES)</option>
                <option value="vendedor">Vendedor</option>
                <option value="admin">Admin</option>
              </select>
              <button
                onClick={() =>
                  setDrafts((prev) => ({
                    ...prev,
                    [client.id]: { ...draft, active: !draft.active },
                  }))
                }
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold border ${
                  draft.active
                    ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                    : "text-red-400 bg-red-500/10 border-red-500/20"
                }`}
              >
                {draft.active ? <Shield size={11} /> : <UserCog size={11} />}
                {draft.active ? "Activa" : "Bloq."}
              </button>
              <div className="text-right">
                <button
                  onClick={() => void saveClient(client)}
                  disabled={savingId === client.id}
                  className="inline-flex items-center gap-1.5 text-xs bg-[#2D9F6A] hover:bg-[#25875a] disabled:opacity-50 text-white px-3 py-2 rounded-lg transition"
                >
                  <Save size={11} />
                  {savingId === client.id ? "..." : "Guardar"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className={`border rounded-2xl p-5 space-y-3 ${dk("border-[#1f1f1f] bg-[#111]", "border-[#e5e5e5] bg-white")}`}>
          <div className="flex items-center gap-2">
            <Plus size={15} className="text-[#2D9F6A]" />
            <h3 className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>Alta de usuario por empresa</h3>
          </div>
          <select
            value={selectedClientId}
            onChange={(event) => setSelectedClientId(event.target.value)}
            className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-white border-[#e5e5e5] text-[#171717]")}`}
          >
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.company_name || client.contact_name || client.id}
              </option>
            ))}
          </select>
          <input
            value={newAccess.fullName}
            onChange={(event) => setNewAccess((prev) => ({ ...prev, fullName: event.target.value }))}
            placeholder="Nombre completo"
            className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white placeholder:text-[#404040]", "bg-white border-[#e5e5e5] text-[#171717] placeholder:text-[#a3a3a3]")}`}
          />
          <input
            value={newAccess.email}
            onChange={(event) => setNewAccess((prev) => ({ ...prev, email: event.target.value }))}
            placeholder="Email"
            className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white placeholder:text-[#404040]", "bg-white border-[#e5e5e5] text-[#171717] placeholder:text-[#a3a3a3]")}`}
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              value={newAccess.role}
              onChange={(event) => setNewAccess((prev) => ({ ...prev, role: event.target.value as PortalAccessRole }))}
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-white border-[#e5e5e5] text-[#171717]")}`}
            >
              {Object.entries(ACCESS_ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select
              value={newAccess.status}
              onChange={(event) => setNewAccess((prev) => ({ ...prev, status: event.target.value as PortalAccessStatus }))}
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-white border-[#e5e5e5] text-[#171717]")}`}
            >
              {Object.entries(ACCESS_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <input
            value={newAccess.branches}
            onChange={(event) => setNewAccess((prev) => ({ ...prev, branches: event.target.value }))}
            placeholder="Sucursales permitidas (coma separada)"
            className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white placeholder:text-[#404040]", "bg-white border-[#e5e5e5] text-[#171717] placeholder:text-[#a3a3a3]")}`}
          />
          <input
            value={newAccess.orderLimit}
            onChange={(event) => setNewAccess((prev) => ({ ...prev, orderLimit: event.target.value }))}
            placeholder="Límite por usuario (ARS)"
            className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white placeholder:text-[#404040]", "bg-white border-[#e5e5e5] text-[#171717] placeholder:text-[#a3a3a3]")}`}
          />
          <textarea
            rows={3}
            value={newAccess.comment}
            onChange={(event) => setNewAccess((prev) => ({ ...prev, comment: event.target.value }))}
            placeholder="Observaciones internas o alcance de permisos"
            className={`w-full rounded-lg border px-3 py-2 text-sm outline-none resize-none ${dk("bg-[#0d0d0d] border-[#262626] text-white placeholder:text-[#404040]", "bg-white border-[#e5e5e5] text-[#171717] placeholder:text-[#a3a3a3]")}`}
          />
          <button
            onClick={() => void createAccessRecord()}
            disabled={savingAccessId === "new" || !newAccess.email.trim() || !newAccess.fullName.trim()}
            className="inline-flex items-center gap-2 bg-[#2D9F6A] hover:bg-[#25875a] disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm transition"
          >
            <Plus size={12} />
            {savingAccessId === "new" ? "Creando..." : "Crear usuario"}
          </button>
        </div>

        <div className="space-y-3">
          {filteredClients.map((client) => {
            const companyAccess = accessByClient.get(client.id) ?? [];
            return (
              <div key={`access-${client.id}`} className={`border rounded-2xl overflow-hidden ${dk("border-[#1f1f1f]", "border-[#e5e5e5]")}`}>
                <div className={`px-4 py-3 border-b flex items-center justify-between gap-3 ${dk("border-[#1a1a1a] bg-[#111]", "border-[#f0f0f0] bg-white")}`}>
                  <div>
                    <p className={`text-sm font-semibold ${dk("text-white", "text-[#171717]")}`}>{client.company_name || client.contact_name || client.id}</p>
                    <p className="text-[11px] text-gray-500">
                      Acceso principal: {client.email || "sin email"} · {companyAccess.filter((entry) => entry.status === "active").length} usuario(s) activo(s)
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold border ${dk("border-[#262626] text-gray-400", "border-[#e5e5e5] text-[#737373]")}`}>
                    <Users size={11} />
                    {companyAccess.length} delegado(s)
                  </span>
                </div>

                {companyAccess.length === 0 ? (
                  <div className={`px-4 py-6 text-sm ${dk("bg-[#111] text-gray-500", "bg-white text-[#737373]")}`}>
                    Todavía no hay usuarios delegados para esta empresa.
                  </div>
                ) : (
                  companyAccess.map((access) => {
                    const draft = getAccessDraft(access.id);
                    return (
                      <div key={access.id} className={`grid gap-3 px-4 py-3 border-t md:grid-cols-[1fr_120px_120px_1fr_140px_100px] ${dk("border-[#1a1a1a] bg-[#111]", "border-[#f0f0f0] bg-white")}`}>
                        <div className="space-y-2">
                          <input
                            value={draft.fullName}
                            onChange={(event) =>
                              setAccessDrafts((prev) => ({
                                ...prev,
                                [access.id]: { ...draft, fullName: event.target.value },
                              }))
                            }
                            className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-[#fafafa] border-[#e5e5e5] text-[#171717]")}`}
                          />
                          <input
                            value={draft.email}
                            onChange={(event) =>
                              setAccessDrafts((prev) => ({
                                ...prev,
                                [access.id]: { ...draft, email: event.target.value },
                              }))
                            }
                            className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-[#fafafa] border-[#e5e5e5] text-[#171717]")}`}
                          />
                        </div>

                        <select
                          value={draft.role}
                          onChange={(event) =>
                            setAccessDrafts((prev) => ({
                              ...prev,
                              [access.id]: { ...draft, role: event.target.value as PortalAccessRole },
                            }))
                          }
                          className={`rounded-lg border px-3 py-2 text-sm outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-[#fafafa] border-[#e5e5e5] text-[#171717]")}`}
                        >
                          {Object.entries(ACCESS_ROLE_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>

                        <select
                          value={draft.status}
                          onChange={(event) =>
                            setAccessDrafts((prev) => ({
                              ...prev,
                              [access.id]: { ...draft, status: event.target.value as PortalAccessStatus },
                            }))
                          }
                          className={`rounded-lg border px-3 py-2 text-sm outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-[#fafafa] border-[#e5e5e5] text-[#171717]")}`}
                        >
                          {Object.entries(ACCESS_STATUS_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>

                        <input
                          value={draft.branches}
                          onChange={(event) =>
                            setAccessDrafts((prev) => ({
                              ...prev,
                              [access.id]: { ...draft, branches: event.target.value },
                            }))
                          }
                          placeholder="Sucursales"
                          className={`rounded-lg border px-3 py-2 text-sm outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-[#fafafa] border-[#e5e5e5] text-[#171717]")}`}
                        />

                        <input
                          value={draft.orderLimit}
                          onChange={(event) =>
                            setAccessDrafts((prev) => ({
                              ...prev,
                              [access.id]: { ...draft, orderLimit: event.target.value },
                            }))
                          }
                          placeholder="Límite"
                          className={`rounded-lg border px-3 py-2 text-sm outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-[#fafafa] border-[#e5e5e5] text-[#171717]")}`}
                        />

                        <div className="text-right">
                          <button
                            onClick={() => void saveAccessRecord(access.id, client.id)}
                            disabled={savingAccessId === access.id}
                            className="inline-flex items-center gap-1.5 text-xs bg-[#2D9F6A] hover:bg-[#25875a] disabled:opacity-50 text-white px-3 py-2 rounded-lg transition"
                          >
                            <Save size={11} />
                            {savingAccessId === access.id ? "..." : "Guardar"}
                          </button>
                        </div>

                        <div className="md:col-span-6">
                          <textarea
                            rows={2}
                            value={draft.comment}
                            onChange={(event) =>
                              setAccessDrafts((prev) => ({
                                ...prev,
                                [access.id]: { ...draft, comment: event.target.value },
                              }))
                            }
                            placeholder="Comentario interno"
                            className={`w-full rounded-lg border px-3 py-2 text-sm outline-none resize-none ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-[#fafafa] border-[#e5e5e5] text-[#171717]")}`}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
