import { useState } from "react";
import { Plus, Pencil, Trash2, Check, X, GripVertical } from "lucide-react";
import { PosSubcategory, posStorage } from "./types";

interface Props {
  isDark?: boolean;
}

function uid() {
  return `pos-${Math.random().toString(36).slice(2, 9)}`;
}

export function PosCategoriesTab({ isDark }: Props) {
  const dk = (d: string, l: string) => (isDark ? d : l);

  const [subcats, setSubcats] = useState<PosSubcategory[]>(() =>
    posStorage.loadSubcategories().sort((a, b) => a.order - b.order)
  );
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  function persist(next: PosSubcategory[]) {
    const reordered = next.map((s, i) => ({ ...s, order: i }));
    setSubcats(reordered);
    posStorage.saveSubcategories(reordered);
  }

  function addSubcat() {
    const name = newName.trim();
    if (!name) return;
    persist([...subcats, { id: uid(), name, order: subcats.length }]);
    setNewName("");
  }

  function saveEdit(id: string) {
    const name = editingName.trim();
    if (!name) return;
    persist(subcats.map((s) => (s.id === id ? { ...s, name } : s)));
    setEditingId(null);
  }

  function remove(id: string) {
    persist(subcats.filter((s) => s.id !== id));
  }

  function handleDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const from = subcats.findIndex((s) => s.id === dragId);
    const to   = subcats.findIndex((s) => s.id === targetId);
    if (from === -1 || to === -1) return;
    const next = [...subcats];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    persist(next);
    setDragId(null);
    setDragOverId(null);
  }

  const inputCls = `flex-1 border rounded-lg px-3 py-2 text-sm outline-none transition ${dk(
    "bg-[#0d0d0d] border-[#262626] text-white focus:border-[#404040] placeholder:text-[#404040]",
    "bg-[#f9f9f9] border-[#d4d4d4] text-[#171717] focus:border-[#2D9F6A] placeholder:text-gray-400"
  )}`;

  return (
    <div className="space-y-5 max-w-lg">
      <p className={`text-xs ${dk("text-[#737373]", "text-[#737373]")}`}>
        Subcategorías internas del módulo POS. Usadas para clasificar productos, kits y reglas.
      </p>

      {/* Add form */}
      <div className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addSubcat()}
          placeholder="Nueva subcategoría..."
          className={inputCls}
        />
        <button
          onClick={addSubcat}
          disabled={!newName.trim()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#2D9F6A] hover:bg-[#25835A] disabled:opacity-40 text-white text-xs font-semibold transition"
        >
          <Plus size={13} /> Agregar
        </button>
      </div>

      {/* List */}
      <div className="space-y-1.5">
        {subcats.map((s) => (
          <div
            key={s.id}
            draggable
            onDragStart={() => setDragId(s.id)}
            onDragEnd={() => { setDragId(null); setDragOverId(null); }}
            onDragOver={(e) => { e.preventDefault(); setDragOverId(s.id); }}
            onDrop={() => handleDrop(s.id)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2.5 border transition ${
              dragOverId === s.id
                ? "border-[#2D9F6A] bg-[#2D9F6A]/10"
                : dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")
            } ${dragId === s.id ? "opacity-40" : ""}`}
          >
            <GripVertical size={14} className="text-gray-500 cursor-grab shrink-0" />

            {editingId === s.id ? (
              <>
                <input
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit(s.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  autoFocus
                  className={`${inputCls} py-1`}
                />
                <button onClick={() => saveEdit(s.id)} className="text-green-400 hover:text-green-300 transition">
                  <Check size={14} />
                </button>
                <button onClick={() => setEditingId(null)} className="text-gray-500 hover:text-gray-300 transition">
                  <X size={14} />
                </button>
              </>
            ) : (
              <>
                <span className={`flex-1 text-sm ${dk("text-white", "text-[#171717]")}`}>{s.name}</span>
                <button
                  onClick={() => { setEditingId(s.id); setEditingName(s.name); }}
                  className="text-gray-500 hover:text-[#2D9F6A] transition"
                >
                  <Pencil size={13} />
                </button>
                <button onClick={() => remove(s.id)} className="text-gray-500 hover:text-red-400 transition">
                  <Trash2 size={13} />
                </button>
              </>
            )}
          </div>
        ))}

        {subcats.length === 0 && (
          <p className="text-xs text-gray-500 py-4 text-center">Sin subcategorías. Agregá una arriba.</p>
        )}
      </div>
    </div>
  );
}
