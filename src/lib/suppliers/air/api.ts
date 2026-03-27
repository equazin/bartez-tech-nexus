/**
 * AIR API client — https://api.air-intra.com/v2
 *
 * Auth flow:
 *   GET /?q=login&user=X&pass=Y  →  { token: "..." }
 *   Todas las requests siguientes llevan: Authorization: Bearer <token>
 *
 * Endpoints usados:
 *   GET  /?q=catalogo              → rubros y grupos (categorías del proveedor)
 *   POST /?q=articulos&page=N      → productos paginados (page empieza en 0)
 *   GET  /?q=check_token           → valida token activo
 */

export interface AirRubro {
  codigo: string;   // e.g. "001-1262"
  nombre: string;
  arts:   number;   // cantidad de artículos
}

export interface AirGrupo {
  codigo: string;
  nombre: string;
}

export interface AirProduct {
  codiart:    string;           // ID único del producto en AIR
  descrip:    string;           // nombre
  detalle?:   string;           // descripción larga
  precio:     number;
  stock:      number;
  rubro_id?:  number | string;
  grupo_id?:  number | string;
  rubro?:     string;
  grupo?:     string;
  [key: string]: unknown;       // campos extra que pueda devolver la API
}

interface LoginResponse {
  token?: string;
  error?: string;
}

interface ArticulosResponse {
  articulos?: AirProduct[];
  total?:     number;
  [key: string]: unknown;
}

interface CatalogoResponse {
  rubros?: AirRubro[];
  [key: string]: unknown;
}

// ─── Client ──────────────────────────────────────────────────

export class AirApiClient {
  private readonly baseUrl: string;
  private readonly user: string;
  private readonly pass: string;
  private token: string | null = null;

  constructor(baseUrl: string, user: string, pass: string, staticToken?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.user    = user;
    this.pass    = pass;
    if (staticToken) this.token = staticToken;
  }

  // ── Auth ────────────────────────────────────────────────────

  async login(): Promise<void> {
    if (this.token) return; // ya tenemos token, no hace falta login

    const url = `${this.baseUrl}/?q=login&user=${encodeURIComponent(this.user)}&pass=${encodeURIComponent(this.pass)}`;
    const res  = await fetch(url);

    if (!res.ok) {
      throw new Error(`AIR login failed (HTTP ${res.status})`);
    }

    const body: LoginResponse = await res.json();

    if (!body.token) {
      throw new Error(`AIR login failed: ${body.error ?? "no token in response"}`);
    }

    this.token = body.token;
  }

  async checkToken(): Promise<boolean> {
    if (!this.token) return false;
    const res = await this.get("/?q=check_token");
    return res.ok;
  }

  private async ensureToken(): Promise<void> {
    if (!this.token) {
      await this.login();
    }
  }

  // ── HTTP helpers ────────────────────────────────────────────

  private authHeaders(): HeadersInit {
    return {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
    };
  }

  private async get(path: string): Promise<Response> {
    await this.ensureToken();
    return fetch(`${this.baseUrl}${path}`, { headers: this.authHeaders() });
  }

  private async post(path: string, body?: unknown): Promise<Response> {
    await this.ensureToken();
    return fetch(`${this.baseUrl}${path}`, {
      method:  "POST",
      headers: this.authHeaders(),
      body:    body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  // ── Endpoints ───────────────────────────────────────────────

  async fetchCatalogo(): Promise<AirRubro[]> {
    const res = await this.get("/?q=catalogo");
    if (!res.ok) throw new Error(`fetchCatalogo failed (HTTP ${res.status})`);

    const body: CatalogoResponse = await res.json();
    return body.rubros ?? [];
  }

  async fetchProductsPage(page: number): Promise<AirProduct[]> {
    const res = await this.post(`/?q=articulos&page=${page}`);
    if (!res.ok) throw new Error(`fetchProductsPage(${page}) failed (HTTP ${res.status})`);

    const body: ArticulosResponse = await res.json();
    return body.articulos ?? [];
  }

  /**
   * Itera todas las páginas hasta que una devuelva 0 artículos.
   */
  async *fetchAllProducts(): AsyncGenerator<AirProduct> {
    let page = 0;
    while (true) {
      const products = await this.fetchProductsPage(page);
      if (products.length === 0) break;
      for (const p of products) yield p;
      page++;
    }
  }
}

// ─── Factory ─────────────────────────────────────────────────

export function createAirClient(): AirApiClient {
  const url   = process.env.AIR_API_URL;
  const user  = process.env.AIR_API_USER ?? "";
  const pass  = process.env.AIR_API_PASS ?? "";
  const token = process.env.AIR_API_TOKEN; // token pre-generado desde intranet (opcional)

  if (!url) {
    throw new Error("Missing AIR_API_URL env var");
  }
  if (!token && (!user || !pass)) {
    throw new Error("Set AIR_API_TOKEN or both AIR_API_USER and AIR_API_PASS");
  }

  return new AirApiClient(url, user, pass, token);
}
