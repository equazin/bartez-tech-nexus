import type { VercelRequest, VercelResponse } from "@vercel/node";

import { consultarDolarBna, type TipoDeDolar } from "../_shared/dolarBna.js";
import { camposDeElit, hayCredencialesDeElit, productoPorId, productosCambiadosDesde, type ProductoElit } from "../_shared/elitServidor.js";
import { fail, methodNotAllowed, ok } from "../_shared/http.js";
import { camposDeNewBytes, catalogoDeNewBytes, descripcionesDeNewBytes, hayCredencialesDeNewBytes, textoDeDescripcion } from "../_shared/newBytesServidor.js";
import { getRoleFromRequest } from "../_shared/roles.js";
import { getSupabaseAdmin, getSupabaseClient } from "../_shared/supabaseServer.js";

/**
 * Sincronización automática de la tienda. El cron de Vercel la corre a las 9 y a las 18 (hora de Argentina):
 * trae el dólar del BNA, los costos y el stock de ELIT y de New Bytes de los productos vinculados, y recalcula
 * los precios.
 *   GET/POST ?recurso=correr          admin o el cron (CRON_SECRET): corre la sincronización
 *   GET      ?recurso=estado          admin: configuración y resultado de la última corrida
 *   PATCH    ?recurso=configuracion   admin: {dolar: {activo, tipo}, elit: {activa}, newbytes: {activa}}
 */

export const config = { maxDuration: 60 };

/** Después de este tiempo no se piden más productos a ELIT: queda margen para guardar y recalcular. */
const TIEMPO_PARA_CONSULTAR_MS = 42_000;
/** ELIT filtra por fecha de cambio; se pide desde 4 horas antes de la última corrida por si su hora no es UTC. */
const MARGEN_DEL_FILTRO_MS = 4 * 60 * 60_000;
const PRIMERA_VEZ_DESDE_MS = 48 * 60 * 60_000;
/** Además de los cambios, cada corrida repasa por id las filas que hace más de 20 horas que no se actualizan. */
const REPASO_DESPUES_DE_MS = 20 * 60 * 60_000;
const REPASO_MAXIMO = 60;
const CONSULTAS_A_LA_VEZ = 4;
/** Un dólar nuevo que se aleja más que esto del vigente no se aplica solo: puede ser un error de lectura. */
const VARIACION_MAXIMA_DEL_DOLAR = 0.25;

interface ConfiguracionAutomatica {
  dolar: { activo: boolean; tipo: TipoDeDolar };
  elit: { activa: boolean };
  newbytes: { activa: boolean };
}

interface ResultadoDelDolar {
  estado: "actualizado" | "sin_cambios" | "apagado" | "error";
  valor?: number;
  anterior?: number | null;
  fecha?: string | null;
  origen?: string;
  error?: string;
}

interface ResultadoDeMayorista {
  estado: "ok" | "parcial" | "apagada" | "sin_credenciales" | "error";
  vinculados: number;
  revisados: number;
  productos_cambiados: number;
  no_encontrados: number;
  error?: string;
}

interface Corrida {
  empezo: string;
  termino: string;
  disparada_por: "cron" | "panel";
  dolar: ResultadoDelDolar;
  elit: ResultadoDeMayorista;
  newbytes: ResultadoDeMayorista;
  recalculados: number | null;
  error_recalculo?: string;
  /** Descripciones de New Bytes que se completaron en esta corrida. */
  descripciones?: ResultadoDeDescripciones;
  /** Desde cuándo pedirle cambios a ELIT en la próxima corrida; solo avanza cuando la consulta terminó completa. */
  elit_hasta?: string;
}

interface FilaDeProveedor {
  id: string;
  product_id: number;
  supplier_id: string;
  external_id: string | null;
  cost_price: number | string | null;
  stock_available: number | null;
  active: boolean;
  last_synced_at: string | null;
}

function esElCron(req: VercelRequest): boolean {
  const secreto = process.env.CRON_SECRET?.trim();
  return Boolean(secreto) && req.headers.authorization === `Bearer ${secreto}`;
}

async function esAdmin(req: VercelRequest): Promise<{ admin: boolean; userId: string | null }> {
  const supabase = getSupabaseClient(req);
  const rol = await getRoleFromRequest(req, supabase);
  const bearer = req.headers.authorization;
  const token = bearer?.startsWith("Bearer ") ? bearer.slice(7) : undefined;
  const userId = token ? ((await supabase.auth.getUser(token)).data.user?.id ?? null) : null;
  return { admin: rol === "admin", userId };
}

