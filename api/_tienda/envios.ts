import { timingSafeEqual } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";

import { fail, methodNotAllowed, ok } from "../_shared/http.js";
import { getRoleFromRequest } from "../_shared/roles.js";
import { getSupabaseAdmin, getSupabaseClient } from "../_shared/supabaseServer.js";
import {
  claveDeAvisos,
  cotizarConZipnova,
  crearEnvioEnZipnova,
  cuentasDeZipnova,
  diasDeDuracion,
  direccionesDeZipnova,
  documentoDelEnvio,
  hayCredencialesDeZipnova,
  obtenerEnvioDeZipnova,
  suscribirAvisos,
  type EnvioDeZipnova,
  type ItemDeZipnova,
  type ResultadoDeCotizacion,
} from "../_shared/zipnova.js";
import { cambiarEstadoDeLaTienda, type PedidoActual } from "./orders.js";

/**
 * Envíos de la tienda (/api/envios?recurso=...):
 * - cotizar (público): opciones a domicilio y en sucursal para un carrito y un destino.
 * - configuracion, cuentas, avisos, pendientes, crear, etiqueta (panel, solo administradores).
 * - aviso (Zipnova): cambio de estado de un envío; se confirma consultando el envío antes de tocar el pedido.
 *
 * Lo que despacha Teqo se cotiza con Zipnova (más el margen del panel). Lo que despacha un mayorista directo
 * paga su tarifa plana; si el carrito mezcla, se cobra el envío más alto y solo se ofrece la entrega a domicilio,
 * porque el mayorista entrega en el domicilio. Sin Zipnova activo, se usa la tabla de tarifas por peso.
 */

type Supabase = ReturnType<typeof getSupabaseAdmin>;

export interface DestinoDelEnvio {
  codigo_postal: string;
  localidad: string;
  provincia: string;
}

export interface ItemDelEnvio {
  product_id: number;
  cantidad: number;
}

export interface DatosParaZipnova {
  carrier_id: number;
  transporte: string;
  service_type: string;
  logistic_type: string;
  precio_zipnova: number;
}

export interface OpcionDeEnvio {
  id: "domicilio" | "sucursal";
  precio: number;
  gratis: boolean;
  demora_dias_min: number | null;
  demora_dias_max: number | null;
  entrega_estimada: string | null;
  transporte: string | null;
  sucursales?: Array<{ id: number; nombre: string; direccion: string; horario: string | null }>;
  zipnova: DatosParaZipnova | null;
  /** Lo que le cuesta el envío a Teqo (con IVA), aunque al cliente le salga gratis; nulo si no se sabe. Uso interno. */
  costo: number | null;
}

interface ConfiguracionDeZipnova {
  activo: boolean;
  account_id: number | null;
  origen_id: number | null;
  margen_porcentaje: number;
  margen_fijo: number;
  sucursal: boolean;
}

interface ParteDelEnvio {
  product_id: number;
  nombre: string;
  cantidad: number;
  directo: boolean;
  tarifa: number | null;
  demora_dias_min: number | null;
  demora_dias_max: number | null;
  peso_kg: number;
  alto_cm: number;
  ancho_cm: number;
  largo_cm: number;
}

const numero = (v: unknown, defecto = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : defecto;
};

const mensaje = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function leerConfiguracion(supabase: Supabase): Promise<{ zipnova: ConfiguracionDeZipnova; gratisDesde: number | null; redondeo: number }> {
  const { data } = await supabase.from("tienda_configuracion").select("clave, valor").in("clave", ["zipnova", "envio_gratis_desde", "redondeo_pesos"]);
  const filas = new Map(((data ?? []) as Array<{ clave: string; valor: unknown }>).map((f) => [f.clave, f.valor]));
  const z = (filas.get("zipnova") ?? {}) as Partial<ConfiguracionDeZipnova>;
  const gratis = filas.get("envio_gratis_desde");
  return {
    zipnova: {
      activo: Boolean(z.activo),
      account_id: z.account_id ? numero(z.account_id) : null,
      origen_id: z.origen_id ? numero(z.origen_id) : null,
      margen_porcentaje: Math.min(Math.max(numero(z.margen_porcentaje), 0), 300),
      margen_fijo: Math.max(numero(z.margen_fijo), 0),
      sucursal: z.sucursal !== false,
    },
    gratisDesde: gratis === null || gratis === undefined ? null : numero(gratis, 0) || null,
    redondeo: Math.max(numero(filas.get("redondeo_pesos"), 10) || 10, 1),
  };
}

