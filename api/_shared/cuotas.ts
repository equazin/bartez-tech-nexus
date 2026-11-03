/**
 * Cuotas con Mercado Pago, portado del motor de Teqo (apps/motor/src/dominios/pagos/cuotas.ts).
 * Las tarjetas de crédito activas de la cuenta (GET /v1/payment_methods) y, para cada una, sus
 * planes para un monto (GET /v1/payment_methods/installments). Un plan solo sale si trae el CFT y
 * la TEA en sus etiquetas: nunca se calculan acá. Sin datos de Mercado Pago, "sin_datos": la tienda
 * no menciona cantidad de cuotas.
 */

export interface PlanDeCuotas {
  cuotas: number;
  monto_cuota: number;
  total: number;
  tea: number;
  cftea: number;
}

export interface TarjetaConCuotas {
  id: string;
  nombre: string;
  emisor: string | null;
  planes: PlanDeCuotas[];
}

export interface CuotasDeLaTienda {
  origen: "mercadopago" | "sin_datos";
  actualizado_en: string | null;
  monto: number | null;
  tarjetas: TarjetaConCuotas[];
}

export const SIN_DATOS: CuotasDeLaTienda = { origen: "sin_datos", actualizado_en: null, monto: null, tarjetas: [] };

/** La etiqueta con el costo financiero y la tasa, con coma decimal: "CFT_70,21%|TEA_89,43%". */
export const ETIQUETA_DE_TASAS = /CFT_(\d+(?:,\d+)?)%\|TEA_(\d+(?:,\d+)?)%/;
export const CUOTAS_PARA_OFRECER = 2;
const SIN_TOPE = 99;
const ID_DE_MEDIO = /^[a-z0-9_-]{1,40}$/i;

const conComa = (texto: string): number => Number(texto.replace(",", "."));
const objeto = (valor: unknown): Record<string, unknown> | null =>
  valor !== null && typeof valor === "object" && !Array.isArray(valor) ? (valor as Record<string, unknown>) : null;
const numero = (valor: unknown): number | null => (typeof valor === "number" && Number.isFinite(valor) ? valor : null);
const aDosDecimales = (valor: number): number => Math.round(valor * 100) / 100;

export function leerTasas(labels: unknown): { cftea: number; tea: number } | null {
  if (!Array.isArray(labels)) return null;
  const texto = labels.filter((l): l is string => typeof l === "string").join("|");
  const encontrada = ETIQUETA_DE_TASAS.exec(texto);
  if (!encontrada) return null;
  const cftea = conComa(encontrada[1]);
  const tea = conComa(encontrada[2]);
  return Number.isFinite(cftea) && Number.isFinite(tea) ? { cftea, tea } : null;
}

export interface TarjetaDeCredito {
  id: string;
  nombre: string;
}

export function leerTarjetas(respuesta: unknown): TarjetaDeCredito[] {
  if (!Array.isArray(respuesta)) throw new Error("Mercado Pago devolvió los medios de pago en un formato que no se entiende.");
  const vistas = new Set<string>();
  return respuesta.flatMap((elemento) => {
    const medio = objeto(elemento);
    if (!medio || medio.payment_type_id !== "credit_card" || medio.status !== "active") return [];
    const id = medio.id;
    if (typeof id !== "string" || !ID_DE_MEDIO.test(id) || vistas.has(id)) return [];
    vistas.add(id);
    const nombre = typeof medio.name === "string" && medio.name.trim() ? medio.name.trim().slice(0, 60) : id;
    return [{ id, nombre }];
  });
}

