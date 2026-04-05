import { useMemo, useState } from "react";
import { Save, Search, Trash2, X } from "lucide-react";

import { logActivity } from "@/lib/api/activityLog";
import { supabase } from "@/lib/supabase";
import type { Product } from "@/models/products";
import type { QuoteStatus } from "@/models/quote";

interface ClientProfile {
  id: string;
  company_name: string;
  contact_name: string;
}

interface QuoteLineItem {
  product_id: number;
  name: string;
  quantity: number;
  cost: number;
  margin: number;
  unitPrice: number;
  totalPrice: number;
  ivaRate: number;
  ivaAmount: number;
  totalWithIVA: number;
}

interface Props {
  clients: ClientProfile[];
  products: Product[];
  isDark?: boolean;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
  initialClientId?: string;
}

export function CreateQuoteModal({ clients, products, isDark = true, onClose, onCreated, initialClientId }: Props) {
  const dk = (dark: string, light: string) => (isDark ? dark : light);
  const [clientId, setClientId] = useState(initialClientId ?? "");
  const [lines, setLines] = useState<QuoteLineItem[]>([]);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<QuoteStatus>("draft");
  const [currency, setCurrency] = useState<"USD" | "ARS">("USD");
  const [validDays, setValidDays] = useState("7");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const lockClient = Boolean(initialClientId);

  const filteredProducts = useMemo(() => {
    const term = productSearch.toLowerCase();
    return products
      .filter((product) => !term || product.name.toLowerCase().includes(term) || product.sku?.toLowerCase().includes(term))
      .slice(0, 8);
  }, [productSearch, products]);

  function addProduct(product: Product) {
    const cost = product.cost_price ?? 0;
    const ivaRate = product.iva_rate ?? 21;
    setLines((prev) => {
      const existing = prev.find((line) => line.product_id === product.id);
      if (existing) {
        return prev.map((line) => {
          if (line.product_id !== product.id) return line;
          const quantity = line.quantity + 1;
          const totalPrice = line.unitPrice * quantity;
          const ivaAmount = totalPrice * (ivaRate / 100);
          return {
            ...line,
            quantity,
            totalPrice,
            ivaAmount,
            totalWithIVA: totalPrice + ivaAmount,
          };
        });
      }
      return [
        ...prev,
        {
          product_id: product.id,
          name: product.name,
          quantity: 1,
          cost,
          margin: 0,
          unitPrice: cost,
          totalPrice: cost,
          ivaRate,
          ivaAmount: cost * (ivaRate / 100),
          totalWithIVA: cost * (1 + ivaRate / 100),
        },
      ];
    });
    setProductSearch("");
  }

  function updateLine(id: number, field: "quantity" | "unitPrice", value: number) {
    setLines((prev) =>
      prev.map((line) => {
        if (line.product_id !== id) return line;
        const next = { ...line, [field]: value };
        next.totalPrice = next.unitPrice * next.quantity;
        next.ivaAmount = next.totalPrice * (next.ivaRate / 100);
        next.totalWithIVA = next.totalPrice + next.ivaAmount;
        next.margin = next.cost > 0 ? ((next.unitPrice - next.cost) / next.cost) * 100 : 0;
        return next;
      }),
    );
  }

  function removeLine(id: number) {
    setLines((prev) => prev.filter((line) => line.product_id !== id));
  }

  const subtotal = lines.reduce((sum, line) => sum + line.totalPrice, 0);
  const ivaTotal = lines.reduce((sum, line) => sum + line.ivaAmount, 0);
  const total = subtotal + ivaTotal;

  async function handleSave() {
    if (!clientId) {
      setError("Selecciona un cliente.");
      return;
    }
    if (lines.length === 0) {
      setError("Agrega al menos un producto.");
      return;
    }

    const client = clients.find((item) => item.id === clientId);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (Number(validDays) || 7) * 24 * 60 * 60 * 1000).toISOString();

    setSaving(true);
    setError("");

    const { data, error: dbError } = await supabase
      .from("quotes")
      .insert({
        client_id: clientId,
        client_name: client?.company_name || client?.contact_name || clientId,
        items: lines,
        subtotal,
        iva_total: ivaTotal,
        total,
        currency,
        status,
        version: 1,
        valid_days: Number(validDays) || 7,
        expires_at: expiresAt,
        notes: notes || null,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .select("id")
      .single();

    if (dbError) {
      setError(dbError.message);
      setSaving(false);
      return;
    }

    await supabase
      .from("profiles")
      .update({
        last_contact_at: now.toISOString(),
        last_contact_type: "cotizacion",
      })
      .eq("id", clientId);

    logActivity({
      user_id: clientId,
      action: "save_quote",
      entity_type: "quote",
      entity_id: String(data.id),
      metadata: { total, currency, created_by: "admin" },
    });

    await onCreated();
    onClose();
  }

  const inputCls = `w-full rounded-lg border px-3 py-2 text-sm outline-none transition ${dk("bg-[#0d0d0d] border-[#222] text-white focus:border-[#2D9F6A]/50", "bg-white border-[#e5e5e5] text-[#171717] focus:border-[#2D9F6A]/50")}`;
  const labelCls = `mb-1 text-[11px] font-semibold uppercase tracking-wide ${dk("text-gray-500", "text-[#a3a3a3]")}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border shadow-2xl ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={`flex items-center justify-between border-b px-6 py-4 ${dk("border-[#1f1f1f]", "border-[#e5e5e5]")}`}>
          <h2 className={`font-bold ${dk("text-white", "text-[#171717]")}`}>Crear cotización</h2>
          <button onClick={onClose} className="text-gray-500 transition hover:text-gray-300">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 p-6">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className={labelCls}>Cliente *</p>
              <select value={clientId} onChange={(event) => setClientId(event.target.value)} className={inputCls} disabled={lockClient}>
                <option value="">Seleccionar cliente…</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.company_name || client.contact_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className={labelCls}>Estado</p>
                <select value={status} onChange={(event) => setStatus(event.target.value as QuoteStatus)} className={inputCls}>
                  <option value="draft">Borrador</option>
                  <option value="sent">Enviada</option>
                </select>
              </div>
              <div>
                <p className={labelCls}>Validez</p>
                <input value={validDays} onChange={(event) => setValidDays(event.target.value.replace(/\D/g, ""))} className={inputCls} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_120px] gap-3">
            <div>
              <p className={labelCls}>Agregar productos</p>
              <div className="relative">
                <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  value={productSearch}
                  onChange={(event) => setProductSearch(event.target.value)}
                  placeholder="Buscar por nombre o SKU…"
                  className={`${inputCls} pl-8`}
                />
              </div>
              {productSearch ? (
                <div className={`mt-1 overflow-hidden rounded-xl border shadow-lg ${dk("bg-[#0d0d0d] border-[#222]", "bg-white border-[#e5e5e5]")}`}>
                  {filteredProducts.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-gray-500">Sin resultados</p>
                  ) : (
                    filteredProducts.map((product) => (
                      <button
                        key={product.id}
                        onClick={() => addProduct(product)}
                        className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs transition ${dk("text-gray-300 hover:bg-[#1a1a1a]", "text-[#525252] hover:bg-[#f5f5f5]")}`}
                      >
                        <span>{product.name}</span>
                        <span className="font-mono text-gray-500">${(product.cost_price ?? 0).toLocaleString()}</span>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>
            <div>
              <p className={labelCls}>Moneda</p>
              <select value={currency} onChange={(event) => setCurrency(event.target.value as "USD" | "ARS")} className={inputCls}>
                <option value="USD">USD</option>
                <option value="ARS">ARS</option>
              </select>
            </div>
          </div>

          {lines.length > 0 ? (
            <div className={`overflow-hidden rounded-xl border ${dk("border-[#1f1f1f]", "border-[#e5e5e5]")}`}>
              <table className="w-full text-xs">
                <thead className={`${dk("bg-[#0a0a0a] text-gray-500", "bg-[#f5f5f5] text-[#a3a3a3]")} uppercase tracking-wide`}>
                  <tr>
                    <th className="px-3 py-2 text-left">Producto</th>
                    <th className="px-3 py-2 text-center">Cant.</th>
                    <th className="px-3 py-2 text-right">Unit.</th>
                    <th className="px-3 py-2 text-right">Margen</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="w-6 px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.product_id} className={`border-t ${dk("border-[#1f1f1f]", "border-[#f0f0f0]")}`}>
                      <td className={`px-3 py-2 ${dk("text-gray-300", "text-[#525252]")}`}>
                        <div>{line.name}</div>
                        <div className="font-mono text-[10px] text-gray-600">costo: ${line.cost.toLocaleString()}</div>
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" min="1" value={line.quantity} onChange={(event) => updateLine(line.product_id, "quantity", Number(event.target.value))} className={`w-14 rounded border px-1 py-0.5 text-center text-xs outline-none ${dk("bg-[#181818] border-[#333] text-white", "bg-white border-[#e5e5e5] text-[#171717]")}`} />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" min="0" value={line.unitPrice} onChange={(event) => updateLine(line.product_id, "unitPrice", Number(event.target.value))} className={`w-20 rounded border px-1 py-0.5 text-right text-xs outline-none ${dk("bg-[#181818] border-[#333] text-white", "bg-white border-[#e5e5e5] text-[#171717]")}`} />
                      </td>
                      <td className={`px-3 py-2 text-right ${line.margin >= 0 ? "text-green-400" : "text-red-400"}`}>{line.margin.toFixed(0)}%</td>
                      <td className={`px-3 py-2 text-right font-semibold ${dk("text-white", "text-[#171717]")}`}>${line.totalWithIVA.toLocaleString("en-US", { maximumFractionDigits: 0 })}</td>
                      <td className="px-2 py-2">
                        <button onClick={() => removeLine(line.product_id)} className="text-gray-600 transition hover:text-red-400">
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr className={`border-t ${dk("border-[#2a2a2a]", "border-[#e5e5e5]")}`}>
                    <td colSpan={4} className="px-3 py-2 text-right text-xs font-bold text-gray-500">
                      TOTAL
                    </td>
                    <td className="px-3 py-2 text-right text-sm font-extrabold text-[#2D9F6A]">
                      ${total.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          ) : null}

          <div>
            <p className={labelCls}>Notas comerciales</p>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} placeholder="Contexto comercial, condiciones o alcance…" className={`${inputCls} resize-none`} />
          </div>

          {error ? <p className="text-xs text-red-400">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className={`rounded-lg border px-4 py-2 text-sm transition ${dk("border-[#2a2a2a] text-gray-400 hover:bg-[#1c1c1c] hover:text-white", "border-[#e5e5e5] text-[#737373] hover:bg-[#f5f5f5]")}`}>
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-[#2D9F6A] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#25835A] disabled:opacity-50">
              <Save size={13} /> {saving ? "Guardando…" : "Crear cotización"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
