import { useRef, useState } from "react";
import Papa from "papaparse";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

interface ImportResult { imported: number; errors: string[]; }

export default function ProductImport({ onImport }: { onImport: (result: ImportResult) => void }) {
  const [preview, setPreview] = useState<any[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [importing, setImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setErrors([]); setPreview([]);

    Papa.parse<Record<string, string>>(files[0], {
      header: true,
      skipEmptyLines: true,
      complete: ({ data }) => {
        const products: any[] = [];
        const parseErrors: string[] = [];

        data.forEach((row, i) => {
          const name = row.name?.trim();
          const cost_price = Number(row.cost_price);
          if (!name) { parseErrors.push(`Fila ${i + 2}: falta nombre`); return; }
          if (isNaN(cost_price) || cost_price <= 0) { parseErrors.push(`Fila ${i + 2}: precio inválido`); return; }

          products.push({
            name,
            description: row.description || "",
            image: row.image || "/placeholder.png",
            cost_price,
            category: row.category || "General",
            stock: Number(row.stock) || 0,
            sku: row.sku || null,
            active: true,
          });
        });

        setPreview(products);
        setErrors(parseErrors);
      },
      error: (err) => setErrors([err.message]),
    });
  }

  async function handleImport() {
    if (!preview.length) return;
    setImporting(true);

    const { data, error } = await supabase
      .from("products")
      .upsert(preview, { onConflict: "name", ignoreDuplicates: false })
      .select();

    setImporting(false);

    if (error) {
      onImport({ imported: 0, errors: [error.message] });
      return;
    }

    onImport({ imported: data?.length ?? preview.length, errors: [] });
    setPreview([]);
  }

  return (
    <div>
      <h3 className="font-semibold text-base mb-4">Importar CSV</h3>

      <div
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${
          dragActive ? "border-primary bg-primary/5" : "border-border/40 bg-background/70"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
        onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
        <p className="text-sm text-muted-foreground mb-3">
          Arrastrá un CSV o hacé click para seleccionar
        </p>
        <p className="text-xs text-muted-foreground/60">
          Columnas: <code className="bg-secondary px-1 rounded">name, cost_price, category, stock, sku, image, description</code>
        </p>
        <Button variant="outline" className="mt-3" type="button">Seleccionar archivo</Button>
      </div>

      {errors.length > 0 && (
        <ul className="mt-3 text-sm text-red-500 space-y-1">
          {errors.map((err, i) => <li key={i}>• {err}</li>)}
        </ul>
      )}

      {preview.length > 0 && (
        <div className="mt-5">
          <h4 className="font-semibold text-sm mb-2">Vista previa — {preview.length} productos</h4>
          <div className="overflow-x-auto rounded-lg border border-border/40">
            <table className="w-full text-xs">
              <thead className="bg-secondary/50">
                <tr>
                  {["Nombre", "Precio", "Categoría", "Stock", "SKU"].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((p, i) => (
                  <tr key={i} className="border-t border-border/20">
                    <td className="px-3 py-2">{p.name}</td>
                    <td className="px-3 py-2">${p.cost_price}</td>
                    <td className="px-3 py-2">{p.category}</td>
                    <td className="px-3 py-2">{p.stock}</td>
                    <td className="px-3 py-2 text-muted-foreground">{p.sku || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button className="mt-3 w-full" onClick={handleImport} disabled={importing}>
            {importing ? "Importando..." : `Importar ${preview.length} productos a Supabase`}
          </Button>
        </div>
      )}
    </div>
  );
}
