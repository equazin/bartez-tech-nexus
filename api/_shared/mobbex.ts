import type { CobroEnLinea, DatosDelCobro, EstadoDeCobro, EstadoDelCobro } from "./cobros.js";
import { entero, leerJson, mensajeDelProveedor, numero, objeto, texto } from "./lectura.js";

/**
 * Mobbex por su API, sin SDK (documentación en mobbex.dev: Checkout, Webhooks y Consulta de operaciones).
 *   - Cada llamada lleva la clave de la aplicación (x-api-key) y el token de la cuenta de comercio (x-access-token).
 *   - El checkout se crea con una referencia propia, única por pago: Mobbex no acepta dos pagos con la misma.
 *   - El estado se consulta por esa referencia. Aprobado es el código "200".
 * Teqo nunca ve datos de tarjeta: el comprador paga en Mobbex y vuelve. Los errores nunca muestran las claves.
 */

const TIEMPO_MS = 15_000;

interface ConfiguracionDeMobbex {
  apiKey: string;
  accessToken: string;
  apiUrl: string;
  /** MOBBEX_PRUEBA=1: checkouts de prueba (moneda TEST), para probar con las tarjetas de Mobbex. */
  prueba: boolean;
}

export function configuracionDeMobbex(): ConfiguracionDeMobbex | null {
  const apiKey = process.env.MOBBEX_API_KEY?.trim();
  const accessToken = process.env.MOBBEX_ACCESS_TOKEN?.trim();
  if (!apiKey || !accessToken) return null;
  return {
    apiKey,
    accessToken,
    apiUrl: (process.env.MOBBEX_API_URL?.trim() || "https://api.mobbex.com").replace(/\/$/, ""),
    prueba: process.env.MOBBEX_PRUEBA?.trim() === "1",
  };
}

async function pedir(config: ConfiguracionDeMobbex, ruta: string, opciones: { json?: unknown; formulario?: Record<string, string> }): Promise<Record<string, unknown>> {
  let respuesta: Response;
  let cuerpo: Record<string, unknown>;
  try {
    let body: string | FormData | undefined;
    if (opciones.json !== undefined) body = JSON.stringify(opciones.json);
    else if (opciones.formulario) {
      body = new FormData();
      for (const [clave, valor] of Object.entries(opciones.formulario)) body.append(clave, valor);
    }
    respuesta = await fetch(`${config.apiUrl}${ruta}`, {
      method: "POST",
      headers: {
        "x-api-key": config.apiKey,
        "x-access-token": config.accessToken,
        accept: "application/json",
        ...(opciones.json !== undefined ? { "content-type": "application/json" } : {}),
      },
      body,
      signal: AbortSignal.timeout(TIEMPO_MS),
    });
    cuerpo = await leerJson(respuesta);
  } catch {
    throw new Error("Mobbex no respondió.");
  }
  if (!respuesta.ok || cuerpo.result === false) throw new Error(`Mobbex rechazó el pedido: ${mensajeDelProveedor(cuerpo, respuesta.status)}`);
  return cuerpo;
}

/** El código de estado de Mobbex: 200 aprobado; 400 a 599 rechazado (401 vencido); el resto, en curso. */
function estadoDeMobbex(codigo: string, idDelPago: string | null): EstadoDeCobro {
  if (!idDelPago) return "pendiente";
  if (codigo === "200") return "aprobado";
  const n = Number(codigo);
  if (n === 0 || n === 401) return "cancelado";
  if (n >= 400 && n < 600) return "rechazado";
  return "pendiente";
}

export function cobroDeMobbex(): CobroEnLinea | null {
  const config = configuracionDeMobbex();
  if (!config) return null;
  return {
    id: "mobbex",
    nombre: "Mobbex",
    secreto: config.accessToken,

    async crear(d: DatosDelCobro) {
      const referencia = `teqo-${d.pagoId}`;
      const cuerpo = await pedir(config, "/p/checkout", {
        json: {
          total: d.total,
          description: `Compra ${d.numero} en Teqo`,
          currency: "ARS",
          reference: referencia,
          ...(config.prueba ? { test: true } : {}),
          // Mobbex le suma a esta dirección el estado (status), el tipo y el id de la transacción.
          return_url: d.vuelta,
          webhook: d.aviso,
          // Solo los estados finales: el aprobado, el rechazado o el vencido.
          webhooksType: "final",
          timeout: d.minutos,
          customer: { email: d.email, name: d.nombre, identification: d.documento },
        },
      });
      const data = objeto(cuerpo.data);
      const url = texto(data.url);
      if (!url) throw new Error("Mobbex no devolvió el enlace de pago.");
      return { referencia, url, detalle: { checkout: texto(data.id) } };
    },

    async consultar(referencia: string): Promise<EstadoDelCobro> {
      const cuerpo = await pedir(config, "/2.0/transactions/status", { formulario: { id: referencia } });
      const transaccion = objeto(objeto(cuerpo.data).transaction);
      const pago = objeto(transaccion.payment);
      const idDelPago = texto(pago.id);
      const referenciaDelPago = texto(pago.reference);
      if (idDelPago && referenciaDelPago && referenciaDelPago !== referencia) throw new Error("Mobbex devolvió una operación de otra compra.");
      const estado = objeto(pago.status);
      const codigo = String(estado.code ?? "");
      const origen = objeto(pago.source);
      const monedaCruda = texto(objeto(pago.currency).code);
      // En modo de prueba Mobbex cobra en "TEST": solo entonces se toma como pesos, para poder probar de punta a punta.
      const moneda = monedaCruda === "TEST" && config.prueba ? "ARS" : monedaCruda;
      return {
        idExterno: idDelPago,
        estado: estadoDeMobbex(codigo, idDelPago),
        monto: numero(pago.total),
        moneda,
        cuotas: entero(objeto(origen.installment).count),
        detalle: { mobbex_estado: codigo, mobbex_texto: texto(estado.text), medio: texto(origen.name), prueba: monedaCruda === "TEST" },
      };
    },
  };
}
