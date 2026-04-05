import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, CheckCircle2, AlertTriangle, Download } from "lucide-react";
import type { Product } from "@/models/products";

interface BulkImportProps {
  products: Product[];
  onAddAll: (items: Array<{ product: Product; quantity: number }>) => void;
  isDark: boolean;
}

export function BulkImport({ products, onAddAll, isDark: _isDark }: BulkImportProps) {
  const [csvContent, setCsvContent] = useState("");
  const [results, setResults] = useState<Array<{ sku: string; qty: number; product?: Product; error?: string }>>([]);

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
    <div className="border border-border/70 bg-card rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-foreground">Carga Masiva de Pedido</h3>
          <p className="text-xs text-muted-foreground mt-1">Subí un archivo CSV con columnas SKU y CANTIDAD.</p>
        </div>
        <button
          onClick={() => {
            const blob = new Blob(["BAR-001,10\nBAR-002,5"], { type: "text/csv" });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "plantilla_pedido.csv";
            a.click();
          }}
          className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-primary hover:underline"
        >
          <Download size={12} /> Bajar Plantilla
        </button>
      </div>

      {!csvContent ? (
        <label className="relative block">
          <div className="border-2 border-dashed border-border/70 hover:border-primary/40 rounded-2xl py-12 flex flex-col items-center justify-center transition-colors cursor-pointer bg-secondary/30 hover:bg-secondary/50">
            <Upload size={32} className="mb-4 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground mb-1">Cargar CSV de Pedido</p>
            <p className="text-xs text-muted-foreground mb-4">Múltiples productos de un solo clic.</p>
            <Button variant="outline" className="text-xs pointer-events-none">Seleccionar archivo</Button>
          </div>
          <input type="file" accept=".csv" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleCsvUpload} />
        </label>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                <CheckCircle2 size={12} /> {totals.valid} Válidos
              </div>
              {totals.errors > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-destructive font-bold">
                  <AlertTriangle size={12} /> {totals.errors} con error
                </div>
              )}
            </div>
            <button
              onClick={() => { setCsvContent(""); setResults([]); }}
              className="text-xs text-muted-foreground hover:text-foreground transition"
            >
              Borrar todo
            </button>
          </div>

          <div className="max-h-60 overflow-y-auto rounded-xl border border-border/70 bg-secondary/30">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 text-[10px] uppercase font-bold tracking-wider bg-secondary text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 border-b border-border/70">SKU</th>
                  <th className="px-4 py-2 border-b border-border/70">Producto</th>
                  <th className="px-4 py-2 border-b border-border/70">Cant.</th>
                  <th className="px-4 py-2 border-b border-border/70">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {results.map((r, i) => (
                  <tr key={i} className="text-xs">
                    <td className="px-4 py-2 font-mono text-[10px] text-foreground">{r.sku}</td>
                    <td className="px-4 py-2 truncate max-w-[200px] text-foreground">
                      {r.product?.name || "---"}
                    </td>
                    <td className="px-4 py-2 font-bold text-foreground">{r.qty}</td>
                    <td className="px-4 py-2">
                      {r.error ? (
                        <span className="text-destructive text-[10px]">{r.error}</span>
                      ) : (
                        <CheckCircle2 size={12} className="text-primary" />
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
            className="w-full font-bold"
          >
            Cargar {totals.valid} productos al carrito
          </Button>
        </div>
      )}
    </div>
  );
}