function leerPlan(elemento: unknown, monto: number): PlanDeCuotas | null {
  const costo = objeto(elemento);
  if (!costo) return null;
  const cuotas = numero(costo.installments);
  const montoCuota = numero(costo.installment_amount);
  const total = numero(costo.total_amount);
  if (cuotas === null || !Number.isInteger(cuotas) || cuotas < 1 || montoCuota === null || montoCuota <= 0 || total === null || total <= 0) return null;
  const minimo = numero(costo.min_allowed_amount);
  const maximo = numero(costo.max_allowed_amount);
  if (minimo !== null && monto < minimo) return null;
  if (maximo !== null && maximo > 0 && monto > maximo) return null;
  const tasas = leerTasas(costo.labels);
  if (!tasas) return null;
  // Un CFTEA nunca es menor que la TEA del mismo plan; si lo es, la etiqueta no trae un CFTEA real.
  if (tasas.cftea < tasas.tea) return null;
  return { cuotas, monto_cuota: aDosDecimales(montoCuota), total: aDosDecimales(total), tea: tasas.tea, cftea: tasas.cftea };
}

export interface PlanesDeUnaTarjeta {
  emisor: string | null;
  planes: PlanDeCuotas[];
}

export function leerPlanes(respuesta: unknown, monto: number): PlanesDeUnaTarjeta {
  if (!Array.isArray(respuesta)) throw new Error("Mercado Pago devolvió las cuotas en un formato que no se entiende.");
  const opciones = respuesta.flatMap((e) => {
    const opcion = objeto(e);
    return opcion && (opcion.payment_type_id === undefined || opcion.payment_type_id === "credit_card") ? [opcion] : [];
  });
  const elegida = opciones.find((o) => objeto(o.issuer)?.default === true) ?? opciones[0];
  if (!elegida) return { emisor: null, planes: [] };
  const nombreDelEmisor = objeto(elegida.issuer)?.name;
  const emisor = typeof nombreDelEmisor === "string" && nombreDelEmisor.trim() ? nombreDelEmisor.trim().slice(0, 80) : null;
  const porCuotas = new Map<number, PlanDeCuotas>();
  for (const elemento of Array.isArray(elegida.payer_costs) ? elegida.payer_costs : []) {
    const plan = leerPlan(elemento, monto);
    if (plan && !porCuotas.has(plan.cuotas)) porCuotas.set(plan.cuotas, plan);
  }
  return { emisor, planes: [...porCuotas.values()].sort((a, b) => a.cuotas - b.cuotas) };
}

// ── El cliente y la caché en memoria del proceso ────────────────────────────

const MINUTO_MS = 60_000;
const HORA_MS = 60 * MINUTO_MS;
const TIEMPO_DE_UNA_LLAMADA_MS = 5_000;
const TARJETAS_VIGENCIA_MS = 24 * HORA_MS;
const PAUSA_DESPUES_DE_UNA_FALLA_MS = MINUTO_MS;
const MAXIMO_DE_ENTRADAS = 5_000;
const TARJETAS_A_LA_VEZ = 3;

interface Guardado<T> {
  valor: T;
  en: number;
}

const planesGuardados = new Map<string, Guardado<PlanesDeUnaTarjeta>>();
const fallas = new Map<string, number>();
let tarjetasGuardadas: Guardado<TarjetaDeCredito[]> | null = null;
let tarjetasFallaronEn: number | null = null;

function configuracion(): { token: string; apiUrl: string } | null {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!token) return null;
  const apiUrl = (process.env.MERCADOPAGO_API_URL?.trim() || "https://api.mercadopago.com").replace(/\/$/, "");
  return { token, apiUrl };
}

async function pedir(ruta: string): Promise<unknown> {
  const config = configuracion();
  if (!config) throw new Error("Mercado Pago no está configurado.");
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), TIEMPO_DE_UNA_LLAMADA_MS);
  try {
    const respuesta = await fetch(`${config.apiUrl}${ruta}`, {
      headers: { Authorization: `Bearer ${config.token}`, Accept: "application/json" },
      signal: control.signal,
    });
    if (!respuesta.ok) throw new Error(`Mercado Pago respondió ${respuesta.status}.`);
    return (await respuesta.json()) as unknown;
  } finally {
    clearTimeout(reloj);
  }
}

function anotar<T>(mapa: Map<string, T>, clave: string, valor: T, tope: number): void {
  mapa.delete(clave);
  mapa.set(clave, valor);
  while (mapa.size > tope) {
    const masVieja = mapa.keys().next().value;
    if (masVieja === undefined) break;
    mapa.delete(masVieja);
  }
}

