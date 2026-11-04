import type { VercelRequest, VercelResponse } from "@vercel/node";

import { fail, methodNotAllowed, ok } from "../_shared/http.js";
import { configuracionDeMercadoPago, crearPreferencia, firmaValida, obtenerPago, reintegrar as reintegrarEnMercadoPago } from "../_shared/mercadopago.js";
import { getRoleFromRequest } from "../_shared/roles.js";
import { getSupabaseAdmin, getSupabaseClient } from "../_shared/supabaseServer.js";
import { avisarAlComprador } from "../_shared/avisos.js";

/**
 * Pagos de la tienda.
 *   GET   ?recurso=medios                       público: los medios activos (Mercado Pago solo si está configurado)
 *   POST  ?recurso=preferencia {id, token}      público: el enlace de pago de Mercado Pago para una compra
 *   POST  ?recurso=aviso                        Mercado Pago: el aviso firmado; el único camino a "pagado" para ese medio
 *   GET   ?recurso=transferencia&id&token       público: la cuenta para transferir y el plazo
 *   GET   ?recurso=lista                        panel: pedidos de la tienda con sus pagos
 *   POST  ?recurso=validar {order_id}           admin: confirma una transferencia (único camino a "pagado" para ese medio)
 *   POST  ?recurso=cancelar {order_id, motivo}  admin: cancela un pedido pendiente y libera el stock
 *   POST  ?recurso=reintegrar {pago_id, monto?} admin: reintegro total o parcial
 *   GET/PATCH ?recurso=configuracion            admin: cuenta bancaria, medios activos, margen por medio y plazo de vencimiento
 *   GET/POST ?recurso=vencer                    admin o cron: vence los pedidos pendientes que pasaron el plazo
 */

export const config = { maxDuration: 30 };

interface PedidoParaPagar {
  id: number;
  order_number: string;
  total: number;
  status: string;
  payment_method: string | null;
  comprador_email: string | null;
  comprador_nombre: string | null;
  token_acceso: string | null;
  created_at: string;
}

interface FilaDePago {
  id: number;
  order_id: number;
  proveedor: "mercadopago" | "transferencia";
  estado: string;
  monto: number;
  id_externo: string | null;
  referencia: string | null;
  detalle: Record<string, unknown>;
  reintegrado_monto: number;
  reintegro_clave: string | null;
}

interface ConfiguracionDeTransferencia {
  titular: string | null;
  cuit: string | null;
  banco: string | null;
  cbu: string | null;
  alias: string | null;
}

const intentos = new Map<string, number[]>();
function excedeLaTasa(clave: string, porMinuto: number): boolean {
  const ahora = Date.now();
  const recientes = (intentos.get(clave) ?? []).filter((t) => ahora - t < 60_000);
  recientes.push(ahora);
  intentos.set(clave, recientes);
  return recientes.length > porMinuto;
}

const ipDe = (req: VercelRequest): string => String(req.headers["x-forwarded-for"] ?? req.socket?.remoteAddress ?? "").split(",")[0].trim();

function sitio(): string {
  const base = (process.env.VITE_SITE_URL?.trim() || process.env.API_ALLOWED_ORIGIN?.split(",")[0]?.trim() || "").replace(/\/$/, "");
  if (!base) throw new Error("Falta VITE_SITE_URL: la tienda no sabe su propia dirección para volver de Mercado Pago.");
  return base;
}

async function quienPide(req: VercelRequest): Promise<{ admin: boolean; panel: boolean; userId: string | null }> {
  const supabase = getSupabaseClient(req);
  const rol = await getRoleFromRequest(req, supabase);
  const bearer = req.headers.authorization;
  const token = bearer?.startsWith("Bearer ") ? bearer.slice(7) : undefined;
  const userId = token ? ((await supabase.auth.getUser(token)).data.user?.id ?? null) : null;
  return { admin: rol === "admin", panel: rol === "admin" || rol === "vendedor" || rol === "sales", userId };
}

function esElCron(req: VercelRequest): boolean {
  const secreto = process.env.CRON_SECRET?.trim();
  return Boolean(secreto) && req.headers.authorization === `Bearer ${secreto}`;
}

