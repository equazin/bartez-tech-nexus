import type { CobroEnLinea, DatosDelCobro, EstadoDeCobro, EstadoDelCobro } from "./cobros.js";
import { leerJson, mensajeDelProveedor, numero, objeto, texto } from "./lectura.js";

/**
 * Openpay de BBVA (Argentina) por su API, sin SDK (documentación en developers.openpayargentina.com.ar).
 *   - Con el client_id y el client_secret se pide un token (JWT) que dura una hora.
 *   - El cobro es un link de pago (api/v4/payments/links); el comprador paga en Openpay y vuelve.
 *   - El estado se consulta por el id del link: aprobado es un pago del link en APPROVED.
 * Teqo nunca ve datos de tarjeta. Los errores nunca muestran las credenciales.
 */

const TIEMPO_MS = 15_000;

interface ConfiguracionDeOpenpay {
  clientId: string;
  clientSecret: string;
  /** Producción: https://api.openpayargentina.com.ar. Para probar, OPENPAY_API_URL con la base de desarrollo. */
  apiUrl: string;
}

export function configuracionDeOpenpay(): ConfiguracionDeOpenpay | null {
  const clientId = process.env.OPENPAY_CLIENT_ID?.trim();
  const clientSecret = process.env.OPENPAY_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, apiUrl: (process.env.OPENPAY_API_URL?.trim() || "https://api.openpayargentina.com.ar").replace(/\/$/, "") };
}

let tokenGuardado: { valor: string; vence: number; clave: string } | null = null;

async function llamar(url: string, init: RequestInit): Promise<{ respuesta: Response; cuerpo: Record<string, unknown> }> {
  try {
    const respuesta = await fetch(url, { ...init, signal: AbortSignal.timeout(TIEMPO_MS) });
    return { respuesta, cuerpo: await leerJson(respuesta) };
  } catch {
    throw new Error("Openpay no respondió.");
  }
}

async function token(config: ConfiguracionDeOpenpay): Promise<string> {
  const clave = `${config.apiUrl}|${config.clientId}`;
  if (tokenGuardado && tokenGuardado.clave === clave && tokenGuardado.vence - Date.now() > 60_000) return tokenGuardado.valor;
  const { respuesta, cuerpo } = await llamar(`${config.apiUrl}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ grant_type: "client_credentials", client_id: config.clientId, client_secret: config.clientSecret, scope: "*" }),
  });
  const valor = texto(cuerpo.access_token);
  if (!respuesta.ok || !valor) throw new Error(`Openpay no dio acceso: ${mensajeDelProveedor(cuerpo, respuesta.status)}`);
  const segundos = numero(cuerpo.expires_in) ?? 3600;
  tokenGuardado = { valor, vence: Date.now() + segundos * 1000, clave };
  return valor;
}

async function pedir(config: ConfiguracionDeOpenpay, ruta: string, cuerpoDelPedido?: unknown): Promise<Record<string, unknown>> {
  const { respuesta, cuerpo } = await llamar(`${config.apiUrl}${ruta}`, {
    method: cuerpoDelPedido === undefined ? "GET" : "POST",
    headers: {
      authorization: `Bearer ${await token(config)}`,
      accept: "application/json",
      ...(cuerpoDelPedido === undefined ? {} : { "content-type": "application/json" }),
    },
    body: cuerpoDelPedido === undefined ? undefined : JSON.stringify(cuerpoDelPedido),
  });
  if (respuesta.status === 401) tokenGuardado = null;
  if (!respuesta.ok) throw new Error(`Openpay rechazó el pedido: ${mensajeDelProveedor(cuerpo, respuesta.status)}`);
  // Según el ejemplo de la documentación, el link viene suelto; si viniera envuelto en "data", se lo saca.
  return cuerpo.data !== undefined ? objeto(cuerpo.data) : cuerpo;
}

const RECHAZADO = /^(DECLIN|REJECT|FAIL|ERROR|DENIED|CANCEL)/;

export function cobroDeOpenpay(): CobroEnLinea | null {
  const config = configuracionDeOpenpay();
  if (!config) return null;
  return {
    id: "openpay",
    nombre: "Openpay",
    secreto: config.clientSecret,

    async crear(d: DatosDelCobro) {
      const link = await pedir(config, "/api/v4/payments/links", {
        source: "ecommerce",
        currency: "032",
        items: [{ description: `Compra ${d.numero} en Teqo`, quantity: 1, unit_price: d.total }],
        redirect_on_success: `${d.vuelta}&pago=exito`,
        redirect_on_failure: `${d.vuelta}&pago=fallo`,
        webhook_url: d.aviso,
        webhook_version: "V4",
        // Sin este dato el link dura 10 minutos.
        expires_in_minutes: d.minutos,
        external_data: `teqo-${d.pagoId}`,
      });
      const id = texto(link.id);
      const url = texto(objeto(link.transaction_data).checkout_url);
      if (!id || !url) throw new Error("Openpay no devolvió el enlace de pago.");
      return { referencia: id, url, detalle: { link: id } };
    },

    async consultar(referencia: string): Promise<EstadoDelCobro> {
      const link = await pedir(config, `/api/v4/payments/links/${encodeURIComponent(referencia)}`);
      if (texto(link.id) && texto(link.id) !== referencia) throw new Error("Openpay devolvió otro link de pago.");
      const pagos = (Array.isArray(link.payments) ? link.payments : []).map(objeto);
      const aprobado = pagos.find((p) => texto(p.status) === "APPROVED");
      const ultimo = aprobado ?? pagos[pagos.length - 1];
      const estadoDelUltimo = texto(ultimo?.status) ?? "";
      let estado: EstadoDeCobro = "pendiente";
      if (aprobado) estado = "aprobado";
      else if (RECHAZADO.test(estadoDelUltimo)) estado = "rechazado";
      else if (texto(link.status) === "NOT_AVAILABLE") estado = "cancelado";
      const moneda = texto(link.currency);
      // El monto del link; si no viene, la suma de sus ítems y el envío (el link se crea con un solo ítem: el total).
      const items = (Array.isArray(link.items) ? link.items : []).map(objeto);
      const sumaDeItems = items.reduce((suma, i) => suma + (numero(i.unit_price) ?? 0) * (numero(i.quantity) ?? 0), 0) + (numero(objeto(link.shipping).amount) ?? 0);
      const montoDelLink = numero(link.amount);
      return {
        idExterno: texto(ultimo?.payment_intent_uuid) ?? texto(ultimo?.reference_number),
        estado,
        monto: montoDelLink !== null && montoDelLink > 0 ? montoDelLink : sumaDeItems > 0 ? Math.round(sumaDeItems * 100) / 100 : null,
        moneda: moneda === "032" ? "ARS" : moneda,
        cuotas: null,
        detalle: { openpay_link: texto(link.status), openpay_pago: estadoDelUltimo || null, autorizacion: texto(ultimo?.authorization_code) },
      };
    },
  };
}
