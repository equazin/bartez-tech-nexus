import type { VercelRequest, VercelResponse } from "@vercel/node";

import { fail, methodNotAllowed, ok } from "../_shared/http.js";
import { createMailerTransport, getDefaultFromEmail, sanitizeHeaderText } from "../_shared/mailer.js";
import { compraRecibidaHTML } from "../_shared/plantillas.js";
import { pedidoDeLaTiendaSchema, type PedidoDeLaTienda } from "../_shared/schemas.js";
import { getSupabaseAdmin } from "../_shared/supabaseServer.js";
import { configuracionDeMercadoPago } from "../_shared/mercadopago.js";

/**
 * POST /api/checkout · crea el pedido de un invitado.
 * Los precios, el envío, el cupón y el stock se resuelven acá, nunca con lo que manda el navegador.
 * El pedido nace pendiente de pago; solo la función de pagos lo marca pagado.
 */

export const config = { maxDuration: 30 };

const INTENTOS_POR_MINUTO = 10;
const intentos = new Map<string, number[]>();

function excedeLaTasa(clave: string): boolean {
  const ahora = Date.now();
  const recientes = (intentos.get(clave) ?? []).filter((t) => ahora - t < 60_000);
  recientes.push(ahora);
  intentos.set(clave, recientes);
  if (intentos.size > 5_000) {
    const masVieja = intentos.keys().next().value;
    if (masVieja !== undefined) intentos.delete(masVieja);
  }
  return recientes.length > INTENTOS_POR_MINUTO;
}

interface ProductoParaVender {
  id: number;
  name: string;
  name_custom: string | null;
  name_original: string | null;
  sku: string | null;
  active: boolean;
  stock: number;
  stock_reserved: number | null;
  precio_final_ars: number | null;
  iva_rate: number | null;
  weight_kg: number | null;
  cost_price: number | null;
  supplier_multiplier: number | null;
  publicado: boolean;
}

interface Cupon {
  id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  min_purchase: number | null;
  max_discount: number | null;
  max_uses: number | null;
  used_count: number | null;
  expires_at: string | null;
  client_id: string | null;
  is_active: boolean | null;
}

const aDosDecimales = (n: number): number => Math.round(n * 100) / 100;
const nombreDe = (p: ProductoParaVender): string => p.name_custom?.trim() || p.name_original?.trim() || p.name;

function origenPermitido(req: VercelRequest, res: VercelResponse): boolean {
  const permitido = process.env.API_ALLOWED_ORIGIN?.trim();
  const origen = req.headers.origin;
  if (permitido && origen && origen !== permitido) return false;
  if (origen) {
    res.setHeader("Access-Control-Allow-Origin", origen);
    res.setHeader("Vary", "Origin");
  }
  return true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    origenPermitido(req, res);
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  if (!origenPermitido(req, res)) return fail(res, "Origen no permitido", 403);

  const parseado = pedidoDeLaTiendaSchema.safeParse(req.body ?? {});
  if (!parseado.success) {
    const primero = parseado.error.issues[0];
    return fail(res, primero ? `Revisá ${primero.path.join(".") || "los datos"}: ${primero.message}` : "Datos incompletos", 400);
  }
  const pedido = parseado.data;

  const ip = String(req.headers["x-forwarded-for"] ?? req.socket?.remoteAddress ?? "").split(",")[0].trim();
  if (excedeLaTasa(`${ip}|${pedido.comprador.email.toLowerCase()}`)) {
    return fail(res, "Demasiados intentos seguidos. Esperá un minuto y volvé a probar.", 429);
  }

  try {
    const resultado = await crearPedido(pedido);
    return ok(res, resultado, 201);
  } catch (e: unknown) {
    const mensaje = e instanceof Error ? e.message : "No se pudo crear el pedido.";
    const esDelCliente = /stock|carrito|cupón|cupon|envío|envio|precio/i.test(mensaje);
    console.error("[checkout]", mensaje);
    return fail(res, esDelCliente ? mensaje : "No se pudo crear el pedido. Probá de nuevo en un momento.", esDelCliente ? 409 : 500);
  }
}

