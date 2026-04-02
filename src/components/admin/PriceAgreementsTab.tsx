import { useState, useMemo } from "react";
import { Plus, Trash2, ToggleLeft, ToggleRight, ChevronDown } from "lucide-react";
import { usePriceAgreements, type PriceAgreement } from "@/hooks/usePriceAgreements";

interface ClientRow {
  id: string;
  company_name: string;
  contact_name: string;
}

interface PriceAgreementsTabProps {
  isDark?: boolean;
  clients: ClientRow[];
}

const PRICE_LIST_LABEL: Record<string, string> = {
  standard:    "Standard",
  mayorista:   "Mayorista",
  distribuidor: "Distribuidor",
};

const EMPTY_FORM = {
  name: "",
  margin_pct: "" as string | number,
  discount_pct: 0,
  price_list: "mayorista" as PriceAgreement["price_list"],
  valid_from: new Date().toISOString().slice(0, 10),
  valid_until: "",
  notes: "",
};

export function PriceAgreementsTab({ isDark = true, clients }: PriceAgreementsTabProps) {
  const dk = (d: string, l: string) => (isDark ? d : l);

  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const { agreements, loading, error, create, update, deactivate, refetch } = usePriceAgreements(selectedClientId || undefined);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId),
    [clients, selectedClientId]
  );

  async function handleCreate() {
    if (!selectedClientId) return;
    if (!form.name.trim()) { setFormError("El nombre del acuerdo es requerido."); return; }
    if (!form.valid_from) { setFormError("La fecha de inicio es requerida."); return; }

    setSaving(true);
    setFormError(null);

    const result = await create({
      client_id: selectedClientId,
      name: form.name.trim(),
      margin_pct: form.margin_pct !== "" ? Number(form.margin_pct) : null,
      discount_pct: Number(form.discount_pct) || 0,
      price_list: form.price_list,
      valid_from: form.valid_from,
      valid_until: form.valid_until || null,
      active: true,
      notes: form.notes.trim() || null,
    });

    if (result) {
      setForm({ ...EMPTY_FORM });
      setShowForm(false);
    } else {
      setFormError("Error al guardar el acuerdo.");
    }
    setSaving(false);
  }

  const inputCls = `w-full text-xs px-3 py-2 rounded-lg border ${dk("bg-[#0d0d0d] border-[#2a2a2a] text-white placeholder-[#525252]", "bg-white border-[#e5e5e5] text-[#171717] placeholder-[#a3a3a3]")}`;

  return (
    <div className="max-w-4xl space-y-5">
      {/* Header */}
      <div>
        <h2 className={`font-bold text-base ${dk("text-white", "text-[#171717]")}`}>Acuerdos de Precio</h2>
        <p className="text-xs text-[#737373] mt-0.5">Asigná precios o descuentos especiales por cliente</p>
      </div>

      {/* Client selector */}
      <div className="relative">
        <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#525252] pointer-events-none" />
        <select
          value={selectedClientId}
          onChange={(e) => { setSelectedClientId(e.target.value); setShowForm(false); }}
          className={`w-full text-xs px-3 py-2 pr-8 rounded-lg border appearance-none ${dk("bg-[#0d0d0d] border-[#2a2a2a] text-white", "bg-white border-[#e5e5e5] text-[#171717]")}`}
        >
          <option value="">— Seleccioná un cliente —</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.company_name || c.contact_name}
            </option>
          ))}
        </select>
      </div>

      {!selectedClientId && (
        <p className={`text-sm text-center py-10 ${dk("text-[#525252]", "text-[#a3a3a3]")}`}>
          Seleccioná un cliente para ver y gestionar sus acuerdos de precio
        </p>
      )}

      {selectedClientId && (
        <>
          {/* Add button */}
          <div className="flex justify-between items-center">
            <p className={`text-xs ${dk("text-[#737373]", "text-[#525252]")}`}>
              {agreements.length} acuerdo{agreements.length !== 1 ? "s" : ""} para <strong>{selectedClient?.company_name || selectedClient?.contact_name}</strong>
            </p>
            <button
              onClick={() => setShowForm((v) => !v)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#2D9F6A]/15 text-[#2D9F6A] border border-[#2D9F6A]/30 hover:bg-[#2D9F6A]/25 transition-colors"
            >
              <Plus size={11} /> Nuevo acuerdo
            </button>
          </div>

          {/* Create form */}
          {showForm && (
            <div className={`rounded-xl border p-4 space-y-3 ${dk("border-[#2a2a2a] bg-[#0a0a0a]", "border-[#e5e5e5] bg-[#fafafa]")}`}>
              <p className={`text-xs font-bold ${dk("text-white", "text-[#171717]")}`}>Nuevo acuerdo</p>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-[10px] uppercase tracking-widest text-[#525252] mb-1 block">Nombre</label>
                  <input placeholder="Ej: Precio especial Q1 2025" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-[#525252] mb-1 block">Lista de precios</label>
                  <select value={form.price_list} onChange={(e) => setForm((f) => ({ ...f, price_list: e.target.value as PriceAgreement["price_list"] }))} className={inputCls}>
                    <option value="standard">Standard</option>
                    <option value="mayorista">Mayorista</option>
                    <option value="distribuidor">Distribuidor</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-[#525252] mb-1 block">Descuento adicional %</label>
                  <input type="number" min="0" max="100" step="0.5" placeholder="0" value={form.discount_pct} onChange={(e) => setForm((f) => ({ ...f, discount_pct: Number(e.target.value) }))} className={inputCls} />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-[#525252] mb-1 block">Margen fijo % (opcional)</label>
                  <input type="number" min="0" max="100" step="0.5" placeholder="Deja vacío para usar el del cliente" value={form.margin_pct} onChange={(e) => setForm((f) => ({ ...f, margin_pct: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-[#525252] mb-1 block">Vigencia desde</label>
                  <input type="date" value={form.valid_from} onChange={(e) => setForm((f) => ({ ...f, valid_from: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-[#525252] mb-1 block">Vigencia hasta (opcional)</label>
                  <input type="date" value={form.valid_until} onChange={(e) => setForm((f) => ({ ...f, valid_until: e.target.value }))} className={inputCls} />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] uppercase tracking-widest text-[#525252] mb-1 block">Notas internas</label>
                  <input placeholder="Notas opcionales" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className={inputCls} />
                </div>
              </div>

              {formError && <p className="text-xs text-red-400">{formError}</p>}
              {error && <p className="text-xs text-red-400">{error}</p>}

              <div className="flex gap-2 pt-1">
                <button onClick={handleCreate} disabled={saving} className="text-xs px-4 py-1.5 rounded-lg bg-[#2D9F6A] text-white hover:bg-[#25885a] disabled:opacity-50 transition-colors">
                  {saving ? "Guardando..." : "Guardar acuerdo"}
                </button>
                <button onClick={() => { setShowForm(false); setFormError(null); }} className={`text-xs px-3 py-1.5 rounded-lg border ${dk("border-[#2a2a2a] text-[#737373] hover:text-white", "border-[#e5e5e5] text-[#525252] hover:bg-[#f5f5f5]")} transition-colors`}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Agreements list */}
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className={`h-14 rounded-xl ${dk("bg-[#111]", "bg-[#f5f5f5]")} animate-pulse`} />)}</div>
          ) : agreements.length === 0 ? (
            <p className={`text-sm text-center py-8 ${dk("text-[#525252]", "text-[#a3a3a3]")}`}>No hay acuerdos para este cliente</p>
          ) : (
            <div className="space-y-2">
              {agreements.map((ag) => (
                <div key={ag.id} className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${dk("border-[#1f1f1f] bg-[#0d0d0d]", "border-[#e5e5e5] bg-white")} ${!ag.active ? "opacity-50" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold ${dk("text-white", "text-[#171717]")}`}>{ag.name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${ag.active ? "text-green-400 bg-green-500/10 border-green-500/20" : "text-gray-400 bg-gray-500/10 border-gray-500/20"}`}>
                        {ag.active ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#737373] mt-0.5">
                      {PRICE_LIST_LABEL[ag.price_list]}
                      {ag.discount_pct > 0 && ` · -${ag.discount_pct}%`}
                      {ag.margin_pct != null && ` · Margen ${ag.margin_pct}%`}
                      {` · desde ${new Date(ag.valid_from).toLocaleDateString("es-AR")}`}
                      {ag.valid_until && ` hasta ${new Date(ag.valid_until).toLocaleDateString("es-AR")}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => ag.active ? deactivate(ag.id) : update(ag.id, { active: true })}
                      title={ag.active ? "Desactivar" : "Activar"}
                      className="text-[#525252] hover:text-white transition-colors"
                    >
                      {ag.active ? <ToggleRight size={16} className="text-[#2D9F6A]" /> : <ToggleLeft size={16} />}
                    </button>
                    <button
                      onClick={() => deactivate(ag.id)}
                      title="Eliminar"
                      className="text-[#525252] hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