const zipnovaListo = (z: ConfiguracionDeZipnova) => z.activo && z.account_id !== null && z.origen_id !== null && hayCredencialesDeZipnova();

async function partesDelEnvio(supabase: Supabase, items: ItemDelEnvio[]): Promise<ParteDelEnvio[]> {
  const { data, error } = await supabase.rpc("tienda_envio_partes", { p_items: items });
  if (error) throw new Error(`No se pudo cotizar el envío: ${error.message}`);
  return ((data ?? []) as ParteDelEnvio[]).map((p) => ({
    ...p,
    tarifa: p.tarifa === null ? null : numero(p.tarifa),
    peso_kg: numero(p.peso_kg, 1),
  }));
}

function itemsParaZipnova(propios: ParteDelEnvio[]): ItemDeZipnova[] {
  const items: ItemDeZipnova[] = [];
  for (const p of propios) {
    for (let i = 0; i < p.cantidad && items.length < 60; i += 1) {
      items.push({
        weight: Math.max(10, Math.round(p.peso_kg * 1000)),
        height: p.alto_cm,
        width: p.ancho_cm,
        length: p.largo_cm,
        description: p.nombre.slice(0, 80),
      });
    }
  }
  return items;
}

/** Sin entregas en el día ni urgentes: la propuesta es la misma para todo el país. */
const esValida = (r: ResultadoDeCotizacion) =>
  typeof r.carrier?.id === "number" &&
  Number.isFinite(Number(r.amounts?.price_incl_tax)) &&
  r.selectable !== false && !r.service_type?.is_urgent && !/same_?day|express|urgent|flex/i.test(r.service_type?.code ?? "");
const esSucursal = (r: ResultadoDeCotizacion) => /pickup/i.test(r.service_type?.code ?? "");
const precioDe = (r: ResultadoDeCotizacion) => numero(r.amounts?.price_incl_tax, Number.POSITIVE_INFINITY);

function masBarata(resultados: ResultadoDeCotizacion[]): ResultadoDeCotizacion | null {
  return resultados.reduce<ResultadoDeCotizacion | null>((mejor, r) => (mejor === null || precioDe(r) < precioDe(mejor) ? r : mejor), null);
}

function diasDe(r: ResultadoDeCotizacion): { min: number | null; max: number | null } {
  const total = r.delivery_time?.times?.total;
  const min = diasDeDuracion(total?.min) ?? (r.delivery_time?.min ?? null);
  const max = diasDeDuracion(total?.max) ?? (r.delivery_time?.max ?? null) ?? min;
  return { min, max };
}

const mayor = (a: number | null, b: number | null) => (a === null ? b : b === null ? a : Math.max(a, b));

