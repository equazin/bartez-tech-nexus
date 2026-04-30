import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, GitCompare, Minus, Plus, ShoppingCart } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useImpersonate } from "@/context/ImpersonateContext";
import { useSharedCartState } from "@/hooks/useSharedCartState";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MoneyCell } from "@/components/ui/money-cell";
import { StockCell } from "@/components/ui/stock-cell";
import { ProductGallery } from "@/components/portal/product/ProductGallery";
import { ProductTabs } from "@/components/portal/product/ProductTabs";
import { WatchlistPanel } from "@/components/portal/product/WatchlistPanel";
import { getAvailableStock } from "@/lib/pricing";
import { displayName } from "@/models/products";
import type { Product } from "@/models/products";

async function fetchProductBySlug(slug: string): Promise<Product | null> {
  // Try SKU match first, then id
  const { data } = await supabase
    .from("portal_products")
    .select("*")
    .or(`sku.eq.${slug},id.eq.${Number(slug) || 0}`)
    .limit(1)
    .maybeSingle();
  return (data as Product | null) ?? null;
}

export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const { profile: authProfile } = useAuth();
  const { activeProfile } = useImpersonate();
  const profile = activeProfile ?? authProfile;
  const clientId = profile?.id;

  const { cart, setCart } = useSharedCartState(clientId ?? "");
  const { logView } = useRecentlyViewed(clientId);

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);

    fetchProductBySlug(slug).then((p) => {
      if (cancelled) return;
      setProduct(p);
      if (p) {
        setQty(p.min_order_qty ?? 1);
        logView(p.id);
      }
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [slug, logView]);

  const handleAdd = useCallback(() => {
    if (!product) return;
    setCart((prev) => ({ ...prev, [product.id]: (prev[product.id] ?? 0) + qty }));
  }, [product, qty, setCart]);

  function changeQty(delta: number) {
    if (!product) return;
    const min = product.min_order_qty ?? 1;
    setQty((prev) => Math.max(min, prev + delta));
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="grid gap-8 lg:grid-cols-2">
          <Skeleton className="aspect-square rounded-xl" />
          <div className="flex flex-col gap-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <p className="text-lg font-medium">Producto no encontrado</p>
        <Button variant="outline" onClick={() => navigate("/portal/catalogo")}>
          Volver al catálogo
        </Button>
      </div>
    );
  }

  const available = getAvailableStock(product);
  const cartQty = cart[product.id] ?? 0;

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">
      {/* Back */}
      <Button
        variant="ghost"
        size="sm"
        className="mb-4 gap-1.5"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft className="h-4 w-4" />
        Volver
      </Button>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Gallery */}
        <ProductGallery product={product} />

        {/* Info panel */}
        <div className="flex flex-col gap-4">
          {/* Badges */}
          <div className="flex flex-wrap gap-1.5">
            {product.featured && <Badge variant="secondary">Destacado</Badge>}
            {product.offer_percent && (
              <Badge className="bg-danger text-danger-foreground">
                -{product.offer_percent}% OFF
              </Badge>
            )}
            {product.brand_name && <Badge variant="outline">{product.brand_name}</Badge>}
          </div>

          {/* Name */}
          <div>
            <h1 className="text-xl font-bold leading-snug">{displayName(product)}</h1>
            {product.sku && (
              <p className="mt-1 font-mono text-sm text-muted-foreground">SKU: {product.sku}</p>
            )}
          </div>

          {/* Price */}
          <div className="flex items-end gap-3">
            <MoneyCell
              value={product.unit_price ?? 0}
              emphasis="strong"
              hint="+ IVA"
              className="text-2xl"
            />
            <StockCell available={available} reserved={product.stock_reserved} />
          </div>

          {/* Description short */}
          {product.description_short && (
            <p className="text-sm text-muted-foreground">{product.description_short}</p>
          )}

          {/* Add to cart */}
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-md border">
              <button
                type="button"
                onClick={() => changeQty(-1)}
                className="flex h-9 w-9 items-center justify-center rounded-l-md hover:bg-muted"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-10 text-center tabular-nums">{qty}</span>
              <button
                type="button"
                onClick={() => changeQty(1)}
                className="flex h-9 w-9 items-center justify-center rounded-r-md hover:bg-muted"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <Button
              className="flex-1 gap-2"
              disabled={available <= 0}
              onClick={handleAdd}
            >
              <ShoppingCart className="h-4 w-4" />
              {cartQty > 0 ? `Agregar (${cartQty} en carrito)` : "Agregar al carrito"}
            </Button>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <WatchlistPanel productId={product.id} profileId={clientId} />
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => navigate(`/portal/comparar?ids=${product.id}`)}
            >
              <GitCompare className="h-4 w-4" />
              Comparar
            </Button>
          </div>

          {/* Min order hint */}
          {product.min_order_qty && product.min_order_qty > 1 && (
            <p className="text-xs text-muted-foreground">
              Pedido mínimo: {product.min_order_qty} unidades
            </p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-8">
        <ProductTabs product={product} currentQty={qty} />
      </div>
    </div>
  );
}
