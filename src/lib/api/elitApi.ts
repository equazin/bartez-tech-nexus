const PROXY_URL = "/api/elit-proxy";

export class ElitApiError extends Error {
  constructor(message: string, public readonly detail?: string) {
    super(message);
    this.name = "ElitApiError";
  }
}

export interface ElitAttribute {
  nombre?: string;
  valor?: string;
  [key: string]: unknown;
}

export interface ElitProduct {
  id: number | string;
  codigo_alfa?: string;
  codigo_producto?: string;
  nombre: string;
  categoria?: string;
  sub_categoria?: string;
  marca?: string;
  precio: number;
  impuesto_interno?: number;
  iva?: number;
  moneda?: number | string;
  markup?: number;
  cotizacion?: number;
  pvp_usd?: number;
  pvp_ars?: number;
  peso?: number;
  ean?: string;
  nivel_stock?: string;
  stock_total?: number;
  stock_deposito_cliente?: number;
  stock_deposito_cd?: number;
  garantia?: string;
  link?: string;
  imagenes?: string[];
  miniaturas?: string[];
  atributos?: ElitAttribute[];
  gamer?: boolean;
  creado?: string;
  actualizado?: string;
  [key: string]: unknown;
}

interface ElitPaginator {
  total?: number;
  limit?: number;
  offset?: number;
}

export interface ElitProductsPagePayload {
  products: ElitProduct[];
  paginator: ElitPaginator | null;
}

export interface ElitProductsQuery {
  actualizacion?: string;
  id?: number | string;
  codigo_alfa?: string;
  codigo_producto?: string;
  nombre?: string;
  marca?: string;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  });
  return search.toString();
}

async function elitFetch<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const query = buildQuery({ path, ...params });
  const response = await fetch(`${PROXY_URL}?${query}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => response.statusText);
    let detail = errText;
    let message = `HTTP ${response.status}`;
    try {
      const parsed = JSON.parse(errText) as Record<string, unknown>;
      if (typeof parsed.error === "string") {
        message = parsed.error;
        detail = typeof parsed.detail === "string" ? parsed.detail : errText;
      }
    } catch {
      // non-JSON body — use raw text as detail
    }
    throw new ElitApiError(`${message} (${response.status})`, detail);
  }

  const json = await response.json();
  return json as T;
}

function extractProducts(payload: unknown): ElitProduct[] {
  if (Array.isArray(payload)) {
    return payload as ElitProduct[];
  }

  if (payload && typeof payload === "object") {
    const objectPayload = payload as Record<string, unknown>;
    const candidateKeys = ["resultado", "data", "productos", "results", "items"];
    for (const key of candidateKeys) {
      if (Array.isArray(objectPayload[key])) {
        return objectPayload[key] as ElitProduct[];
      }
    }
  }

  return [];
}

function extractPaginator(payload: unknown): ElitPaginator | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const objectPayload = payload as Record<string, unknown>;
  const paginator = objectPayload.paginador;
  if (!paginator || typeof paginator !== "object") {
    return null;
  }

  const pageObject = paginator as Record<string, unknown>;
  return {
    total: Number(pageObject.total ?? 0) || 0,
    limit: Number(pageObject.limit ?? 0) || 0,
    offset: Number(pageObject.offset ?? 0) || 0,
  };
}

export async function fetchElitProductsPagePayload(
  offset = 1,
  limit = 100,
  query: ElitProductsQuery = {}
): Promise<ElitProductsPagePayload> {
  const payload = await elitFetch<unknown>("productos", {
    limit,
    offset,
    ...query,
  });

  return {
    products: extractProducts(payload),
    paginator: extractPaginator(payload),
  };
}

export async function fetchElitProductsPage(offset = 1, limit = 100, actualizacion?: string): Promise<ElitProduct[]> {
  const result = await fetchElitProductsPagePayload(offset, limit, { actualizacion });
  return result.products;
}

export async function fetchAllElitProducts(
  onProgress?: (offset: number, total: number) => void,
  actualizacion?: string
): Promise<ElitProduct[]> {
  const all: ElitProduct[] = [];
  const limit = 100;
  let offset = 1;

  while (true) {
    const batch = await fetchElitProductsPage(offset, limit, actualizacion);
    if (!Array.isArray(batch) || batch.length === 0) {
      break;
    }
    all.push(...batch);
    onProgress?.(offset, all.length);
    if (batch.length < limit) {
      break;
    }
    offset += limit;
  }

  return all;
}