async function leerConfiguracion(claves: string[]): Promise<Record<string, unknown>> {
  const { data, error } = await getSupabaseAdmin().from("tienda_configuracion").select("clave, valor").in("clave", claves);
  if (error) throw new Error(error.message);
  const valores: Record<string, unknown> = {};
  for (const fila of (data ?? []) as Array<{ clave: string; valor: unknown }>) valores[fila.clave] = fila.valor;
  return valores;
}

async function pedidoConToken(id: unknown, token: unknown): Promise<PedidoParaPagar> {
  const numero = Number(id);
  if (!Number.isInteger(numero) || typeof token !== "string" || !/^[0-9a-f]{48}$/.test(token)) throw new Error("La compra no es válida.");
  const { data, error } = await getSupabaseAdmin()
    .from("orders")
    .select("id, order_number, total, status, payment_method, comprador_email, comprador_nombre, token_acceso, created_at")
    .eq("id", numero)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const pedido = data as PedidoParaPagar | null;
  if (!pedido || pedido.token_acceso !== token) throw new Error("No encontramos esa compra.");
  return pedido;
}

async function registrarActividad(userId: string | null, accion: string, entidadId: string, metadata: Record<string, unknown>): Promise<void> {
  await getSupabaseAdmin().from("activity_logs").insert({ user_id: userId, action: accion, entity_type: "order", entity_id: entidadId, metadata });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const recurso = String(req.query.recurso ?? "");
  try {
    switch (recurso) {
      case "medios":
        return await medios(req, res);
      case "preferencia":
        return await preferencia(req, res);
      case "aviso":
        return await aviso(req, res);
      case "transferencia":
        return await transferencia(req, res);
      case "lista":
        return await lista(req, res);
      case "validar":
        return await validar(req, res);
      case "cancelar":
        return await cancelar(req, res);
      case "reintegrar":
        return await reintegrar(req, res);
      case "configuracion":
        return await configuracion(req, res);
      case "vencer":
        return await vencer(req, res);
      default:
        return fail(res, "Recurso desconocido", 404);
    }
  } catch (e: unknown) {
    const mensaje = e instanceof Error ? e.message : "Error inesperado";
    console.error("[pagos]", recurso, mensaje);
    return fail(res, mensaje, 500);
  }
}

// ── Medios activos ──────────────────────────────────────────────────────────
// El margen de cada medio no sale acá: con el margen y el precio se podría calcular el costo.
async function mediosActivos(): Promise<Array<{ id: string; nombre: string; detalle: string }>> {
  const { data, error } = await getSupabaseAdmin().from("medios_de_pago").select("id, nombre, detalle, activo, orden").order("orden");
  if (error) throw new Error(error.message);
  const hayMercadoPago = configuracionDeMercadoPago() !== null;
  return ((data ?? []) as Array<{ id: string; nombre: string; detalle: string; activo: boolean }>)
    .filter((m) => m.activo && (m.id !== "mercadopago" || hayMercadoPago))
    .map(({ id, nombre, detalle }) => ({ id, nombre, detalle }));
}

async function medios(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  return ok(res, await mediosActivos());
}