const mensaje = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const recurso = String(req.query.recurso ?? "");
  try {
    switch (recurso) {
      case "correr":
        return await correr(req, res);
      case "estado":
        return await estado(req, res);
      case "configuracion":
        return await configuracion(req, res);
      case "descripciones":
        return await descripciones(req, res);
      default:
        return fail(res, "Recurso desconocido", 404);
    }
  } catch (e: unknown) {
    console.error("[sincronizacion]", mensaje(e));
    return fail(res, mensaje(e), 500);
  }
}

// ── Configuración y estado ───────────────────────────────────────────────────
async function leerFilas(): Promise<Record<string, unknown>> {
  const { data, error } = await getSupabaseAdmin()
    .from("tienda_configuracion")
    .select("clave, valor")
    .in("clave", ["dolar_automatico", "sincronizacion_elit", "sincronizacion_newbytes", "sincronizacion_ultima"]);
  if (error) throw new Error(`No se pudo leer la configuración: ${error.message}`);
  const valores: Record<string, unknown> = {};
  for (const fila of (data ?? []) as Array<{ clave: string; valor: unknown }>) valores[fila.clave] = fila.valor;
  return valores;
}

function configuracionDe(valores: Record<string, unknown>): ConfiguracionAutomatica {
  const dolar = (valores.dolar_automatico ?? {}) as { activo?: unknown; tipo?: unknown };
  const elit = (valores.sincronizacion_elit ?? {}) as { activa?: unknown };
  const newbytes = (valores.sincronizacion_newbytes ?? {}) as { activa?: unknown };
  return {
    dolar: { activo: dolar.activo !== false, tipo: dolar.tipo === "divisa" ? "divisa" : "billete" },
    elit: { activa: elit.activa !== false },
    newbytes: { activa: newbytes.activa !== false },
  };
}

function ultimaDe(valores: Record<string, unknown>): Corrida | null {
  const ultima = valores.sincronizacion_ultima as Partial<Corrida> | null | undefined;
  return ultima && typeof ultima.empezo === "string" ? (ultima as Corrida) : null;
}

async function estado(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  if (!(await esAdmin(req)).admin) return fail(res, "Solo para administradores", 403);
  const valores = await leerFilas();
  return ok(res, estadoPublico(valores));
}

function estadoPublico(valores: Record<string, unknown>) {
  return {
    configuracion: configuracionDe(valores),
    ultima: ultimaDe(valores),
    credenciales_elit: hayCredencialesDeElit(),
    credenciales_newbytes: hayCredencialesDeNewBytes(),
  };
}

async function configuracion(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "PATCH") return methodNotAllowed(res, ["PATCH"]);
  const { admin, userId } = await esAdmin(req);
  if (!admin) return fail(res, "Solo para administradores", 403);

  const cuerpo = (req.body ?? {}) as { dolar?: { activo?: unknown; tipo?: unknown }; elit?: { activa?: unknown }; newbytes?: { activa?: unknown } };
  const actual = configuracionDe(await leerFilas());
  const cambios: Array<{ clave: string; valor: unknown }> = [];
  if (cuerpo.dolar) {
    const tipo = cuerpo.dolar.tipo ?? actual.dolar.tipo;
    if (tipo !== "billete" && tipo !== "divisa") return fail(res, "El dólar automático toma billete o divisa.");
    const activo = typeof cuerpo.dolar.activo === "boolean" ? cuerpo.dolar.activo : actual.dolar.activo;
    cambios.push({ clave: "dolar_automatico", valor: { activo, tipo } });
  }
  if (cuerpo.elit) {
    const activa = typeof cuerpo.elit.activa === "boolean" ? cuerpo.elit.activa : actual.elit.activa;
    cambios.push({ clave: "sincronizacion_elit", valor: { activa } });
  }
  if (cuerpo.newbytes) {
    const activa = typeof cuerpo.newbytes.activa === "boolean" ? cuerpo.newbytes.activa : actual.newbytes.activa;
    cambios.push({ clave: "sincronizacion_newbytes", valor: { activa } });
  }
  if (cambios.length === 0) return fail(res, "No hay nada para cambiar.");

  const supabase = getSupabaseAdmin();
  for (const cambio of cambios) {
    const { error } = await supabase
      .from("tienda_configuracion")
      .update({ valor: cambio.valor, actualizado_en: new Date().toISOString(), actualizado_por: userId })
      .eq("clave", cambio.clave);
    if (error) throw new Error(`No se pudo guardar la configuración: ${error.message}`);
  }
  return ok(res, estadoPublico(await leerFilas()));
}