/** Las opciones de envío de un carrito a un destino. La usan la cotización pública y el checkout. */
export async function opcionesDeEnvio(supabase: Supabase, items: ItemDelEnvio[], subtotal: number, destino: DestinoDelEnvio): Promise<OpcionDeEnvio[]> {
  const partes = await partesDelEnvio(supabase, items);
  if (partes.length === 0) return [];
  const { zipnova, gratisDesde, redondeo } = await leerConfiguracion(supabase);
  const gratis = gratisDesde !== null && subtotal >= gratisDesde;
  const redondear = (n: number) => Math.ceil(n / redondeo) * redondeo;

  const directos = partes.filter((p) => p.directo);
  const propios = partes.filter((p) => !p.directo);
  if (directos.some((p) => p.tarifa === null)) return [];
  const directo = directos.length
    ? {
        precio: Math.max(...directos.map((p) => p.tarifa ?? 0)),
        min: directos.reduce<number | null>((m, p) => mayor(m, p.demora_dias_min), null),
        max: directos.reduce<number | null>((m, p) => mayor(m, p.demora_dias_max ?? p.demora_dias_min), null),
      }
    : null;

  // Solo productos de un mayorista directo: su tarifa plana, a domicilio.
  if (propios.length === 0 && directo) {
    return [{ id: "domicilio", precio: gratis ? 0 : directo.precio, gratis, demora_dias_min: directo.min, demora_dias_max: directo.max, entrega_estimada: null, transporte: null, zipnova: null, costo: directo.precio }];
  }

  if (!zipnovaListo(zipnova)) {
    // Sin Zipnova: la tabla de tarifas por peso de siempre (ya contempla el mayorista directo y el envío gratis).
    const { data, error } = await supabase.rpc("tienda_cotizar_envio_carrito", { p_items: items, p_subtotal: subtotal });
    if (error) throw new Error(`No se pudo cotizar el envío: ${error.message}`);
    const fila = (Array.isArray(data) ? data[0] : data) as { precio: number | null; demora_dias_min: number | null; demora_dias_max: number | null; gratis: boolean; disponible: boolean } | null;
    if (!fila?.disponible || fila.precio === null) return [];
    // La tarifa por peso es lo que cuesta el envío; con envío gratis no queda registrada.
    const costo = fila.gratis ? null : numero(fila.precio);
    return [{ id: "domicilio", precio: numero(fila.precio), gratis: Boolean(fila.gratis), demora_dias_min: fila.demora_dias_min, demora_dias_max: fila.demora_dias_max, entrega_estimada: null, transporte: null, zipnova: null, costo }];
  }

  const resultados = (
    await cotizarConZipnova({
      accountId: zipnova.account_id as number,
      origenId: zipnova.origen_id as number,
      destino: { zipcode: destino.codigo_postal, city: destino.localidad, state: destino.provincia },
      valorDeclarado: subtotal,
      items: itemsParaZipnova(propios),
    })
  ).filter(esValida);

  const candidatas: Array<{ id: OpcionDeEnvio["id"]; r: ResultadoDeCotizacion | null }> = [{ id: "domicilio", r: masBarata(resultados.filter((r) => !esSucursal(r))) }];
  // Lo del mayorista directo se entrega en el domicilio: con un carrito mezclado no se ofrece sucursal.
  if (zipnova.sucursal && !directo) {
    candidatas.push({ id: "sucursal", r: masBarata(resultados.filter((r) => esSucursal(r) && (r.pickup_points?.length ?? 0) > 0)) });
  }

  const opciones: OpcionDeEnvio[] = [];
  for (const { id, r } of candidatas) {
    if (!r || !Number.isFinite(precioDe(r))) continue;
    const conMargen = redondear(precioDe(r) * (1 + zipnova.margen_porcentaje / 100) + zipnova.margen_fijo);
    const precio = Math.max(conMargen, directo?.precio ?? 0);
    const dias = diasDe(r);
    opciones.push({
      id,
      precio: gratis ? 0 : precio,
      gratis,
      demora_dias_min: mayor(dias.min, directo?.min ?? null),
      demora_dias_max: mayor(dias.max, directo?.max ?? null),
      entrega_estimada: r.delivery_time?.estimated_delivery ?? null,
      transporte: r.carrier?.name ?? null,
      sucursales:
        id === "sucursal"
          ? (r.pickup_points ?? []).map((p) => ({
              id: p.point_id,
              nombre: p.description,
              direccion: [`${p.location?.street ?? ""} ${p.location?.street_number ?? ""}`.trim(), p.location?.city].filter(Boolean).join(", "),
              horario: p.open_hours ?? null,
            }))
          : undefined,
      zipnova: { carrier_id: r.carrier.id, transporte: r.carrier.name, service_type: r.service_type.code, logistic_type: r.logistic_type, precio_zipnova: precioDe(r) },
      // Con un carrito mezclado se pagan los dos envíos: Zipnova y la tarifa plana del mayorista directo.
      costo: precioDe(r) + (directo?.precio ?? 0),
    });
  }
  return opciones;
}

/** Lo que ve el navegador: sin los datos internos para crear el envío. */
const paraElPublico = (o: OpcionDeEnvio) => {
  const { zipnova: _interno, costo: _costo, ...resto } = o;
  return resto;
};

