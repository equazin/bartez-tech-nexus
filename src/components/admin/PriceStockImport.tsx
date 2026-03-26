import { useState, useRef } from "react";
import { Upload, Download, CheckCircle2, AlertTriangle, X } from "lucide-react";
import Papa from "papaparse";
import { supabase } from "@/lib/supabase";
import { recordPriceChange } from "@/lib/api/priceHistory";
import type { Product } from "@/models/products";

interface ImportRow {
  sku: string;
  cost_price?: string;
  stock?: string;
}

interface ImportResult {
  sku: string;
  status: "ok" | "not_found" | "error";
  message: string;
}

interface Props {
  products: Product[];
  isDark?: boolean;
  onDone?: () => void;
  userId?: string;
}

export function PriceStockImport({ products, isDark = true, onDone, userId }: Props) {
  const [results, setResults] = useState<ImportResult[]>([]);
  const [running, setRunning] = useState(false);
  const [preview, setPreview] = useState<ImportRow[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const dk = (d: string, l: string) => isDark ? d : l;

  function downloadTemplate() {
    const csv = "sku,cost_price,stock\nSRV-X100,11500,\nNET-SW24,,20\nLAP-C15I7,2650,5\n";
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template_actualizacion.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResults([]);
    Papa.parse<ImportRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => setPreview(res.data),
    });
    e.target.value = "";
  }

  async function runImport() {
    if (!preview.length) return;
    setRunning(true);
    setResults([]);

    const skuMap: Record<string, Product> = {};
    for (const p of products) {
      if (p.sku) skuMap[p.sku.toUpperCase()] = p;
    }

    const out: ImportResult[] = [];

    for (const row of preview) {
      const sku = (row.sku ?? "").trim().toUpperCase();
      if (!sku) continue;

      const product = skuMap[sku];
      if (!product) {
        out.push({ sku, status: "not_found", message: "SKU no encontrado" });
        continue;
      }

      const updates: Record<string, unknown> = {};
      const newPrice = row.cost_price ? Number(row.cost_price) : undefined;
      const newStock = row.stock ? Number(row.stock) : undefined;

      if (newPrice != null && !isNaN(newPrice) && newPrice > 0) {
        updates.cost_price = newPrice;
      }
      if (newStock != null && !isNaN(newStock) && newStock >= 0) {
        updates.stock = newStock;
      }

      if (!Object.keys(updates).length) {
        out.push({ sku, status: "error", message: "Sin datos válidos en la fila" });
        continue;
      }

      const { error } = await supabase
        .from("products")
        .update(updates)
        .eq("id", product.id);

      if (error) {
        out.push({ sku, status: "error", message: error.message });
        continue;
      }

      // Record price history if price changed
      if (updates.cost_price != null && updates.cost_price !== product.cost_price) {
        await recordPriceChange({
          product_id: product.id,
          changed_by: userId,
          old_price: product.cost_price,
          new_price: updates.cost_price as number,
          change_reason: "Importación CSV",
        });
      }

      out.push({
        sku,
        status: "ok",
        message: [
          updates.cost_price != null ? `Precio: ${product.cost_price} → ${updates.cost_price}` : null,
          updates.stock != null ? `Stock: ${product.stock} → ${updates.stock}` : null,
        ].filter(Boolean).join(" | "),
      });
    }

    setResults(out);
    setPreview([]);
    setRunning(false);
    if (onDone) onDone();
  }

  const inputCls = `w-full border rounded-lg px-3 py-2 text-sm outline-none ${dk("bg-[#0d0d0d] border-[#222] text-white", "bg-white border-[#e5e5e5] text-[#171717]")}`;
  const bg = dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]");

  const ok    = results.filter((r) => r.status === "ok").length;
  const notFound = results.filter((r) => r.status === "not_found").length;
  const errors = results.filter((r) => r.status === "error").length;

  return (
    <div className={`${bg} border rounded-xl p-5 space-y-4`}>
      <div className="flex items-center justify-between">
        <h3 className={`font-bold text-sm ${dk("text-white", "text-[#171717]")}`}>
          Importar precios / stock por SKU
        </h3>
        <button onClick={downloadTemplate} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition ${dk("border-[#2a2a2a] text-gray-400 hover:text-white hover:bg-[#1c1c1c]", "border-[#e5e5e5] text-[#737373] hover:bg-[#f5f5f5]")}`}>
          <Download size={11} /> Plantilla CSV
        </button>
      </div>

      <p className={`text-[11px] ${dk("text-gray-500", "text-[#737373]")}`}>
        Columnas: <code className={`font-mono px-1 rounded ${dk("bg-[#1c1c1c]", "bg-[#f0f0f0]")}`}>sku</code>{" "}
        <code className={`font-mono px-1 rounded ${dk("bg-[#1c1c1c]", "bg-[#f0f0f0]")}`}>cost_price</code>{" "}
        <code className={`font-mono px-1 rounded ${dk("bg-[#1c1c1c]", "bg-[#f0f0f0]")}`}>stock</code> — las columnas vacías se ignoran.
      </p>

      {/* File input */}
      <div
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl py-6 text-center cursor-pointer transition ${dk("border-[#262626] hover:border-[#2D9F6A]/40 text-gray-600 hover:text-gray-400", "border-[#e5e5e5] hover:border-[#2D9F6A]/40 text-[#a3a3a3] hover:text-[#737373]")}`}
      >
        <Upload size={20} className="mx-auto mb-1 opacity-50" />
        <p className="text-xs font-medium">Hacé click para seleccionar un CSV</p>
      </div>
      <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />

      {/* Preview */}
      {preview.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className={`text-xs font-semibold ${dk("text-gray-400", "text-[#525252]")}`}>
              Vista previa — {preview.length} filas
            </p>
            <button onClick={() => setPreview([])} className="text-gray-500 hover:text-red-400 transition">
              <X size={13} />
            </button>
          </div>
          <div className={`rounded-lg border overflow-hidden ${dk("border-[#222]", "border-[#e5e5e5]")} max-h-40 overflow-y-auto`}>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className={`${dk("bg-[#0a0a0a] text-gray-500", "bg-[#f5f5f5] text-[#a3a3a3]")} text-[10px] uppercase`}>
                  <th className="px-3 py-1.5 text-left">SKU</th>
                  <th className="px-3 py-1.5 text-right">Precio</th>
                  <th className="px-3 py-1.5 text-right">Stock</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 20).map((r, i) => (
                  <tr key={i} className={`border-t ${dk("border-[#1a1a1a]", "border-[#f0f0f0]")}`}>
                    <td className={`px-3 py-1.5 font-mono ${dk("text-gray-300", "text-[#525252]")}`}>{r.sku}</td>
                    <td className={`px-3 py-1.5 text-right ${dk("text-gray-500", "text-[#a3a3a3]")}`}>{r.cost_price || "—"}</td>
                    <td className={`px-3 py-1.5 text-right ${dk("text-gray-500", "text-[#a3a3a3]")}`}>{r.stock || "—"}</td>
                  </tr>
                ))}
                {preview.length > 20 && (
                  <tr className={`border-t ${dk("border-[#1a1a1a]", "border-[#f0f0f0]")}`}>
                    <td colSpan={3} className={`px-3 py-1.5 text-center text-[10px] ${dk("text-gray-600", "text-[#a3a3a3]")}`}>
                      +{preview.length - 20} filas más…
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <button
            onClick={runImport}
            disabled={running}
            className="mt-3 w-full bg-[#2D9F6A] hover:bg-[#25835A] text-white text-sm font-semibold py-2 rounded-lg transition disabled:opacity-50"
          >
            {running ? "Importando…" : `Aplicar ${preview.length} actualizaciones`}
          </button>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div>
          <div className="flex gap-3 mb-2 text-xs">
            <span className="text-green-400 font-bold">{ok} exitosos</span>
            {notFound > 0 && <span className="text-amber-400 font-bold">{notFound} no encontrados</span>}
            {errors > 0 && <span className="text-red-400 font-bold">{errors} errores</span>}
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {results.map((r, i) => (
              <div key={i} className={`flex items-start gap-2 text-[11px] px-2 py-1 rounded ${
                r.status === "ok"        ? dk("bg-green-500/10 text-green-400", "bg-green-50 text-green-700") :
                r.status === "not_found" ? dk("bg-amber-500/10 text-amber-400", "bg-amber-50 text-amber-700") :
                                           dk("bg-red-500/10 text-red-400",    "bg-red-50 text-red-700")
              }`}>
                {r.status === "ok" ? <CheckCircle2 size={11} className="shrink-0 mt-0.5" /> : <AlertTriangle size={11} className="shrink-0 mt-0.5" />}
                <span className="font-mono font-bold">{r.sku}</span>
                <span className="flex-1">{r.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