async function crearPedido(pedido: PedidoDeLaTienda): Promise<{ id: number; numero: string; token: string }> {
  const supabase = getSupabaseAdmin();

  const { data: medio } = await supabase.from("medios_de_pago").select("id, activo, recargo_porcentaje").eq("id", pedido.medio_pago).maybeSingle();
  const medioLeido = medio as { activo?: boolean; recargo_porcentaje?: number | string | null } | null;
  const medioActivo = Boolean(medioLeido?.activo) && (pedido.medio_pago !== "mercadopago" || configuracionDeMercadoPago() !== null);
  if (!medioActivo) throw new Error("Ese medio de pago no está disponible. Elegí otro.");
  // Cada medio suma su recargo sobre el precio final con IVA (Configuración › Transferencia y medios).
  const recargo = Math.min(Math.max(Number(medioLeido?.recargo_porcentaje ?? 0) || 0, 0), 100);

  // Un producto por línea, sumando cantidades repetidas.
  const cantidades = new Map<number, number>();
  for (const item of pedido.items) cantidades.set(item.product_id, (cantidades.get(item.product_id) ?? 0) + item.quantity);
  const ids = [...cantidades.keys()];

  const { data: productosCrudos, error: errorProductos } = await supabase
    .from("products")
    .select("id, name, name_custom, name_original, sku, active, publicado, stock, stock_reserved, precio_final_ars, iva_rate, weight_kg, cost_price, supplier_multiplier")
    .in("id", ids);
  if (errorProductos) throw new Error(`No se pudieron leer los productos: ${errorProductos.message}`);
  const productos = new Map<number, ProductoParaVender>();
  for (const p of (productosCrudos ?? []) as ProductoParaVender[]) productos.set(p.id, p);

  const [{ data: dolarCrudo }, { data: configuracion }] = await Promise.all([
    supabase.rpc("dolar_vigente"),
    supabase.from("tienda_configuracion").select("clave, valor").in("clave", ["peso_por_defecto_kg", "redondeo_pesos"]),
  ]);
  const dolar = typeof dolarCrudo === "number" ? dolarCrudo : Number(dolarCrudo ?? 0) || null;
  const pesoPorDefecto = Number((configuracion ?? []).find((c: { clave: string; valor: unknown }) => c.clave === "peso_por_defecto_kg")?.valor ?? 1) || 1;
  // Mismo redondeo que tienda_redondear en la base, para que el precio cobrado sea el que se mostró.
  const redondeo = Math.max(Number((configuracion ?? []).find((c: { clave: string; valor: unknown }) => c.clave === "redondeo_pesos")?.valor ?? 10) || 10, 1);
  const conRecargo = (precio: number) => Math.round((precio * (1 + recargo / 100)) / redondeo) * redondeo;
  // El costo (cost_price) siempre está en dólares: la sincronización con los mayoristas lo
  // normaliza. Se pasa a pesos con el dólar vigente.

  const items: Array<Record<string, unknown>> = [];
  const lineasDelEmail: Array<{ nombre: string; cantidad: number; precioFinal: number }> = [];
  let subtotal = 0;
  let pesoKg = 0;

  for (const [productoId, cantidad] of cantidades) {
    const p = productos.get(productoId);
    if (!p || !p.active || !p.publicado) throw new Error("Un producto del carrito ya no está en la tienda.");
    if (p.precio_final_ars === null) throw new Error(`"${nombreDe(p)}" no tiene precio todavía. Sacalo del carrito para seguir.`);
    const disponible = p.stock - (p.stock_reserved ?? 0);
    if (cantidad > disponible) throw new Error(`No queda stock suficiente de "${nombreDe(p)}": quedan ${Math.max(disponible, 0)} unidades.`);

    const precioFinal = conRecargo(Number(p.precio_final_ars));
    const iva = p.iva_rate ?? 21;
    const neto = aDosDecimales(precioFinal / (1 + iva / 100));
    const costoPesos = aDosDecimales((p.cost_price ?? 0) * (p.supplier_multiplier ?? 1) * (dolar ?? 0));

    subtotal += precioFinal * cantidad;
    pesoKg += (p.weight_kg && p.weight_kg > 0 ? p.weight_kg : pesoPorDefecto) * cantidad;
    items.push({
      product_id: p.id,
      name: nombreDe(p),
      sku: p.sku ?? "",
      quantity: cantidad,
      cost_price: costoPesos,
      unit_price: neto,
      total_price: aDosDecimales(neto * cantidad),
      margin: costoPesos > 0 ? aDosDecimales((neto / costoPesos - 1) * 100) : null,
      iva_rate: iva,
      precio_final: precioFinal,
      costo_pesos: costoPesos,
      dolar,
      costo_moneda: "USD",
    });
    lineasDelEmail.push({ nombre: nombreDe(p), cantidad, precioFinal });
  }
  subtotal = aDosDecimales(subtotal);

  const { data: cotizacion, error: errorEnvio } = await supabase.rpc("tienda_cotizar_envio", { p_peso_kg: aDosDecimales(pesoKg), p_subtotal: subtotal });
  if (errorEnvio) throw new Error(`No se pudo cotizar el envío: ${errorEnvio.message}`);
  const envio = (Array.isArray(cotizacion) ? cotizacion[0] : cotizacion) as { precio: number | null; demora_dias_min: number | null; demora_dias_max: number | null; disponible: boolean } | null;
  if (!envio || !envio.disponible || envio.precio === null) throw new Error("Todavía no podemos cotizar el envío. Probá más tarde.");
  const costoEnvio = Number(envio.precio);

  let cuponId: string | null = null;
  let descuento = 0;
  if (pedido.cupon) {
    const { data: cupon } = await supabase.from("coupons").select("*").eq("code", pedido.cupon.trim().toUpperCase()).maybeSingle();
    const c = cupon as Cupon | null;
    const vigente = c && c.is_active !== false && (!c.expires_at || new Date(c.expires_at) > new Date());
    const conUsos = c && (!c.max_uses || (c.used_count ?? 0) < c.max_uses);
    const paraTodos = c && !c.client_id;
    const alcanza = c && subtotal >= (c.min_purchase ?? 0);
    if (!c || !vigente || !conUsos || !paraTodos) throw new Error("El cupón no es válido o ya venció.");
    if (!alcanza) throw new Error(`El cupón vale para compras desde ${new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(c.min_purchase ?? 0)}.`);
    descuento = c.discount_type === "fixed" ? Number(c.discount_value) : (subtotal * Number(c.discount_value)) / 100;
    if (c.max_discount && descuento > Number(c.max_discount)) descuento = Number(c.max_discount);
    descuento = aDosDecimales(Math.min(descuento, subtotal));
    cuponId = c.id;
  }

  const total = aDosDecimales(subtotal + costoEnvio - descuento);

  const { data: creado, error: errorCreacion } = await supabase.rpc("tienda_crear_pedido", {
    p_items: items,
    p_comprador: pedido.comprador,
    p_direccion: pedido.envio,
    p_medio_pago: pedido.medio_pago,
    p_subtotal: subtotal,
    p_envio_costo: costoEnvio,
    p_envio_demora_min: envio.demora_dias_min,
    p_envio_demora_max: envio.demora_dias_max,
    p_descuento: descuento,
    p_cupon_id: cuponId,
    p_total: total,
    p_notas: pedido.notas ?? null,
  });
  if (errorCreacion) throw new Error(errorCreacion.message);
  const resultado = creado as { id: number; numero: string; token: string };

  void avisarAlComprador(pedido, resultado, { lineasDelEmail, subtotal, envio: costoEnvio, descuento, total });
  return resultado;
}