// ── Acceso ──────────────────────────────────────────────────────────────────

async function usuarioAdmin(req: VercelRequest): Promise<string | null> {
  const supabase = getSupabaseClient(req);
  const rol = await getRoleFromRequest(req, supabase);
  if (rol !== "admin") return null;
  const token = req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : "";
  return (await supabase.auth.getUser(token)).data.user?.id ?? "admin";
}

const sitio = () => (process.env.VITE_SITE_URL?.trim() || process.env.API_ALLOWED_ORIGIN?.split(",")[0]?.trim() || "").replace(/\/$/, "");

const intentos = new Map<string, number[]>();
function excedeLaTasa(clave: string, porMinuto: number): boolean {
  const ahora = Date.now();
  const recientes = (intentos.get(clave) ?? []).filter((t) => ahora - t < 60_000);
  recientes.push(ahora);
  intentos.set(clave, recientes);
  if (intentos.size > 5_000) {
    const vieja = intentos.keys().next().value;
    if (vieja !== undefined) intentos.delete(vieja);
  }
  return recientes.length > porMinuto;
}

// ── Recursos ────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const recurso = String(req.query.recurso ?? "");
  try {
    switch (recurso) {
      case "cotizar":
        return await cotizar(req, res);
      case "aviso":
        return await aviso(req, res);
      case "configuracion":
      case "cuentas":
      case "avisos":
      case "pendientes":
      case "crear":
      case "etiqueta": {
        const userId = await usuarioAdmin(req);
        if (!userId) return fail(res, "Solo para administradores", 403);
        if (recurso === "configuracion") return await configuracion(req, res);
        if (recurso === "cuentas") return await cuentas(req, res);
        if (recurso === "avisos") return await activarAvisos(req, res);
        if (recurso === "pendientes") return await pendientes(req, res);
        if (recurso === "crear") return await crear(req, res, userId);
        return await etiqueta(req, res);
      }
      default:
        return fail(res, "No existe ese recurso de envíos.", 404);
    }
  } catch (e: unknown) {
    console.error(`[envios:${recurso}]`, mensaje(e));
    return fail(res, mensaje(e), 500);
  }
}

function leerDestino(crudo: unknown): DestinoDelEnvio | null {
  const d = (crudo ?? {}) as Record<string, unknown>;
  const codigo_postal = String(d.codigo_postal ?? "").trim();
  const localidad = String(d.localidad ?? "").trim().slice(0, 120);
  const provincia = String(d.provincia ?? "").trim().slice(0, 60);
  if (!/^\d{4}$/.test(codigo_postal) || localidad.length < 2 || provincia.length < 2) return null;
  return { codigo_postal, localidad, provincia };
}

function leerItems(crudo: unknown): ItemDelEnvio[] | null {
  if (!Array.isArray(crudo) || crudo.length === 0 || crudo.length > 50) return null;
  const items: ItemDelEnvio[] = [];
  for (const i of crudo as Array<Record<string, unknown>>) {
    const product_id = Math.trunc(numero(i.product_id));
    const cantidad = Math.trunc(numero(i.cantidad ?? i.quantity, 1));
    if (product_id <= 0 || cantidad < 1 || cantidad > 99) return null;
    items.push({ product_id, cantidad });
  }
  return items;
}

async function cotizar(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  const ip = String(req.headers["x-forwarded-for"] ?? req.socket?.remoteAddress ?? "").split(",")[0].trim();
  if (excedeLaTasa(`cotizar|${ip}`, 30)) return fail(res, "Demasiadas consultas seguidas. Esperá un minuto.", 429);
  const cuerpo = (req.body ?? {}) as Record<string, unknown>;
  const items = leerItems(cuerpo.items);
  const destino = leerDestino(cuerpo.destino);
  if (!items || !destino) return fail(res, "Revisá el código postal, la localidad y la provincia.", 400);
  const subtotal = Math.max(numero(cuerpo.subtotal), 0);
  try {
    const opciones = await opcionesDeEnvio(getSupabaseAdmin(), items, subtotal, destino);
    return ok(res, { opciones: opciones.map(paraElPublico) });
  } catch (e: unknown) {
    console.error("[envios:cotizar]", mensaje(e));
    return ok(res, { opciones: [], error: "No pudimos cotizar el envío a ese código postal. Revisá los datos o probá en un rato." });
  }
}

