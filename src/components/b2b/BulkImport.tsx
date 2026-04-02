import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, CheckCircle2, AlertTriangle, Package, TableIcon, Download } from "lucide-react";
import type { Product } from "@/models/products";
import { usePricing } from "@/hooks/usePricing";

interface BulkImportProps {
  products: Product[];
  onAddAll: (items: Array<{ product: Product; quantity: number }>) => void;
  isDark: boolean;
}

export function BulkImport({ products, onAddAll, isDark }: BulkImportProps) {
  const [csvContent, setCsvContent] = useState("");
  const [results, setResults] = useState<Array<{ sku: string; qty: number; product?: Product; error?: string }>>([]);
  const dk = (d: string, l: string) => (isDark ? d : l);

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);
      processCsv(text);
    };
    reader.readAsText(file);
  };

  const processCsv = (text: string) => {
    const lines = text.split("\n").filter(l => l.trim().length > 0);
    // Format expected: SKU,QTY
    const rows = lines.map(line => {
      const [sku, qty] = line.split(",").map(c => c.trim());
      const product = products.find(p => p.sku?.toUpperCase() === sku.toUpperCase());
      const quantity = parseInt(qty);

      if (!product) return { sku, qty: quantity, error: "SKU no encontrado" };
      if (isNaN(quantity) || quantity <= 0) return { sku, qty: 0, product, error: "Cantidad inválida" };
      
      return { sku, qty: quantity, product };
    });
    setResults(rows);
  };

  const totals = results.reduce((acc, r) => {
    if (!r.error) acc.valid += 1;
    else acc.errors += 1;
    return acc;
  }, { valid: 0, errors: 0 });

  return (
    <div className={`p-6 rounded-2xl border ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold">Carga Masiva de Pedido</h3>
          <p className="text-xs text-[#525252] mt-1">Sube un archivo CSV con columnas SKU y CANTIDAD.</p>
        </div>
        <button 
          onClick={() => {
            const blob = new Blob(["BAR-001,10\nBAR-002,5"], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = "plantilla_pedido.csv";
            a.click();
          }}
          className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-[#2D9F6A] hover:underline"
        >
          <Download size={12} /> Bajar Plantilla
        </button>
      </div>

      {!csvContent ? (
        <div className={`border-2 border-dashed rounded-2xl py-12 flex flex-col items-center justify-center transition-colors ${dk("border-[#1f1f1f] bg-[#0d0d0d] hover:border-[#2D9F6A]/40 hover:bg-[#111]", "border-[#e5e5e5] bg-[#fafafa] hover:border-[#2D9F6A]/40 hover:bg-[#f0faf5]")}`}>
          <Upload size={32} className="mb-4 text-[#525252]" />
          <p className="text-sm font-medium mb-1">Cargar CSV de Pedido</p>
          <p className="text-xs text-[#333] mb-4">Múltiples productos de un solo clic.</p>
          <input 
            type="file" 
            accept=".csv" 
            className="absolute inset-0 opacity-0 cursor-pointer" 
            onChange={handleCsvUpload} 
          />
          <Button variant="outline" className="text-xs">Sellecionar archivo</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold">
                <CheckCircle2 size={12} /> {totals.valid} Válidos
              </div>
              {totals.errors > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-red-400 font-bold">
                  <AlertTriangle size={12} /> {totals.errors} con error
                </div>
              )}
            </div>
            <button 
              onClick={() => { setCsvContent(""); setResults([]); }}
              className="text-xs text-[#525252] hover:text-white"
            >
              Borrar todo
            </button>
          </div>

          <div className={`max-h-60 overflow-y-auto rounded-xl border ${dk("border-[#1f1f1f] bg-[#0d0d0d]", "border-[#e5e5e5] bg-[#fafafa]")}`}>
            <table className="w-full text-left border-collapse">
              <thead className={`sticky top-0 text-[10px] uppercase font-bold tracking-wider ${dk("bg-[#1a1a1a] text-[#525252]", "bg-white text-[#a3a3a3]")}`}>
                <tr>
                  <th className="px-4 py-2 border-b border-inherit">SKU</th>
                  <th className="px-4 py-2 border-b border-inherit">Producto</th>
                  <th className="px-4 py-2 border-b border-inherit">Cant.</th>
                  <th className="px-4 py-2 border-b border-inherit">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-inherit border-inherit">
                {results.map((r, i) => (
                  <tr key={i} className="text-xs">
                    <td className="px-4 py-2 font-mono text-[10px]">{r.sku}</td>
                    <td className={`px-4 py-2 truncate max-w-[200px] ${dk("text-[#d4d4d4]", "text-[#171717]")}`}>
                      {r.product?.name || "---"}
                    </td>
                    <td className="px-4 py-2 font-bold">{r.qty}</td>
                    <td className="px-4 py-2">
                      {r.error ? (
                        <span className="text-red-400 text-[10px]">{r.error}</span>
                      ) : (
                        <CheckCircle2 size={12} className="text-[#2D9F6A]" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button 
            onClick={() => onAddAll(results.filter(r => !r.error && r.product).map(r => ({ product: r.product!, quantity: r.qty })))}
            disabled={totals.valid === 0}
            className="w-full bg-[#2D9F6A] hover:bg-[#25835A] font-bold"
          >
            Cargar {totals.valid} productos al carrito
          </Button>
        </div>
      )}
    </div>
  );
}
