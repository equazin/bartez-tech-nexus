import { type ReactNode, useMemo, useState } from "react";
import { Edit3, Power, PowerOff, Plus, Save, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SurfaceCard } from "@/components/ui/surface-card";
import { useCurrency } from "@/context/CurrencyContext";
import { createUserApi, updateUserApi } from "@/lib/api/ordersApi";

interface SellerProfile {
  id: string;
  company_name: string;
  contact_name: string;
  role: string;
  email?: string;
  phone?: string;
  active?: boolean;
}

interface ClientProfile {
  id: string;
  company_name: string;
  contact_name: string;
  assigned_seller_id?: string;
}

interface SupabaseOrder {
  id: string;
  client_id: string;
  total: number;
  status: string;
  created_at: string;
}

interface SellerManagementTabProps {
  sellers: SellerProfile[];
  clients: ClientProfile[];
  orders: SupabaseOrder[];
  isDark: boolean;
  onRefreshClients?: () => Promise<void> | void;
}

const CLOSED_ORDER_STATUSES = new Set(["approved", "preparing", "shipped", "delivered", "dispatched"]);

const EMPTY_FORM = {
  contact_name: "",
  company_name: "",
  email: "",
  password: "",
  phone: "",
};

function normalizePhoneForSupabase(rawPhone: string): string {
  const digits = rawPhone.replace(/\D+/g, "");
  if (!digits) return "";
  if (digits.startsWith("549")) return digits;
  if (digits.startsWith("54")) return `549${digits.slice(2)}`;
  if (digits.length >= 10 && digits.length <= 11) return `549${digits}`;
  return digits;
}

