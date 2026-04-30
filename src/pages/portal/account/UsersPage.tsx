import { useState } from "react";
import { useB2BTeam, type B2BTeamMember, type PendingInvitation } from "@/hooks/useB2BTeam";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { UserPlus, Users, Trash2, Pencil, Mail, ShieldCheck } from "lucide-react";

function formatARS(n: number): string {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

interface FormState {
  email: string;
  role: "buyer" | "manager";
  threshold: string;
}

const DEFAULT_FORM: FormState = { email: "", role: "buyer", threshold: "0" };

export default function UsersPage() {
  const { members, invitations, loading, invite, remove, update } = useB2BTeam();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState<B2BTeamMember | null>(null);

  async function handleInvite() {
    const threshold = parseFloat(form.threshold) || 0;
    if (!form.email.trim()) return;
    setSubmitting(true);
    const ok = await invite(form.email.trim(), form.role, threshold);
    setSubmitting(false);
    if (ok) {
      setForm(DEFAULT_FORM);
      setInviteOpen(false);
    }
  }

  async function handleEdit() {
    if (!editing) return;
    const threshold = parseFloat(form.threshold) || 0;
    setSubmitting(true);
    const ok = await update(editing.id, form.role, threshold);
    setSubmitting(false);
    if (ok) setEditing(null);
  }

  function openEdit(member: B2BTeamMember) {
    setEditing(member);
    setForm({
      email: member.email,
      role: member.b2b_role === "manager" ? "manager" : "buyer",
      threshold: String(member.approval_threshold ?? 0),
    });
  }

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Equipo</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Usuarios autorizados a comprar a nombre de tu empresa.
          </p>
        </div>
        <Button onClick={() => { setForm(DEFAULT_FORM); setInviteOpen(true); }} className="gap-2">
          <UserPlus className="h-4 w-4" />
          Invitar
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : members.length === 0 && invitations.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title="Aún no hay usuarios"
          description="Invitá a tu equipo a comprar desde el portal con su propio usuario y límite de aprobación."
          actionLabel="Invitar usuario"
          onAction={() => setInviteOpen(true)}
        />
      ) : (
        <div className="space-y-6">
          {/* Active members */}
          {members.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Miembros activos ({members.length})
              </h2>
              <div className="overflow-hidden rounded-xl border bg-card">
                <table className="w-full">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-medium">Usuario</th>
                      <th className="px-4 py-2.5 text-left font-medium">Rol</th>
                      <th className="px-4 py-2.5 text-right font-medium">Límite aprobación</th>
                      <th className="px-4 py-2.5 text-right font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {members.map((m) => (
                      <tr key={m.id} className="text-sm">
                        <td className="px-4 py-3">
                          <div className="font-medium">{m.contact_name || m.email}</div>
                          <div className="text-xs text-muted-foreground">{m.email}</div>
                        </td>
                        <td className="px-4 py-3">
                          {m.b2b_role === "manager" ? (
                            <Badge variant="outline" className="gap-1 border-info text-info">
                              <ShieldCheck className="h-3 w-3" />
                              Manager
                            </Badge>
                          ) : (
                            <Badge variant="outline">Buyer</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right portal-tabular">
                          {m.approval_threshold > 0 ? formatARS(m.approval_threshold) : "Sin límite"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(m)} aria-label="Editar">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (window.confirm(`¿Remover a ${m.contact_name || m.email}?`)) {
                                  void remove(m.id);
                                }
                              }}
                              aria-label="Eliminar"
                            >
                              <Trash2 className="h-4 w-4 text-danger" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Pending invitations */}
          {invitations.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Invitaciones pendientes ({invitations.length})
              </h2>
              <div className="space-y-2">
                {invitations.map((inv: PendingInvitation) => (
                  <div key={inv.id} className="flex items-center justify-between rounded-xl border bg-card px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">{inv.invited_email}</div>
                        <div className="text-xs text-muted-foreground">
                          {inv.role} · expira {formatDate(inv.expires_at)}
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className="border-warning text-warning">
                      Pendiente
                    </Badge>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invitar usuario</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="usuario@empresa.com"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="invite-role">Rol</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm((f) => ({ ...f, role: v as FormState["role"] }))}
              >
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="buyer">Buyer — compra y solicita aprobación</SelectItem>
                  <SelectItem value="manager">Manager — aprueba pedidos del equipo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.role === "buyer" && (
              <div>
                <Label htmlFor="invite-threshold">Límite de aprobación (ARS)</Label>
                <Input
                  id="invite-threshold"
                  type="number"
                  min="0"
                  step="1000"
                  value={form.threshold}
                  onChange={(e) => setForm((f) => ({ ...f, threshold: e.target.value }))}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Pedidos por encima de este monto requerirán aprobación de un manager. 0 = todo requiere aprobación.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleInvite} disabled={submitting || !form.email.trim()}>
              Enviar invitación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar usuario</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div>
                <Label>Email</Label>
                <Input value={editing.email} disabled />
              </div>
              <div>
                <Label htmlFor="edit-role">Rol</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) => setForm((f) => ({ ...f, role: v as FormState["role"] }))}
                >
                  <SelectTrigger id="edit-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buyer">Buyer</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.role === "buyer" && (
                <div>
                  <Label htmlFor="edit-threshold">Límite de aprobación (ARS)</Label>
                  <Input
                    id="edit-threshold"
                    type="number"
                    min="0"
                    step="1000"
                    value={form.threshold}
                    onChange={(e) => setForm((f) => ({ ...f, threshold: e.target.value }))}
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleEdit} disabled={submitting}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