// ── Mercado Pago: la preferencia ────────────────────────────────────────────
async function preferencia(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  if (excedeLaTasa(`preferencia|${ipDe(req)}`, 20)) return fail(res, "Demasiados intentos. Esperá un minuto.", 429);
  const config = configuracionDeMercadoPago();
  if (!config) return fail(res, "Mercado Pago no está disponible en este momento.", 503);
  const cuerpo = (req.body ?? {}) as { id?: unknown; token?: unknown };
  let pedido: PedidoParaPagar;
  try {
    pedido = await pedidoConToken(cuerpo.id, cuerpo.token);
  } catch (e: unknown) {
    return fail(res, e instanceof Error ? e.message : "La compra no es válida.", 404);
  }
  if (pedido.status !== "pendiente_pago") return fail(res, "Esta compra ya no está pendiente de pago.", 409);
  if (pedido.payment_method !== "mercadopago") return fail(res, "Esta compra no se paga con Mercado Pago.", 409);

  const supabase = getSupabaseAdmin();
  const { data: existente } = await supabase
    .from("pagos")
    .select("id, referencia, detalle")
    .eq("order_id", pedido.id)
    .eq("proveedor", "mercadopago")
    .eq("estado", "pendiente")
    .order("creado_en", { ascending: false })
    .limit(1)
    .maybeSingle();
  const previo = existente as { id: number; referencia: string | null; detalle: Record<string, unknown> } | null;
  if (previo?.referencia && typeof previo.detalle?.url === "string") return ok(res, { url: previo.detalle.url });

  let pagoId = previo?.id;
  if (!pagoId) {
    const { data: creado, error } = await supabase
      .from("pagos")
      .insert({ order_id: pedido.id, proveedor: "mercadopago", estado: "pendiente", monto: pedido.total, moneda: "ARS" })
      .select("id")
      .single();
    if (error || !creado) throw new Error(`No se pudo anotar el intento de pago: ${error?.message ?? ""}`);
    pagoId = (creado as { id: number }).id;
  }

  const valores = await leerConfiguracion(["cuotas_maximas", "pendiente_vence_horas"]);
  const cuotasMaximas = typeof valores.cuotas_maximas === "number" ? valores.cuotas_maximas : 12;
  const venceHoras = typeof valores.pendiente_vence_horas === "number" ? valores.pendiente_vence_horas : null;
  const venceEn = venceHoras ? new Date(new Date(pedido.created_at).getTime() + venceHoras * 3_600_000) : null;
  if (venceEn && venceEn.getTime() < Date.now()) return fail(res, "Venció el plazo para pagar esta compra.", 409);

  const base = sitio();
  const creada = await crearPreferencia(config, {
    pagoId,
    numero: pedido.order_number,
    total: Number(pedido.total),
    email: pedido.comprador_email ?? "",
    vuelta: `${base}/compra/${pedido.id}?t=${pedido.token_acceso}`,
    aviso: `${base}/api/pagos?recurso=aviso`,
    cuotasMaximas,
    venceEn,
  });
  await supabase.from("pagos").update({ referencia: creada.id, detalle: { url: creada.url, preferencia: creada.id }, actualizado_en: new Date().toISOString() }).eq("id", pagoId);
  return ok(res, { url: creada.url });
}

// ── Mercado Pago: el aviso firmado ──────────────────────────────────────────
const ESTADO_DEL_PAGO: Record<string, string> = {
  approved: "aprobado",
  pending: "pendiente",
  in_process: "pendiente",
  authorized: "pendiente",
  rejected: "rechazado",
  cancelled: "cancelado",
  refunded: "reintegrado",
  charged_back: "reintegrado",
};