async function avisarAlComprador(
  pedido: PedidoDeLaTienda,
  creado: { id: number; numero: string; token: string },
  montos: { lineasDelEmail: Array<{ nombre: string; cantidad: number; precioFinal: number }>; subtotal: number; envio: number; descuento: number; total: number },
): Promise<void> {
  try {
    const base = (process.env.VITE_SITE_URL?.trim() || process.env.API_ALLOWED_ORIGIN?.trim() || "").replace(/\/$/, "");
    const enlace = `${base}/compra/${creado.id}?t=${creado.token}`;
    const transporte = createMailerTransport();
    await transporte.sendMail({
      from: `"Teqo" <${getDefaultFromEmail()}>`,
      to: pedido.comprador.email,
      subject: sanitizeHeaderText(`Recibimos tu compra ${creado.numero}`, "Recibimos tu compra"),
      html: compraRecibidaHTML({
        numero: creado.numero,
        nombre: pedido.comprador.nombre,
        lineas: montos.lineasDelEmail,
        subtotal: montos.subtotal,
        envio: montos.envio,
        descuento: montos.descuento,
        total: montos.total,
        medioPago: pedido.medio_pago,
        enlace,
      }),
    });
  } catch (e: unknown) {
    console.error("[checkout] No se pudo mandar el email de compra recibida:", e instanceof Error ? e.message : e);
  }
}
