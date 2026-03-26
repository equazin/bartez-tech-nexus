import { X } from "lucide-react";
import type { Product } from "@/models/products";
import { getAvailableStock } from "@/lib/pricing";

interface ProductCompareProps {
  products: Product[];
  onRemove: (productId: number) => void;
  onClear: () => void;
  formatPrice: (n: number) => string;
  currency: string;
}

const SPEC_LABELS: Record<string, string> = {
  cpu: "CPU",
  ram: "RAM",
  storage: "Almacenamiento",
  ports: "Puertos",
  poe: "PoE",
  throughput: "Throughput",
  vpn: "VPN",
  warranty: "Garantía",
};

function specKeys(products: Product[]): string[] {
  const keys = new Set<string>();
  for (const p of products) {
    if (p.specs) Object.keys(p.specs).forEach((k) => keys.add(k));
  }
  return Array.from(keys);
}

export default function ProductCompare({
  products,
  onRemove,
  onClear,
  formatPrice,
  currency,
}: ProductCompareProps) {
  if (products.length === 0) return null;

  const specs = specKeys(products);
  const colWidth = products.length === 1 ? "w-64" : products.length === 2 ? "w-56" : "w-48";

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 shadow-2xl border-t border-gray-200 bg-white animate-in slide-in-from-bottom duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
        <span className="text-sm font-semibold text-gray-700">
          Comparando {products.length} producto{products.length !== 1 ? "s" : ""}
          <span className="ml-2 text-xs text-gray-400 font-normal">(máx. 3)</span>
        </span>
        <button
          onClick={onClear}
          className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1"
        >
          <X size={14} /> Limpiar comparador
        </button>
      </div>

      {/* Scrollable table */}
      <div className="overflow-x-auto max-h-[55vh]">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10 bg-white">
            <tr>
              {/* Row label column */}
              <th className="w-36 min-w-[9rem] text-left px-3 py-2 text-xs uppercase tracking-wide text-gray-500 border-b border-r border-gray-200 bg-gray-50">
                Atributo
              </th>
              {products.map((p) => (
                <th
                  key={p.id}
                  className={`${colWidth} min-w-[11rem] px-3 py-2 border-b border-r border-gray-200 text-left bg-white`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div>
                      <div className="font-semibold text-gray-800 text-xs leading-tight line-clamp-2">
                        {p.name}
                      </div>
                      {p.sku && (
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">{p.sku}</div>
                      )}
                    </div>
                    <button
                      onClick={() => onRemove(p.id)}
                      className="shrink-0 text-gray-400 hover:text-red-500 mt-0.5"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {/* Image row */}
            <tr className="bg-gray-50/50">
              <td className="px-3 py-2 text-xs text-gray-500 border-b border-r border-gray-200 font-medium">
                Imagen
              </td>
              {products.map((p) => (
                <td key={p.id} className="px-3 py-2 border-b border-r border-gray-200">
                  <img
                    src={p.image}
                    alt={p.name}
                    className="h-14 w-auto object-contain rounded"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </td>
              ))}
            </tr>

            {/* Category */}
            <tr>
              <td className="px-3 py-2 text-xs text-gray-500 border-b border-r border-gray-200 font-medium">
                Categoría
              </td>
              {products.map((p) => (
                <td key={p.id} className="px-3 py-2 border-b border-r border-gray-200 text-xs text-gray-700">
                  {p.category}
                </td>
              ))}
            </tr>

            {/* Price */}
            <tr className="bg-gray-50/50">
              <td className="px-3 py-2 text-xs text-gray-500 border-b border-r border-gray-200 font-medium">
                Precio base ({currency})
              </td>
              {products.map((p) => (
                <td key={p.id} className="px-3 py-2 border-b border-r border-gray-200">
                  <span className="font-semibold text-blue-700 text-sm">
                    {formatPrice(p.cost_price)}
                  </span>
                </td>
              ))}
            </tr>

            {/* Price tiers */}
            {products.some((p) => p.price_tiers && p.price_tiers.length > 0) && (
              <tr>
                <td className="px-3 py-2 text-xs text-gray-500 border-b border-r border-gray-200 font-medium align-top">
                  Precios por volumen
                </td>
                {products.map((p) => (
                  <td key={p.id} className="px-3 py-2 border-b border-r border-gray-200 text-xs">
                    {p.price_tiers && p.price_tiers.length > 0 ? (
                      <div className="space-y-0.5">
                        {p.price_tiers.map((t, i) => (
                          <div key={i} className="flex items-center gap-1 text-gray-600">
                            <span className="text-gray-400 w-16 shrink-0">
                              {t.min}
                              {t.max ? `–${t.max}` : "+"}:
                            </span>
                            <span className="font-medium text-blue-600">
                              {formatPrice(t.price)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                ))}
              </tr>
            )}

            {/* Stock */}
            <tr className="bg-gray-50/50">
              <td className="px-3 py-2 text-xs text-gray-500 border-b border-r border-gray-200 font-medium">
                Stock disponible
              </td>
              {products.map((p) => {
                const avail = getAvailableStock(p);
                return (
                  <td key={p.id} className="px-3 py-2 border-b border-r border-gray-200 text-xs">
                    <span
                      className={
                        avail === 0
                          ? "text-red-600 font-semibold"
                          : avail <= 3
                          ? "text-amber-600 font-semibold"
                          : "text-green-600 font-semibold"
                      }
                    >
                      {avail === 0 ? "Sin stock" : `${avail} unid.`}
                    </span>
                  </td>
                );
              })}
            </tr>

            {/* Min order */}
            {products.some((p) => p.min_order_qty) && (
              <tr>
                <td className="px-3 py-2 text-xs text-gray-500 border-b border-r border-gray-200 font-medium">
                  Mínimo de compra
                </td>
                {products.map((p) => (
                  <td key={p.id} className="px-3 py-2 border-b border-r border-gray-200 text-xs text-gray-700">
                    {p.min_order_qty ? `${p.min_order_qty} unid.` : "—"}
                  </td>
                ))}
              </tr>
            )}

            {/* Dynamic specs */}
            {specs.map((key, i) => (
              <tr key={key} className={i % 2 === 0 ? "bg-gray-50/50" : ""}>
                <td className="px-3 py-2 text-xs text-gray-500 border-b border-r border-gray-200 font-medium">
                  {SPEC_LABELS[key] ?? key}
                </td>
                {products.map((p) => (
                  <td key={p.id} className="px-3 py-2 border-b border-r border-gray-200 text-xs text-gray-700">
                    {p.specs?.[key] ?? <span className="text-gray-300">—</span>}
                  </td>
                ))}
              </tr>
            ))}

            {/* Tags */}
            {products.some((p) => p.tags && p.tags.length > 0) && (
              <tr>
                <td className="px-3 py-2 text-xs text-gray-500 border-b border-r border-gray-200 font-medium">
                  Etiquetas
                </td>
                {products.map((p) => (
                  <td key={p.id} className="px-3 py-2 border-b border-r border-gray-200 text-xs">
                    {p.tags && p.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {p.tags.map((t) => (
                          <span
                            key={t}
                            className="bg-blue-100 text-blue-700 rounded px-1.5 py-0.5 text-[10px]"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                ))}
              </tr>
            )}

            {/* IVA */}
            <tr>
              <td className="px-3 py-2 text-xs text-gray-500 border-b border-r border-gray-200 font-medium">
                IVA
              </td>
              {products.map((p) => (
                <td key={p.id} className="px-3 py-2 border-b border-r border-gray-200 text-xs text-gray-700">
                  {p.iva_rate != null ? `${p.iva_rate}%` : "21%"}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