async function aviso(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  const config = configuracionDeMercadoPago();
  if (!config) return fail(res, "Mercado Pago no está configurado", 503);

  const cuerpo = (req.body ?? {}) as { type?: unknown; action?: unknown; data?: { id?: unknown } };
  const tipo = String(req.query.type ?? req.query.topic ?? cuerpo.type ?? "");
  const dataId = String(req.query["data.id"] ?? cuerpo.data?.id ?? "");
  if (tipo !== "payment" || !dataId) return ok(res, { resultado: "ignorado" });

  const firma = req.headers["x-signature"];
  const solicitud = req.headers["x-request-id"];
  const valida = firmaValida(
    { firma: Array.isArray(firma) ? firma[0] : firma, idDeSolicitud: Array.isArray(solicitud) ? solicitud[0] : solicitud, idDelRecurso: dataId },
    config.secreto,
  );
  if (!valida) {
    console.warn("[pagos] aviso con firma inválida", dataId);
    return fail(res, "Firma inválida", 401);
  }

  const supabase = getSupabaseAdmin();
  const pago = await obtenerPago(config, dataId);
  const claveDelAviso = `${pago.id}:${pago.estado}`;
  const { data: yaVisto } = await supabase.from("avisos_recibidos").select("id").eq("proveedor", "mercadopago").eq("id_externo", claveDelAviso).maybeSingle();
  if (yaVisto) return ok(res, { resultado: "repetido" });

  let resultado = "registrado";
  const referencia = Number(pago.referencia);
  const { data: filaCruda } = Number.isInteger(referencia)
    ? await supabase.from("pagos").select("id, order_id, proveedor, estado, monto, id_externo, referencia, detalle, reintegrado_monto, reintegro_clave").eq("id", referencia).maybeSingle()
    : { data: null };
  const fila = filaCruda as FilaDePago | null;

  if (!fila || fila.proveedor !== "mercadopago") {
    resultado = "ignorado_referencia";
  } else {
    const estadoNuevo = ESTADO_DEL_PAGO[pago.estado] ?? "pendiente";
    const montoCoincide = pago.monto !== null && Math.abs(pago.monto - Number(fila.monto)) < 1 && (pago.moneda === null || pago.moneda === "ARS");
    const nota = !montoCoincide && pago.estado === "approved" ? "revisar: el monto o la moneda no coinciden con el pedido" : null;
    const yaAprobado = fila.estado === "aprobado";
    await supabase
      .from("pagos")
      .update({
        id_externo: pago.id,
        estado: yaAprobado && estadoNuevo === "pendiente" ? "aprobado" : estadoNuevo,
        cuotas: pago.cuotas,
        detalle: { ...fila.detalle, ...pago.detalle, moneda: pago.moneda, monto_mercadopago: pago.monto },
        nota: nota ?? undefined,
        aprobado_en: pago.estado === "approved" ? new Date().toISOString() : undefined,
        actualizado_en: new Date().toISOString(),
      })
      .eq("id", fila.id);

    if (pago.estado === "approved" && montoCoincide) {
      const { data: marcado, error } = await supabase.rpc("tienda_marcar_pagado", { p_order_id: fila.order_id });
      if (error) throw new Error(`El pago está aprobado pero no se pudo marcar el pedido: ${error.message}`);
      resultado = marcado ? "acreditado" : "ya_pagado";
      if (marcado) await avisarAlComprador(fila.order_id, "pago_acreditado");
    } else if (pago.estado === "approved") {
      resultado = "revisar_monto";
    } else if (pago.estado === "refunded" || pago.estado === "charged_back") {
      await supabase.from("orders").update({ notes: `Mercado Pago avisa que el pago ${pago.id} quedó ${pago.estado === "refunded" ? "reintegrado" : "con contracargo"}: revisar.` }).eq("id", fila.order_id);
      resultado = "revisar_estado";
    }
  }

  const { error: errorAviso } = await supabase
    .from("avisos_recibidos")
    .insert({ proveedor: "mercadopago", id_externo: claveDelAviso, cuerpo: { type: tipo, action: cuerpo.action ?? null, data_id: dataId, estado: pago.estado, referencia: pago.referencia }, resultado });
  if (errorAviso && !/duplicate|unique/i.test(errorAviso.message)) throw new Error(errorAviso.message);
  return ok(res, { resultado });
}

// ── Transferencia: la cuenta y el plazo ─────────────────────────────────────
async function transferencia(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  let pedido: PedidoParaPagar;
  try {
    pedido = await pedidoConToken(req.query.id, req.query.token);
  } catch (e: unknown) {
    return fail(res, e instanceof Error ? e.message : "La compra no es válida.", 404);
  }
  const valores = await leerConfiguracion(["transferencia", "pendiente_vence_horas"]);
  const cuenta = (valores.transferencia ?? {}) as Partial<ConfiguracionDeTransferencia>;
  const venceHoras = typeof valores.pendiente_vence_horas === "number" ? valores.pendiente_vence_horas : null;
  return ok(res, {
    numero: pedido.order_number,
    total: pedido.total,
    estado: pedido.status,
    cuenta: { titular: cuenta.titular ?? null, cuit: cuenta.cuit ?? null, banco: cuenta.banco ?? null, cbu: cuenta.cbu ?? null, alias: cuenta.alias ?? null },
    vence_en: venceHoras ? new Date(new Date(pedido.created_at).getTime() + venceHoras * 3_600_000).toISOString() : null,
  });
}

// ── Panel ───────────────────────────────────────────────────────────────────
async function lista(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  const { panel } = await quienPide(req);
  if (!panel) return fail(res, "Solo para el panel", 403);
  const supabase = getSupabaseAdmin();
  const { data: pedidos, error } = await supabase
    .from("orders")
    .select("id, order_number, status, payment_method, total, comprador_nombre, comprador_email, comprador_telefono, comprador_documento, direccion_envio, created_at, pagado_en, notes")
    .eq("origen", "tienda")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  const ids = (pedidos ?? []).map((p: { id: number }) => p.id);
  const [{ data: pagos }, despachos] = await Promise.all([
    ids.length > 0 ? supabase.from("pagos").select("*").in("order_id", ids).order("creado_en", { ascending: false }) : Promise.resolve({ data: [] }),
    lineasDeDespachoDirecto(ids),
  ]);
  return ok(res, { pedidos: pedidos ?? [], pagos: pagos ?? [], despachos });
}

