import { useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/api/activityLog";
import { X, Plus, Trash2, Save, Search } from "lucide-react";
import { Product } from "@/models/products";

interface ClientProfile { id: string; company_name: string; contact_name: string; }

interface LineItem {
  product_id: number;
  name: string;
  sku: string;
  quantity: number;
  cost_price: number;
  unit_price: number;
  total_price: number;
  margin: number;
}

interface Props {
  clients: ClientProfile[];
  products: Product[];
  isDark?: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateOrderModal({ clients, products, isDark = true, onClose, onCreated }: Props) {
  const dk = (d: string, l: string) => isDark ? d : l;
  const [clientId, setClientId] = useState("");
  const [lines, setLines] = useState<LineItem[]>([]);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"pending" | "approved">("pending");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [productSearch, setProductSearch] = useState("");

  const filteredProducts = useMemo(() => {
    const term = productSearch.toLowerCase();
    return products.filter((p) =>
      !term || p.name.toLowerCase().includes(term) || p.sku?.toLowerCase().includes(term)
    ).slice(0, 8);
  }, [products, productSearch]);

  function addProduct(p: Product) {
    setLines((prev) => {
      const exists = prev.find((l) => l.product_id === p.id);
      if (exists) return prev.map((l) => l.product_id === p.id
        ? { ...l, quantity: l.quantity + 1, total_price: l.unit_price * (l.quantity + 1) }
        : l
      );
      return [...prev, {
        product_id:  p.id,
        name:        p.name,
        sku:         p.sku ?? "",
        quantity:    1,
        cost_price:  p.cost_price,
        unit_price:  p.cost_price,
        total_price: p.cost_price,
        margin:      0,
      }];
    });
    setProductSearch("");
  }

  function updateLine(id: number, field: keyof LineItem, value: number) {
    setLines((prev) => prev.map((l) => {
      if (l.product_id !== id) return l;
      const updated = { ...l, [field]: value };
      if (field === "quantity" || field === "unit_price") {
        updated.total_price = updated.unit_price * updated.quantity;
        updated.margin = updated.cost_price > 0
          ? ((updated.unit_price - updated.cost_price) / updated.cost_price) * 100
          : 0;
      }
      return updated;
    }));
  }

  function removeLine(id: number) {
    setLines((prev) => prev.filter((l) => l.product_id !== id));
  }

  const total = lines.reduce((s, l) => s + l.total_price, 0);

  async function handleSave() {
    if (!clientId) { setError("Seleccioná un cliente."); return; }
    if (lines.length === 0) { setError("Agregá al menos un producto."); return; }
    setSaving(true);
    setError("");

    const orderNumber = `ADM-${Date.now().toString().slice(-6)}`;
    const { data, error: dbErr } = await supabase.from("orders").insert({
      client_id:    clientId,
      products:     lines,
      total,
      status,
      notes:        notes || null,
      order_number: orderNumber,
    }).select("id").single();

    if (dbErr) { setError(dbErr.message); setSaving(false); return; }

    logActivity({
      user_id:     null,
      action:      "place_order",
      entity_type: "order",
      entity_id:   String(data.id),
      metadata:    { order_number: orderNumber, total, created_by: "admin" },
    });

    onCreated();
    onClose();
  }

  const inputCls = `w-full border rounded-lg px-3 py-2 text-sm outline-none transition ${dk("bg-[#0d0d0d] border-[#222] text-white focus:border-[#2D9F6A]/50", "bg-white border-[#e5e5e5] text-[#171717] focus:border-[#2D9F6A]/50")}`;
  const labelCls = `text-[11px] font-semibold uppercase tracking-wide mb-1 ${dk("text-gray-500", "text-[#a3a3a3]")}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${dk("border-[#1f1f1f]", "border-[#e5e5e5]")}`}>
          <h2 className={`font-bold ${dk("text-white", "text-[#171717]")}`}>Crear pedido (admin)</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Client + status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className={labelCls}>Cliente *</p>
              <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputCls}>
                <option value="">Seleccionar cliente…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.company_name || c.contact_name}</option>
                ))}
              </select>
            </div>
            <div>
              <p className={labelCls}>Estado inicial</p>
              <select value={status} onChange={(e) => setStatus(e.target.value as any)} className={inputCls}>
                <option value="pending">En revisión</option>
                <option value="approved">Aprobado</option>
              </select>
            </div>
          </div>

          {/* Product search */}
          <div>
            <p className={labelCls}>Agregar productos</p>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              <input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Buscar por nombre o SKU…"
                className={`${inputCls} pl-8`}
              />
            </div>
            {productSearch && (
              <div className={`mt-1 rounded-xl border overflow-hidden shadow-lg ${dk("bg-[#0d0d0d] border-[#222]", "bg-white border-[#e5e5e5]")}`}>
                {filteredProducts.length === 0 ? (
                  <p className="text-xs text-gray-500 px-3 py-2">Sin resultados</p>
                ) : filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addProduct(p)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition ${dk("hover:bg-[#1a1a1a] text-gray-300", "hover:bg-[#f5f5f5] text-[#525252]")}`}
                  >
                    <span>{p.name}</span>
                    <span className="text-gray-500 font-mono">${p.cost_price.toLocaleString()}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Line items */}
          {lines.length > 0 && (
            <div className={`rounded-xl border overflow-hidden ${dk("border-[#1f1f1f]", "border-[#e5e5e5]")}`}>
              <table className="w-full text-xs">
                <thead className={`${dk("bg-[#0a0a0a] text-gray-500", "bg-[#f5f5f5] text-[#a3a3a3]")} uppercase tracking-wide`}>
                  <tr>
                    <th className="px-3 py-2 text-left">Producto</th>
                    <th className="px-3 py-2 text-center">Cant.</th>
                    <th className="px-3 py-2 text-right">Precio unit.</th>
                    <th className="px-3 py-2 text-right">Margen</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-2 py-2 w-6" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.product_id} className={`border-t ${dk("border-[#1f1f1f]", "border-[#f0f0f0]")}`}>
                      <td className={`px-3 py-2 ${dk("text-gray-300", "text-[#525252]")}`}>
                        <div>{l.name}</div>
                        <div className="text-[10px] text-gray-600 font-mono">costo: ${l.cost_price.toLocaleString()}</div>
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" min="1" value={l.quantity}
                          onChange={(e) => updateLine(l.product_id, "quantity", Number(e.target.value))}
                          className={`w-14 text-center border rounded px-1 py-0.5 text-xs outline-none ${dk("bg-[#181818] border-[#333] text-white", "bg-white border-[#e5e5e5] text-[#171717]")}`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" min="0" value={l.unit_price}
                          onChange={(e) => updateLine(l.product_id, "unit_price", Number(e.target.value))}
                          className={`w-20 text-right border rounded px-1 py-0.5 text-xs outline-none ${dk("bg-[#181818] border-[#333] text-white", "bg-white border-[#e5e5e5] text-[#171717]")}`}
                        />
                      </td>
                      <td className={`px-3 py-2 text-right ${l.margin >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {l.margin.toFixed(0)}%
                      </td>
                      <td className={`px-3 py-2 text-right font-semibold ${dk("text-white", "text-[#171717]")}`}>
                        ${l.total_price.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-2 py-2">
                        <button onClick={() => removeLine(l.product_id)} className="text-gray-600 hover:text-red-400 transition">
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr className={`border-t ${dk("border-[#2a2a2a]", "border-[#e5e5e5]")}`}>
                    <td colSpan={4} className="px-3 py-2 text-right text-xs font-bold text-gray-500">TOTAL</td>
                    <td className={`px-3 py-2 text-right font-extrabold text-sm text-[#2D9F6A]`}>
                      ${total.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Notes */}
          <div>
            <p className={labelCls}>Notas internas</p>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Observaciones, condiciones de pago…"
              className={`${inputCls} resize-none`}
            />
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <div className="flex gap-2 justify-end">
            <button onClick={onClose}
              className={`text-sm px-4 py-2 rounded-lg border transition ${dk("border-[#2a2a2a] text-gray-400 hover:text-white hover:bg-[#1c1c1c]", "border-[#e5e5e5] text-[#737373] hover:bg-[#f5f5f5]")}`}>
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 bg-[#2D9F6A] hover:bg-[#25835A] text-white text-sm font-semibold px-4 py-2 rounded-lg transition disabled:opacity-50">
              <Save size={13} /> {saving ? "Guardando…" : "Crear pedido"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
