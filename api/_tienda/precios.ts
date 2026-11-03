import type { VercelRequest, VercelResponse } from "@vercel/node";

import { consultarCuotas, hayMercadoPago, SIN_DATOS } from "../_shared/cuotas.js";
import { fail, methodNotAllowed, ok } from "../_shared/http.js";
import { getRoleFromRequest } from "../_shared/roles.js";
import { getSupabaseAdmin, getSupabaseClient } from "../_shared/supabaseServer.js";

/**
 * Precios de la tienda, en servidor.
 *   GET   /api/precios?recurso=cuotas&monto=N   público: las cuotas de Mercado Pago para un monto en pesos
 *   GET   /api/precios?recurso=dolar            admin: dólar vigente, historial y configuración
 *   POST  /api/precios?recurso=dolar            admin: cargar un dólar nuevo (recalcula todos los precios)
 *   PATCH /api/precios?recurso=configuracion    admin: margen base, redondeo y cuotas máximas (recalcula)
 *   GET/POST /api/precios?recurso=recalcular    admin o el cron de Vercel (CRON_SECRET): recalcular todo
 */

export const config = { maxDuration: 60 };

const CLAVES_DE_CONFIGURACION = ["margen_base", "redondeo_pesos", "cuotas_maximas", "envio_gratis_desde", "peso_por_defecto_kg"] as const;
type ClaveDeConfiguracion = (typeof CLAVES_DE_CONFIGURACION)[number];

interface FilaDeConfiguracion {
  clave: string;
  valor: unknown;
  descripcion: string | null;
  actualizado_en: string;
}

let configuracionGuardada: { valores: Record<string, unknown>; en: number } | null = null;
const CONFIGURACION_VIGENCIA_MS = 5 * 60_000;

async function leerConfiguracion(): Promise<Record<string, unknown>> {
  const ahora = Date.now();
  if (configuracionGuardada && ahora - configuracionGuardada.en < CONFIGURACION_VIGENCIA_MS) return configuracionGuardada.valores;
  const { data, error } = await getSupabaseAdmin().from("tienda_configuracion").select("clave, valor");
  if (error) throw new Error(`No se pudo leer la configuración: ${error.message}`);
  const valores: Record<string, unknown> = {};
  for (const fila of (data ?? []) as Array<{ clave: string; valor: unknown }>) valores[fila.clave] = fila.valor;
  configuracionGuardada = { valores, en: ahora };
  return valores;
}

async function quienPide(req: VercelRequest): Promise<{ admin: boolean; userId: string | null }> {
  const supabase = getSupabaseClient(req);
  const rol = await getRoleFromRequest(req, supabase);
  const bearer = req.headers.authorization;
  const token = bearer?.startsWith("Bearer ") ? bearer.slice(7) : undefined;
  const userId = token ? ((await supabase.auth.getUser(token)).data.user?.id ?? null) : null;
  return { admin: rol === "admin", userId };
}

/** Con VERCEL_DEPLOY_HOOK_URL, un cambio de precios dispara un despliegue que vuelve a prerenderizar las fichas. */
async function pedirDespliegue(motivo: string): Promise<void> {
  const hook = process.env.VERCEL_DEPLOY_HOOK_URL?.trim();
  if (!hook) return;
  try {
    await fetch(hook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ motivo }) });
  } catch (e: unknown) {
    console.error("[precios] No se pudo pedir el despliegue:", e instanceof Error ? e.message : e);
  }
}