/** Las líneas que despacha un mayorista directo (New Bytes), para hacerle el pedido a mano. */
async function lineasDeDespachoDirecto(ids: number[]) {
  if (ids.length === 0) return [];
  const supabase = getSupabaseAdmin();
  const { data: directos, error: errorDirectos } = await supabase.from("suppliers").select("id, name").eq("despacho_directo", true);
  if (errorDirectos) throw new Error(errorDirectos.message);
  const nombres = new Map(((directos ?? []) as Array<{ id: string; name: string }>).map((s) => [s.id, s.name]));
  if (nombres.size === 0) return [];
  const { data: lineas, error } = await supabase
    .from("order_items")
    .select("order_id, product_id, name, sku, quantity, despacha_proveedor_id")
    .in("order_id", ids)
    .in("despacha_proveedor_id", [...nombres.keys()]);
  if (error) throw new Error(error.message);
  const productos = [...new Set(((lineas ?? []) as Array<{ product_id: number | null }>).map((l) => l.product_id).filter((id): id is number => id !== null))];
  const { data: externos } = productos.length
    ? await supabase.from("product_suppliers").select("product_id, supplier_id, external_id").in("product_id", productos).in("supplier_id", [...nombres.keys()])
    : { data: [] };
  const codigo = new Map(((externos ?? []) as Array<{ product_id: number; supplier_id: string; external_id: string | null }>).map((e) => [`${e.product_id}:${e.supplier_id}`, e.external_id]));
  return ((lineas ?? []) as Array<{ order_id: number; product_id: number | null; name: string; sku: string | null; quantity: number; despacha_proveedor_id: string }>).map((l) => ({
    order_id: l.order_id,
    nombre: l.name,
    sku: l.sku,
    cantidad: l.quantity,
    proveedor: nombres.get(l.despacha_proveedor_id) ?? "",
    id_del_mayorista: l.product_id ? (codigo.get(`${l.product_id}:${l.despacha_proveedor_id}`) ?? null) : null,
  }));
}

async function validar(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  const { admin, userId } = await quienPide(req);
  if (!admin) return fail(res, "Solo para administradores", 403);
  const orderId = Number((req.body ?? {}).order_id);
  if (!Number.isInteger(orderId)) return fail(res, "Falta el pedido.");
  const supabase = getSupabaseAdmin();
  const { data: pedido } = await supabase.from("orders").select("id, status, payment_method, total").eq("id", orderId).maybeSingle();
  const p = pedido as { id: number; status: string; payment_method: string | null; total: number } | null;
  if (!p) return fail(res, "No existe ese pedido.", 404);
  if (p.payment_method !== "transferencia") return fail(res, "Ese pedido no se paga por transferencia.", 409);
  if (p.status === "pagado") return ok(res, { resultado: "ya_pagado" });
  if (p.status !== "pendiente_pago" && p.status !== "vencido") return fail(res, `El pedido está "${p.status}": no se puede confirmar.`, 409);

  const { error: errorPago } = await supabase
    .from("pagos")
    .insert({ order_id: p.id, proveedor: "transferencia", estado: "aprobado", monto: p.total, moneda: "ARS", validado_por: userId, aprobado_en: new Date().toISOString(), nota: "Transferencia confirmada desde el panel" });
  if (errorPago) throw new Error(errorPago.message);
  const { error } = await supabase.rpc("tienda_marcar_pagado", { p_order_id: p.id });
  if (error) throw new Error(error.message);
  await registrarActividad(userId, "validar_transferencia", String(p.id), { total: p.total, estado_anterior: p.status });
  await avisarAlComprador(p.id, "pago_acreditado");
  return ok(res, { resultado: "acreditado" });
}

