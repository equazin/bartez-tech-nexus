import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PriceTierTable } from "./PriceTierTable";
import { StockByWarehouse } from "./StockByWarehouse";
import { PriceSparkline } from "@/components/PriceSparkline";
import type { Product } from "@/models/products";

const HIDDEN_PREFIXES = ["elit_", "air_", "invid_", "supplier_", "preferred_supplier_", "sync_", "internal_", "provider_"];
const HIDDEN_TOKENS = ["cost", "precio_costo", "markup", "pvp", "exchange", "cotizacion", "external_id", "uuid", "token", "source", "last_update"];

function isVisible(key: string): boolean {
  const k = key.trim().toLowerCase();
  if (!k) return false;
  if (HIDDEN_PREFIXES.some((p) => k.startsWith(p))) return false;
  if (HIDDEN_TOKENS.some((t) => k.includes(t))) return false;
  return true;
}

function formatLabel(key: string): string {
  const s = key.replace(/[_-]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface Props {
  product: Product;
  currentQty?: number;
}

export function ProductTabs({ product, currentQty = 1 }: Props) {
  const visibleSpecs = Object.entries(product.specs ?? {}).filter(([k]) => isVisible(k));
  const hasDescription = Boolean(product.description_full || product.description);
  const hasTiers = (product.price_tiers?.length ?? 0) >= 2;

  return (
    <Tabs defaultValue={hasDescription ? "descripcion" : "specs"}>
      <TabsList className="w-full justify-start">
        {hasDescription && <TabsTrigger value="descripcion">Descripción</TabsTrigger>}
        {visibleSpecs.length > 0 && <TabsTrigger value="specs">Especificaciones</TabsTrigger>}
        {hasTiers && <TabsTrigger value="precios">Precios vol.</TabsTrigger>}
        <TabsTrigger value="stock">Stock</TabsTrigger>
        <TabsTrigger value="historial">Historial</TabsTrigger>
      </TabsList>

      {hasDescription && (
        <TabsContent value="descripcion" className="prose prose-sm dark:prose-invert max-w-none pt-4">
          <div
            dangerouslySetInnerHTML={{ __html: product.description_full || product.description || "" }}
          />
        </TabsContent>
      )}

      {visibleSpecs.length > 0 && (
        <TabsContent value="specs" className="pt-4">
          <div className="rounded-lg border">
            {visibleSpecs.map(([key, val], i) => (
              <div
                key={key}
                className={`flex gap-4 px-4 py-2.5 text-sm ${i % 2 === 0 ? "bg-muted/40" : ""}`}
              >
                <span className="w-40 shrink-0 font-medium text-muted-foreground">{formatLabel(key)}</span>
                <span className="flex-1">{String(val ?? "")}</span>
              </div>
            ))}
          </div>
        </TabsContent>
      )}

      {hasTiers && (
        <TabsContent value="precios" className="pt-4">
          <PriceTierTable product={product} currentQty={currentQty} />
        </TabsContent>
      )}

      <TabsContent value="stock" className="pt-4">
        <StockByWarehouse productId={product.id} />
      </TabsContent>

      <TabsContent value="historial" className="pt-4">
        <div className="rounded-lg border p-4">
          <p className="mb-3 text-sm font-semibold">Historial de precio</p>
          <PriceSparkline productId={product.id} currentPrice={product.unit_price ?? 0} isDark={false} />
        </div>
      </TabsContent>
    </Tabs>
  );
}