// ── Corrida ──────────────────────────────────────────────────────────────────
async function correr(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") return methodNotAllowed(res, ["GET", "POST"]);
  const delCron = esElCron(req);
  if (!delCron && !(await esAdmin(req)).admin) return fail(res, "Solo para administradores", 403);

  const inicio = Date.now();
  const valores = await leerFilas();
  const config = configuracionDe(valores);
  const anterior = ultimaDe(valores);

  const [dolar, { resultado: elit, completa }, newbytes] = await Promise.all([
    config.dolar.activo ? actualizarDolar(config.dolar.tipo) : Promise.resolve<ResultadoDelDolar>({ estado: "apagado" }),
    config.elit.activa ? sincronizarElit(anterior, inicio + TIEMPO_PARA_CONSULTAR_MS) : Promise.resolve({ resultado: elitVacia("apagada"), completa: false }),
    config.newbytes.activa ? sincronizarNewBytes() : Promise.resolve(elitVacia("apagada")),
  ]);

  let recalculados: number | null = null;
  let errorRecalculo: string | undefined;
  const { data, error } = await getSupabaseAdmin().rpc("recalcular_precios");
  if (error) errorRecalculo = error.message;
  else recalculados = Number(data ?? 0);

  // Lo que entró de New Bytes sin descripción la toma acá, si queda tiempo.
  const descripcionesNuevas =
    config.newbytes.activa && hayCredencialesDeNewBytes() && Date.now() - inicio < 25_000 ? await completarDescripcionesNewBytes() : undefined;

  const corrida: Corrida = {
    empezo: new Date(inicio).toISOString(),
    termino: new Date().toISOString(),
    disparada_por: delCron ? "cron" : "panel",
    dolar,
    elit,
    newbytes,
    recalculados,
    ...(errorRecalculo ? { error_recalculo: errorRecalculo } : {}),
    ...(descripcionesNuevas ? { descripciones: descripcionesNuevas } : {}),
    elit_hasta: completa ? new Date(inicio).toISOString() : anterior?.elit_hasta,
  };
  const { error: errorAlGuardar } = await getSupabaseAdmin()
    .from("tienda_configuracion")
    .update({ valor: corrida, actualizado_en: corrida.termino })
    .eq("clave", "sincronizacion_ultima");
  if (errorAlGuardar) console.error("[sincronizacion] No se pudo guardar el resultado:", errorAlGuardar.message);

  return ok(res, corrida);
}

async function actualizarDolar(tipo: TipoDeDolar): Promise<ResultadoDelDolar> {
  try {
    const cotizacion = await consultarDolarBna(tipo);
    const supabase = getSupabaseAdmin();
    const { data: vigente, error } = await supabase
      .from("cotizacion_dolar")
      .select("valor")
      .order("vigente_desde", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);

    const anterior = vigente ? Number((vigente as { valor: unknown }).valor) : null;
    const base = { valor: cotizacion.venta, anterior, fecha: cotizacion.fecha, origen: cotizacion.origen };
    if (anterior !== null && Math.abs(anterior - cotizacion.venta) < 0.005) return { estado: "sin_cambios", ...base };
    if (anterior !== null && anterior > 0 && Math.abs(cotizacion.venta - anterior) / anterior > VARIACION_MAXIMA_DEL_DOLAR) {
      return { estado: "error", ...base, error: "El valor leído se aleja más de un 25 % del vigente: no se aplicó. Cargalo a mano si es correcto." };
    }

    const fuente = cotizacion.origen === "bna" ? "BNA" : "BNA vía dolarapi.com";
    const nota = `${fuente}, ${tipo} venta${cotizacion.fecha ? ` del ${cotizacion.fecha}` : ""}`;
    const { error: errorAlCargar } = await supabase.from("cotizacion_dolar").insert({ valor: cotizacion.venta, fuente: "api", nota });
    if (errorAlCargar) throw new Error(errorAlCargar.message);
    return { estado: "actualizado", ...base };
  } catch (e: unknown) {
    console.error("[sincronizacion] Dólar:", mensaje(e));
    return { estado: "error", error: mensaje(e) };
  }
}