async function cancelar(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  const { admin, userId } = await quienPide(req);
  if (!admin) return fail(res, "Solo para administradores", 403);
  const cuerpo = (req.body ?? {}) as { order_id?: unknown; motivo?: unknown };
  const orderId = Number(cuerpo.order_id);
  if (!Number.isInteger(orderId)) return fail(res, "Falta el pedido.");
  const motivo = typeof cuerpo.motivo === "string" && cuerpo.motivo.trim() ? cuerpo.motivo.trim().slice(0, 300) : "Cancelado desde el panel.";
  const { data, error } = await getSupabaseAdmin().rpc("tienda_cancelar_pedido", { p_order_id: orderId, p_estado: "cancelado", p_motivo: motivo });
  if (error) throw new Error(error.message);
  if (!data) return fail(res, "Solo se cancela un pedido pendiente de pago.", 409);
  await registrarActividad(userId, "cancelar_pedido", String(orderId), { motivo });
  await avisarAlComprador(orderId, "cancelado", { motivo });
  return ok(res, { resultado: "cancelado" });
}

async function reintegrar(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  const { admin, userId } = await quienPide(req);
  if (!admin) return fail(res, "Solo para administradores", 403);
  const cuerpo = (req.body ?? {}) as { pago_id?: unknown; monto?: unknown; motivo?: unknown };
  const pagoId = Number(cuerpo.pago_id);
  if (!Number.isInteger(pagoId)) return fail(res, "Falta el pago.");
  const supabase = getSupabaseAdmin();
  const { data: filaCruda } = await supabase.from("pagos").select("id, order_id, proveedor, estado, monto, id_externo, referencia, detalle, reintegrado_monto, reintegro_clave").eq("id", pagoId).maybeSingle();
  const fila = filaCruda as FilaDePago | null;
  if (!fila) return fail(res, "No existe ese pago.", 404);
  if (fila.estado !== "aprobado") return fail(res, `El pago está "${fila.estado}": solo se reintegra un pago aprobado.`, 409);

  const queda = Number(fila.monto) - Number(fila.reintegrado_monto);
  const pedidoMonto = cuerpo.monto === undefined || cuerpo.monto === null || cuerpo.monto === "" ? null : Number(cuerpo.monto);
  if (pedidoMonto !== null && (!Number.isFinite(pedidoMonto) || pedidoMonto <= 0 || pedidoMonto > queda + 0.01)) return fail(res, `El monto tiene que estar entre 0 y ${queda}.`);
  const monto = pedidoMonto ?? queda;
  const motivo = typeof cuerpo.motivo === "string" ? cuerpo.motivo.trim().slice(0, 300) : "";
  // La clave de idempotencia se anota antes de pedir: pedir dos veces el mismo reintegro no reintegra dos veces.
  const clave = fila.reintegro_clave ?? `${fila.id}-${Date.now()}`;
  if (!fila.reintegro_clave) await supabase.from("pagos").update({ reintegro_clave: clave }).eq("id", fila.id);

  let idExterno: string | null = null;
  if (fila.proveedor === "mercadopago") {
    const config = configuracionDeMercadoPago();
    if (!config || !fila.id_externo) return fail(res, "No se puede reintegrar: falta Mercado Pago o el id del pago.", 409);
    idExterno = (await reintegrarEnMercadoPago(config, fila.id_externo, monto >= queda ? null : monto, clave)).id;
  }
  const reintegrado = Number(fila.reintegrado_monto) + monto;
  const total = reintegrado >= Number(fila.monto) - 0.01;
  await supabase
    .from("pagos")
    .update({ reintegrado_monto: reintegrado, reintegro_id_externo: idExterno ?? undefined, estado: total ? "reintegrado" : "aprobado", nota: motivo || undefined, actualizado_en: new Date().toISOString() })
    .eq("id", fila.id);
  if (total) await supabase.from("orders").update({ status: "reintegrado" }).eq("id", fila.order_id).in("status", ["pagado", "cancelado"]);
  await registrarActividad(userId, "reintegrar", String(fila.order_id), { pago_id: fila.id, monto, total, proveedor: fila.proveedor, motivo });
  return ok(res, { resultado: total ? "reintegrado" : "reintegro_parcial", monto });
}

