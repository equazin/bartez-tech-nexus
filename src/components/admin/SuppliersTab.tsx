import { useState } from "react";
import { Plus, Pencil, Trash2, Save, X, Building2, Phone, Mail, Clock, TrendingUp } from "lucide-react";
import { useSuppliers } from "@/hooks/useSuppliers";
import type { Supplier, SupplierInsert } from "@/models/supplier";

const EMPTY: SupplierInsert = {
  name: "", contact_name: "", contact_email: "", contact_phone: "",
  lead_time_days: 7, default_margin: 20, price_multiplier: 1.0, active: true, notes: "",
};

interface Props { isDark?: boolean }

export function SuppliersTab({ isDark = true }: Props) {
  const { suppliers, loading, error, add, edit, remove } = useSuppliers();
  const [editing, setEditing] = useState<string | null>(null);  // id being edited
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState<SupplierInsert>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const dk = (d: string, l: string) => isDark ? d : l;

  function startNew() {
    setForm(EMPTY);
    setShowNew(true);
    setEditing(null);
    setFormError("");
  }

  function startEdit(s: Supplier) {
    setForm({
      name: s.name, contact_name: s.contact_name ?? "",
      contact_email: s.contact_email ?? "", contact_phone: s.contact_phone ?? "",
      lead_time_days: s.lead_time_days, default_margin: s.default_margin,
      price_multiplier: s.price_multiplier, active: s.active, notes: s.notes ?? "",
    });
    setEditing(s.id);
    setShowNew(false);
    setFormError("");
  }

  function cancelForm() {
    setShowNew(false);
    setEditing(null);
    setFormError("");
  }

  async function handleSave() {
    if (!form.name.trim()) { setFormError("El nombre es obligatorio."); return; }
    setSaving(true);
    setFormError("");
    try {
      if (editing) {
        await edit(editing, form);
      } else {
        await add(form);
      }
      cancelForm();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`¿Eliminar proveedor "${name}"? Los productos vinculados quedarán sin proveedor.`)) return;
    try { await remove(id); } catch { /* silencioso */ }
  }

  const bg = dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]");
  const inputCls = `w-full border rounded-lg px-3 py-2 text-sm outline-none transition ${dk("bg-[#0d0d0d] border-[#222] text-white focus:border-[#2D9F6A]/50 placeholder:text-[#404040]", "bg-white border-[#e5e5e5] text-[#171717] focus:border-[#2D9F6A]/50 placeholder:text-[#c4c4c4]")}`;
  const labelCls = `text-[11px] font-semibold uppercase tracking-wide ${dk("text-gray-500", "text-[#a3a3a3]")} mb-1`;

  const FormPanel = () => (
    <div className={`${bg} border rounded-xl p-5 mb-4`}>
      <h3 className={`font-bold text-sm ${dk("text-white", "text-[#171717]")} mb-4`}>
        {editing ? "Editar proveedor" : "Nuevo proveedor"}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <p className={labelCls}>Nombre *</p>
          <input className={inputCls} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Ej: Ingram Micro" />
        </div>
        <div>
          <p className={labelCls}>Contacto</p>
          <input className={inputCls} value={form.contact_name} onChange={(e) => setForm((p) => ({ ...p, contact_name: e.target.value }))} placeholder="Nombre y apellido" />
        </div>
        <div>
          <p className={labelCls}>Teléfono</p>
          <input className={inputCls} value={form.contact_phone} onChange={(e) => setForm((p) => ({ ...p, contact_phone: e.target.value }))} placeholder="+54 11 ..." />
        </div>
        <div>
          <p className={labelCls}>Email</p>
          <input className={inputCls} type="email" value={form.contact_email} onChange={(e) => setForm((p) => ({ ...p, contact_email: e.target.value }))} placeholder="ventas@proveedor.com" />
        </div>
        <div>
          <p className={labelCls}>Lead time (días)</p>
          <input className={inputCls} type="number" min="1" value={form.lead_time_days} onChange={(e) => setForm((p) => ({ ...p, lead_time_days: Number(e.target.value) }))} />
        </div>
        <div>
          <p className={labelCls}>Margen default (%)</p>
          <input className={inputCls} type="number" min="0" max="100" step="0.5" value={form.default_margin} onChange={(e) => setForm((p) => ({ ...p, default_margin: Number(e.target.value) }))} />
        </div>
        <div>
          <p className={labelCls}>Multiplicador de precio</p>
          <input className={inputCls} type="number" min="0.01" step="0.01" value={form.price_multiplier} onChange={(e) => setForm((p) => ({ ...p, price_multiplier: Number(e.target.value) }))} />
          <p className={`text-[10px] ${dk("text-gray-600", "text-[#a3a3a3]")} mt-0.5`}>
            Ej: 1.05 = precio de lista + 5%
          </p>
        </div>
        <div className="sm:col-span-2">
          <p className={labelCls}>Notas internas</p>
          <textarea className={`${inputCls} resize-none h-16`} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Condiciones, observaciones..." />
        </div>
        <div className="sm:col-span-2 flex items-center gap-2">
          <input type="checkbox" id="sup-active" checked={form.active} onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))} className="accent-[#2D9F6A] h-4 w-4" />
          <label htmlFor="sup-active" className={`text-sm ${dk("text-gray-300", "text-[#525252]")}`}>Activo</label>
        </div>
      </div>
      {formError && <p className="text-red-400 text-xs mt-2">{formError}</p>}
      <div className="flex gap-2 mt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 bg-[#2D9F6A] hover:bg-[#25835A] text-white text-sm font-semibold px-4 py-2 rounded-lg transition disabled:opacity-50"
        >
          <Save size={13} /> {saving ? "Guardando…" : "Guardar"}
        </button>
        <button onClick={cancelForm} className={`flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg border transition ${dk("border-[#2a2a2a] text-gray-400 hover:text-white hover:bg-[#1c1c1c]", "border-[#e5e5e5] text-[#737373] hover:bg-[#f5f5f5]")}`}>
          <X size={13} /> Cancelar
        </button>
      </div>
    </div>
  );

  if (loading) return (
    <div className={`text-center py-12 ${dk("text-gray-500", "text-[#a3a3a3]")} text-sm`}>
      Cargando proveedores…
    </div>
  );

  return (
    <div className="max-w-4xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`font-bold text-base ${dk("text-white", "text-[#171717]")}`}>Proveedores</h2>
          <p className={`text-xs ${dk("text-gray-500", "text-[#737373]")} mt-0.5`}>{suppliers.length} registrados</p>
        </div>
        {!showNew && !editing && (
          <button onClick={startNew} className="flex items-center gap-1.5 bg-[#2D9F6A] hover:bg-[#25835A] text-white text-sm font-semibold px-3 py-2 rounded-lg transition">
            <Plus size={14} /> Nuevo proveedor
          </button>
        )}
      </div>

      {error && <p className="text-red-400 text-xs bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>}

      {(showNew || editing) && <FormPanel />}

      {/* Supplier cards */}
      {suppliers.length === 0 && !showNew ? (
        <div className={`text-center py-16 ${dk("text-gray-600", "text-[#a3a3a3]")} text-sm`}>
          <Building2 size={32} className="mx-auto mb-2 opacity-20" />
          <p>No hay proveedores. Creá el primero.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {suppliers.map((s) => (
            <div key={s.id} className={`${bg} border rounded-xl p-4 ${!s.active ? "opacity-50" : ""}`}>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <p className={`font-bold text-sm ${dk("text-white", "text-[#171717]")}`}>{s.name}</p>
                  {!s.active && <span className="text-[10px] text-red-400 font-medium">Inactivo</span>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => startEdit(s)} className={`p-1.5 rounded-lg transition ${dk("text-gray-600 hover:text-white hover:bg-[#1c1c1c]", "text-[#a3a3a3] hover:text-[#171717] hover:bg-[#f5f5f5]")}`}>
                    <Pencil size={12} />
                  </button>
                  <button onClick={() => handleDelete(s.id, s.name)} className="p-1.5 rounded-lg transition text-gray-600 hover:text-red-400 hover:bg-red-500/10">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              <div className={`space-y-1.5 text-[11px] ${dk("text-gray-500", "text-[#737373]")}`}>
                {s.contact_name && (
                  <div className="flex items-center gap-1.5">
                    <Building2 size={11} className="shrink-0" /> {s.contact_name}
                  </div>
                )}
                {s.contact_phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone size={11} className="shrink-0" /> {s.contact_phone}
                  </div>
                )}
                {s.contact_email && (
                  <div className="flex items-center gap-1.5">
                    <Mail size={11} className="shrink-0" /> {s.contact_email}
                  </div>
                )}
              </div>
              <div className={`flex gap-3 mt-3 pt-3 border-t ${dk("border-[#1f1f1f]", "border-[#f0f0f0]")}`}>
                <div className="text-center">
                  <p className={`text-[10px] ${dk("text-gray-600", "text-[#a3a3a3]")}`}>Lead time</p>
                  <p className={`font-bold text-xs ${dk("text-white", "text-[#171717]")}`}>{s.lead_time_days}d</p>
                </div>
                <div className="text-center">
                  <p className={`text-[10px] ${dk("text-gray-600", "text-[#a3a3a3]")}`}>Margen</p>
                  <p className="font-bold text-xs text-[#2D9F6A]">{s.default_margin}%</p>
                </div>
                <div className="text-center">
                  <p className={`text-[10px] ${dk("text-gray-600", "text-[#a3a3a3]")}`}>Multiplicador</p>
                  <p className={`font-bold text-xs ${dk("text-white", "text-[#171717]")}`}>×{s.price_multiplier}</p>
                </div>
              </div>
              {s.notes && (
                <p className={`mt-2 text-[10px] italic ${dk("text-gray-600", "text-[#a3a3a3]")} line-clamp-2`}>{s.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