async function configuracion(req: VercelRequest, res: VercelResponse) {
  const supabase = getSupabaseAdmin();
  if (req.method === "PUT" || req.method === "PATCH") {
    const cuerpo = (req.body ?? {}) as Record<string, unknown>;
    if (cuerpo.zipnova && typeof cuerpo.zipnova === "object") {
      const z = cuerpo.zipnova as Record<string, unknown>;
      const valor: ConfiguracionDeZipnova = {
        activo: Boolean(z.activo),
        account_id: z.account_id ? Math.trunc(numero(z.account_id)) || null : null,
        origen_id: z.origen_id ? Math.trunc(numero(z.origen_id)) || null : null,
        margen_porcentaje: Math.min(Math.max(numero(z.margen_porcentaje), 0), 300),
        margen_fijo: Math.max(numero(z.margen_fijo), 0),
        sucursal: z.sucursal !== false,
      };
      if (valor.activo && (!valor.account_id || !valor.origen_id)) return fail(res, "Para activar Zipnova elegí la cuenta y el origen.", 400);
      const { error } = await supabase.from("tienda_configuracion").upsert({ clave: "zipnova", valor });
      if (error) return fail(res, error.message, 500);
    }
    if (Array.isArray(cuerpo.medidas)) {
      for (const m of cuerpo.medidas as Array<Record<string, unknown>>) {
        const categoria_id = Math.trunc(numero(m.categoria_id));
        if (categoria_id <= 0) continue;
        if (m.borrar) {
          await supabase.from("envio_medidas").delete().eq("categoria_id", categoria_id);
          continue;
        }
        const fila = {
          categoria_id,
          alto_cm: Math.min(Math.max(Math.trunc(numero(m.alto_cm)), 1), 500),
          ancho_cm: Math.min(Math.max(Math.trunc(numero(m.ancho_cm)), 1), 500),
          largo_cm: Math.min(Math.max(Math.trunc(numero(m.largo_cm)), 1), 500),
          actualizado_en: new Date().toISOString(),
        };
        const { error } = await supabase.from("envio_medidas").upsert(fila);
        if (error) return fail(res, error.message, 500);
      }
    }
  } else if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET", "PUT"]);
  }
  const [{ zipnova }, medidas, categorias] = await Promise.all([
    leerConfiguracion(supabase),
    supabase.from("envio_medidas").select("categoria_id, alto_cm, ancho_cm, largo_cm"),
    supabase.from("categories").select("id, name, slug, parent_id").order("name"),
  ]);
  return ok(res, {
    zipnova,
    credenciales: hayCredencialesDeZipnova(),
    medidas: medidas.data ?? [],
    categorias: categorias.data ?? [],
  });
}

async function cuentas(_req: VercelRequest, res: VercelResponse) {
  const [cuentasZ, direcciones] = await Promise.all([cuentasDeZipnova(), direccionesDeZipnova()]);
  return ok(res, { cuentas: cuentasZ, direcciones });
}

async function activarAvisos(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  const { zipnova } = await leerConfiguracion(getSupabaseAdmin());
  if (!zipnova.account_id) return fail(res, "Primero elegí la cuenta de Zipnova.", 400);
  const base = sitio();
  if (!base) return fail(res, "Falta VITE_SITE_URL para armar la dirección de los avisos.", 500);
  await suscribirAvisos(zipnova.account_id, `${base}/api/envios?recurso=aviso&clave=${claveDeAvisos()}`);
  return ok(res, { activados: true });
}

interface PedidoParaEnviar extends PedidoActual {
  order_number: string;
  subtotal: number | null;
  comprador_nombre: string | null;
  comprador_email: string | null;
  comprador_telefono: string | null;
  comprador_documento: string | null;
  direccion_envio: Record<string, string | null> | null;
  envio_detalle: { opcion?: string; sucursal_id?: number | null; sucursal?: string | null; zipnova?: DatosParaZipnova | null } | null;
  zipnova_envio_id: number | null;
  tracking_number: string | null;
  envio_seguimiento_url: string | null;
  shipping_transport: string | null;
  created_at: string;
}

