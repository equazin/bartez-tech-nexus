import type { VercelRequest, VercelResponse } from "@vercel/node";

import checkout from "./_tienda/checkout.js";
import cuenta from "./_tienda/cuenta.js";
import envios from "./_tienda/envios.js";
import legal from "./_tienda/legal.js";
import orders from "./_tienda/orders.js";
import pagos from "./_tienda/pagos.js";
import precios from "./_tienda/precios.js";
import sincronizacion from "./_tienda/sincronizacion.js";

/**
 * Tienda: una sola función para las cinco rutas de la tienda, porque el plan Hobby de
 * Vercel admite 12 funciones por deploy. vercel.json reescribe /api/checkout, /api/legal,
 * /api/orders, /api/pagos y /api/precios a /api/tienda?modulo=... conservando la consulta,
 * así el front, los crons y el aviso de Mercado Pago siguen usando las direcciones de siempre.
 * La sincronización automática (dólar del BNA y ELIT) se llama directo: /api/tienda?modulo=sincronizacion.
 */

export const config = { maxDuration: 60 };

type Manejador = (req: VercelRequest, res: VercelResponse) => Promise<unknown> | unknown;

const MODULOS: Record<string, Manejador> = { checkout, cuenta, envios, legal, orders, pagos, precios, sincronizacion };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const modulo = typeof req.query.modulo === "string" ? req.query.modulo : "";
  const manejador = MODULOS[modulo];
  if (!manejador) {
    res.status(404).json({ success: false, error: "No existe ese módulo de la tienda." });
    return;
  }
  return manejador(req, res);
}
