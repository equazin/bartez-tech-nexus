import { useRef, useState } from "react";
import Papa from "papaparse";
import { Product } from "@/models/products";
import { mergeProducts } from "@/store/productStore";
import { Button } from "@/components/ui/button";

interface ImportResult {
  imported: number;
  errors: string[];
}

export default function ProductImport({
  onImport,
}: {
  onImport: (result: ImportResult) => void;
}) {
  const [preview, setPreview] = useState<Product[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function generateId(index: number) {
    return Date.now() + Math.floor(Math.random() * 10000) + index;
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    setErrors([]);
    setPreview([]);

    const file = files[0];

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data;
        const products: Product[] = [];
        const parseErrors: string[] = [];

        rows.forEach((row, i) => {
          const name = row.name?.trim();
          const cost_price = Number(row.cost_price);

          if (!name) {
            parseErrors.push(`Fila ${i + 2}: falta nombre`);
            return;
          }

          if (isNaN(cost_price)) {
            parseErrors.push(`Fila ${i + 2}: precio inválido`);
            return;
          }

          products.push({
            id: generateId(i),
            name,
            description: row.description || "",
            image: row.image || "/placeholder.png",
            cost_price,
            category: row.category || "General",
            stock: Number(row.stock) || 0,
            supplier_id: 0,
            supplier_multiplier: 1,
            sku: row.sku || "",
          });
        });

        setPreview(products);
        setErrors(parseErrors);
      },
      error: (err) => setErrors([err.message]),
    });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    handleFiles(e.target.files);
  }

  function handleImport() {
    const result = mergeProducts(preview);
    onImport(result);
    setPreview([]);
  }

  return (
    <div className="my-6">
      <div
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${
          dragActive
            ? "border-[#FF6A00] bg-[#FF6A00]/10"
            : "border-border/40 bg-background/70"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragActive(false);
        }}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleChange}
        />

        <p className="mb-3 text-sm text-muted-foreground">
          Arrastrá un CSV o hacé click para seleccionar
        </p>

        <Button variant="outline">Importar CSV</Button>
      </div>

      {errors.length > 0 && (
        <div className="mt-3 text-sm text-red-500">
          <ul>
            {errors.map((err, i) => (
              <li key={i}>• {err}</li>
            ))}
          </ul>
        </div>
      )}

      {preview.length > 0 && (
        <div className="mt-6">
          <h4 className="font-semibold mb-2">
            Preview ({preview.length} productos)
          </h4>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Precio</th>
                  <th>Categoría</th>
                  <th>Stock</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>${p.cost_price}</td>
                    <td>{p.category}</td>
                    <td>{p.stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button className="mt-4 w-full" onClick={handleImport}>
            Importar {preview.length} productos
          </Button>
        </div>
      )}
    </div>
  );
}