const COLUMNAS_DEL_PEDIDO =
  "id, client_id, status, origen, pagado_en, order_number, subtotal, comprador_nombre, comprador_email, comprador_telefono, comprador_documento, direccion_envio, envio_detalle, zipnova_envio_id, tracking_number, envio_seguimiento_url, shipping_transport, created_at";

async function pendientes(_req: VercelRequest, res: VercelResponse) {
  const { data, error } = await getSupabaseAdmin()
    .from("orders")
    .select(COLUMNAS_DEL_PEDIDO)
    .eq("origen", "tienda")
    .in("status", ["pagado", "preparando", "enviado"])
    .not("envio_detalle->zipnova", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return fail(res, error.message, 500);
  return ok(res, data ?? []);
}

async function crear(req: VercelRequest, res: VercelResponse, userId: string) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  const orderId = Math.trunc(numero((req.body ?? {}).order_id));
  if (orderId <= 0) return fail(res, "Falta el pedido.", 400);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("orders").select(COLUMNAS_DEL_PEDIDO).eq("id", orderId).single();
  if (error || !data) return fail(res, "No encontramos el pedido.", 404);
  const pedido = data as unknown as PedidoParaEnviar;
  if (pedido.origen !== "tienda") return fail(res, "Solo se crean envíos de pedidos de la tienda.", 400);
  if (!["pagado", "preparando"].includes(pedido.status)) return fail(res, `El pedido está "${pedido.status}": el envío se crea cuando está pagado.`, 409);
  if (pedido.zipnova_envio_id) return fail(res, "Este pedido ya tiene un envío en Zipnova.", 409);
  const elegido = pedido.envio_detalle?.zipnova;
  if (!elegido) return fail(res, "Este pedido no se cotizó con Zipnova.", 409);
  if (!pedido.comprador_documento?.trim()) return fail(res, "Falta el DNI del comprador: Zipnova lo pide para el envío. Cargalo en el pedido.", 409);

  const { zipnova } = await leerConfiguracion(supabase);
  if (!zipnova.account_id || !zipnova.origen_id) return fail(res, "Falta elegir la cuenta y el origen de Zipnova en Configuración › Envíos.", 409);

  const { data: lineas } = await supabase.from("order_items").select("product_id, quantity").eq("order_id", orderId).not("product_id", "is", null);
  const items = ((lineas ?? []) as Array<{ product_id: number; quantity: number }>).map((l) => ({ product_id: l.product_id, cantidad: l.quantity }));
  const propios = (await partesDelEnvio(supabase, items)).filter((p) => !p.directo);
  if (propios.length === 0) return fail(res, "Este pedido no tiene productos que despache Teqo.", 409);

  const dir = pedido.direccion_envio ?? {};
  const sucursal = pedido.envio_detalle?.opcion === "sucursal" ? (pedido.envio_detalle?.sucursal_id ?? null) : null;
  const envio: EnvioDeZipnova = await crearEnvioEnZipnova({
    account_id: zipnova.account_id,
    origin_id: String(zipnova.origen_id),
    external_id: pedido.order_number,
    service_type: elegido.service_type,
    logistic_type: elegido.logistic_type,
    carrier_id: elegido.carrier_id,
    declared_value: Math.round(numero(pedido.subtotal)),
    type_packaging: "dynamic",
    destination: {
      name: pedido.comprador_nombre ?? "",
      document: (pedido.comprador_documento ?? "").replace(/\D/g, ""),
      email: pedido.comprador_email ?? "",
      phone: pedido.comprador_telefono ?? "",
      street: dir.calle ?? "",
      street_number: dir.numero ?? "",
      street_extras: dir.piso ?? undefined,
      city: dir.localidad ?? "",
      state: dir.provincia ?? "",
      zipcode: dir.codigo_postal ?? "",
      ...(sucursal ? { point_id: sucursal } : {}),
    },
    items: itemsParaZipnova(propios),
  });

  const { error: errorGuardar } = await supabase
    .from("orders")
    .update({
      zipnova_envio_id: envio.id,
      shipping_provider: "zipnova",
      shipping_transport: envio.carrier?.name ?? elegido.transporte,
      tracking_number: envio.carrier_tracking_id ?? null,
      envio_seguimiento_url: envio.tracking ?? envio.tracking_external ?? null,
    })
    .eq("id", orderId);
  if (errorGuardar) return fail(res, `El envío se creó en Zipnova (${envio.id}) pero no se pudo guardar en el pedido: ${errorGuardar.message}`, 500);

  if (pedido.status === "pagado") {
    const r = await cambiarEstadoDeLaTienda(pedido, "preparando", {}, userId === "admin" ? null : userId);
    if (r.error) console.error("[envios:crear] No se pudo pasar a preparando:", r.error);
  }
  return ok(res, { zipnova_envio_id: envio.id, estado: envio.status_name, seguimiento: envio.tracking ?? null });
}