function esElCron(req: VercelRequest): boolean {
  const secreto = process.env.CRON_SECRET?.trim();
  return Boolean(secreto) && req.headers.authorization === `Bearer ${secreto}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const recurso = String(req.query.recurso ?? "");
  try {
    switch (recurso) {
      case "cuotas":
        return await cuotas(req, res);
      case "dolar":
        return await dolar(req, res);
      case "configuracion":
        return await configuracionDePrecios(req, res);
      case "recalcular":
        return await recalcular(req, res);
      default:
        return fail(res, "Recurso desconocido", 404);
    }
  } catch (e: unknown) {
    const mensaje = e instanceof Error ? e.message : "Error inesperado";
    console.error("[precios]", mensaje);
    return fail(res, mensaje, 500);
  }
}

// ── Cuotas (público) ─────────────────────────────────────────────────────────
async function cuotas(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  const monto = Number(req.query.monto);
  if (!Number.isFinite(monto) || monto <= 0 || monto > 1_000_000_000) return fail(res, "Falta un monto válido en pesos.");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
  if (!hayMercadoPago()) return ok(res, SIN_DATOS);
  const valores = await leerConfiguracion();
  const tope = valores.cuotas_maximas;
  const cuotasMaximas = typeof tope === "number" && Number.isInteger(tope) ? tope : 99;
  const minutos = Number(process.env.CUOTAS_CACHE_MINUTOS) > 0 ? Number(process.env.CUOTAS_CACHE_MINUTOS) : 30;
  return ok(res, await consultarCuotas(Math.round(monto * 100) / 100, cuotasMaximas, minutos));
}

// ── Dólar (admin) ────────────────────────────────────────────────────────────
async function estadoDelDolar() {
  const admin = getSupabaseAdmin();
  const [{ data: historial, error: errorHistorial }, { data: config, error: errorConfig }] = await Promise.all([
    admin.from("cotizacion_dolar").select("id, valor, fuente, nota, vigente_desde, cargado_por").order("vigente_desde", { ascending: false }).order("id", { ascending: false }).limit(30),
    admin.from("tienda_configuracion").select("clave, valor, descripcion, actualizado_en").in("clave", [...CLAVES_DE_CONFIGURACION]),
  ]);
  if (errorHistorial) throw new Error(errorHistorial.message);
  if (errorConfig) throw new Error(errorConfig.message);
  const { count } = await admin.from("products").select("id", { count: "exact", head: true }).eq("active", true).is("precio_final_ars", null);
  return {
    vigente: historial?.[0] ?? null,
    historial: historial ?? [],
    configuracion: (config ?? []) as FilaDeConfiguracion[],
    sin_precio: count ?? 0,
  };
}

async function dolar(req: VercelRequest, res: VercelResponse) {
  const { admin, userId } = await quienPide(req);
  if (!admin) return fail(res, "Solo para administradores", 403);

  if (req.method === "GET") return ok(res, await estadoDelDolar());

  if (req.method === "POST") {
    const cuerpo = (req.body ?? {}) as { valor?: unknown; nota?: unknown };
    const valor = Number(cuerpo.valor);
    if (!Number.isFinite(valor) || valor <= 0 || valor > 1_000_000) return fail(res, "El dólar tiene que ser un número mayor que cero.");
    const nota = typeof cuerpo.nota === "string" ? cuerpo.nota.trim().slice(0, 200) : null;
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("cotizacion_dolar").insert({ valor, fuente: "manual", nota, cargado_por: userId });
    if (error) throw new Error(`No se pudo guardar el dólar: ${error.message}`);
    configuracionGuardada = null;
    const { data: recalculados, error: errorRecalculo } = await supabase.rpc("recalcular_precios");
    if (errorRecalculo) throw new Error(`Se guardó el dólar pero falló el recálculo: ${errorRecalculo.message}`);
    void pedirDespliegue("dolar");
    return ok(res, { ...(await estadoDelDolar()), recalculados: Number(recalculados ?? 0) });
  }

  return methodNotAllowed(res, ["GET", "POST"]);
}

// ── Configuración de precios (admin) ─────────────────────────────────────────
function validarValor(clave: ClaveDeConfiguracion, valor: unknown): number | null {
  if (clave === "envio_gratis_desde") {
    if (valor === null || valor === "" || valor === undefined) return null;
    const n = Number(valor);
    if (!Number.isFinite(n) || n < 0) throw new Error("El envío gratis se define con un subtotal en pesos, o vacío para nunca.");
    return n;
  }
  if (clave === "peso_por_defecto_kg") {
    const n = Number(valor);
    if (!Number.isFinite(n) || n <= 0 || n > 1000) throw new Error("El peso por defecto va de 0,001 a 1000 kg.");
    return n;
  }
  if (clave === "cuotas_maximas") {
    if (valor === null || valor === "" || valor === undefined) return null;
    const n = Number(valor);
    if (!Number.isInteger(n) || n < 1 || n > 99) throw new Error("Las cuotas máximas van de 1 a 99, o vacío para no poner tope.");
    return n;
  }
  const n = Number(valor);
  if (!Number.isFinite(n)) throw new Error(`${clave} tiene que ser un número.`);
  if (clave === "margen_base" && (n < 0 || n > 500)) throw new Error("El margen base va de 0 a 500 %.");
  if (clave === "redondeo_pesos" && (n < 1 || n > 100_000)) throw new Error("El redondeo va de 1 a 100.000 pesos.");
  return n;
}

async function configuracionDePrecios(req: VercelRequest, res: VercelResponse) {
  const { admin, userId } = await quienPide(req);
  if (!admin) return fail(res, "Solo para administradores", 403);
  if (req.method !== "PATCH") return methodNotAllowed(res, ["PATCH"]);

  const cuerpo = (req.body ?? {}) as Partial<Record<ClaveDeConfiguracion, unknown>>;
  const cambios = CLAVES_DE_CONFIGURACION.filter((clave) => clave in cuerpo);
  if (cambios.length === 0) return fail(res, "No hay nada para cambiar.");

  const supabase = getSupabaseAdmin();
  for (const clave of cambios) {
    const valor = validarValor(clave, cuerpo[clave]);
    const { error } = await supabase
      .from("tienda_configuracion")
      .update({ valor: valor === null ? null : valor, actualizado_en: new Date().toISOString(), actualizado_por: userId })
      .eq("clave", clave);
    if (error) throw new Error(`No se pudo guardar ${clave}: ${error.message}`);
  }
  configuracionGuardada = null;
  return ok(res, await estadoDelDolar());
}

// ── Recalcular (admin o cron) ────────────────────────────────────────────────
async function recalcular(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") return methodNotAllowed(res, ["GET", "POST"]);
  if (!esElCron(req)) {
    const { admin } = await quienPide(req);
    if (!admin) return fail(res, "Solo para administradores", 403);
  }
  const { data, error } = await getSupabaseAdmin().rpc("recalcular_precios");
  if (error) throw new Error(`No se pudieron recalcular los precios: ${error.message}`);
  void pedirDespliegue("recalculo");
  return ok(res, { recalculados: Number(data ?? 0), en: new Date().toISOString() });
}