async function tarjetas(ahora: number): Promise<TarjetaDeCredito[]> {
  if (tarjetasGuardadas && ahora - tarjetasGuardadas.en < TARJETAS_VIGENCIA_MS) return tarjetasGuardadas.valor;
  if (tarjetasFallaronEn !== null && ahora - tarjetasFallaronEn < PAUSA_DESPUES_DE_UNA_FALLA_MS) return tarjetasGuardadas?.valor ?? [];
  try {
    const valor = leerTarjetas(await pedir("/v1/payment_methods"));
    tarjetasGuardadas = { valor, en: ahora };
    tarjetasFallaronEn = null;
    return valor;
  } catch {
    tarjetasFallaronEn = ahora;
    return tarjetasGuardadas?.valor ?? [];
  }
}

async function planesDe(tarjeta: string, monto: number, ahora: number, minutos: number): Promise<PlanesDeUnaTarjeta | null> {
  const clave = `${tarjeta}|${Math.round(monto * 100)}`;
  const guardado = planesGuardados.get(clave);
  if (guardado && ahora - guardado.en < minutos * MINUTO_MS) return guardado.valor;
  const fallo = fallas.get(clave);
  if (fallo !== undefined && ahora - fallo < PAUSA_DESPUES_DE_UNA_FALLA_MS) return guardado?.valor ?? null;
  try {
    const consulta = new URLSearchParams({ amount: monto.toFixed(2), payment_method_id: tarjeta });
    const valor = leerPlanes(await pedir(`/v1/payment_methods/installments?${consulta}`), monto);
    anotar(planesGuardados, clave, { valor, en: ahora }, MAXIMO_DE_ENTRADAS);
    fallas.delete(clave);
    return valor;
  } catch {
    fallas.set(clave, ahora);
    return guardado && ahora - guardado.en < 24 * HORA_MS ? guardado.valor : null;
  }
}

export function hayMercadoPago(): boolean {
  return configuracion() !== null;
}

/**
 * Las cuotas de un monto en pesos hasta `cuotasMaximas`. Con menos de 2 cuotas máximas, o si ninguna tarjeta
 * tiene un plan de 2 cuotas o más, sin datos. `minutos` es cuánto vale cada consulta guardada.
 */
export async function consultarCuotas(monto: number, cuotasMaximas: number, minutos = 30): Promise<CuotasDeLaTienda> {
  if (!Number.isFinite(monto) || monto <= 0 || !Number.isInteger(cuotasMaximas) || cuotasMaximas < CUOTAS_PARA_OFRECER) return SIN_DATOS;
  if (!hayMercadoPago()) return SIN_DATOS;
  const ahora = Date.now();
  const lista = await tarjetas(ahora);
  if (lista.length === 0) return SIN_DATOS;

  const resultados: Array<{ tarjeta: TarjetaDeCredito; planes: PlanesDeUnaTarjeta | null }> = [];
  for (let i = 0; i < lista.length; i += TARJETAS_A_LA_VEZ) {
    const tanda = lista.slice(i, i + TARJETAS_A_LA_VEZ);
    const planes = await Promise.all(tanda.map((t) => planesDe(t.id, monto, ahora, minutos)));
    tanda.forEach((tarjeta, j) => resultados.push({ tarjeta, planes: planes[j] }));
  }

  const conPlanes: TarjetaConCuotas[] = [];
  for (const { tarjeta, planes } of resultados) {
    if (!planes) continue;
    const dentroDelTope = planes.planes.filter((p) => p.cuotas <= Math.min(cuotasMaximas, SIN_TOPE));
    if (!dentroDelTope.some((p) => p.cuotas >= CUOTAS_PARA_OFRECER)) continue;
    conPlanes.push({ id: tarjeta.id, nombre: tarjeta.nombre, emisor: planes.emisor, planes: dentroDelTope });
  }
  if (conPlanes.length === 0) return SIN_DATOS;
  return { origen: "mercadopago", actualizado_en: new Date(ahora).toISOString(), monto, tarjetas: conPlanes };
}
