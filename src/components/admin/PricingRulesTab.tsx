import { useState } from "react";
import { Plus, Pencil, Trash2, Save, X, Tag, ChevronUp, ChevronDown, AlertCircle } from "lucide-react";
import { usePricingRules } from "@/hooks/usePricingRules";
import { CONDITION_LABELS, type PricingRule, type PricingRuleInsert } from "@/models/pricingRule";

const EMPTY: PricingRuleInsert = {
  name: "",
  condition_type: "category",
  condition_value: "",
  min_margin: 0,
  max_margin: null,
  fixed_markup: null,
  priority: 0,
  active: true,
};

interface Props { isDark?: boolean; categories?: string[] }

export function PricingRulesTab({ isDark = true, categories = [] }: Props) {
  const { rules, loading, error, add, edit, remove } = usePricingRules();
  const [editing, setEditing] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState<PricingRuleInsert>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const dk = (d: string, l: string) => isDark ? d : l;
  const bg = dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]");
  const inputCls = `w-full border rounded-lg px-3 py-2 text-sm outline-none transition ${dk("bg-[#0d0d0d] border-[#222] text-white focus:border-[#2D9F6A]/50 placeholder:text-[#404040]", "bg-white border-[#e5e5e5] text-[#171717] focus:border-[#2D9F6A]/50 placeholder:text-[#c4c4c4]")}`;
  const labelCls = `text-[11px] font-semibold uppercase tracking-wide ${dk("text-gray-500", "text-[#a3a3a3]")} mb-1`;

  function startNew() { setForm(EMPTY); setShowNew(true); setEditing(null); setFormError(""); }

  function startEdit(r: PricingRule) {
    setForm({
      name: r.name, condition_type: r.condition_type, condition_value: r.condition_value,
      min_margin: r.min_margin, max_margin: r.max_margin ?? null,
      fixed_markup: r.fixed_markup ?? null, priority: r.priority, active: r.active,
    });
    setEditing(r.id);
    setShowNew(false);
    setFormError("");
  }

  function cancel() { setShowNew(false); setEditing(null); setFormError(""); }

  async function handleSave() {
    if (!form.name.trim() || !form.condition_value.trim()) {
      setFormError("Nombre y valor de condición son obligatorios.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      if (editing) {
        await edit(editing, form);
      } else {
        await add(form);
      }
      cancel();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`¿Eliminar la regla "${name}"?`)) return;
    try { await remove(id); } catch { /* silencioso */ }
  }

  async function toggleActive(r: PricingRule) {
    try { await edit(r.id, { active: !r.active }); } catch { /* silencioso */ }
  }

  const FormPanel = () => (
    <div className={`${bg} border rounded-xl p-5 mb-4`}>
      <h3 className={`font-bold text-sm ${dk("text-white", "text-[#171717]")} mb-4`}>
        {editing ? "Editar regla" : "Nueva regla de precios"}
      </h3>

      <div className={`flex items-start gap-2 p-3 rounded-lg mb-4 ${dk("bg-blue-500/10 border-blue-500/20", "bg-blue-50 border-blue-200")} border text-xs ${dk("text-blue-400", "text-blue-600")}`}>
        <AlertCircle size={13} className="shrink-0 mt-0.5" />
        <span>
          Las reglas se evalúan en orden de <strong>prioridad</strong> (mayor número = primero).
          La primera regla que coincide determina el margen. Si no hay match, se usa el margen del cliente.
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <p className={labelCls}>Nombre de la regla *</p>
          <input className={inputCls} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Ej: Redes — margen mínimo 18%" />
        </div>

        <div>
          <p className={labelCls}>Tipo de condición</p>
          <select className={inputCls} value={form.condition_type} onChange={(e) => setForm((p) => ({ ...p, condition_type: e.target.value as any }))}>
            {(Object.entries(CONDITION_LABELS) as [string, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        <div>
          <p className={labelCls}>Valor de condición *</p>
          {form.condition_type === "category" && categories.length > 0 ? (
            <select className={inputCls} value={form.condition_value} onChange={(e) => setForm((p) => ({ ...p, condition_value: e.target.value }))}>
              <option value="">— elegir —</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          ) : (
            <input className={inputCls} value={form.condition_value} onChange={(e) => setForm((p) => ({ ...p, condition_value: e.target.value }))} placeholder={
              form.condition_type === "category" ? "Ej: Redes" :
              form.condition_type === "supplier" ? "Nombre o ID" :
              form.condition_type === "tag" ? "Ej: premium" : "Ej: NET-"
            } />
          )}
        </div>

        <div>
          <p className={labelCls}>Margen mínimo (%)</p>
          <input className={inputCls} type="number" min="0" max="200" step="0.5" value={form.min_margin} onChange={(e) => setForm((p) => ({ ...p, min_margin: Number(e.target.value) }))} />
        </div>

        <div>
          <p className={labelCls}>Margen máximo (% — opcional)</p>
          <input className={inputCls} type="number" min="0" max="200" step="0.5"
            value={form.max_margin ?? ""}
            onChange={(e) => setForm((p) => ({ ...p, max_margin: e.target.value ? Number(e.target.value) : null }))}
            placeholder="Sin límite"
          />
        </div>

        <div>
          <p className={labelCls}>Margen fijo (% — override)</p>
          <input className={inputCls} type="number" min="0" max="200" step="0.5"
            value={form.fixed_markup ?? ""}
            onChange={(e) => setForm((p) => ({ ...p, fixed_markup: e.target.value ? Number(e.target.value) : null }))}
            placeholder="Sin override"
          />
          <p className={`text-[10px] mt-0.5 ${dk("text-gray-600", "text-[#a3a3a3]")}`}>Si se define, ignora mín/máx y usa este valor exacto</p>
        </div>

        <div>
          <p className={labelCls}>Prioridad</p>
          <input className={inputCls} type="number" min="0" value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: Number(e.target.value) }))} />
          <p className={`text-[10px] mt-0.5 ${dk("text-gray-600", "text-[#a3a3a3]")}`}>Mayor número = evaluada primero</p>
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" id="rule-active" checked={form.active} onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))} className="accent-[#2D9F6A] h-4 w-4" />
          <label htmlFor="rule-active" className={`text-sm ${dk("text-gray-300", "text-[#525252]")}`}>Activa</label>
        </div>
      </div>

      {formError && <p className="text-red-400 text-xs mt-2">{formError}</p>}

      <div className="flex gap-2 mt-4">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1.5 bg-[#2D9F6A] hover:bg-[#25835A] text-white text-sm font-semibold px-4 py-2 rounded-lg transition disabled:opacity-50">
          <Save size={13} /> {saving ? "Guardando…" : "Guardar"}
        </button>
        <button onClick={cancel} className={`flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg border transition ${dk("border-[#2a2a2a] text-gray-400 hover:text-white hover:bg-[#1c1c1c]", "border-[#e5e5e5] text-[#737373] hover:bg-[#f5f5f5]")}`}>
          <X size={13} /> Cancelar
        </button>
      </div>
    </div>
  );

  if (loading) return <div className={`text-sm ${dk("text-gray-500", "text-[#a3a3a3]")} py-8 text-center`}>Cargando reglas…</div>;

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`font-bold text-base ${dk("text-white", "text-[#171717]")}`}>Motor de Precios</h2>
          <p className={`text-xs ${dk("text-gray-500", "text-[#737373]")} mt-0.5`}>{rules.length} regla{rules.length !== 1 ? "s" : ""}</p>
        </div>
        {!showNew && !editing && (
          <button onClick={startNew} className="flex items-center gap-1.5 bg-[#2D9F6A] hover:bg-[#25835A] text-white text-sm font-semibold px-3 py-2 rounded-lg transition">
            <Plus size={14} /> Nueva regla
          </button>
        )}
      </div>

      {error && <p className="text-red-400 text-xs bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>}

      {(showNew || editing) && <FormPanel />}

      {rules.length === 0 && !showNew ? (
        <div className={`text-center py-16 ${dk("text-gray-600", "text-[#a3a3a3]")} text-sm`}>
          <Tag size={32} className="mx-auto mb-2 opacity-20" />
          <p>No hay reglas. Creá la primera.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((r) => (
            <div key={r.id} className={`${bg} border rounded-xl px-4 py-3 flex items-center gap-3 ${!r.active ? "opacity-40" : ""}`}>
              {/* Priority badge */}
              <div className={`shrink-0 text-center rounded-lg px-2 py-1 min-w-[40px] ${dk("bg-[#1c1c1c]", "bg-[#f0f0f0]")}`}>
                <p className={`text-[9px] ${dk("text-gray-600", "text-[#a3a3a3]")}`}>PRIO</p>
                <p className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>{r.priority}</p>
              </div>

              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-sm ${dk("text-white", "text-[#171717]")} truncate`}>{r.name}</p>
                <p className={`text-[11px] ${dk("text-gray-500", "text-[#737373]")} mt-0.5`}>
                  <span className={`${dk("bg-[#1c1c1c]", "bg-[#f0f0f0]")} px-1.5 py-0.5 rounded text-[10px] font-medium`}>
                    {CONDITION_LABELS[r.condition_type]}
                  </span>
                  {" = "}<span className="font-mono">{r.condition_value}</span>
                </p>
              </div>

              {/* Margin display */}
              <div className="shrink-0 text-right">
                {r.fixed_markup != null ? (
                  <span className="text-xs font-bold text-amber-400">Fijo: {r.fixed_markup}%</span>
                ) : (
                  <div className="text-xs">
                    <span className="text-[#2D9F6A] font-bold">≥ {r.min_margin}%</span>
                    {r.max_margin != null && <span className={`${dk("text-gray-500", "text-[#a3a3a3]")} ml-1`}>/ ≤ {r.max_margin}%</span>}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-1 shrink-0">
                <button onClick={() => toggleActive(r)} title={r.active ? "Desactivar" : "Activar"}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition ${r.active ? dk("border-[#2D9F6A]/30 text-[#2D9F6A] hover:bg-[#2D9F6A]/10", "border-[#2D9F6A]/30 text-[#2D9F6A]") : dk("border-[#333] text-gray-500", "border-[#e5e5e5] text-[#a3a3a3]")}`}>
                  {r.active ? "ON" : "OFF"}
                </button>
                <button onClick={() => startEdit(r)} className={`p-1.5 rounded-lg ${dk("text-gray-600 hover:text-white hover:bg-[#1c1c1c]", "text-[#a3a3a3] hover:text-[#171717] hover:bg-[#f5f5f5]")} transition`}>
                  <Pencil size={12} />
                </button>
                <button onClick={() => handleDelete(r.id, r.name)} className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