export function SellerManagementTab({
  sellers,
  clients,
  orders,
  isDark,
  onRefreshClients,
}: SellerManagementTabProps) {
  const dk = (dark: string, light: string) => (isDark ? dark : light);
  const { formatPrice } = useCurrency();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingSellerId, setEditingSellerId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState(EMPTY_FORM);
  const [editForm, setEditForm] = useState({
    contact_name: "",
    company_name: "",
    email: "",
    phone: "",
    active: true,
  });
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [createError, setCreateError] = useState("");
  const [editError, setEditError] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const filteredSellers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return sellers;
    return sellers.filter((seller) =>
      [seller.contact_name, seller.company_name, seller.email ?? ""].join(" ").toLowerCase().includes(term),
    );
  }, [search, sellers]);

  const sellerRows = useMemo(() => {
    return filteredSellers.map((seller) => {
      const assignedClients = clients.filter((client) => client.assigned_seller_id === seller.id);
      const assignedIds = new Set(assignedClients.map((client) => client.id));
      const monthlySales = orders
        .filter((order) => assignedIds.has(order.client_id) && CLOSED_ORDER_STATUSES.has(order.status))
        .filter((order) => new Date(order.created_at).getTime() >= Date.now() - 30 * 24 * 60 * 60 * 1000)
        .reduce((sum, order) => sum + order.total, 0);

      return {
        seller,
        assignedClientsCount: assignedClients.length,
        monthlySales,
      };
    });
  }, [clients, filteredSellers, orders]);

  function openEditSeller(seller: SellerProfile) {
    setEditingSellerId(seller.id);
    setEditError("");
    setEditForm({
      contact_name: seller.contact_name || "",
      company_name: seller.company_name || "",
      email: seller.email || "",
      phone: seller.phone || "",
      active: seller.active !== false,
    });
  }

  async function handleCreateSeller() {
    try {
      setCreateError("");
      const email = createForm.email.trim().toLowerCase();
      const password = createForm.password.trim();
      const contactName = createForm.contact_name.trim();
      const companyName = createForm.company_name.trim() || contactName;
      const phone = normalizePhoneForSupabase(createForm.phone.trim());

      if (!contactName || !email || !password) {
        setCreateError("Nombre, email y contraseña son obligatorios.");
        return;
      }

      if (phone && phone.length < 10) {
        setCreateError("Si se ingresa un celular, debe incluir codigo de area y numero.");
        return;
      }

      if (sellers.some((seller) => seller.email?.trim().toLowerCase() === email)) {
        setCreateError("El email ya esta registrado.");
        return;
      }

      setSavingCreate(true);
      await createUserApi({
        email,
        password,
        company_name: companyName,
        contact_name: contactName,
        client_type: "reseller",
        default_margin: 0,
        role: "sales",
        phone,
      });

      setShowCreate(false);
      setCreateForm(EMPTY_FORM);
      await onRefreshClients?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo crear el vendedor.";
      setCreateError(message);
    } finally {
      setSavingCreate(false);
    }
  }

  async function handleSaveSeller() {
    if (!editingSellerId) return;

    try {
      setEditError("");
      const email = editForm.email.trim().toLowerCase();
      const contactName = editForm.contact_name.trim();
      const companyName = editForm.company_name.trim() || contactName;
      const phone = normalizePhoneForSupabase(editForm.phone.trim());

      if (!contactName || !email) {
        setEditError("Nombre y email son obligatorios.");
        return;
      }

      if (phone && phone.length < 10) {
        setEditError("Si se ingresa un celular, debe incluir codigo de area y numero.");
        return;
      }

      setSavingEdit(true);
      await updateUserApi(editingSellerId, {
        email,
        contact_name: contactName,
        company_name: companyName,
        role: "sales",
        phone,
        active: editForm.active,
      });

      setEditingSellerId(null);
      await onRefreshClients?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo actualizar el vendedor.";
      setEditError(message);
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleToggleSeller(seller: SellerProfile) {
    try {
      setTogglingId(seller.id);
      await updateUserApi(seller.id, {
        email: seller.email,
        contact_name: seller.contact_name,
        company_name: seller.company_name,
        active: seller.active === false,
      });
      await onRefreshClients?.();
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <SurfaceCard padding="sm" className="space-y-4 rounded-[20px]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Gestion comercial</p>
            <h2 className="font-display text-[1.35rem] font-bold tracking-tight text-foreground">Vendedores</h2>
            <p className="text-[12px] text-muted-foreground">Alta, edición, asignación y estado operativo del equipo comercial.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Users className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar vendedor"
                className={`h-9 w-full rounded-xl border pl-8 pr-3 text-[13px] outline-none transition sm:w-[260px] ${dk("bg-[#111] border-[#1f1f1f] text-white", "bg-white border-[#e5e5e5] text-[#171717]")}`}
              />
            </div>
            <Button size="sm" onClick={() => { setCreateError(""); setShowCreate(true); }}>
              <Plus className="h-3.5 w-3.5" />
              Nuevo vendedor
            </Button>
          </div>
        </div>

        {sellerRows.length === 0 ? (
          <EmptyState
            title="Sin vendedores"
            description="Crea el primer vendedor para empezar a asignar cartera y medir performance."
          />
        ) : (
          <div className="overflow-x-auto rounded-[16px] border border-border/70">
            <table className="min-w-full text-left text-[13px]">
              <thead className="bg-secondary/50 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Nombre</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Rol</th>
                  <th className="px-4 py-3 font-semibold">Clientes</th>
                  <th className="px-4 py-3 font-semibold">Ventas mes</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sellerRows.map(({ seller, assignedClientsCount, monthlySales }) => (
                  <tr key={seller.id} className="border-t border-border/70 bg-card/80">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-semibold text-foreground">{seller.contact_name || seller.company_name}</p>
                        <p className="text-[11px] text-muted-foreground">{seller.company_name || "Sin alias"}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{seller.email || "Sin email"}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">sales</Badge>
                    </td>
                    <td className="px-4 py-3 text-foreground">{assignedClientsCount}</td>
                    <td className="px-4 py-3 text-foreground">{formatPrice(monthlySales)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={seller.active === false ? "destructive" : "success"}>
                        {seller.active === false ? "Inactivo" : "Activo"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="toolbar" onClick={() => openEditSeller(seller)}>
                          <Edit3 className="h-3.5 w-3.5" />
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="toolbar"
                          onClick={() => void handleToggleSeller(seller)}
                          disabled={togglingId === seller.id}
                        >
                          {seller.active === false ? <Power className="h-3.5 w-3.5" /> : <PowerOff className="h-3.5 w-3.5" />}
                          {seller.active === false ? "Activar" : "Desactivar"}
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

      {showCreate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className={`w-full max-w-lg rounded-2xl border shadow-2xl ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
            <div className={`flex items-center justify-between border-b px-6 py-4 ${dk("border-[#1a1a1a]", "border-[#e5e5e5]")}`}>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Alta</p>
                <h3 className="font-display text-lg font-semibold text-foreground">Nuevo vendedor</h3>
              </div>
              <Button size="sm" variant="toolbar" onClick={() => setShowCreate(false)}>Cerrar</Button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nombre *">
                  <input value={createForm.contact_name} onChange={(event) => setCreateForm((prev) => ({ ...prev, contact_name: event.target.value }))} className={inputClass(isDark)} />
                </Field>
                <Field label="Alias">
                  <input value={createForm.company_name} onChange={(event) => setCreateForm((prev) => ({ ...prev, company_name: event.target.value }))} className={inputClass(isDark)} />
                </Field>
                <Field label="Email *" className="col-span-2">
                  <input type="email" value={createForm.email} onChange={(event) => setCreateForm((prev) => ({ ...prev, email: event.target.value }))} className={inputClass(isDark)} />
                </Field>
                <Field label="Contraseña *">
                  <input type="text" value={createForm.password} onChange={(event) => setCreateForm((prev) => ({ ...prev, password: event.target.value }))} className={inputClass(isDark)} />
                </Field>
                <Field label="Rol">
                  <input value="sales" readOnly className={inputClass(isDark)} />
                </Field>
                <Field label="Celular" className="col-span-2">
                  <input value={createForm.phone} onChange={(event) => setCreateForm((prev) => ({ ...prev, phone: event.target.value }))} className={inputClass(isDark)} />
                </Field>
              </div>
              {createError ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{createError}</p> : null}
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="toolbar" onClick={() => setShowCreate(false)}>Cancelar</Button>
                <Button size="sm" onClick={() => void handleCreateSeller()} disabled={savingCreate}>
                  <Save className="h-3.5 w-3.5" />
                  {savingCreate ? "Creando..." : "Crear vendedor"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {editingSellerId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className={`w-full max-w-lg rounded-2xl border shadow-2xl ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
            <div className={`flex items-center justify-between border-b px-6 py-4 ${dk("border-[#1a1a1a]", "border-[#e5e5e5]")}`}>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Edicion</p>
                <h3 className="font-display text-lg font-semibold text-foreground">Editar vendedor</h3>
              </div>
              <Button size="sm" variant="toolbar" onClick={() => setEditingSellerId(null)}>Cerrar</Button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nombre *">
                  <input value={editForm.contact_name} onChange={(event) => setEditForm((prev) => ({ ...prev, contact_name: event.target.value }))} className={inputClass(isDark)} />
                </Field>
                <Field label="Alias">
                  <input value={editForm.company_name} onChange={(event) => setEditForm((prev) => ({ ...prev, company_name: event.target.value }))} className={inputClass(isDark)} />
                </Field>
                <Field label="Email *" className="col-span-2">
                  <input type="email" value={editForm.email} onChange={(event) => setEditForm((prev) => ({ ...prev, email: event.target.value }))} className={inputClass(isDark)} />
                </Field>
                <Field label="Celular" className="col-span-2">
                  <input value={editForm.phone} onChange={(event) => setEditForm((prev) => ({ ...prev, phone: event.target.value }))} className={inputClass(isDark)} />
                </Field>
                <Field label="Rol">
                  <input value="sales" readOnly className={inputClass(isDark)} />
                </Field>
                <Field label="Estado">
                  <select value={editForm.active ? "true" : "false"} onChange={(event) => setEditForm((prev) => ({ ...prev, active: event.target.value === "true" }))} className={inputClass(isDark)}>
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </select>
                </Field>
              </div>
              {editError ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{editError}</p> : null}
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="toolbar" onClick={() => setEditingSellerId(null)}>Cancelar</Button>
                <Button size="sm" onClick={() => void handleSaveSeller()} disabled={savingEdit}>
                  <Save className="h-3.5 w-3.5" />
                  {savingEdit ? "Guardando..." : "Guardar cambios"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`space-y-1 ${className ?? ""}`}>
      <span className="block text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function inputClass(isDark: boolean) {
  return `h-10 w-full rounded-lg border px-3 text-sm outline-none transition ${isDark
    ? "border-[#262626] bg-[#0d0d0d] text-white focus:border-[#404040]"
    : "border-[#e5e5e5] bg-[#f5f5f5] text-[#171717] focus:border-[#d4d4d4]"}`;
}
