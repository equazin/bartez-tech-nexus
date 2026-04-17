/**
 * Cliente para la API AIR Intranet (https://api.air-intra.com/docs/)
 * Documentación: https://api.air-intra.com/docs/
 *
 * Las llamadas se realizan a través del proxy serverless /api/air-proxy
 * para evitar errores CORS (la API AIR no permite peticiones desde el browser).
 *
 * Paginación: 500 registros por página, página empieza en 0,
 *             array vacío [] señala fin de datos
 * Rate limit: mínimo 5 minutos entre requests al mismo endpoint
 */

// Proxy serverless: evita CORS llamando a AIR desde el servidor
const PROXY_URL = "/api/air-proxy";

export class AirApiError extends Error {
  constructor(
    public readonly error_id: number,
    message: string,
    public readonly detail: string
  ) {
    super(message);
    this.name = "AirApiError";
  }
}

async function airFetch<T>(query: string, body?: Record<string, unknown>): Promise<T> {
  const bodyStr = body ? JSON.stringify(body) : "{}";
  const res = await fetch(`${PROXY_URL}?q=${query}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: bodyStr,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    // Try to extract a more informative message from the proxy/AIR error body
    let detail = errText;
    let message = `HTTP ${res.status}`;
    try {
      const parsed = JSON.parse(errText) as Record<string, unknown>;
      if (typeof parsed.error === "string") {
        message = parsed.error;
        detail = typeof parsed.detail === "string" ? parsed.detail : errText;
      } else if (typeof parsed.error_name === "string") {
        message = parsed.error_name;
        detail = typeof parsed.error_detail === "string" ? parsed.error_detail : errText;
      }
    } catch {
      // non-JSON body — use raw text as detail
    }
    throw new AirApiError(res.status, `${message} (${res.status})`, detail);
  }

  const rawText = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(rawText);
  } catch {
    // AIR devolvió HTML u otro contenido no-JSON (error PHP, redirect de login, etc.)
    throw new AirApiError(
      502,
      `AIR devolvió respuesta inválida — no es JSON. Intentá de nuevo en unos segundos.`,
      rawText.slice(0, 300)
    );
  }

  // La API devuelve { error_id, error_name, error_detail } cuando hay error
  if (data && typeof data === "object" && !Array.isArray(data) && "error_id" in (data as object)) {
    const d = data as Record<string, unknown>;
    throw new AirApiError(d.error_id as number, (d.error_name as string) ?? `AIR error ${d.error_id}`, (d.error_detail as string) ?? "");
  }

  return data as T;
}

// ── Token ────────────────────────────────────────────────────────────────────

export interface AirTokenInfo {
  codigo: string;
  nombre: string;
  mail: string;
  sucursal: string;
  lista: string;
  listasql: string;
  cotiza: string;
  token: string;
  emitido: string;
  caduca: string;
  expira: number;
}

export async function checkAirToken(): Promise<AirTokenInfo> {
  return airFetch<AirTokenInfo>("check_token");
}

// ── Catálogo ─────────────────────────────────────────────────────────────────

export interface AirRubro {
  codigo: string;
  nombre: string;
  arts: number;
}

export interface AirGrupo {
  codigo: string;
  nombre: string;
  arts: number;
}

export interface AirCatalogo {
  rubros: AirRubro[];
  grupos: AirGrupo[];
}

export async function fetchAirCatalogo(): Promise<AirCatalogo> {
  return airFetch<AirCatalogo>("catalogo");
}

// ── Artículos ────────────────────────────────────────────────────────────────
// Estructura real verificada contra la API

export interface AirStockDeposito {
  name: string;
  fisico: number;
  disponible: number;
  entrante: number;
}

export interface AirImpuesto {
  alicuota: number;
  base_imponible: number;
  impuesto_determinado: number;
}

export interface AirProduct {
  codigo: string;               // SKU interno AIR
  descrip: string;              // nombre/descripción del producto
  part_number?: string;         // número de parte del fabricante
  precio: number;               // precio en USD (moneda: DOL)
  moneda?: string;              // "DOL" = USD
  impuesto_iva?: AirImpuesto;   // IVA: alicuota = 21
  impuesto_interno?: AirImpuesto;
  tipo?: { id: string; name: string };
  estado?: { id: string; name: string }; // id: "P" = activo
  // Stock por depósito
  air?: AirStockDeposito;       // depósito General (Buenos Aires)
  ros?: AirStockDeposito;       // Rosario
  mza?: AirStockDeposito;       // Mendoza
  cba?: AirStockDeposito;       // Córdoba
  lug?: AirStockDeposito;       // Lugano
  rubro?: string;               // código de rubro (categoría)
  grupo?: string;               // código de grupo (marca)
  garantia?: string;
  financiacion?: string;
  PROMOS?: unknown[];
  [key: string]: unknown;
}

/**
 * Stock local (Rosario). Es el stock inmediato del cliente.
 */
export function calcRosStock(p: AirProduct): number {
  return p.ros?.disponible ?? 0;
}

/**
 * Stock en Lugano (Buenos Aires). Disponible con 2-3 días de demora.
 */
export function calcLugStock(p: AirProduct): number {
  return p.lug?.disponible ?? 0;
}

/** Calcula stock disponible total sumando todos los depósitos */
export function calcTotalStock(p: AirProduct): number {
  return (
    (p.air?.disponible ?? 0) +
    (p.ros?.disponible ?? 0) +
    (p.mza?.disponible ?? 0) +
    (p.cba?.disponible ?? 0) +
    (p.lug?.disponible ?? 0)
  );
}

export async function fetchAirProductsPage(page: number): Promise<AirProduct[]> {
  return airFetch<AirProduct[]>(`articulos&page=${page}`);
}

/** Obtiene TODAS las páginas de artículos (puede tardar varios minutos) */
export async function fetchAllAirProducts(
  onProgress?: (page: number, total: number) => void
): Promise<AirProduct[]> {
  const all: AirProduct[] = [];
  let page = 0;

  while (true) {
    const batch = await fetchAirProductsPage(page);
    if (!Array.isArray(batch) || batch.length === 0) break;
    all.push(...batch);
    onProgress?.(page, all.length);
    page++;
    // Pequeño delay para respetar rate limits entre páginas
    if (batch.length === 500) await delay(500);
  }

  return all;
}

// ── Stock y Precio (ligero) ───────────────────────────────────────────────────

export interface AirSyp {
  codigo: string;
  precio?: number;
  // Stock puede venir como campos planos o como depósitos
  stock?: number;
  air?: AirStockDeposito;
  ros?: AirStockDeposito;
  mza?: AirStockDeposito;
  cba?: AirStockDeposito;
  lug?: AirStockDeposito;
  [key: string]: unknown;
}

export async function fetchAirSypPage(page: number): Promise<AirSyp[]> {
  return airFetch<AirSyp[]>(`syp&page=${page}`);
}

/** Obtiene stock+precio por lista de códigos (máx recomendado: 500 por llamada) */
export async function fetchAirSypByList(codes: string[]): Promise<AirSyp[]> {
  return airFetch<AirSyp[]>("syp_list", codes as unknown as Record<string, unknown>);
}

/** Obtiene TODAS las páginas de syp */
export async function fetchAllAirSyp(
  onProgress?: (page: number, total: number) => void
): Promise<AirSyp[]> {
  const all: AirSyp[] = [];
  let page = 0;

  while (true) {
    const batch = await fetchAirSypPage(page);
    if (!Array.isArray(batch) || batch.length === 0) break;
    all.push(...batch);
    onProgress?.(page, all.length);
    page++;
    if (batch.length === 500) await delay(500);
  }

  return all;
}

// ── Metadata de producto individual ─────────────────────────────────────────

export async function fetchAirProductMeta(codiart: string): Promise<AirProduct> {
  return airFetch<AirProduct>(`get_meta&codiart=${codiart}`);
}

// ── Utilidades ────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extrae el precio del producto (ya viene en USD)
 */
export function extractPrice(p: AirProduct): number {
  return p.precio ?? 0;
}

/**
 * Normaliza un AirProduct al formato Product de Supabase para upsert.
 * - sku        ← codigo
 * - name       ← descrip (trim)
 * - cost_price ← precio (USD)
 * - stock      ← suma disponible de todos los depósitos
 * - active     ← estado.id === "P" (Estado Normal)
 * - iva_rate   ← impuesto_iva.alicuota
 * - category   ← rubro (código; el admin puede editarlo después)
 */
export function normalizeAirProduct(p: AirProduct): Record<string, unknown> {
  const sku = String(p.codigo ?? "").trim();
  const name = String(p.descrip ?? "").trim() || sku;
  const cost_price = extractPrice(p);

  // Stock local (Rosario) — entrega inmediata
  const stock = calcRosStock(p);
  // Stock Lugano — disponible con demora 2-3 días, se guarda en specs
  const lug_stock = calcLugStock(p);

  const active = p.estado?.id === "P";
  const iva_rate = p.impuesto_iva?.alicuota ?? 21;
  const category = p.rubro ?? "Sin categoría";

  return {
    sku,
    name,
    cost_price,
    category,
    // stock = solo ROS (entrega inmediata)
    stock,
    image: "",
    active,
    iva_rate,
    external_id: sku,
    description: p.part_number ? `Part#: ${p.part_number}` : "",
    // lug_stock en specs para mostrar "2-3 días" en el portal
    specs: lug_stock > 0 ? { lug_stock: String(lug_stock) } : {},
  };
}