const elitVacia = (estado: ResultadoDeMayorista["estado"], error?: string): ResultadoDeMayorista => ({
  estado,
  vinculados: 0,
  revisados: 0,
  productos_cambiados: 0,
  no_encontrados: 0,
  ...(error ? { error } : {}),
});

async function enTandas<T>(items: T[], aLaVez: number, tarea: (item: T) => Promise<void>): Promise<void> {
  let siguiente = 0;
  const trabajadores = Array.from({ length: Math.min(aLaVez, items.length) }, async () => {
    while (siguiente < items.length) {
      const item = items[siguiente];
      siguiente += 1;
      await tarea(item);
    }
  });
  await Promise.all(trabajadores);
}

async function sincronizarElit(anterior: Corrida | null, hasta: number): Promise<{ resultado: ResultadoDeMayorista; completa: boolean }> {
  if (!hayCredencialesDeElit()) return { resultado: elitVacia("sin_credenciales", "Faltan ELIT_API_USER_ID y ELIT_API_TOKEN en Vercel."), completa: false };
  try {
    const supabase = getSupabaseAdmin();
    const { data: proveedor, error: errorProveedor } = await supabase.from("suppliers").select("id").ilike("name", "ELIT").maybeSingle();
    if (errorProveedor) throw new Error(errorProveedor.message);
    if (!proveedor) return { resultado: elitVacia("ok"), completa: true };

    const { data, error } = await supabase
      .from("product_suppliers")
      .select("id, product_id, supplier_id, external_id, cost_price, stock_available, active, last_synced_at")
      .eq("supplier_id", (proveedor as { id: string }).id);
    if (error) throw new Error(error.message);
    const filas = (data ?? []) as FilaDeProveedor[];
    const porExterno = new Map(filas.filter((f) => f.external_id).map((f) => [String(f.external_id), f]));
    if (porExterno.size === 0) return { resultado: elitVacia("ok"), completa: true };

    // 1. Lo que ELIT cambió desde la última corrida completa.
    const ultimaVez = anterior?.elit_hasta ? Date.parse(anterior.elit_hasta) : Number.NaN;
    const desde = new Date((Number.isFinite(ultimaVez) ? ultimaVez : Date.now() - PRIMERA_VEZ_DESDE_MS) - MARGEN_DEL_FILTRO_MS);
    const cambios = await productosCambiadosDesde(desde, hasta);
    const vistos = new Map<string, ProductoElit>();
    for (const producto of cambios.productos) {
      const id = String(producto.id);
      if (porExterno.has(id)) vistos.set(id, producto);
    }

    // 2. Repaso por id de las filas más viejas que no aparecieron entre los cambios.
    const limite = Date.now() - REPASO_DESPUES_DE_MS;
    const viejas = filas
      .filter((f) => f.external_id && !vistos.has(String(f.external_id)) && (!f.last_synced_at || Date.parse(f.last_synced_at) < limite))
      .sort((a, b) => (a.last_synced_at ?? "").localeCompare(b.last_synced_at ?? ""))
      .slice(0, REPASO_MAXIMO);
    let noEncontrados = 0;
    let repasoCompleto = true;
    await enTandas(viejas, CONSULTAS_A_LA_VEZ, async (fila) => {
      if (Date.now() > hasta) {
        repasoCompleto = false;
        return;
      }
      try {
        const producto = await productoPorId(String(fila.external_id));
        if (producto) vistos.set(String(fila.external_id), producto);
        else noEncontrados += 1;
      } catch (e: unknown) {
        console.error("[sincronizacion] ELIT por id:", mensaje(e));
      }
    });

    // 3. Guardar las filas revisadas y pasar costo y stock a los productos que cambiaron.
    const ahora = new Date().toISOString();
    const cambiados = new Set<number>();
    const nuevas = [...vistos].map(([externo, producto]) => {
      const fila = porExterno.get(externo)!;
      const campos = camposDeElit(producto);
      if (Number(fila.cost_price ?? 0) !== campos.cost_price || (fila.stock_available ?? 0) !== campos.stock_available || fila.active !== campos.active) {
        cambiados.add(fila.product_id);
      }
      return { id: fila.id, product_id: fila.product_id, supplier_id: fila.supplier_id, ...campos, last_synced_at: ahora, updated_at: ahora };
    });
    for (let i = 0; i < nuevas.length; i += 200) {
      const { error: errorAlGuardar } = await supabase.from("product_suppliers").upsert(nuevas.slice(i, i + 200), { onConflict: "id" });
      if (errorAlGuardar) throw new Error(`No se pudieron guardar las filas de ELIT: ${errorAlGuardar.message}`);
    }
    if (cambiados.size > 0) {
      const { error: errorAlPasar } = await supabase.rpc("reconciliar_costos_y_stock", { p_ids: [...cambiados] });
      if (errorAlPasar) throw new Error(`No se pudieron pasar costo y stock a los productos: ${errorAlPasar.message}`);
    }

    // elit_hasta solo avanza si la consulta de cambios terminó completa; el repaso por id va aparte,
    // guiado por last_synced_at, y si se corta sigue en la próxima corrida.
    return {
      resultado: {
        estado: cambios.completo && repasoCompleto ? "ok" : "parcial",
        vinculados: porExterno.size,
        revisados: nuevas.length,
        productos_cambiados: cambiados.size,
        no_encontrados: noEncontrados,
      },
      completa: cambios.completo,
    };
  } catch (e: unknown) {
    console.error("[sincronizacion] ELIT:", mensaje(e));
    return { resultado: elitVacia("error", mensaje(e)), completa: false };
  }
}