async function etiqueta(req: VercelRequest, res: VercelResponse) {
  const orderId = Math.trunc(numero(req.query.order_id));
  const que = req.query.que === "document" ? "document" : "label";
  const { data } = await getSupabaseAdmin().from("orders").select("zipnova_envio_id, order_number").eq("id", orderId).single();
  const fila = data as { zipnova_envio_id: number | null; order_number: string } | null;
  if (!fila?.zipnova_envio_id) return fail(res, "Este pedido no tiene envío en Zipnova.", 404);
  const pdf = await documentoDelEnvio(fila.zipnova_envio_id, que);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${que === "label" ? "etiqueta" : "guia"}-${fila.order_number}.pdf"`);
  return res.status(200).send(pdf);
}

// ── Avisos de Zipnova ───────────────────────────────────────────────────────

const ENTREGADO = /^delivered$/i;
const EN_CAMINO = /(in_transit|out_for_delivery|shipped|dispatched|picked_up|with_carrier|in_distribution|at_destination|transit)/i;

function claveValida(recibida: string): boolean {
  const esperada = claveDeAvisos();
  if (!recibida || recibida.length !== esperada.length) return false;
  return timingSafeEqual(Buffer.from(recibida), Buffer.from(esperada));
}

async function aviso(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  if (!hayCredencialesDeZipnova() || !claveValida(String(req.query.clave ?? ""))) return fail(res, "Aviso no autorizado.", 403);
  const datos = ((req.body ?? {}) as { data?: { shipment_id?: number } }).data;
  const envioId = Math.trunc(numero(datos?.shipment_id));
  if (envioId <= 0) return ok(res, { ignorado: true });

  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from("orders").select(COLUMNAS_DEL_PEDIDO).eq("zipnova_envio_id", envioId).maybeSingle();
  const pedido = data as unknown as PedidoParaEnviar | null;
  if (!pedido) return ok(res, { ignorado: true });

  // El aviso no viene firmado: el estado sale de consultar el envío en Zipnova.
  const envio = await obtenerEnvioDeZipnova(envioId);
  await supabase
    .from("orders")
    .update({
      tracking_number: envio.carrier_tracking_id ?? pedido.tracking_number,
      envio_seguimiento_url: envio.tracking ?? envio.tracking_external ?? pedido.envio_seguimiento_url,
    })
    .eq("id", pedido.id);

  const estado = envio.status ?? "";
  let actual = pedido.status;
  if ((EN_CAMINO.test(estado) || ENTREGADO.test(estado)) && (actual === "pagado" || actual === "preparando")) {
    if (actual === "pagado") {
      const r = await cambiarEstadoDeLaTienda({ ...pedido, status: actual }, "preparando", {}, null);
      if (!r.error) actual = "preparando";
    }
    const r = await cambiarEstadoDeLaTienda({ ...pedido, status: actual }, "enviado", {}, null);
    if (!r.error) actual = "enviado";
    else console.error("[envios:aviso] No se pudo pasar a enviado:", r.error);
  }
  if (ENTREGADO.test(estado) && actual === "enviado") {
    const r = await cambiarEstadoDeLaTienda({ ...pedido, status: actual }, "entregado", {}, null);
    if (r.error) console.error("[envios:aviso] No se pudo pasar a entregado:", r.error);
  }
  return ok(res, { procesado: true, estado: envio.status_name });
}
