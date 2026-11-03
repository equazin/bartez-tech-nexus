import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Mercado Pago Checkout Pro por su API, sin SDK. Portado del motor de Teqo (apps/motor/src/dominios/pagos).
 * Teqo nunca ve datos de tarjeta: el cliente paga en Mercado Pago y vuelve. El estado de un pago nunca se
 * toma del aviso ni de la dirección de vuelta: siempre se consulta acá. Los errores nunca muestran el token.
 */

export class ErrorDeMercadoPago extends Error {
  constructor(
    mensaje: string,
    readonly estado: number | null = null,
  ) {
    super(mensaje);
  }
}

export type EstadoDeMercadoPago = "approved" | "pending" | "in_process" | "authorized" | "rejected" | "cancelled" | "refunded" | "charged_back";

export interface PagoDeMercadoPago {
  id: string;
  estado: EstadoDeMercadoPago;
  /** La external_reference: el id de nuestra fila en `pagos`. */
  referencia: string | null;
  /** En pesos con dos decimales; nulo si no vino un monto válido. */
  monto: number | null;
  moneda: string | null;
  cuotas: number | null;
  detalle: Record<string, unknown>;
}

export interface ConfiguracionDeMercadoPago {
  token: string;
  apiUrl: string;
  secreto: string | null;
}

const TIEMPO_MS = 15_000;

export function configuracionDeMercadoPago(): ConfiguracionDeMercadoPago | null {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!token) return null;
  return {
    token,
    apiUrl: (process.env.MERCADOPAGO_API_URL?.trim() || "https://api.mercadopago.com").replace(/\/$/, ""),
    secreto: process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim() || null,
  };
}

/** Las credenciales de prueba empiezan con TEST-: usan el checkout de pruebas. */
export const esDePrueba = (token: string): boolean => token.startsWith("TEST-");

interface OpcionesDelPedido {
  metodo?: "GET" | "POST" | "PUT";
  cuerpo?: unknown;
  idempotencia?: string;
  tiempoMs?: number;
}

async function pedir(config: ConfiguracionDeMercadoPago, ruta: string, opciones: OpcionesDelPedido = {}): Promise<Record<string, unknown>> {
  let respuesta: Response;
  let texto: string;
  try {
    respuesta = await fetch(`${config.apiUrl}${ruta}`, {
      method: opciones.metodo ?? "GET",
      headers: {
        authorization: `Bearer ${config.token}`,
        accept: "application/json",
        ...(opciones.cuerpo === undefined ? {} : { "content-type": "application/json" }),
        ...(opciones.idempotencia ? { "x-idempotency-key": opciones.idempotencia } : {}),
      },
      body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
      signal: AbortSignal.timeout(opciones.tiempoMs ?? TIEMPO_MS),
    });
    texto = await respuesta.text();
  } catch {
    throw new ErrorDeMercadoPago("Mercado Pago no respondió.");
  }
  let json: unknown = {};
  try {
    json = texto ? JSON.parse(texto) : {};
  } catch {
    // Sin JSON: el mensaje lleva solo el estado.
  }
  if (!respuesta.ok) {
    const mensaje = json !== null && typeof json === "object" && "message" in json ? (json as { message?: unknown }).message : undefined;
    const detalle = typeof mensaje === "string" ? `: ${mensaje.split(config.token).join("***").slice(0, 160)}` : ".";
    throw new ErrorDeMercadoPago(`Mercado Pago respondió ${respuesta.status}${detalle}`, respuesta.status);
  }
  return json !== null && typeof json === "object" && !Array.isArray(json) ? (json as Record<string, unknown>) : {};
}

const aMonto = (valor: unknown): number | null => (typeof valor === "number" && Number.isFinite(valor) && valor >= 0 ? Math.round(valor * 100) / 100 : null);

function aPago(r: Record<string, unknown>, id: string): PagoDeMercadoPago {
  return {
    id: String(r.id ?? id),
    estado: (typeof r.status === "string" ? r.status : "pending") as EstadoDeMercadoPago,
    referencia: typeof r.external_reference === "string" ? r.external_reference : null,
    monto: aMonto(r.transaction_amount),
    moneda: typeof r.currency_id === "string" ? r.currency_id : null,
    cuotas: typeof r.installments === "number" ? r.installments : null,
    detalle: {
      status_detail: r.status_detail ?? null,
      payment_method_id: r.payment_method_id ?? null,
      payment_type_id: r.payment_type_id ?? null,
      date_approved: r.date_approved ?? null,
      date_created: r.date_created ?? null,
    },
  };
}

export interface PreferenciaNueva {
  pagoId: number;
  numero: string;
  total: number;
  email: string;
  vuelta: string;
  aviso: string;
  cuotasMaximas: number;
  venceEn: Date | null;
}