async function filasDelProveedor(nombreNormalizado: string): Promise<FilaDeProveedor[]> {
  const supabase = getSupabaseAdmin();
  const { data: proveedores, error: errorProveedor } = await supabase.from("suppliers").select("id, name");
  if (errorProveedor) throw new Error(errorProveedor.message);
  const normalizar = (texto: string) => texto.toLowerCase().replace(/\s+/g, "");
  const proveedor = ((proveedores ?? []) as Array<{ id: string; name: string }>).find((p) => normalizar(p.name) === nombreNormalizado);
  if (!proveedor) return [];
  const { data, error } = await supabase
    .from("product_suppliers")
    .select("id, product_id, supplier_id, external_id, cost_price, stock_available, active, last_synced_at")
    .eq("supplier_id", proveedor.id);
  if (error) throw new Error(error.message);
  return (data ?? []) as FilaDeProveedor[];
}

/**
 * New Bytes manda el catálogo entero en una consulta: se actualizan todas las filas vinculadas, y la que
 * ya no aparece en el catálogo queda sin stock (conserva el último costo).
 */
async function sincronizarNewBytes(): Promise<ResultadoDeMayorista> {
  if (!hayCredencialesDeNewBytes()) return elitVacia("sin_credenciales", "Faltan NB_API_USER y NB_API_PASSWORD en Vercel.");
  try {
    const vinculadas = (await filasDelProveedor("newbytes")).filter((f) => f.external_id);
    if (vinculadas.length === 0) return elitVacia("ok");

    const catalogo = await catalogoDeNewBytes();
    if (catalogo.length === 0) throw new Error("New Bytes devolvió el catálogo vacío: no se tocó nada.");
    const porId = new Map(catalogo.map((p) => [String(p.id), p]));

    const ahora = new Date().toISOString();
    const cambiados = new Set<number>();
    const encontradas: Array<Record<string, unknown>> = [];
    const faltantes: Array<Record<string, unknown>> = [];
    for (const fila of vinculadas) {
      const producto = porId.get(String(fila.external_id));
      const base = { id: fila.id, product_id: fila.product_id, supplier_id: fila.supplier_id, last_synced_at: ahora, updated_at: ahora };
      if (producto) {
        const campos = camposDeNewBytes(producto);
        if (Number(fila.cost_price ?? 0) !== campos.cost_price || (fila.stock_available ?? 0) !== campos.stock_available || fila.active !== campos.active) {
          cambiados.add(fila.product_id);
        }
        encontradas.push({ ...base, ...campos });
      } else {
        if ((fila.stock_available ?? 0) !== 0) cambiados.add(fila.product_id);
        faltantes.push({ ...base, stock_available: 0 });
      }
    }

    const supabase = getSupabaseAdmin();
    // Dos tandas aparte: un upsert con columnas distintas por fila pondría en nulo las que faltan.
    for (const tanda of [encontradas, faltantes]) {
      for (let i = 0; i < tanda.length; i += 200) {
        const { error } = await supabase.from("product_suppliers").upsert(tanda.slice(i, i + 200), { onConflict: "id" });
        if (error) throw new Error(`No se pudieron guardar las filas de New Bytes: ${error.message}`);
      }
    }
    if (cambiados.size > 0) {
      const { error } = await supabase.rpc("reconciliar_costos_y_stock", { p_ids: [...cambiados] });
      if (error) throw new Error(`No se pudieron pasar costo y stock a los productos: ${error.message}`);
    }
    return {
      estado: "ok",
      vinculados: vinculadas.length,
      revisados: encontradas.length,
      productos_cambiados: cambiados.size,
      no_encontrados: faltantes.length,
    };
  } catch (e: unknown) {
    console.error("[sincronizacion] New Bytes:", mensaje(e));
    return elitVacia("error", mensaje(e));
  }
}

