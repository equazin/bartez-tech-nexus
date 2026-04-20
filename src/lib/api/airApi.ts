import { extractAirJsonPayload } from "@/lib/suppliers/air/response";

/**
 * Cliente para la API AIR Intranet (https://api.air-intra.com/docs/)
 * Las llamadas se realizan a traves del proxy serverless /api/air-proxy
 * para evitar errores CORS desde el browser.
 */

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
      // Keep the raw body as detail.
    }

    throw new AirApiError(res.status, `${message} (${res.status})`, detail);
  }

  const rawText = await res.text();
  const payload = extractAirJsonPayload(rawText);

  if (!payload) {
    throw new AirApiError(
      502,
      "AIR devolvio respuesta invalida - no es JSON. Intenta de nuevo en unos segundos.",
      rawText.slice(0, 300)
    );
  }

  const data = JSON.parse(payload.jsonText) as unknown;

  if (data && typeof data === "object" && !Array.isArray(data) && "error_id" in (data as object)) {
    const d = data as Record<string, unknown>;
    throw new AirApiError(
      d.error_id as number,
      (d.error_name as string) ?? `AIR error ${d.error_id}`,
      (d.error_detail as string) ?? ""
    );
  }

  return data as T;
}

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
  codigo: string;
  descrip: string;
  part_number?: string;
  precio: number;
  moneda?: string;
  impuesto_iva?: AirImpuesto;
  impuesto_interno?: AirImpuesto;
  tipo?: { id: string; name: string };
  estado?: { id: string; name: string };
  air?: AirStockDeposito;
  ros?: AirStockDeposito;
  mza?: AirStockDeposito;
  cba?: AirStockDeposito;
  lug?: AirStockDeposito;
  rubro?: string;
  grupo?: string;
  garantia?: string;
  financiacion?: string;
  PROMOS?: unknown[];
  [key: string]: unknown;
}

export function calcRosStock(p: AirProduct): number {
  return p.ros?.disponible ?? 0;
}

export function calcLugStock(p: AirProduct): number {
  return p.lug?.disponible ?? 0;
}

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

export async function fetchAllAirProducts(
  onProgress?: (page: number, total: number) => void
): Promise<AirProduct[]> {
  const all: AirProduct[] = [];
  let page = 0;

  while (true) {
    const batch = await fetchAirProductsPage(page);
    if (!Array.isArray(batch) || batch.length === 0) {
      break;
    }
    all.push(...batch);
    onProgress?.(page, all.length);
    page++;
    if (batch.length === 500) {
      await delay(500);
    }
  }

  return all;
}

export interface AirSyp {
  codigo: string;
  precio?: number;
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

export async function fetchAirSypByList(codes: string[]): Promise<AirSyp[]> {
  return airFetch<AirSyp[]>("syp_list", codes as unknown as Record<string, unknown>);
}

export async function fetchAllAirSyp(
  onProgress?: (page: number, total: number) => void
): Promise<AirSyp[]> {
  const all: AirSyp[] = [];
  let page = 0;

  while (true) {
    const batch = await fetchAirSypPage(page);
    if (!Array.isArray(batch) || batch.length === 0) {
      break;
    }
    all.push(...batch);
    onProgress?.(page, all.length);
    page++;
    if (batch.length === 500) {
      await delay(500);
    }
  }

  return all;
}

export async function fetchAirProductMeta(codiart: string): Promise<AirProduct> {
  return airFetch<AirProduct>(`get_meta&codiart=${codiart}`);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function extractPrice(p: AirProduct): number {
  return p.precio ?? 0;
}

export function normalizeAirProduct(p: AirProduct): Record<string, unknown> {
  const sku = String(p.codigo ?? "").trim();
  const name = String(p.descrip ?? "").trim() || sku;
  const cost_price = extractPrice(p);
  const stock = calcRosStock(p);
  const lug_stock = calcLugStock(p);
  const active = p.estado?.id === "P";
  const iva_rate = p.impuesto_iva?.alicuota ?? 21;
  const category = p.rubro ?? "Sin categoria";

  return {
    sku,
    name,
    cost_price,
    category,
    stock,
    image: "",
    active,
    iva_rate,
    external_id: sku,
    description: p.part_number ? `Part#: ${p.part_number}` : "",
    specs: lug_stock > 0 ? { lug_stock: String(lug_stock) } : {},
  };
}