export async function crearPreferencia(config: ConfiguracionDeMercadoPago, p: PreferenciaNueva): Promise<{ id: string; url: string }> {
  const r = await pedir(config, "/checkout/preferences", {
    metodo: "POST",
    idempotencia: `preferencia-${p.pagoId}`,
    cuerpo: {
      items: [{ id: String(p.pagoId), title: `Compra ${p.numero} en Teqo`, quantity: 1, unit_price: p.total, currency_id: "ARS" }],
      payer: { email: p.email },
      external_reference: String(p.pagoId),
      notification_url: p.aviso,
      back_urls: { success: `${p.vuelta}&pago=exito`, pending: `${p.vuelta}&pago=pendiente`, failure: `${p.vuelta}&pago=fallo` },
      auto_return: "approved",
      // Las cuotas son con interés a cargo del cliente: Mercado Pago las calcula al pagar. Sin efectivo ni cajero.
      payment_methods: { installments: Math.max(1, p.cuotasMaximas), excluded_payment_types: [{ id: "ticket" }, { id: "atm" }] },
      statement_descriptor: "TEQO",
      ...(p.venceEn ? { expires: true, expiration_date_to: p.venceEn.toISOString() } : {}),
    },
  });
  const url = esDePrueba(config.token) ? r.sandbox_init_point : r.init_point;
  if (typeof r.id !== "string" || typeof url !== "string") throw new ErrorDeMercadoPago("Mercado Pago no devolvió el enlace de pago.");
  return { id: r.id, url };
}

export async function obtenerPago(config: ConfiguracionDeMercadoPago, id: string): Promise<PagoDeMercadoPago> {
  if (!/^\d{1,30}$/.test(id)) throw new ErrorDeMercadoPago("El id del pago no es válido.", 400);
  return aPago(await pedir(config, `/v1/payments/${id}`), id);
}

/** Reintegro total (sin monto) o parcial. La clave de idempotencia es la de nuestro reintegro. */
export async function reintegrar(config: ConfiguracionDeMercadoPago, pagoId: string, monto: number | null, clave: string): Promise<{ id: string }> {
  if (!/^\d{1,30}$/.test(pagoId)) throw new ErrorDeMercadoPago("El id del pago no es válido.", 400);
  const r = await pedir(config, `/v1/payments/${pagoId}/refunds`, { metodo: "POST", idempotencia: `reintegro-${clave}`, cuerpo: monto === null ? {} : { amount: monto } });
  return { id: String(r.id ?? "") };
}

// ── La firma de los avisos (cabecera x-signature) ───────────────────────────

/**
 * Mercado Pago firma con HMAC-SHA256 el texto `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` con la clave
 * secreta del webhook. Avisos de más de 7 días (o del futuro) se rechazan: Mercado Pago reintenta durante días
 * con su ts original, y uno viejo bien firmado solo dispara una consulta del pago, que es idempotente.
 */
export const ANTIGUEDAD_MAXIMA_MS = 7 * 24 * 60 * 60 * 1000;

export interface DatosDeFirma {
  firma: string | undefined;
  idDeSolicitud: string | undefined;
  idDelRecurso: string | undefined;
}

function partes(firma: string): { ts?: string; v1?: string } {
  return Object.fromEntries(
    firma.split(",").map((parte) => {
      const [clave, ...valor] = parte.trim().split("=");
      return [clave, valor.join("=")];
    }),
  );
}

export function textoFirmado(idDelRecurso: string, idDeSolicitud: string, ts: string): string {
  return `id:${idDelRecurso.toLowerCase()};request-id:${idDeSolicitud};ts:${ts};`;
}

export function firmar(idDelRecurso: string, idDeSolicitud: string, ts: string, secreto: string): string {
  return createHmac("sha256", secreto).update(textoFirmado(idDelRecurso, idDeSolicitud, ts)).digest("hex");
}

export function firmaValida(datos: DatosDeFirma, secreto: string | null, ahora: number = Date.now()): boolean {
  if (!secreto || !datos.firma || !datos.idDeSolicitud || !datos.idDelRecurso) return false;
  const { ts, v1 } = partes(datos.firma);
  if (!ts || !v1 || !/^\d+$/.test(ts) || !/^[0-9a-f]{64}$/i.test(v1)) return false;
  const momento = ts.length > 11 ? Number(ts) : Number(ts) * 1000;
  if (!Number.isFinite(momento) || Math.abs(ahora - momento) > ANTIGUEDAD_MAXIMA_MS) return false;
  const esperada = Buffer.from(firmar(datos.idDelRecurso, datos.idDeSolicitud, ts, secreto), "hex");
  const recibida = Buffer.from(v1, "hex");
  return esperada.length === recibida.length && timingSafeEqual(esperada, recibida);
}