// ── Descripciones de New Bytes ────────────────────────────────────────────────
interface ResultadoDeDescripciones {
  estado: "ok" | "sin_credenciales" | "error";
  sin_descripcion: number;
  completadas: number;
  sin_texto_en_new_bytes: number;
  error?: string;
}

const sinTexto = (valor: unknown) => {
  const t = typeof valor === "string" ? valor.trim() : "";
  return !t || t === "-" || /^part#:/i.test(t);
};

/**
 * Completa la descripción de los productos vinculados a New Bytes que no tienen, con el texto que
 * New Bytes genera para las tiendas de sus clientes. No pisa una descripción cargada a mano.
 */
async function completarDescripcionesNewBytes(): Promise<ResultadoDeDescripciones> {
  const vacio = { sin_descripcion: 0, completadas: 0, sin_texto_en_new_bytes: 0 };
  if (!hayCredencialesDeNewBytes()) return { estado: "sin_credenciales", ...vacio, error: "Faltan NB_API_USER y NB_API_PASSWORD en Vercel." };
  try {
    const vinculadas = (await filasDelProveedor("newbytes")).filter((f) => f.external_id);
    if (vinculadas.length === 0) return { estado: "ok", ...vacio };
    const supabase = getSupabaseAdmin();
    const pendientes: Array<{ id: number; externo: string; specs: Record<string, unknown> | null }> = [];
    for (let i = 0; i < vinculadas.length; i += 300) {
      const tanda = vinculadas.slice(i, i + 300);
      const { data, error } = await supabase.from("products").select("id, description, description_full, specs").in("id", tanda.map((f) => f.product_id));
      if (error) throw new Error(error.message);
      const externoDe = new Map(tanda.map((f) => [f.product_id, String(f.external_id)]));
      for (const p of (data ?? []) as Array<{ id: number; description: string | null; description_full: string | null; specs: Record<string, unknown> | null }>) {
        if (sinTexto(p.description_full) && sinTexto(p.description)) pendientes.push({ id: p.id, externo: externoDe.get(p.id)!, specs: p.specs });
      }
    }
    if (pendientes.length === 0) return { estado: "ok", ...vacio };

    const textos = await descripcionesDeNewBytes();
    let completadas = 0;
    let sinTextoEnNewBytes = 0;
    await enTandas(pendientes, 8, async (p) => {
      const crudo = textos.get(p.externo);
      const texto = crudo ? textoDeDescripcion(crudo) : "";
      if (!texto) {
        sinTextoEnNewBytes += 1;
        return;
      }
      const { error } = await supabase
        .from("products")
        .update({ description_full: texto, specs: { ...(p.specs ?? {}), supplier_description: crudo }, updated_at: new Date().toISOString() })
        .eq("id", p.id);
      if (error) console.error("[sincronizacion] Descripción de", p.id, error.message);
      else completadas += 1;
    });
    return { estado: "ok", sin_descripcion: pendientes.length, completadas, sin_texto_en_new_bytes: sinTextoEnNewBytes };
  } catch (e: unknown) {
    console.error("[sincronizacion] Descripciones de New Bytes:", mensaje(e));
    return { estado: "error", ...vacio, error: mensaje(e) };
  }
}

async function descripciones(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") return methodNotAllowed(res, ["GET", "POST"]);
  if (!esElCron(req) && !(await esAdmin(req)).admin) return fail(res, "Solo para administradores", 403);
  return ok(res, await completarDescripcionesNewBytes());
}
