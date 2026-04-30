import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { X, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useImpersonate } from "@/context/ImpersonateContext";
import { useSharedCartState } from "@/hooks/useSharedCartState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MoneyCell } from "@/components/ui/money-cell";
import { StockCell } from "@/components/ui/stock-cell";
import { getAvailableStock } from "@/lib/pricing";
import { displayName } from "@/models/products";
import type { Product } from "@/models/products";

const MAX_COMPARE = 4;

const HIDDEN_PREFIXES = ["elit_", "air_", "invid_", "supplier_", "sync_", "internal_"];
const HIDDEN_TOKENS = ["cost", "markup", "pvp", "exchange", "uuid", "token", "source"];

function isVisible(key: string): boolean {
  const k = key.toLowerCase();
  return !HIDDEN_PREFIXES.some((p) => k.startsWith(p)) && !HIDDEN_TOKENS.some((t) => k.includes(t));
}

function formatLabel(key: string): string {
  const s = key.replace(/[_-]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

async function fetchProductsByIds(ids: number[]): Promise<Product[]> {
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from("portal_products")
    .select("*")
    .in("id", ids);
  return (data ?? []) as Product[];
}

function getAllSpecKeys(products: Product[]): string[] {
  const keys = new Set<string>();
  for (const p of products) {
    for (const k of Object.keys(p.specs ?? {})) {
      if (isVisible(k)) keys.add(k);
    }
  }
  return [...keys].sort();
}

export default function CompareProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const { profile: authProfile } = useAuth();
  const { activeProfile } = useImpersonate();
  const profile = activeProfile ?? authProfile;
  const clientId = profile?.id;

  const { setCart } = useSharedCartState(clientId ?? "");

  const ids = searchParams
    .get("ids")
    ?.split(",")
    .map(Number)
    .filter(Boolean)
    .slice(0, MAX_COMPARE) ?? [];

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchProductsByIds(ids).then((data) => {
      if (cancelled) return;
      // preserve order of ids param
      const ordered = ids.map((id) => data.find((p) => p.id === id)).filter(Boolean) as Product[];
      setProducts(ordered);
      setLoading(false);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get("ids")]);

  function removeProduct(id: number) {
    const next = ids.filter((i) => i !== id);
    if (next.length === 0) {
      navigate("/portal/catalogo");
    } else {
      setSearchParams({ ids: next.join(",") });
    }
  }

  function addToCart(product: Product) {
    const qty = product.min_order_qty ?? 1;
    setCart((prev) => ({ ...prev, [product.id]: (prev[product.id] ?? 0) + qty }));
  }

  const specKeys = getAllSpecKeys(products);

  const colWidth = products.length > 0 ? `${Math.floor(100 / products.length)}%` : "25%";

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Comparar productos</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {products.length} de {MAX_COMPARE} productos
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate("/portal/catalogo")}>
          Volver al catálogo
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.max(ids.length, 1)}, 1fr)` }}>
          {ids.map((id) => (
            <div key={id} className="flex flex-col gap-3">
              <Skeleton className="aspect-square rounded-xl" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-8 w-1/2" />
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20">
          <p className="text-muted-foreground">No hay productos para comparar.</p>
          <Button asChild><Link to="/portal/catalogo">Ir al catálogo</Link></Button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            {/* Header row — product cards */}
            <thead>
              <tr>
                <th className="w-36 border-b py-2 text-left text-xs font-medium uppercase text-muted-foreground" />
                {products.map((p) => (
                  <th key={p.id} style={{ width: colWidth }} className="border-b p-3 text-left align-top">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-start justify-between">
                        <Link
                          to={`/portal/p/${p.sku ?? p.id}`}
                          className="font-semibold leading-snug hover:underline"
                        >
                          {displayName(p)}
                        </Link>
                        <button
                          type="button"
                          onClick={() => removeProduct(p.id)}
                          className="ml-1 shrink-0 rounded-full p-0.5 hover:bg-muted"
                        >
                          <X className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </div>
                      {p.image && (
                        <img src={p.image} alt="" className="h-24 w-full object-contain rounded bg-muted p-2" />
                      )}
                      {p.brand_name && <Badge variant="outline" className="w-fit">{p.brand_name}</Badge>}
                    </div>
                  </th>
                ))}
                {products.length < MAX_COMPARE && (
                  <th style={{ width: colWidth }} className="border-b p-3 text-left align-top">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 border-dashed"
                      onClick={() => navigate("/portal/catalogo")}
                    >
                      <Plus className="h-4 w-4" />
                      Agregar
                    </Button>
                  </th>
                )}
              </tr>
            </thead>

            <tbody>
              {/* Price row */}
              <tr className="border-b bg-muted/30">
                <td className="px-3 py-2.5 text-xs font-semibold uppercase text-muted-foreground">Precio</td>
                {products.map((p) => (
                  <td key={p.id} className="p-3">
                    <MoneyCell value={p.unit_price ?? 0} emphasis="strong" hint="+ IVA" />
                  </td>
                ))}
              </tr>

              {/* Stock row */}
              <tr className="border-b">
                <td className="px-3 py-2.5 text-xs font-semibold uppercase text-muted-foreground">Stock</td>
                {products.map((p) => (
                  <td key={p.id} className="p-3">
                    <StockCell available={getAvailableStock(p)} reserved={p.stock_reserved} density="compact" />
                  </td>
                ))}
              </tr>

              {/* SKU row */}
              <tr className="border-b bg-muted/30">
                <td className="px-3 py-2.5 text-xs font-semibold uppercase text-muted-foreground">SKU</td>
                {products.map((p) => (
                  <td key={p.id} className="p-3 font-mono text-xs text-muted-foreground">{p.sku ?? "—"}</td>
                ))}
              </tr>

              {/* Specs rows */}
              {specKeys.map((key, i) => (
                <tr key={key} className={`border-b ${i % 2 === 0 ? "bg-muted/20" : ""}`}>
                  <td className="px-3 py-2.5 text-xs font-medium text-muted-foreground">
                    {formatLabel(key)}
                  </td>
                  {products.map((p) => {
                    const val = p.specs?.[key];
                    return (
                      <td key={p.id} className="p-3 text-sm">
                        {val !== undefined && val !== null ? String(val) : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* Add to cart row */}
              <tr className="border-t">
                <td className="px-3 py-3" />
                {products.map((p) => (
                  <td key={p.id} className="p-3">
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={getAvailableStock(p) <= 0}
                      onClick={() => addToCart(p)}
                    >
                      Agregar
                    </Button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
