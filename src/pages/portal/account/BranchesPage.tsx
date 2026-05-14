import { useState } from "react";
import { useClientBranches, type ClientBranch, type BranchInput } from "@/hooks/useClientBranches";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { MapPin, Plus, Pencil, Trash2, Star, Phone, User } from "lucide-react";

const EMPTY_FORM: BranchInput = {
  name: "",
  address: "",
  city: "",
  province: "",
  postal_code: "",
  contact_name: "",
  contact_phone: "",
  is_default: false,
};

export default function BranchesPage() {
  const { branches, loading, upsert, remove } = useClientBranches();
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<BranchInput>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const isEditing = typeof form.id === "number";

  function openNew() {
    setForm(EMPTY_FORM);
    setEditorOpen(true);
  }

  function openEdit(branch: ClientBranch) {
    setForm({
      id: branch.id,
      name: branch.name,
      address: branch.address ?? "",
      city: branch.city ?? "",
      province: branch.province ?? "",
      postal_code: branch.postal_code ?? "",
      contact_name: branch.contact_name ?? "",
      contact_phone: branch.contact_phone ?? "",
      is_default: branch.is_default,
    });
    setEditorOpen(true);
  }

  async function handleSubmit() {
    if (!form.name.trim()) return;
    setSubmitting(true);
    const ok = await upsert({ ...form, name: form.name.trim() });
    setSubmitting(false);
    if (ok) {
      setForm(EMPTY_FORM);
      setEditorOpen(false);
    }
  }

  async function handleDelete(branch: ClientBranch) {
    if (!window.confirm(`¿Eliminar la sucursal "${branch.name}"?`)) return;
    await remove(branch.id);
  }

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Sucursales</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Direcciones de envío y retiro guardadas para tu cuenta.
          </p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" />
          Nueva sucursal
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : branches.length === 0 ? (
        <EmptyState
          icon={<MapPin className="h-8 w-8" />}
          title="Sin sucursales guardadas"
          description="Cargá direcciones para agilizar el checkout. La sucursal por defecto se aplica automáticamente al hacer un pedido."
          actionLabel="Crear primera sucursal"
          onAction={openNew}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {branches.map((b) => (
            <div key={b.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-semibold">{b.name}</h3>
                    {b.is_default && (
                      <Badge variant="outline" className="gap-1 border-brand-500 text-brand-500">
                        <Star className="h-3 w-3" />
                        Por defecto
                      </Badge>
                    )}
                  </div>
                  {b.address && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {b.address}
                      {(b.city || b.province) && (
                        <span> · {[b.city, b.province].filter(Boolean).join(", ")}</span>
                      )}
                      {b.postal_code && <span> · CP {b.postal_code}</span>}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(b)} aria-label="Editar">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(b)} aria-label="Eliminar">
                    <Trash2 className="h-4 w-4 text-danger" />
                  </Button>
                </div>
              </div>
              {(b.contact_name || b.contact_phone) && (
                <div className="mt-3 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
                  {b.contact_name && (
                    <div className="flex items-center gap-1.5">
                      <User className="h-3 w-3" />
                      {b.contact_name}
                    </div>
                  )}
                  {b.contact_phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3 w-3" />
                      {b.contact_phone}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Editar sucursal" : "Nueva sucursal"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="b-name">Nombre *</Label>
              <Input
                id="b-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ej. Casa central"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="b-address">Dirección</Label>
              <Input
                id="b-address"
                value={form.address ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="Calle 1234"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="b-city">Ciudad</Label>
                <Input
                  id="b-city"
                  value={form.city ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="b-province">Provincia</Label>
                <Input
                  id="b-province"
                  value={form.province ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="b-postal">Código postal</Label>
              <Input
                id="b-postal"
                value={form.postal_code ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, postal_code: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="b-contact-name">Contacto</Label>
                <Input
                  id="b-contact-name"
                  value={form.contact_name ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="b-contact-phone">Teléfono</Label>
                <Input
                  id="b-contact-phone"
                  value={form.contact_phone ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
              <div className="space-y-0.5">
                <Label htmlFor="b-default" className="cursor-pointer">Sucursal por defecto</Label>
                <p className="text-xs text-muted-foreground">
                  Se selecciona automáticamente al hacer un pedido.
                </p>
              </div>
              <Switch
                id="b-default"
                checked={!!form.is_default}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_default: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || !form.name.trim()}>
              {isEditing ? "Guardar cambios" : "Crear sucursal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
