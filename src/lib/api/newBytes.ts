import { encabezadosDelPanel } from "@/lib/api/encabezadosDelPanel";
import { syncSupplierCatalogRecords, type SupplierCatalogRecord, type SupplierSyncResult } from "@/lib/api/supplierSync";
import { supabase } from "@/lib/supabase";

/**
 * New Bytes desde el panel: el catálogo por el proxy (/api/proveedores?proveedor=newbytes, con la sesión
 * del panel) y la importación de los productos elegidos, que entran sin publicar como los de ELIT.
 * New Bytes despacha directo al cliente con Entregar: el envío de sus productos es la tarifa plana de
 * Configuración › Envíos (tienda_cotizar_envio_carrito).
 */

export const NOMBRE_DE_NEW_BYTES = "New Bytes";
const PROXY = "/api/proveedores?proveedor=newbytes";

export interface ProductoNewBytes {
  id: number | string;
  sku?: string;
  title?: string;
  amountStock?: number | string;
  price?: { value?: number | string; iva?: number | string; finalPrice?: number | string };
  cotizacion?: number | string;
  category?: string;
  categoryDescriptionUser?: string;
  mainImage?: string;
  mainImageExp?: string;
  weightAverage?: number | string;
  widthAverage?: number | string;
  lengthAverage?: number | string;
  highAverage?: number | string;
  [clave: string]: unknown;
}

const numero = (valor: unknown): number => {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
  const n = Number(String(valor ?? "").trim().replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const texto = (valor: unknown): string => (typeof valor === "string" ? valor.trim() : "");

export const costoEnDolares = (p: ProductoNewBytes) => numero(p.price?.value);
export const stockDe = (p: ProductoNewBytes) => Math.max(0, Math.round(numero(p.amountStock)));
export const categoriaDe = (p: ProductoNewBytes) => texto(p.categoryDescriptionUser) || texto(p.category);
export const fotoDe = (p: ProductoNewBytes) => texto(p.mainImageExp) || texto(p.mainImage);

/** La marca, si New Bytes la manda con alguno de estos nombres. */
function marcaDe(p: ProductoNewBytes): string | null {
  for (const clave of ["brand", "marca", "brandDescription", "manufacturer"]) {
    const valor = p[clave];
    if (typeof valor === "string" && valor.trim()) return valor.trim();
    if (valor && typeof valor === "object" && typeof (valor as { description?: unknown }).description === "string") {
      return String((valor as { description: string }).description).trim() || null;
    }
  }
  return null;
}

function eanDe(p: ProductoNewBytes): string | null {
  for (const clave of ["ean", "upc", "gtin", "barcode"]) {
    const valor = texto(p[clave]);
    if (valor) return valor;
  }
  return null;
}

function listaDe(payload: unknown): ProductoNewBytes[] {
  if (Array.isArray(payload)) return payload as ProductoNewBytes[];
  if (payload && typeof payload === "object") {
    for (const clave of ["data", "products", "productos", "items", "result"]) {
      const valor = (payload as Record<string, unknown>)[clave];
      if (Array.isArray(valor)) return valor as ProductoNewBytes[];
    }
  }
  return [];
}

export async function traerCatalogoDeNewBytes(): Promise<ProductoNewBytes[]> {
  const respuesta = await fetch(`${PROXY}&recurso=catalogo`, { headers: { ...(await encabezadosDelPanel()) } });
  const json = (await respuesta.json().catch(() => null)) as unknown;
  if (!respuesta.ok) {
    const error = json && typeof json === "object" ? (json as { error?: unknown }).error : null;
    throw new Error(typeof error === "string" ? error : `New Bytes respondió ${respuesta.status}`);
  }
  return listaDe(json).filter((p) => p && p.id !== undefined && p.id !== null);
}

/** Los ids de New Bytes que ya están vinculados a un producto de la tienda. */
export async function idsYaVinculados(): Promise<Set<string>> {
  const { data: proveedor } = await supabase.from("suppliers").select("id").ilike("name", NOMBRE_DE_NEW_BYTES).maybeSingle();
  if (!proveedor) return new Set();
  const { data, error } = await supabase.from("product_suppliers").select("external_id").eq("supplier_id", (proveedor as { id: string }).id);
  if (error) throw new Error(error.message);
  return new Set(((data ?? []) as Array<{ external_id: string | null }>).map((f) => String(f.external_id ?? "")).filter(Boolean));
}

function registroDeNewBytes(p: ProductoNewBytes): SupplierCatalogRecord {
  const costo = costoEnDolares(p);
  const stock = stockDe(p);
  const sku = texto(p.sku) || String(p.id);
  const peso = numero(p.weightAverage);
  return {
    supplierName: NOMBRE_DE_NEW_BYTES,
    supplierExternalId: String(p.id),
    supplierSku: sku,
    canonicalSku: sku,
    manufacturerPartNumber: texto(p.sku) || null,
    ean: eanDe(p),
    brand: marcaDe(p),
    name: texto(p.title) || sku,
    description: "",
    category: categoriaDe(p) || "Sin categoria",
    image: fotoDe(p),
    costPrice: Number(costo.toFixed(4)),
    sourceCostPrice: costo,
    sourceCurrency: "USD",
    sourceExchangeRate: numero(p.cotizacion) || null,
    stockAvailable: stock,
    active: stock > 0 || costo > 0,
    ivaRate: numero(p.price?.iva) || 21,
    leadTimeDays: 0,
    priceMultiplier: 1,
    metadata: {
      nb_id: p.id,
      nb_categoria: categoriaDe(p) || null,
      nb_cotizacion: numero(p.cotizacion) || null,
      weight_kg: peso > 0 ? Number((peso / 1000).toFixed(3)) : null,
    },
  };
}

const clave = (valor: unknown) => String(valor ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/** SKU y part number de todos los productos, normalizados, para vincular solo por código exacto. */
async function codigosDelCatalogo(): Promise<Set<string>> {
  const codigos = new Set<string>();
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase.from("products").select("sku, specs").range(desde, desde + 999);
    if (error) throw new Error(`No se pudo leer el catálogo: ${error.message}`);
    for (const fila of (data ?? []) as Array<{ sku: string | null; specs: Record<string, unknown> | null }>) {
      for (const valor of [fila.sku, fila.specs?.manufacturer_part_number, fila.specs?.supplier_sku]) {
        const k = clave(valor);
        if (k.length >= 4) codigos.add(k);
      }
    }
    if (!data || data.length < 1000) break;
  }
  return codigos;
}

/**
 * Importa los elegidos: los nuevos entran sin publicar; los que ya estaban, solo con costo y stock.
 * Un producto de New Bytes se vincula a uno existente solo si su código coincide exacto con el SKU o el
 * part number de ese producto. Sin coincidencia exacta entra como producto nuevo: el parecido por nombre
 * mezclaba modelos distintos (una RX 9070 XT con una RX 9070, un Ryzen con otro). Si ya estaba vinculado
 * a un producto con otro código, ese vínculo se deshace y queda como producto propio.
 */
export async function importarDeNewBytes(productos: ProductoNewBytes[], userId?: string): Promise<SupplierSyncResult> {
  const codigos = await codigosDelCatalogo();
  const registros = productos.map((p) => {
    const registro = registroDeNewBytes(p);
    const k = clave(registro.supplierSku);
    return { ...registro, forceCreate: !(k.length >= 4 && codigos.has(k)) };
  });
  return syncSupplierCatalogRecords(registros, userId, { existingProductsMode: "price_only" });
}
