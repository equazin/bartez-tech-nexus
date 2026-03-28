import { useRef, useState } from "react";
import Papa from "papaparse";
import { supabase } from "@/lib/supabase";
import { Upload, AlertCircle, CheckCircle2, Eye, Loader2, X } from "lucide-react";

interface ImportResult { imported: number; errors: string[]; }

// Columns accepted in the CSV
const COLUMNS = [
  "name *", "sku *", "cost_price *", "category", "stock", "stock_min",
  "description", "image", "supplier_id", "supplier_multiplier",
  "featured", "active", "tags", "external_id",
];

function parseBoolean(v: string | undefined, defaultVal = true): boolean {
  if (v === undefined || v === "") return defaultVal;
  return ["true", "1", "yes", "si", "sí"].includes(v.toLowerCase().trim());
}

function parseTags(v: string | undefined): string[] {
  if (!v?.trim()) return [];
  return v.split(/[,;|]/).map((t) => t.trim().toLowerCase()).filter(Boolean);
}

export default function ProductImport({ onImport, isDark = true }: { onImport: (result: ImportResult) => void; isDark?: boolean }) {
  const dk = (d: string, l: string) => isDark ? d : l;
  const [preview, setPreview]   = useState<any[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [dragActive, setDragActive]   = useState(false);
  const [importing, setImporting]     = useState(false);
  const [fileName, setFileName]       = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setParseErrors([]); setPreview([]); setFileName(files[0].name);

    Papa.parse<Record<string, string>>(files[0], {
      header: true,
      skipEmptyLines: true,
      complete: ({ data }) => {
        if (inputRef.current) inputRef.current.value = "";
        const products: any[] = [];
        const errors: string[] = [];

        data.forEach((row, i) => {
          const rowNum = i + 2; // header = row 1
          const name = row.name?.trim();
          const cost_price = Number(row.cost_price);

          if (!name)                              { errors.push(`Fila ${rowNum}: falta nombre`); return; }
          if (!row.sku?.trim())                   { errors.push(`Fila ${rowNum}: falta SKU`); return; }
          if (isNaN(cost_price) || cost_price <= 0) { errors.push(`Fila ${rowNum}: precio inválido`); return; }

          // Build payload with ONLY the fields that have values in the CSV.
          // Blank fields are omitted so Supabase upsert won't overwrite
          // existing data with empty/zero values.
          const product: Record<string, unknown> = {
            name,
            sku:       row.sku.trim().toUpperCase(),
            cost_price,
          };

          if (row.description?.trim())     product.description        = row.description.trim();
          if (row.image?.trim())           product.image              = row.image.trim();
          if (row.category?.trim())        product.category           = row.category.trim();
          if (row.stock?.trim())           product.stock              = Number(row.stock);
          if (row.stock_min?.trim())       product.stock_min          = Number(row.stock_min);
          if (row.supplier_id?.trim())     product.supplier_id        = Number(row.supplier_id);
          if (row.supplier_multiplier?.trim()) product.supplier_multiplier = Number(row.supplier_multiplier);
          if (row.featured?.trim())        product.featured           = parseBoolean(row.featured, false);
          if (row.active?.trim())          product.active             = parseBoolean(row.active, true);
          if (row.tags?.trim())            product.tags               = parseTags(row.tags);
          if (row.external_id?.trim())     product.external_id        = row.external_id.trim();

          products.push(product);
        });

        setPreview(products);
        setParseErrors(errors);
      },
      error: (err) => setParseErrors([err.message]),
    });
  }

  async function handleImport() {
    if (!preview.length) return;
    setImporting(true);

    const { data, error } = await supabase
      .from("products")
      .upsert(preview, { onConflict: "sku", ignoreDuplicates: false })
      .select();

    setImporting(false);

    if (error) {
      onImport({ imported: 0, errors: [error.message] });
      return;
    }

    onImport({ imported: data?.length ?? preview.length, errors: [] });
    setPreview([]);
    setFileName("");
  }

  function reset() { setPreview([]); setParseErrors([]); setFileName(""); }

  return (
    <div className="space-y-4">

      {/* Drop zone */}
      <div
        className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
          dragActive
            ? "border-[#2D9F6A] bg-[#2D9F6A]/5"
            : `${dk("border-[#2a2a2a] bg-[#141414]", "border-[#d4d4d4] bg-[#f9f9f9]")} hover:border-[#2D9F6A]/40`
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" accept=".csv" className="hidden"
          onChange={(e) => handleFiles(e.target.files)} />
        <Upload size={24} className="mx-auto mb-2 text-gray-600" />
        {fileName ? (
          <p className={`text-sm font-medium ${dk("text-white", "text-[#171717]")}`}>{fileName}</p>
        ) : (
          <p className="text-sm text-gray-500">Arrastrá un CSV o hacé click para seleccionar</p>
        )}
        <p className="text-[11px] text-gray-700 mt-1.5">Solo archivos .csv</p>
      </div>

      {/* Column reference */}
      <div className={`${dk("bg-[#141414] border-[#222]", "bg-[#f5f5f5] border-[#e5e5e5]")} border rounded-lg px-3 py-2.5`}>
        <p className="text-[11px] text-gray-600 font-semibold mb-1.5 uppercase tracking-wider">Columnas soportadas</p>
        <div className="flex flex-wrap gap-1">
          {COLUMNS.map((col) => (
            <span key={col}
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                col.includes("*")
                  ? "bg-[#2D9F6A]/10 text-[#2D9F6A] border border-[#2D9F6A]/20"
                  : "bg-[#1e1e1e] text-gray-500 border border-[#2a2a2a]"
              }`}>
              {col}
            </span>
          ))}
        </div>
        <p className="text-[10px] text-gray-700 mt-1.5">
          * obligatorio · tags separados por coma · featured/active: true/false
        </p>
      </div>

      {/* Parse errors */}
      {parseErrors.length > 0 && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2.5 space-y-1">
          <p className="text-xs font-semibold text-red-400 flex items-center gap-1.5">
            <AlertCircle size={12} /> {parseErrors.length} error{parseErrors.length > 1 ? "es" : ""} encontrado{parseErrors.length > 1 ? "s" : ""}
          </p>
          {parseErrors.map((err, i) => (
            <p key={i} className="text-xs text-red-400/80 pl-4">{err}</p>
          ))}
        </div>
      )}

      {/* Preview */}
      {preview.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
              <Eye size={12} /> Vista previa — {preview.length} producto{preview.length !== 1 ? "s" : ""}
            </p>
            <button onClick={reset} className="text-xs text-gray-600 hover:text-gray-300 transition flex items-center gap-1">
              <X size={11} /> Limpiar
            </button>
          </div>

          <div className={`overflow-x-auto rounded-xl border ${dk("border-[#252525] bg-[#141414]", "border-[#e5e5e5] bg-white")}`}>
            <table className="w-full text-xs">
              <thead>
                <tr className={`border-b ${dk("border-[#252525]", "border-[#e5e5e5]")}`}>
                  {["Nombre", "SKU", "Precio", "Categoría", "Stock", "St.Min", "Proveedor", "Mult.", "Tags", "Featured", "Activo"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-gray-500 font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((p, i) => (
                  <tr key={i} className={`border-t ${dk("border-[#1e1e1e] hover:bg-[#1a1a1a]", "border-[#f0f0f0] hover:bg-[#fafafa]")} transition-colors`}>
                    <td className={`px-3 py-2 font-medium max-w-[160px] truncate ${dk("text-white", "text-[#171717]")}`}>{p.name}</td>
                    <td className="px-3 py-2 font-mono text-gray-400">{p.sku}</td>
                    <td className="px-3 py-2 text-[#2D9F6A] font-semibold tabular-nums">${p.cost_price.toLocaleString("es-AR")}</td>
                    <td className="px-3 py-2 text-gray-400">{p.category}</td>
                    <td className="px-3 py-2 text-gray-400 tabular-nums">{p.stock}</td>
                    <td className="px-3 py-2 text-gray-600 tabular-nums">{p.stock_min || "—"}</td>
                    <td className="px-3 py-2 text-gray-600">{p.supplier_id || "—"}</td>
                    <td className="px-3 py-2 text-gray-600">{p.supplier_multiplier !== 1 ? p.supplier_multiplier : "—"}</td>
                    <td className="px-3 py-2 max-w-[120px]">
                      {p.tags?.length > 0 ? (
                        <div className="flex flex-wrap gap-0.5">
                          {p.tags.slice(0, 3).map((t: string) => (
                            <span key={t} className={`${dk("bg-[#252525]", "bg-[#f0f0f0]")} text-gray-500 px-1 py-0.5 rounded text-[10px]`}>{t}</span>
                          ))}
                          {p.tags.length > 3 && <span className="text-gray-700 text-[10px]">+{p.tags.length - 3}</span>}
                        </div>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {p.featured
                        ? <CheckCircle2 size={13} className="text-yellow-400" />
                        : <span className="text-gray-700">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      {p.active
                        ? <CheckCircle2 size={13} className="text-green-400" />
                        : <span className="text-gray-600 text-[10px]">inactivo</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={handleImport}
            disabled={importing}
            className="mt-3 w-full flex items-center justify-center gap-2 bg-[#2D9F6A] hover:bg-[#25835A] disabled:opacity-50 disabled:pointer-events-none text-white font-bold text-sm py-2.5 rounded-xl transition-all active:scale-[0.98]"
          >
            {importing
              ? <><Loader2 size={14} className="animate-spin" /> Importando...</>
              : `Importar ${preview.length} producto${preview.length !== 1 ? "s" : ""}`
            }
          </button>
        </div>
      )}
    </div>
  );
}
