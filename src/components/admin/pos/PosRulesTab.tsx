import { useState, useMemo } from "react";
import { Plus, Trash2, Pencil, Check, X, ToggleLeft, ToggleRight, Zap, ArrowRight } from "lucide-react";
import { Product, displayName } from "@/models/products";
import { PosRule, PosRuleType, posStorage } from "./types";

interface Props {
  products: Product[];
  isDark?: boolean;
}

function uid() { return crypto.randomUUID(); }

const RULE_TYPE_LABELS: Record<PosRuleType, { label: string; color: string }> = {
  "cross-sell":  { label: "Cross-sell",  color: "text-blue-400 bg-blue-400/10" },
  "upsell":      { label: "Upsell",      color: "text-amber-400 bg-amber-400/10" },
  "complement":  { label: "Complemento", color: "text-violet-400 bg-violet-400/10" },
};

const EMPTY_FORM: Omit<PosRule, "id"> = {
  baseProductId: 0,
  suggestedProductIds: [],
  type: "cross-sell",
  priority: 1,
  active: true,
};

export function PosRulesTab({ products, isDark }: Props) {
  const dk = (d: string, l: string) => (isDark ? d : l);

  const [rules,      setRules]      = useState<PosRule[]>(() => posStorage.loadRules());
  const [showForm,   setShowForm]   = useState(false);
  const [editingRule, setEditingRule] = useState<PosRule | null>(null);
  const [form,       setForm]       = useState<Omit<PosRule, "id">>(EMPTY_FORM);
  const [baseSearch, setBaseSearch] = useState("");
  const [sugSearch,  setSugSearch]  = useState("");

  function persist(next: PosRule[]) { setRules(next); posStorage.saveRules(next); }

  function openCreate() { setForm(EMPTY_FORM); setEditingRule(null); setShowForm(true); }
  function openEdit(r: PosRule) {
    setForm({ baseProductId: r.baseProductId, suggestedProductIds: r.suggestedProductIds, type: r.type, priority: r.priority, active: r.active });
    setEditingRule(r);
    setShowForm(true);
  }

  function saveRule() {
    if (!form.baseProductId || form.suggestedProductIds.length === 0) return;
    if (editingRule) {
      persist(rules.map((r) => r.id === editingRule.id ? { ...editingRule, ...form } : r));
    } else {
      persist([...rules, { ...form, id: uid() }]);
    }
    setShowForm(false);
    setEditingRule(null);
  }

  function deleteRule(id: string) { persist(rules.filter((r) => r.id !== id)); }

  function toggleActive(id: string) {
    persist(rules.map((r) => r.id === id ? { ...r, active: !r.active } : r));
  }

  function toggleSuggested(productId: number) {
    const ids = form.suggestedProductIds;
    const next = ids.includes(productId) ? ids.filter((x) => x !== productId) : [...ids, productId];
    setForm((f) => ({ ...f, suggestedProductIds: next }));
  }

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  function filterProducts(query: string) {
    const q = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (!q) return products;
    return products.filter((p) =>
      displayName(p).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q)
    );
  }

  const inputCls = `w-full border rounded-lg px-3 py-2 text-sm outline-none transition ${dk(
    "bg-[#0d0d0d] border-[#262626] text-white focus:border-[#2D9F6A] placeholder:text-[#404040]",
    "bg-[#f9f9f9] border-[#d4d4d4] text-[#171717] focus:border-[#2D9F6A] placeholder:text-gray-400"
  )}`;

  const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className={`text-xs ${dk("text-[#737373]", "text-[#737373]")}`}>
          {rules.length} regla{rules.length !== 1 ? "s" : ""} de sugerencia configurada{rules.length !== 1 ? "s" : ""}
        </p>
        <button onClick={openCreate} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#2D9F6A] hover:bg-[#25835A] text-white font-semibold transition">
          <Plus size={13} /> Nueva regla
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className={`w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl p-6 space-y-4 ${dk("bg-[#0d0d0d] border border-[#1f1f1f]", "bg-white border border-[#e5e5e5]")}`}>
            <div className="flex items-center justify-between">
              <h3 className={`font-bold text-sm ${dk("text-white", "text-[#171717]")}`}>
                {editingRule ? "Editar regla" : "Nueva regla de sugerencia"}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-gray-300 transition"><X size={16} /></button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              {/* Type */}
              <div>
                <label className={`block text-xs font-semibold mb-1 ${dk("text-[#737373]", "text-[#525252]")}`}>Tipo de regla</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as PosRuleType }))}
                  className={inputCls}
                >
                  {(Object.keys(RULE_TYPE_LABELS) as PosRuleType[]).map((t) => (
                    <option key={t} value={t}>{RULE_TYPE_LABELS[t].label}</option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className={`block text-xs font-semibold mb-1 ${dk("text-[#737373]", "text-[#525252]")}`}>Prioridad (1 = más alta)</label>
                <input
                  type="number" min={1}
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))}
                  className={inputCls}
                />
              </div>

              {/* Base product */}
              <div className="sm:col-span-2">
                <label className={`block text-xs font-semibold mb-1 ${dk("text-[#737373]", "text-[#525252]")}`}>Producto base (SI...)</label>
                <input value={baseSearch} onChange={(e) => setBaseSearch(e.target.value)} placeholder="Buscar producto base…" className={`${inputCls} mb-1`} />
                <div className={`max-h-32 overflow-y-auto rounded-lg border divide-y ${dk("border-[#1f1f1f] divide-[#1a1a1a]", "border-[#e5e5e5] divide-[#f0f0f0]")}`}>
                  {filterProducts(baseSearch).slice(0, 30).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setForm((f) => ({ ...f, baseProductId: p.id }))}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs transition ${
                        form.baseProductId === p.id
                          ? "bg-[#2D9F6A]/15 text-[#2D9F6A] font-semibold"
                          : dk("text-[#737373] hover:bg-[#0f0f0f]", "text-[#525252] hover:bg-[#fafafa]")
                      }`}
                    >
                      {form.baseProductId === p.id && <Check size={11} />}
                      <span className="truncate">{displayName(p)}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Suggested products */}
              <div className="sm:col-span-2">
                <label className={`block text-xs font-semibold mb-1 ${dk("text-[#737373]", "text-[#525252]")}`}>Productos sugeridos (ENTONCES...)</label>
                <input value={sugSearch} onChange={(e) => setSugSearch(e.target.value)} placeholder="Buscar productos sugeridos…" className={`${inputCls} mb-1`} />
                <div className={`max-h-32 overflow-y-auto rounded-lg border divide-y ${dk("border-[#1f1f1f] divide-[#1a1a1a]", "border-[#e5e5e5] divide-[#f0f0f0]")}`}>
                  {filterProducts(sugSearch).slice(0, 30).map((p) => (
                    <label key={p.id} className={`flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer transition ${dk("hover:bg-[#0f0f0f]", "hover:bg-[#fafafa]")}`}>
                      <input
                        type="checkbox"
                        checked={form.suggestedProductIds.includes(p.id)}
                        onChange={() => toggleSuggested(p.id)}
                        className="accent-[#2D9F6A]"
                      />
                      <span className={`truncate ${dk("text-[#737373]", "text-[#525252]")}`}>{displayName(p)}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowForm(false)} className={`text-xs px-4 py-2 rounded-lg border transition ${dk("border-[#333] text-[#737373] hover:text-white", "border-[#d4d4d4] text-[#737373] hover:text-[#171717]")}`}>
                Cancelar
              </button>
              <button
                onClick={saveRule}
                disabled={!form.baseProductId || form.suggestedProductIds.length === 0}
                className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg bg-[#2D9F6A] hover:bg-[#25835A] disabled:opacity-40 text-white font-semibold transition"
              >
                <Check size={13} /> {editingRule ? "Guardar cambios" : "Crear regla"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rules list */}
      {sortedRules.length === 0 && (
        <div className={`flex flex-col items-center justify-center py-16 rounded-xl border ${dk("bg-[#0d0d0d] border-[#1f1f1f] text-[#525252]", "bg-[#f9f9f9] border-[#e5e5e5] text-[#a3a3a3]")}`}>
          <Zap size={32} className="mb-3 opacity-30" />
          <p className="text-sm font-semibold">Sin reglas configuradas</p>
          <p className="text-xs mt-1">Creá reglas para sugerir productos automáticamente.</p>
        </div>
      )}

      <div className="space-y-2">
        {sortedRules.map((rule) => {
          const base  = productById.get(rule.baseProductId);
          const suggs = rule.suggestedProductIds.map((id) => productById.get(id)).filter(Boolean) as Product[];
          const { label, color } = RULE_TYPE_LABELS[rule.type];

          return (
            <div
              key={rule.id}
              className={`flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl border transition ${
                rule.active
                  ? dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")
                  : dk("bg-[#0a0a0a] border-[#141414] opacity-50", "bg-[#f9f9f9] border-[#ececec] opacity-50")
              }`}
            >
              {/* Priority badge */}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${dk("bg-[#1a1a1a] text-[#525252]", "bg-[#f0f0f0] text-[#737373]")}`}>
                #{rule.priority}
              </span>

              {/* Type badge */}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${color}`}>{label}</span>

              {/* SI → ENTONCES */}
              <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
                <span className={`text-xs font-semibold truncate max-w-[160px] ${dk("text-white", "text-[#171717]")}`}>
                  {base ? displayName(base) : <span className="text-red-400">Producto eliminado</span>}
                </span>
                <ArrowRight size={13} className="text-[#2D9F6A] shrink-0" />
                <span className={`text-xs truncate ${dk("text-[#737373]", "text-[#737373]")}`}>
                  {suggs.length > 0
                    ? suggs.map((p) => displayName(p)).join(", ")
                    : <span className="text-red-400">Sin sugeridos</span>
                  }
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 ml-auto shrink-0">
                <button onClick={() => toggleActive(rule.id)} title={rule.active ? "Desactivar" : "Activar"}>
                  {rule.active
                    ? <ToggleRight size={18} className="text-[#2D9F6A]" />
                    : <ToggleLeft  size={18} className="text-gray-600" />
                  }
                </button>
                <button onClick={() => openEdit(rule)} className="text-gray-500 hover:text-[#2D9F6A] transition p-1">
                  <Pencil size={13} />
                </button>
                <button onClick={() => deleteRule(rule.id)} className="text-gray-500 hover:text-red-400 transition p-1">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
