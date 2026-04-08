import { useMemo, useState } from "react";
import { ClipboardList, Search, ShoppingCart } from "lucide-react";
import { Product } from "@/models/products";

interface ExpressQuoterProps {
  products: Product[];
  onAddToCart: (product: Product, qty: number) => void;
  isDark: boolean;
}

export function ExpressQuoter({ products, onAddToCart, isDark: _isDark }: ExpressQuoterProps) {
  void _isDark;
  const [query, setQuery] = useState("");
  const suggestions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return products.slice(0, 6);

    return products
      .filter((product) =>
        [product.sku, product.name, product.brand_name]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalized)),
      )
      .slice(0, 6);
  }, [products, query]);
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="text-center">
        <h2 className="text-2xl font-black tracking-tight text-foreground">Solicitud guiada de cotizacion</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Empeza por SKU, marca o nombre, carga una base al carrito y termina la propuesta en el checkout.
        </p>
      </div>

      <div className="rounded-[28px] border border-border/70 bg-card p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
            <Search size={18} className="text-primary" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Paso 1</p>
            <p className="text-sm font-semibold text-foreground">Busca por SKU, marca o nombre y carga una base al carrito</p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-border/70 bg-background px-4 py-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ej: DELL, LATITUDE, 16GB, SKU..."
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="mt-4 grid gap-2">
          {suggestions.map((product) => (
            <div key={product.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background/70 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{product.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {[product.brand_name, product.sku, product.category].filter(Boolean).join(" - ")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onAddToCart(product, Math.max(product.min_order_qty ?? 1, 1))}
                className="shrink-0 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
              >
                Agregar base
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="border border-border/70 bg-card rounded-[32px] p-16 flex flex-col items-center justify-center text-center gap-6">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <ShoppingCart size={32} className="text-primary" />
        </div>
        <div>
          <div className="flex items-center justify-center gap-2 mb-2">
            <ClipboardList size={14} className="text-muted-foreground" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Uso actual</span>
          </div>
          <h3 className="text-lg font-bold text-foreground">Carga rapida para armar una propuesta base</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm">
            Esta vista ya funciona como acceso guiado para buscar el producto base y terminar la propuesta desde el checkout.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Segui este recorrido: <span className="font-semibold text-foreground">buscar, agregar base y cerrar desde checkout</span> para mantener una ruta corta entre cotizar y comprar.
        </p>
      </div>
    </div>
  );
}
