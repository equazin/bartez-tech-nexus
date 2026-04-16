import { ShoppingCart, X } from "lucide-react";
import type { Product } from "@/models/products";
import { getAvailableStock } from "@/lib/pricing";

interface ProductCompareProps {
  products: Product[];
  onRemove: (productId: number) => void;
  onClear: () => void;
  formatPrice: (n: number) => string;
  currency: string;
  onAddAllToCart?: (products: Product[]) => void;
}

const SPEC_LABELS: Record<string, string> = {
  cpu: "Procesador",
  gpu: "Gráficos",
  ram: "Memoria RAM",
  storage: "Almacenamiento",
  screen: "Pantalla",
  resolution: "Resolución",
  refresh_rate: "Frecuencia",
  ports: "Puertos",
  connectivity: "Conectividad",
  chipset: "Chipset",
  socket: "Socket",
  form_factor: "Formato",
  warranty: "Garantía",
};

const SPEC_PRIORITY = [
  "cpu",
  "gpu",
  "ram",
  "storage",
  "screen",
  "resolution",
  "refresh_rate",
  "ports",
  "connectivity",
  "chipset",
  "socket",
  "form_factor",
  "warranty",
];

const HIDDEN_SPEC_PREFIXES = [
  "elit_",
  "air_",
  "invid_",
  "supplier_",
  "preferred_supplier_",
  "sync_",
  "internal_",
  "provider_",
];

const HIDDEN_SPEC_TOKENS = [
  "cost",
  "precio_costo",
  "precio_compra",
  "markup",
  "pvp",
  "exchange",
  "cotizacion",
  "external_id",
  "uuid",
  "token",
  "source",
  "last_update",
  "stock_cd",
  "stock_total",
  "stock_deposito",
  "lug_stock",
  "iva",
  "link",
];

function normalizeSpecKey(rawKey: string): string {
  return rawKey.trim().toLowerCase();
}

function isClientVisibleSpecKey(rawKey: string): boolean {
  const key = normalizeSpecKey(rawKey);
  if (!key) return false;
  if (HIDDEN_SPEC_PREFIXES.some((prefix) => key.startsWith(prefix))) return false;
  if (HIDDEN_SPEC_TOKENS.some((token) => key.includes(token))) return false;
  return true;
}

function formatSpecLabel(rawKey: string): string {
  const normalized = normalizeSpecKey(rawKey);
  if (SPEC_LABELS[normalized]) return SPEC_LABELS[normalized];
  const withSpaces = rawKey
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

function formatSpecValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) {
    const joined = value.map((item) => String(item ?? "").trim()).filter(Boolean).join(", ");
    return joined || "—";
  }
  if (typeof value === "object") return JSON.stringify(value);
  const text = String(value).trim();
  return text || "—";
}

function collectSpecKeys(products: Product[]): string[] {
  const keys = new Set<string>();
  for (const product of products) {
    if (!product.specs) continue;
    Object.keys(product.specs).forEach((key) => {
      if (isClientVisibleSpecKey(key)) keys.add(key);
    });
  }

  const priorityIndex = new Map(SPEC_PRIORITY.map((key, index) => [key, index]));
  return Array.from(keys).sort((a, b) => {
    const aNorm = normalizeSpecKey(a);
    const bNorm = normalizeSpecKey(b);
    const aPriority = priorityIndex.has(aNorm) ? (priorityIndex.get(aNorm) as number) : Number.POSITIVE_INFINITY;
    const bPriority = priorityIndex.has(bNorm) ? (priorityIndex.get(bNorm) as number) : Number.POSITIVE_INFINITY;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return formatSpecLabel(a).localeCompare(formatSpecLabel(b), "es");
  });
}

function allSame(values: string[]): boolean {
  const normalized = values.map((value) => value.trim().toLowerCase());
  if (normalized.length <= 1) return true;
  return normalized.every((value) => value === normalized[0]);
}

function withFallbackImage(event: React.SyntheticEvent<HTMLImageElement, Event>) {
  const target = event.currentTarget;
  target.style.display = "none";
}

