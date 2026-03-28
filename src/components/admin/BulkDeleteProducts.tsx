import { useState } from "react";
import { Upload, Trash2, AlertTriangle, CheckCircle2, X, Download, Loader2 } from "lucide-react";
import Papa from "papaparse";
import { supabase } from "@/lib/supabase";

interface Props { isDark?: boolean; onDone?: () => void }

interface PreviewRow { sku: string; id: number; name: string; found: boolean }

export function BulkDeleteProducts({ isDark = true, onDone }: Props) {
  const dk = (d: string, l: string) => (isDark ? d : l);

  function downloadTemplate() {
    const csv = ["sku", "LAP-C15I7", "NET-SW24", "UPS-1500"].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "template_eliminar_productos.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const [preview,   setPreview]   = useState<PreviewRow[]>([]);
  const [running,   setRunning]   = useState(false);
  const [results,   setResults]   = useState<{ sku: string; ok: boolean; message: string }[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [parseError, setParseError] = useState("");

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResults([]);
    setConfirmed(false);
    setPreview([]);
    setParseError("");

    Papa.parse<{ sku: string }>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        // Reset input here, inside complete, so File is fully read first
        e.target.value = "";
        const skus = res.data
          .map((r) => (r.sku ?? "").trim().toUpperCase())
          .filter(Boolean);
        if (!skus.length) {
          setParseError("No se encontraron SKUs. Verificá que la columna se llame exactamente \"sku\".");
          return;
        }
        // Async lookup extracted from PapaParse callback
        lookupSkus(skus);
      },
      error: (err) => {
        e.target.value = "";
        setParseError(err.message);
      },
    });
  }

  async function lookupSkus(skus: string[]) {
    setRunning(true);
    try {
      const { data: products, error } = await supabase
        .from("products")
        .select("id, sku, name")
        .in("sku", skus);

      if (error) { setParseError(error.message); return; }

      const productMap: Record<string, { id: number; name: string }> = {};
      (products ?? []).forEach((p: any) => {
        if (p.sku) productMap[p.sku.toUpperCase()] = { id: p.id, name: p.name };
      });

      setPreview(skus.map((sku) => ({
        sku,
        id:    productMap[sku]?.id ?? 0,
        name:  productMap[sku]?.name ?? "—",
        found: !!productMap[sku],
      })));
    } catch (err: unknown) {
      setParseError(err instanceof Error ? err.message : "Error al buscar productos");
    } finally {
      setRunning(false);
    }
  }

  async function runDelete() {
    const toDelete = preview.filter((r) => r.found);
    if (!toDelete.length) return;
    setRunning(true);

    const out: typeof results = [];
    for (const row of toDelete) {
      const { error } = await supabase.from("products").delete().eq("id", row.id);
      out.push({
        sku:     row.sku,
        ok:      !error,
        message: error ? error.message : `${row.name} eliminado`,
      });
    }

    setResults(out);
    setPreview([]);
    setConfirmed(false);
    setRunning(false);
    onDone?.();
  }

  const toDelete  = preview.filter((r) => r.found).length;
  const notFound  = preview.filter((r) => !r.found).length;
  const okCount   = results.filter((r) => r.ok).length;
  const errCount  = results.filter((r) => !r.ok).length;

  return (
    <div className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-xl p-5 space-y-4`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className={`font-bold text-sm ${dk("text-white", "text-[#171717]")}`}>Eliminar productos por CSV</h3>
          <p className="text-xs text-gray-500 mt-0.5">CSV con columna <code className="font-mono">sku</code> — se muestran los productos a borrar antes de confirmar.</p>
        </div>
        <button
          onClick={downloadTemplate}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition shrink-0 ${dk("border-[#2a2a2a] text-gray-400 hover:text-white hover:bg-[#1c1c1c]", "border-[#e5e5e5] text-[#737373] hover:bg-[#f5f5f5]")}`}
        >
          <Download size={11} /> Plantilla CSV
        </button>
      </div>

      {/* Upload zone */}
      {parseError && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <AlertTriangle size={12} className="shrink-0" /> {parseError}
        </div>
      )}

      {preview.length === 0 && results.length === 0 && (
        <label
          className={`w-full border-2 border-dashed rounded-xl py-8 text-sm flex flex-col items-center gap-2 transition cursor-pointer ${
            running
              ? "border-[#2D9F6A]/40 text-[#2D9F6A]"
              : dk("border-[#2a2a2a] text-gray-500 hover:border-[#3a3a3a] hover:text-gray-300", "border-[#e5e5e5] text-[#737373] hover:border-[#d4d4d4] hover:text-[#525252]")
          }`}
        >
          <input type="file" accept=".csv" onChange={handleFile} className="hidden" />
          {running ? <Loader2 size={22} className="animate-spin" /> : <Upload size={22} />}
          <span>{running ? "Buscando productos…" : "Seleccionar CSV de SKUs"}</span>
        </label>
      )}

      {/* Preview */}
      {preview.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs">
              <span className="text-red-400 font-semibold flex items-center gap-1"><Trash2 size={11} /> {toDelete} a eliminar</span>
              {notFound > 0 && <span className="text-amber-400 flex items-center gap-1"><AlertTriangle size={11} /> {notFound} no encontrados</span>}
            </div>
            <button onClick={() => setPreview([])} className="text-gray-500 hover:text-red-400 transition"><X size={14} /></button>
          </div>

          {/* Preview table */}
          <div className={`rounded-lg border overflow-hidden text-xs ${dk("border-[#1f1f1f]", "border-[#e5e5e5]")}`}>
            <div className={`grid grid-cols-[80px_1fr_80px] gap-2 px-3 py-1.5 font-bold uppercase tracking-wider text-[10px] ${dk("bg-[#0a0a0a] text-[#525252]", "bg-[#f5f5f5] text-[#a3a3a3]")}`}>
              <span>SKU</span><span>Nombre</span><span>Estado</span>
            </div>
            {preview.slice(0, 10).map((r, i) => (
              <div key={i} className={`grid grid-cols-[80px_1fr_80px] gap-2 px-3 py-1.5 border-t ${dk("border-[#1a1a1a] odd:bg-[#0d0d0d] even:bg-[#111]", "border-[#f0f0f0] odd:bg-[#fafafa] even:bg-white")}`}>
                <span className="font-mono">{r.sku}</span>
                <span className="truncate">{r.name}</span>
                <span className={r.found ? "text-red-400" : "text-amber-400"}>{r.found ? "Borrar" : "No encontrado"}</span>
              </div>
            ))}
            {preview.length > 10 && (
              <div className={`px-3 py-1.5 text-[10px] text-gray-500 border-t ${dk("border-[#1a1a1a]", "border-[#f0f0f0]")}`}>
                +{preview.length - 10} filas más…
              </div>
            )}
          </div>

          {/* Confirm checkbox + delete button */}
          {toDelete > 0 && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-red-400">
                <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="accent-red-500" />
                Confirmo que quiero eliminar {toDelete} producto{toDelete !== 1 ? "s" : ""} de forma permanente.
              </label>
              <button
                onClick={runDelete}
                disabled={!confirmed || running}
                className="flex items-center gap-1.5 text-xs bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white px-4 py-2 rounded-lg transition"
              >
                <Trash2 size={12} /> {running ? "Eliminando…" : `Eliminar ${toDelete} productos`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-emerald-400"><CheckCircle2 size={12} /> {okCount} eliminados</span>
            {errCount > 0 && <span className="flex items-center gap-1 text-red-400"><AlertTriangle size={12} /> {errCount} errores</span>}
            <button onClick={() => setResults([])} className="ml-auto text-gray-500 hover:text-white transition"><X size={12} /></button>
          </div>
          <div className={`rounded-lg border overflow-hidden text-xs max-h-48 overflow-y-auto ${dk("border-[#1f1f1f]", "border-[#e5e5e5]")}`}>
            {results.map((r, i) => (
              <div key={i} className={`grid grid-cols-[70px_1fr] gap-2 px-3 py-1.5 border-b last:border-b-0 ${dk("border-[#1a1a1a] odd:bg-[#0d0d0d] even:bg-[#111]", "border-[#f0f0f0] odd:bg-[#fafafa] even:bg-white")}`}>
                <span className="font-mono text-[10px] text-gray-500">{r.sku}</span>
                <span className={`text-[10px] ${r.ok ? "text-emerald-400" : "text-red-400"}`}>{r.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
