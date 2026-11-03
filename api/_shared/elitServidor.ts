/**
 * ELIT desde el servidor, para la sincronización automática: consulta la API con las credenciales de
 * las variables de entorno (nunca salen en la respuesta ni en los registros) y traduce cada producto
 * a los campos de product_suppliers con las mismas reglas que la sincronización del panel
 * (src/lib/api/elitSync.ts): costo comparable en dólares, stock disponible y demora.
 */

const ELIT_PRODUCTOS = "https://clientes.elit.com.ar/v1/api/productos";
const POR_PAGINA = 100;
const ESPERA_MS = 20_000;

export interface ProductoElit {
  id: number | string;
  precio?: number | string;
  moneda?: number | string;
  cotizacion?: number | string;
  nivel_stock?: string;
  stock_total?: number | string;
  stock_deposito_cliente?: number | string;
  stock_deposito_cd?: number | string;
  actualizado?: string;
  [clave: string]: unknown;
}

export interface CamposDeElit {
  cost_price: number;
  source_cost_price: number;
  source_currency: "USD" | "ARS";
  source_exchange_rate: number | null;
  stock_available: number;
  active: boolean;
  lead_time_days: number;
}

export function hayCredencialesDeElit(): boolean {
  return Boolean(process.env.ELIT_API_USER_ID?.trim() && process.env.ELIT_API_TOKEN?.trim());
}

function numeroDeElit(valor: unknown): number {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
  const texto = String(valor ?? "").trim();
  if (!texto) return 0;
  const normalizado = texto
    .replace(/\s+/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(/,(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : 0;
}

const entero = (valor: unknown) => Math.max(0, Math.round(numeroDeElit(valor)));

/** Los mismos campos que arma buildElitCatalogRecord para product_suppliers. */
export function camposDeElit(producto: ProductoElit): CamposDeElit {
  const moneda = String(producto.moneda ?? "2") === "1" ? "ARS" : "USD";
  const cotizacion = numeroDeElit(producto.cotizacion ?? 0) || null;
  const costoOriginal = numeroDeElit(producto.precio ?? 0);
  const costoEnDolares = moneda === "ARS" && cotizacion && cotizacion > 0 ? Number((costoOriginal / cotizacion).toFixed(4)) : costoOriginal;

  const inmediato = entero(producto.stock_deposito_cliente);
  const demorado = entero(producto.stock_deposito_cd);
  const total = entero(producto.stock_total);
  const sumado = Math.max(total, inmediato + demorado);
  const nivel = String(producto.nivel_stock ?? "").trim().toLowerCase();
  const disponible = sumado > 0 ? sumado : nivel === "alto" || nivel === "medio" ? 1 : 0;

  return {
    cost_price: costoEnDolares,
    source_cost_price: costoOriginal,
    source_currency: moneda,
    source_exchange_rate: cotizacion,
    stock_available: disponible,
    active: disponible > 0 || costoOriginal > 0,
    lead_time_days: demorado > 0 || (disponible > 0 && inmediato <= 0) ? 3 : 0,
  };
}

function productosDe(payload: unknown): ProductoElit[] {
  if (Array.isArray(payload)) return payload as ProductoElit[];
  if (payload && typeof payload === "object") {
    for (const clave of ["resultado", "data", "productos", "results", "items"]) {
      const valor = (payload as Record<string, unknown>)[clave];
      if (Array.isArray(valor)) return valor as ProductoElit[];
    }
  }
  return [];
}

async function consultar(filtros: Record<string, string | number>): Promise<ProductoElit[]> {
  const consulta = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtros)) consulta.set(clave, String(valor));
  const respuesta = await fetch(`${ELIT_PRODUCTOS}?${consulta.toString()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: Number(process.env.ELIT_API_USER_ID?.trim()), token: process.env.ELIT_API_TOKEN?.trim() }),
    signal: AbortSignal.timeout(ESPERA_MS),
  });
  if (!respuesta.ok) throw new Error(`ELIT respondió ${respuesta.status}`);
  return productosDe(await respuesta.json());
}

/** "AAAA-MM-DD HH:mm" en UTC, el formato del filtro `actualizacion` de ELIT. */
export function fechaParaElit(fecha: Date): string {
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${fecha.getUTCFullYear()}-${dos(fecha.getUTCMonth() + 1)}-${dos(fecha.getUTCDate())} ${dos(fecha.getUTCHours())}:${dos(fecha.getUTCMinutes())}`;
}

/**
 * Los productos que ELIT cambió desde `desde`, página por página, mientras quede tiempo.
 * `completo` es false si se cortó por tiempo o por el tope de páginas.
 */
export async function productosCambiadosDesde(desde: Date, hasta: number, maximoDePaginas = 40): Promise<{ productos: ProductoElit[]; completo: boolean }> {
  const productos: ProductoElit[] = [];
  let offset = 1;
  for (let pagina = 0; pagina < maximoDePaginas; pagina += 1) {
    if (Date.now() > hasta) return { productos, completo: false };
    const lote = await consultar({ limit: POR_PAGINA, offset, actualizacion: fechaParaElit(desde) });
    productos.push(...lote);
    if (lote.length < POR_PAGINA) return { productos, completo: true };
    offset += POR_PAGINA;
  }
  return { productos, completo: false };
}

/** Un producto por su id de ELIT. Solo se acepta la respuesta si trae ese mismo id. */
export async function productoPorId(id: string): Promise<ProductoElit | null> {
  const lote = await consultar({ limit: 1, offset: 1, id });
  return lote.find((p) => String(p.id) === id) ?? null;
}