export default function ProductCompare({
  products,
  onRemove,
  onClear,
  formatPrice,
  currency,
  onAddAllToCart,
}: ProductCompareProps) {
  if (products.length === 0) return null;

  const specKeys = collectSpecKeys(products);
  const descriptions = products.map((product) => (product.description || "").trim() || "Sin descripción técnica");
  const descriptionsAreEqual = allSame(descriptions);
  const minQty = products.map((product) => (product.min_order_qty ? `${product.min_order_qty} u.` : "—"));
  const minQtyAreEqual = allSame(minQty);

  const priceTiersByProduct = products.map((product) =>
    product.price_tiers && product.price_tiers.length > 0
      ? product.price_tiers.map((tier) => `${tier.min}${tier.max ? `–${tier.max}` : "+"}: ${formatPrice(tier.price)}`).join(" | ")
      : "—"
  );
  const tiersAreEqual = allSame(priceTiersByProduct);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#d4d4d4] bg-white/95 backdrop-blur shadow-[0_-10px_40px_rgba(0,0,0,0.12)] animate-in slide-in-from-bottom duration-300">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-[#e5e5e5] bg-[#f8f8f8]">
        <span className="text-sm font-semibold text-[#171717]">
          Comparador técnico ({products.length}/3)
          <span className="ml-2 text-xs text-[#737373] font-normal">solo datos útiles para decidir</span>
        </span>
        <div className="flex items-center gap-3">
          {onAddAllToCart && (() => {
            const availableProducts = products.filter((p) => getAvailableStock(p) > 0);
            if (availableProducts.length === 0) return null;
            return (
              <button
                onClick={() => onAddAllToCart(availableProducts)}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 transition hover:bg-blue-100"
              >
                <ShoppingCart size={13} />
                Agregar {availableProducts.length === 1 ? "al" : "todos al"} carrito
              </button>
            );
          })()}
          <button
            onClick={onClear}
            className="text-xs text-red-500 hover:text-red-600 font-semibold flex items-center gap-1"
          >
            <X size={14} /> Limpiar comparador
          </button>
        </div>
      </div>

      <div className="overflow-x-auto max-h-[58vh]">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10 bg-white">
            <tr>
              <th className="w-44 min-w-[11rem] text-left px-3 py-2 text-xs uppercase tracking-wide text-[#737373] border-b border-r border-[#e5e5e5] bg-[#f8f8f8]">
                Atributo
              </th>
              {products.map((product) => (
                <th
                  key={product.id}
                  className="min-w-[18rem] px-3 py-2 border-b border-r border-[#e5e5e5] text-left bg-white"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <img
                        src={product.image}
                        alt={product.name}
                        onError={withFallbackImage}
                        className="h-10 w-10 rounded-md object-contain border border-[#e5e5e5] bg-[#f9f9f9] shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="font-semibold text-[#171717] text-xs leading-tight line-clamp-2">{product.name}</p>
                        {product.sku && (
                          <p className="text-[10px] text-[#737373] font-mono mt-0.5">{product.sku}</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => onRemove(product.id)}
                      className="shrink-0 text-[#a3a3a3] hover:text-red-500"
                      title="Quitar del comparador"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            <tr className="bg-[#f9fafb]">
              <td className="px-3 py-2 text-xs text-[#525252] border-b border-r border-[#e5e5e5] font-medium">
                Categoría
              </td>
              {products.map((product) => (
                <td key={product.id} className="px-3 py-2 border-b border-r border-[#e5e5e5] text-xs text-[#171717]">
                  {product.category}
                </td>
              ))}
            </tr>

            <tr>
              <td className="px-3 py-2 text-xs text-[#525252] border-b border-r border-[#e5e5e5] font-medium">
                Precio base ({currency})
              </td>
              {products.map((product) => (
                <td key={product.id} className="px-3 py-2 border-b border-r border-[#e5e5e5]">
                  <span className="font-extrabold text-[#2D9F6A] text-sm tabular-nums">{formatPrice(product.cost_price)}</span>
                </td>
              ))}
            </tr>

            <tr className="bg-[#f9fafb]">
              <td className="px-3 py-2 text-xs text-[#525252] border-b border-r border-[#e5e5e5] font-medium">
                Stock disponible
              </td>
              {products.map((product) => {
                const available = getAvailableStock(product);
                return (
                  <td key={product.id} className="px-3 py-2 border-b border-r border-[#e5e5e5] text-xs">
                    <span
                      className={
                        available === 0
                          ? "text-red-600 font-semibold"
                          : available <= 3
                          ? "text-amber-600 font-semibold"
                          : "text-green-600 font-semibold"
                      }
                    >
                      {available === 0 ? "Sin stock" : `${available} unid.`}
                    </span>
                  </td>
                );
              })}
            </tr>

            <tr>
              <td className="px-3 py-2 text-xs text-[#525252] border-b border-r border-[#e5e5e5] font-medium">
                Mínimo compra
              </td>
              {minQty.map((value, index) => (
                <td
                  key={`${products[index].id}-min`}
                  className={`px-3 py-2 border-b border-r border-[#e5e5e5] text-xs text-[#171717] ${
                    minQtyAreEqual ? "" : "bg-amber-50/70"
                  }`}
                >
                  {value}
                </td>
              ))}
            </tr>

            {products.some((product) => product.price_tiers && product.price_tiers.length > 0) && (
              <tr className="bg-[#f9fafb]">
                <td className="px-3 py-2 text-xs text-[#525252] border-b border-r border-[#e5e5e5] font-medium align-top">
                  Precio por volumen
                </td>
                {products.map((product, index) => (
                  <td
                    key={`${product.id}-tiers`}
                    className={`px-3 py-2 border-b border-r border-[#e5e5e5] text-xs ${
                      tiersAreEqual ? "text-[#171717]" : "bg-amber-50/70 text-[#171717]"
                    }`}
                  >
                    {product.price_tiers && product.price_tiers.length > 0 ? (
                      <div className="space-y-1">
                        {product.price_tiers.map((tier, tierIndex) => (
                          <div key={`${product.id}-${tierIndex}`} className="flex items-center justify-between gap-2">
                            <span className="text-[#737373]">
                              {tier.min}{tier.max ? `–${tier.max}` : "+"} u.
                            </span>
                            <span className="font-semibold text-[#2D9F6A]">{formatPrice(tier.price)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span>{priceTiersByProduct[index]}</span>
                    )}
                  </td>
                ))}
              </tr>
            )}

            <tr>
              <td className="px-3 py-2 text-xs text-[#525252] border-b border-r border-[#e5e5e5] font-medium align-top">
                Descripción técnica
              </td>
              {descriptions.map((description, index) => (
                <td
                  key={`${products[index].id}-desc`}
                  className={`px-3 py-2 border-b border-r border-[#e5e5e5] text-xs leading-relaxed ${
                    descriptionsAreEqual ? "text-[#525252]" : "bg-amber-50/70 text-[#525252]"
                  }`}
                >
                  <p className="line-clamp-4 whitespace-pre-line">{description}</p>
                </td>
              ))}
            </tr>

            {specKeys.map((key, rowIndex) => {
              const values = products.map((product) => formatSpecValue(product.specs?.[key]));
              const same = allSame(values);
              const zebra = rowIndex % 2 === 0 ? "bg-[#f9fafb]" : "bg-white";
              return (
                <tr key={key} className={zebra}>
                  <td className="px-3 py-2 text-xs text-[#525252] border-b border-r border-[#e5e5e5] font-medium align-top">
                    {formatSpecLabel(key)}
                  </td>
                  {values.map((value, index) => (
                    <td
                      key={`${products[index].id}-${key}`}
                      className={`px-3 py-2 border-b border-r border-[#e5e5e5] text-xs text-[#171717] ${
                        same ? "" : "bg-amber-50/70"
                      }`}
                    >
                      {value}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
