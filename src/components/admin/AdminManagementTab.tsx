import { type ReactNode, useMemo, useState } from "react";
import { Edit3, Plus, Save, Shield, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SurfaceCard } from "@/components/ui/surface-card";
import { createUserApi, updateUserApi } from "@/lib/api/ordersApi";

interface AdminProfile {
  id: string;
  contact_name: string;
  company_name: string;
  email?: string;
  active?: boolean;
}

interface AdminManagementTabProps {
  admins: AdminProfile[];
  isDark: boolean;
  onRefresh?: () => Promise<void> | void;
}

const EMPTY_FORM = { contact_name: "", company_name: "", email: "", password: "" };

export function AdminManagementTab({ admins, isDark, onRefresh }: AdminManagementTabProps) {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState(EMPTY_FORM);
  const [editForm, setEditForm] = useState({ contact_name: "", company_name: "", email: "", active: true });
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [createError, setCreateError] = useState("");
  const [editError, setEditError] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return admins;
    return admins.filter((a) =>
      [a.contact_name, a.company_name, a.email ?? ""].join(" ").toLowerCase().includes(term),
    );
  }, [search, admins]);

  async function handleCreate() {
    const name = createForm.contact_name.trim();
    const email = createForm.email.trim().toLowerCase();
    const pwd = createForm.password.trim();
    if (!name || !email || !pwd) { setCreateError("Nombre, email y contraseña son obligatorios."); return; }
    setSavingCreate(true);
    setCreateError("");
    try {
      await createUserApi({
        email,
        password: pwd,
        contact_name: name,
        company_name: createForm.company_name.trim() || name,
        role: "admin",
        client_type: "empresa",
        default_margin: 0,
      });
      setShowCreate(false);
      setCreateForm(EMPTY_FORM);
      await onRefresh?.();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Error inesperado.");
    } finally {
      setSavingCreate(false);
    }
  }

  async function handleSaveEdit() {
    if (!editingId) return;
    const name = editForm.contact_name.trim();
    const email = editForm.email.trim().toLowerCase();
    if (!name || !email) { setEditError("Nombre y email son obligatorios."); return; }
    setSavingEdit(true);
    setEditError("");
    try {
      await updateUserApi(editingId, {
        email,
        contact_name: name,
        company_name: editForm.company_name.trim() || name,
        role: "admin",
        active: editForm.active,
      });
      setEditingId(null);
      await onRefresh?.();
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Error inesperado.");
    } finally {
      setSavingEdit(false);
    }
  }

  function openEdit(admin: AdminProfile) {
    setEditingId(admin.id);
    setEditError("");
    setEditForm({
      contact_name: admin.contact_name || "",
      company_name: admin.company_name || "",
      email: admin.email || "",
      active: admin.active !== false,
    });
  }

  return (
    <div className="space-y-4">
      <SurfaceCard padding="sm" className="space-y-4 rounded-[20px]">
        {/* Header */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Control de acceso</p>
            <h2 className="font-display text-[1.35rem] font-bold tracking-tight text-foreground">Administradores</h2>
            <p className="text-[12px] text-muted-foreground">Gestión de cuentas con acceso completo al panel.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Users className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar admin..."
                className={iClass(isDark) + " h-9 w-full rounded-xl pl-8 pr-3 text-[13px] sm:w-[220px]"}
              />
            </div>
            <Button size="sm" onClick={() => { setCreateError(""); setShowCreate(true); }}>
              <Plus className="h-3.5 w-3.5" />
              Nuevo admin
            </Button>
          </div>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <EmptyState
            title="Sin administradores"
            description="Agrega el primer administrador para delegar acceso completo al panel."
          />
        ) : (
          <div className="overflow-x-auto rounded-[16px] border border-border/70">
            <table className="min-w-full text-left text-[13px]">
              <thead className="bg-secondary/50 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Nombre</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Rol</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((admin) => (
                  <tr key={admin.id} className="border-t border-border/70 bg-card/80">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Shield size={14} />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{admin.contact_name || admin.company_name}</p>
                          {admin.company_name && admin.company_name !== admin.contact_name && (
                            <p className="text-[11px] text-muted-foreground">{admin.company_name}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{admin.email || "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="border-primary/30 text-primary">admin</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={admin.active === false ? "destructive" : "success"}>
                        {admin.active === false ? "Inactivo" : "Activo"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end">
                        <Button size="sm" variant="toolbar" onClick={() => openEdit(admin)}>
                          <Edit3 className="h-3.5 w-3.5" />
                          Editar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SurfaceCard>

      {/* Create modal */}
      {showCreate && (
        <Modal title="Nuevo administrador" onClose={() => setShowCreate(false)} isDark={isDark}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombre *">
              <input value={createForm.contact_name} onChange={(e) => setCreateForm((p) => ({ ...p, contact_name: e.target.value }))} className={iClass(isDark)} placeholder="Nombre completo" />
            </Field>
            <Field label="Alias (opcional)">
              <input value={createForm.company_name} onChange={(e) => setCreateForm((p) => ({ ...p, company_name: e.target.value }))} className={iClass(isDark)} placeholder="Alias o área" />
            </Field>
            <Field label="Email *" className="col-span-2">
              <input type="email" value={createForm.email} onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))} className={iClass(isDark)} placeholder="admin@empresa.com" />
            </Field>
            <Field label="Contraseña *" className="col-span-2">
              <input type="text" value={createForm.password} onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))} className={iClass(isDark)} placeholder="Mínimo 6 caracteres" />
            </Field>
          </div>
          {createError && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{createError}</p>}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="toolbar" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button size="sm" onClick={() => void handleCreate()} disabled={savingCreate}>
              <Save className="h-3.5 w-3.5" />
              {savingCreate ? "Creando..." : "Crear admin"}
            </Button>
          </div>
        </Modal>
      )}

      {/* Edit modal */}
      {editingId && (
        <Modal title="Editar administrador" onClose={() => setEditingId(null)} isDark={isDark}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombre *">
              <input value={editForm.contact_name} onChange={(e) => setEditForm((p) => ({ ...p, contact_name: e.target.value }))} className={iClass(isDark)} />
            </Field>
            <Field label="Alias">
              <input value={editForm.company_name} onChange={(e) => setEditForm((p) => ({ ...p, company_name: e.target.value }))} className={iClass(isDark)} />
            </Field>
            <Field label="Email *" className="col-span-2">
              <input type="email" value={editForm.email} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} className={iClass(isDark)} />
            </Field>
            <Field label="Rol">
              <input value="admin" readOnly className={iClass(isDark)} />
            </Field>
            <Field label="Estado">
              <select value={editForm.active ? "true" : "false"} onChange={(e) => setEditForm((p) => ({ ...p, active: e.target.value === "true" }))} className={iClass(isDark)}>
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </select>
            </Field>
          </div>
          {editError && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{editError}</p>}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="toolbar" onClick={() => setEditingId(null)}>Cancelar</Button>
            <Button size="sm" onClick={() => void handleSaveEdit()} disabled={savingEdit}>
              <Save className="h-3.5 w-3.5" />
              {savingEdit ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Small helpers ──────────────────────────────────────────────────────────────

function Modal({ title, onClose, isDark, children }: { title: string; onClose: () => void; isDark: boolean; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className={`w-full max-w-lg rounded-2xl border shadow-2xl ${isDark ? "bg-[#111] border-[#1f1f1f]" : "bg-white border-[#e5e5e5]"}`}>
        <div className={`flex items-center justify-between border-b px-6 py-4 ${isDark ? "border-[#1a1a1a]" : "border-[#e5e5e5]"}`}>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Administradores</p>
            <h3 className="font-display text-lg font-semibold text-foreground">{title}</h3>
          </div>
          <Button size="sm" variant="toolbar" onClick={onClose}>Cerrar</Button>
        </div>
        <div className="space-y-4 px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <label className={`space-y-1 ${className ?? ""}`}>
      <span className="block text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function iClass(isDark: boolean) {
  return `h-10 w-full rounded-lg border px-3 text-sm outline-none transition ${
    isDark
      ? "border-[#262626] bg-[#0d0d0d] text-white focus:border-[#404040]"
      : "border-[#e5e5e5] bg-[#f5f5f5] text-[#171717] focus:border-[#d4d4d4]"
  }`;
}