async function configuracion(req: VercelRequest, res: VercelResponse) {
  const { admin, userId } = await quienPide(req);
  if (!admin) return fail(res, "Solo para administradores", 403);
  const supabase = getSupabaseAdmin();

  if (req.method === "PATCH") {
    const cuerpo = (req.body ?? {}) as {
      transferencia?: Partial<ConfiguracionDeTransferencia>;
      medios?: Record<string, boolean>;
      margenes?: Record<string, unknown>;
      pendiente_vence_horas?: unknown;
    };
    const ahora = new Date().toISOString();
    if (cuerpo.transferencia) {
      const t = cuerpo.transferencia;
      const limpio = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
      const cuenta: ConfiguracionDeTransferencia = { titular: limpio(t.titular, 120), cuit: limpio(t.cuit, 20), banco: limpio(t.banco, 80), cbu: limpio(t.cbu, 30), alias: limpio(t.alias, 40) };
      if (cuenta.cbu && !/^\d{22}$/.test(cuenta.cbu)) return fail(res, "El CBU tiene 22 números.");
      const { error } = await supabase.from("tienda_configuracion").update({ valor: cuenta, actualizado_en: ahora, actualizado_por: userId }).eq("clave", "transferencia");
      if (error) throw new Error(error.message);
    }
    if (cuerpo.pendiente_vence_horas !== undefined) {
      const horas = cuerpo.pendiente_vence_horas === null || cuerpo.pendiente_vence_horas === "" ? null : Number(cuerpo.pendiente_vence_horas);
      if (horas !== null && (!Number.isInteger(horas) || horas < 1 || horas > 720)) return fail(res, "El plazo va de 1 a 720 horas, o vacío para que no venza.");
      const { error } = await supabase.from("tienda_configuracion").update({ valor: horas, actualizado_en: ahora, actualizado_por: userId }).eq("clave", "pendiente_vence_horas");
      if (error) throw new Error(error.message);
    }
    if (cuerpo.medios) {
      for (const [id, activo] of Object.entries(cuerpo.medios)) {
        if (id !== "mercadopago" && id !== "transferencia") continue;
        const { error } = await supabase.from("medios_de_pago").update({ activo: Boolean(activo), actualizado_en: ahora }).eq("id", id);
        if (error) throw new Error(error.message);
      }
    }
    if (cuerpo.margenes) {
      for (const [id, valor] of Object.entries(cuerpo.margenes)) {
        if (id !== "mercadopago" && id !== "transferencia") continue;
        const margen = Number(valor);
        if (!Number.isFinite(margen) || margen < 0 || margen > 500) return fail(res, "El margen va de 0 a 500 %.");
        const { error } = await supabase
          .from("medios_de_pago")
          .update({ margen_porcentaje: Math.round(margen * 100) / 100, actualizado_en: ahora })
          .eq("id", id);
        if (error) throw new Error(error.message);
      }
    }
    await registrarActividad(userId, "configurar_pagos", "configuracion", { claves: Object.keys(cuerpo) });
  } else if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET", "PATCH"]);
  }

  const valores = await leerConfiguracion(["transferencia", "pendiente_vence_horas"]);
  const { data: mediosCrudos } = await supabase.from("medios_de_pago").select("id, nombre, detalle, activo, orden, margen_porcentaje").order("orden");
  return ok(res, {
    transferencia: valores.transferencia ?? {},
    pendiente_vence_horas: typeof valores.pendiente_vence_horas === "number" ? valores.pendiente_vence_horas : null,
    medios: mediosCrudos ?? [],
    mercadopago_configurado: configuracionDeMercadoPago() !== null,
    webhook_configurado: Boolean(configuracionDeMercadoPago()?.secreto),
  });
}

async function vencer(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") return methodNotAllowed(res, ["GET", "POST"]);
  if (!esElCron(req)) {
    const { admin } = await quienPide(req);
    if (!admin) return fail(res, "Solo para administradores", 403);
  }
  const valores = await leerConfiguracion(["pendiente_vence_horas"]);
  const horas = typeof valores.pendiente_vence_horas === "number" ? valores.pendiente_vence_horas : null;
  if (!horas) return ok(res, { vencidos: 0, aviso: "Sin plazo configurado: los pedidos pendientes no vencen." });
  const { data, error } = await getSupabaseAdmin().rpc("tienda_vencer_pendientes", { p_horas: horas });
  if (error) throw new Error(error.message);
  return ok(res, { vencidos: Number(data ?? 0), horas });
}
