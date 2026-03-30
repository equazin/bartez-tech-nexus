import { useState, useMemo } from "react";
import {
  Plus, Pencil, Trash2, Copy, Check, X, Package,
  ChevronDown, ChevronUp, ToggleLeft, ToggleRight, ShoppingCart,
} from "lucide-react";
import { Product, displayName } from "@/models/products";
import { PosKit, PosKitItem, posStorage } from "./types";

interface Props {
  products: Product[];
  isDark?: boolean;
}

function uid() { return crypto.randomUUID(); }

const EMPTY_FORM: Omit<PosKit, "id" | "createdAt"> = {
  name: "",
  description: "",
  items: [],
  manualPrice: null,
  discountPct: 0,
  active: true,
};

function calcAutoPrice(items: PosKitItem[], products: Product[], discountPct: number): number {
  const sum = items.reduce((acc, item) => {
    const p = products.find((x) => x.id === item.productId);
    return acc + (p?.cost_price ?? 0) * item.qty;
  }, 0);
  return sum * (1 - discountPct / 100);
}

export function PosKitsTab({ products, isDark }: Props) {
  const dk = (d: string, l: string) => (isDark ? d : l);

  const [kits, setKits] = useState<PosKit[]>(() => posStorage.loadKits());
  const [showForm, setShowForm] = useState(false);
  const [editingKit, setEditingKit] = useState<PosKit | null>(null);
  const [form, setForm] = useState<Omit<PosKit, "id" | "createdAt">>(EMPTY_FORM);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState("");

  function persist(next: PosKit[]) { setKits(next); posStorage.saveKits(next); }

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditingKit(null);
    setShowForm(true);
  }

  function openEdit(kit: PosKit) {
    setForm({ name: kit.name, description: kit.description, items: kit.items, manualPrice: kit.manualPrice, discountPct: kit.discountPct, active: kit.active });
    setEditingKit(kit);
    setShowForm(true);
  }

  function saveKit() {
    if (!form.name.trim()) return;
    if (editingKit) {
      persist(kits.map((k) => k.id === editingKit.id ? { ...editingKit, ...form } : k));
    } else {
      persist([...kits, { ...form, id: uid(), createdAt: new Date().toISOString() }]);
    }
    setShowForm(false);
    setEditingKit(null);
  }

  function duplicateKit(kit: PosKit) {
    persist([...kits, { ...kit, id: uid(), name: `${kit.name} (copia)`, createdAt: new Date().toISOString() }]);
  }

  function deleteKit(id: string) { persist(kits.filter((k) => k.id !== id)); }

  function toggleActive(id: string) {
    persist(kits.map((k) => k.id === id ? { ...k, active: !k.active } : k));
  }

  function toggleItem(productId: number) {
    const exists = form.items.find((i) => i.productId === productId);
    const next: PosKitItem[] = exists
      ? form.items.filter((i) => i.productId !== productId)
      : [...form.items, { productId, qty: 1 }];
    setForm((f) => ({ ...f, items: next }));
  }

  function setQty(productId: number, qty: number) {
    setForm((f) => ({ ...f, items: f.items.map((i) => i.productId === productId ? { ...i, qty: Math.max(1, qty) } : i) }));
  }

  const filteredProducts = useMemo(() => {
    const q = productSearch.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return q ? products.filter((p) =>
      displayName(p).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q) ||
      (p.sku ?? "").toLowerCase().includes(q)
    ) : products;
  }, [products, productSearch]);

  const cardBase = `rounded-2xl border p-5 space-y-3 ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`;
  const inputCls = `w-full border rounded-lg px-3 py-2 text-sm outline-none transition ${dk("bg-[#0d0d0d] border-[#262626] text-white focus:border-[#2D9F6A] placeholder:text-[#404040]", "bg-[#f9f9f9] border-[#d4d4d4] text-[#171717] focus:border-[#2D9F6A] placeholder:text-gray-400")}`;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className={`text-xs ${dk("text-[#737373]", "text-[#737373]")}`}>
          {kits.length} kit{kits.length !== 1 ? "s" : ""} configurado{kits.length !== 1 ? "s" : ""}
        </p>
        <button onClick={openCreate} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#2D9F6A] hover:bg-[#25835A] text-white font-semibold transition">
          <Plus size={13} /> Nuevo kit
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl p-6 space-y-4 ${dk("bg-[#0d0d0d] border border-[#1f1f1f]", "bg-white border border-[#e5e5e5]")}`}>
            <div className="flex items-center justify-between">
              <h3 className={`font-bold text-sm ${dk("text-white", "text-[#171717]")}`}>
                {editingKit ? "Editar kit" : "Nuevo kit POS"}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-gray-300 transition"><X size={16} /></button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className={`block text-xs font-semibold mb-1 ${dk("text-[#737373]", "text-[#525252]")}`}>Nombre *</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Kit Kiosco Básico" className={inputCls} />
              </div>
              <div>
                <label className={`block text-xs font-semibold mb-1 ${dk("text-[#737373]", "text-[#525252]")}`}>Descuento %</label>
                <input type="number" min={0} max={100} value={form.discountPct} onChange={(e) => setForm((f) => ({ ...f, discountPct: Number(e.target.value) }))} className={inputCls} />
              </div>
              <div className="sm:col-span-2">
                <label className={`block text-xs font-semibold mb-1 ${dk("text-[#737373]", "text-[#525252]")}`}>Descripción</label>
                <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Combo completo para kiosco..." className={inputCls} />
              </div>
              <div>
                <label className={`block text-xs font-semibold mb-1 ${dk("text-[#737373]", "text-[#525252]")}`}>Precio manual (USD) — dejar vacío para auto</label>
                <input
                  type="number"
                  min={0}
                  value={form.manualPrice ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, manualPrice: e.target.value === "" ? null : Number(e.target.value) }))}
                  placeholder="Automático"
                  className={inputCls}
                />
              </div>
              <div className="flex items-end gap-2">
                <label className={`text-xs font-semibold ${dk("text-[#737373]", "text-[#525252]")}`}>Estado</label>
                <button onClick={() => setForm((f) => ({ ...f, active: !f.active }))} className="flex items-center gap-1.5 text-xs">
                  {form.active
                    ? <><ToggleRight size={20} className="text-[#2D9F6A]" /><span className="text-[#2D9F6A] font-semibold">Activo</span></>
                    : <><ToggleLeft  size={20} className="text-gray-600" /><span className="text-gray-500">Inactivo</span></>
                  }
                </button>
              </div>
            </div>

            {/* Product selector */}
            <div>
              <label className={`block text-xs font-semibold mb-2 ${dk("text-[#737373]", "text-[#525252]")}`}>Productos del kit</label>
              <input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Buscar producto…"
                className={`${inputCls} mb-2`}
              />
              <div className={`max-h-48 overflow-y-auto rounded-lg border divide-y ${dk("border-[#1f1f1f] divide-[#1a1a1a]", "border-[#e5e5e5] divide-[#f0f0f0]")}`}>
                {filteredProducts.slice(0, 50).map((p) => {
                  const inKit = form.items.find((i) => i.productId === p.id);
                  return (
                    <div key={p.id} className={`flex items-center gap-2 px-3 py-2 ${dk("hover:bg-[#0f0f0f]", "hover:bg-[#fafafa]")}`}>
                      <input type="checkbox" checked={!!inKit} onChange={() => toggleItem(p.id)} className="accent-[#2D9F6A]" />
                      <span className={`flex-1 text-xs truncate ${dk("text-white", "text-[#171717]")}`}>{displayName(p)}</span>
                      {inKit && (
                        <input
                          type="number"
                          min={1}
                          value={inKit.qty}
                          onChange={(e) => setQty(p.id, Number(e.target.value))}
                          onClick={(e) => e.stopPropagation()}
                          className={`w-14 border rounded px-1.5 py-0.5 text-xs text-center ${dk("bg-[#111] border-[#333] text-white", "bg-white border-[#d4d4d4] text-[#171717]")}`}
                        />
                      )}
                      <span className="text-xs text-gray-500 w-16 text-right">${p.cost_price.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</span>
                    </div>
                  );
                })}
              </div>

              {form.items.length > 0 && (
                <div className={`mt-2 p-3 rounded-lg text-xs ${dk("bg-[#0a0a0a] text-[#737373]", "bg-[#f5f5f5] text-[#525252]")}`}>
                  <div className="flex justify-between">
                    <span>Subtotal ({form.items.reduce((a, i) => a + i.qty, 0)} items)</span>
                    <span className="font-mono">${calcAutoPrice(form.items, products, 0).toLocaleString("es-AR", { maximumFractionDigits: 0 })}</span>
                  </div>
                  {form.discountPct > 0 && (
                    <div className="flex justify-between text-[#2D9F6A]">
                      <span>Descuento {form.discountPct}%</span>
                      <span className="font-mono">-${(calcAutoPrice(form.items, products, 0) * form.discountPct / 100).toLocaleString("es-AR", { maximumFractionDigits: 0 })}</span>
                    </div>
                  )}
                  <div className={`flex justify-between font-bold mt-1 ${dk("text-white", "text-[#171717]")}`}>
                    <span>Precio final</span>
                    <span className="font-mono">${(form.manualPrice ?? calcAutoPrice(form.items, products, form.discountPct)).toLocaleString("es-AR", { maximumFractionDigits: 0 })}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowForm(false)} className={`text-xs px-4 py-2 rounded-lg border transition ${dk("border-[#333] text-[#737373] hover:text-white", "border-[#d4d4d4] text-[#737373] hover:text-[#171717]")}`}>
                Cancelar
              </button>
              <button onClick={saveKit} disabled={!form.name.trim()} className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg bg-[#2D9F6A] hover:bg-[#25835A] disabled:opacity-40 text-white font-semibold transition">
                <Check size={13} /> {editingKit ? "Guardar cambios" : "Crear kit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kit cards */}
      {kits.length === 0 && (
        <div className={`flex flex-col items-center justify-center py-16 rounded-xl border ${dk("bg-[#0d0d0d] border-[#1f1f1f] text-[#525252]", "bg-[#f9f9f9] border-[#e5e5e5] text-[#a3a3a3]")}`}>
          <Package size={32} className="mb-3 opacity-30" />
          <p className="text-sm font-semibold">Sin kits creados</p>
          <p className="text-xs mt-1">Creá combos de productos POS para venta rápida.</p>
        </div>
      )}

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {kits.map((kit) => {
          const isExpanded = expandedId === kit.id;
          const autoPrice  = calcAutoPrice(kit.items, products, kit.discountPct);
          const finalPrice = kit.manualPrice ?? autoPrice;
          const basePrice  = calcAutoPrice(kit.items, products, 0);
          const saving     = basePrice > 0 ? Math.round((1 - finalPrice / basePrice) * 100) : 0;

          return (
            <div key={kit.id} className={cardBase}>
              {/* Card header */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-bold text-sm truncate ${dk("text-white", "text-[#171717]")}`}>{kit.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${kit.active ? "bg-[#2D9F6A]/15 text-[#2D9F6A]" : dk("bg-[#222] text-[#525252]", "bg-[#f0f0f0] text-[#a3a3a3]")}`}>
                      {kit.active ? "Activo" : "Inactivo"}
                    </span>
                    {saving > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-400/15 text-amber-400 font-bold">
                        Ahorro {saving}%
                      </span>
                    )}
                  </div>
                  {kit.description && <p className={`text-xs mt-0.5 truncate ${dk("text-[#737373]", "text-[#737373]")}`}>{kit.description}</p>}
                </div>
                <button onClick={() => toggleActive(kit.id)}>
                  {kit.active
                    ? <ToggleRight size={20} className="text-[#2D9F6A] shrink-0" />
                    : <ToggleLeft  size={20} className="text-gray-600 shrink-0" />
                  }
                </button>
              </div>

              {/* Products list (collapsed) */}
              <div>
                {kit.items.slice(0, isExpanded ? undefined : 3).map((item) => {
                  const p = products.find((x) => x.id === item.productId);
                  return p ? (
                    <div key={item.productId} className={`flex items-center gap-2 text-xs py-1 border-b ${dk("border-[#1a1a1a] text-[#737373]", "border-[#f0f0f0] text-[#737373]")}`}>
                      <span className="flex-1 truncate">{displayName(p)}</span>
                      <span className={`font-mono ${dk("text-[#525252]", "text-[#a3a3a3]")}`}>×{item.qty}</span>
                    </div>
                  ) : null;
                })}
                {kit.items.length > 3 && (
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : kit.id)}
                    className={`flex items-center gap-1 text-[10px] mt-1 transition ${dk("text-[#525252] hover:text-[#737373]", "text-[#a3a3a3] hover:text-[#737373]")}`}
                  >
                    {isExpanded ? <><ChevronUp size={11}/> Menos</> : <><ChevronDown size={11}/> +{kit.items.length - 3} más</>}
                  </button>
                )}
              </div>

              {/* Price */}
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-[10px] ${dk("text-[#525252]", "text-[#a3a3a3]")}`}>Precio total</p>
                  <p className={`text-lg font-extrabold font-mono ${dk("text-white", "text-[#171717]")}`}>
                    ${finalPrice.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <button className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition ${dk("border-[#2D9F6A]/30 text-[#2D9F6A] hover:bg-[#2D9F6A]/10", "border-[#2D9F6A]/40 text-[#1a7a50] hover:bg-[#f0faf5]")}`}>
                  <ShoppingCart size={12} /> Al carrito
                </button>
              </div>

              {/* Actions */}
              <div className={`flex items-center gap-1 pt-2 border-t ${dk("border-[#1a1a1a]", "border-[#f0f0f0]")}`}>
                <button onClick={() => openEdit(kit)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#2D9F6A] transition px-2 py-1 rounded">
                  <Pencil size={12} /> Editar
                </button>
                <button onClick={() => duplicateKit(kit)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#2D9F6A] transition px-2 py-1 rounded">
                  <Copy size={12} /> Duplicar
                </button>
                <button onClick={() => deleteKit(kit.id)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-400 transition px-2 py-1 rounded ml-auto">
                  <Trash2 size={12} /> Eliminar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
