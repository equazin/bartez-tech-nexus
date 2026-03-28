import { useState, useRef, useEffect } from "react";
import { Upload, Download, CheckCircle2, AlertTriangle, X } from "lucide-react";
import Papa from "papaparse";
import { supabase } from "@/lib/supabase";

interface Props { isDark?: boolean }

interface CsvRow {
  sku: string;
  supplier_name?: string;
  cost_price?: string;
  stock_available?: string;
  price_multiplier?: string;
  lead_time_days?: string;
  external_id?: string;
}

interface ImportResult {
  sku: string;
  supplier: string;
  status: "ok" | "not_found" | "no_supplier" | "error";
  message: string;
}

interface SupplierOption { id: string; name: string }

export function SupplierPriceImport({ isDark = true }: Props) {
  const dk = (d: string, l: string) => (isDark ? d : l);
  const fileRef = useRef<HTMLInputElement>(null);

  const [suppliers, setSuppliers]   = useState<SupplierOption[]>([]);
  const [preview, setPreview]       = useState<CsvRow[]>([]);
  const [results, setResults]       = useState<ImportResult[]>([]);
  const [running, setRunning]       = useState(false);
  const [defaultSupplier, setDefaultSupplier] = useState("");

  useEffect(() => {
    supabase.from("suppliers").select("id, name").eq("active", true).order("name")
      .then(({ data }) => setSuppliers((data ?? []) as SupplierOption[]));
  }, []);

  function downloadTemplate() {
    const csv = [
      "sku,supplier_name,cost_price,stock_available,price_multiplier,lead_time_days,external_id",
      "LAP-C15I7,TechDistrib,850000,10,1.0,3,TD-LAP001",
      "NET-SW24,InfoSupply,45000,20,,7,",
      "UPS-1500,TechDistrib,120000,,1.0,,SMC1500",
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = "template_proveedores.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResults([]);
    Papa.parse<CsvRow>(file, {
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

    // Build SKU → product_id map
    const { data: productRows } = await supabase
      .from("products")
      .select("id, sku")
      .limit(2000);
    const skuMap: Record<string, number> = {};
    (productRows ?? []).forEach((p: any) => { if (p.sku) skuMap[p.sku.toUpperCase()] = p.id; });

    // Build supplier name → id map
    const supplierMap: Record<string, string> = {};
    suppliers.forEach((s) => { supplierMap[s.name.toLowerCase()] = s.id; });

    const out: ImportResult[] = [];

    for (const row of preview) {
      const sku          = (row.sku ?? "").trim().toUpperCase();
      const supplierName = (row.supplier_name ?? "").trim();
      const resolvedSupplierId =
        supplierName
          ? (supplierMap[supplierName.toLowerCase()] ?? null)
          : (defaultSupplier || null);
      const supplierLabel = supplierName || suppliers.find((s) => s.id === defaultSupplier)?.name || "—";

      if (!sku) continue;

      const productId = skuMap[sku];
      if (!productId) {
        out.push({ sku, supplier: supplierLabel, status: "not_found", message: "SKU no encontrado" });
        continue;
      }
      if (!resolvedSupplierId) {
        out.push({ sku, supplier: supplierLabel, status: "no_supplier", message: "Proveedor no encontrado" });
        continue;
      }

      const costPrice    = row.cost_price       ? Number(row.cost_price)       : undefined;
      const stockAvail   = row.stock_available  ? Number(row.stock_available)  : undefined;
      const multiplier   = row.price_multiplier ? Number(row.price_multiplier) : undefined;
      const leadTime     = row.lead_time_days   ? Number(row.lead_time_days)   : undefined;
      const externalId   = row.external_id?.trim() || undefined;

      const updates: Record<string, unknown> = {};
      if (costPrice  != null && !isNaN(costPrice)  && costPrice  >= 0) updates.cost_price       = costPrice;
      if (stockAvail != null && !isNaN(stockAvail) && stockAvail >= 0) updates.stock_available  = stockAvail;
      if (multiplier != null && !isNaN(multiplier) && multiplier >  0) updates.price_multiplier = multiplier;
      if (leadTime   != null && !isNaN(leadTime)   && leadTime   >= 0) updates.lead_time_days   = leadTime;
      if (externalId)                                                    updates.external_id      = externalId;

      // Upsert product_suppliers row
      const { error } = await supabase
        .from("product_suppliers")
        .upsert(
          {
            product_id:  productId,
            supplier_id: resolvedSupplierId,
            cost_price:  updates.cost_price   ?? 0,
            stock_available: updates.stock_available ?? 0,
            price_multiplier: updates.price_multiplier ?? 1.0,
            lead_time_days:   updates.lead_time_days  ?? 0,
            ...(externalId ? { external_id: externalId } : {}),
          },
          { onConflict: "product_id,supplier_id" }
        );

      if (error) {
        out.push({ sku, supplier: supplierLabel, status: "error", message: error.message });
        continue;
      }

      const changes = [
        updates.cost_price       != null ? `Costo: ${updates.cost_price}`           : null,
        updates.stock_available  != null ? `Stock: ${updates.stock_available}`       : null,
        updates.price_multiplier != null ? `Mult: ×${updates.price_multiplier}`     : null,
        updates.lead_time_days   != null ? `Plazo: ${updates.lead_time_days}d`      : null,
        externalId                       ? `ExtID: ${externalId}`                   : null,
      ].filter(Boolean).join(" · ");

      out.push({ sku, supplier: supplierLabel, status: "ok", message: changes || "Sin cambios válidos" });
    }

    setResults(out);
    setPreview([]);
    setRunning(false);
  }

  const ok       = results.filter((r) => r.status === "ok").length;
  const errors   = results.filter((r) => r.status !== "ok").length;
  const bg       = dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]");

  return (
    <div className={`${bg} border rounded-xl p-5 space-y-4`}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className={`font-bold text-sm ${dk("text-white", "text-[#171717]")}`}>
            Importar precios de proveedor (product_suppliers)
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            CSV: sku, supplier_name, cost_price, stock_available, price_multiplier, lead_time_days, external_id
          </p>
        </div>
        <button
          onClick={downloadTemplate}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition ${dk("border-[#2a2a2a] text-gray-400 hover:text-white hover:bg-[#1c1c1c]", "border-[#e5e5e5] text-[#737373] hover:bg-[#f5f5f5]")}`}
        >
          <Download size={11} /> Plantilla CSV
        </button>
      </div>

      {/* Default supplier fallback */}
      <div>
        <label className={`text-xs mb-1 block ${dk("text-gray-400", "text-[#737373]")}`}>
          Proveedor por defecto <span className="text-gray-600">(si la fila no tiene supplier_name)</span>
        </label>
        <select
          value={defaultSupplier}
          onChange={(e) => setDefaultSupplier(e.target.value)}
          className={`border rounded-lg px-3 py-1.5 text-xs outline-none w-full max-w-xs ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717]")}`}
        >
          <option value="">— ninguno —</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* Upload zone */}
      <div>
        <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
        {preview.length === 0 ? (
          <button
            onClick={() => fileRef.current?.click()}
            className={`w-full border-2 border-dashed rounded-xl py-8 text-sm flex flex-col items-center gap-2 transition ${dk("border-[#2a2a2a] text-gray-500 hover:border-[#3a3a3a] hover:text-gray-300", "border-[#e5e5e5] text-[#737373] hover:border-[#d4d4d4] hover:text-[#525252]")}`}
          >
            <Upload size={22} />
            <span>Seleccionar CSV</span>
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className={`text-xs ${dk("text-gray-400", "text-[#737373]")}`}>{preview.length} filas cargadas</p>
              <button onClick={() => setPreview([])} className="text-gray-500 hover:text-red-400 transition">
                <X size={14} />
              </button>
            </div>
            {/* Preview table */}
            <div className={`rounded-lg border overflow-hidden text-xs ${dk("border-[#1f1f1f]", "border-[#e5e5e5]")}`}>
              <div className={`grid grid-cols-[80px_1fr_90px_80px] gap-2 px-3 py-1.5 font-bold uppercase tracking-wider text-[10px] ${dk("bg-[#0a0a0a] text-[#525252]", "bg-[#f5f5f5] text-[#a3a3a3]")}`}>
                <span>SKU</span><span>Proveedor</span><span>Costo</span><span>Stock</span>
              </div>
              {preview.slice(0, 8).map((r, i) => (
                <div key={i} className={`grid grid-cols-[80px_1fr_90px_80px] gap-2 px-3 py-1.5 border-t ${dk("border-[#1a1a1a] odd:bg-[#0d0d0d] even:bg-[#111]", "border-[#f0f0f0] odd:bg-[#fafafa] even:bg-white")}`}>
                  <span className="font-mono">{r.sku}</span>
                  <span className="truncate">{r.supplier_name || "—"}</span>
                  <span className="text-right">{r.cost_price || "—"}</span>
                  <span className="text-right">{r.stock_available || "—"}</span>
                </div>
              ))}
              {preview.length > 8 && (
                <div className={`px-3 py-1.5 text-[10px] text-gray-500 border-t ${dk("border-[#1a1a1a]", "border-[#f0f0f0]")}`}>
                  +{preview.length - 8} filas más…
                </div>
              )}
            </div>
            <button
              onClick={runImport}
              disabled={running}
              className="flex items-center gap-1.5 text-xs bg-[#2D9F6A] hover:bg-[#25875a] disabled:opacity-50 text-white px-4 py-2 rounded-lg transition"
            >
              <Upload size={12} /> {running ? "Importando…" : `Importar ${preview.length} filas`}
            </button>
          </div>
        )}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-emerald-400"><CheckCircle2 size={12} /> {ok} ok</span>
            {errors > 0 && <span className="flex items-center gap-1 text-red-400"><AlertTriangle size={12} /> {errors} errores</span>}
          </div>
          <div className={`rounded-lg border overflow-hidden text-xs max-h-60 overflow-y-auto ${dk("border-[#1f1f1f]", "border-[#e5e5e5]")}`}>
            {results.map((r, i) => (
              <div key={i} className={`grid grid-cols-[70px_100px_1fr] gap-2 px-3 py-1.5 border-b last:border-b-0 items-start ${dk("border-[#1a1a1a] odd:bg-[#0d0d0d] even:bg-[#111]", "border-[#f0f0f0] odd:bg-[#fafafa] even:bg-white")}`}>
                <span className="font-mono text-[10px] text-gray-500">{r.sku}</span>
                <span className={`text-[10px] ${r.status === "ok" ? "text-emerald-400" : "text-red-400"}`}>
                  {r.status === "ok" ? "OK" : r.status === "not_found" ? "SKU no encontrado" : r.status === "no_supplier" ? "Sin proveedor" : "Error"}
                </span>
                <span className={`text-[10px] break-all ${dk("text-gray-400", "text-[#737373]")}`}>{r.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
