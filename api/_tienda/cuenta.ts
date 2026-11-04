import { timingSafeEqual } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";

import { sitioPublico } from "../_shared/avisos.js";
import { fail, methodNotAllowed, ok } from "../_shared/http.js";
import { createMailerTransport, getDefaultFromEmail, sanitizeHeaderText } from "../_shared/mailer.js";
import { facturaDisponibleHTML } from "../_shared/plantillas.js";
import { getRoleFromRequest } from "../_shared/roles.js";
import { getSupabaseAdmin, getSupabaseClient } from "../_shared/supabaseServer.js";

/**
 * Mi cuenta y facturas.
 *   GET     ?recurso=factura&id=&t=   con el enlace de la compra: redirige al PDF de la factura (enlace firmado de 5 minutos)
 *   POST    ?recurso=privacidad       con sesión: pedido de copia, corrección o borrado de los datos personales
 *   GET     ?recurso=facturas         panel: compras pagas de la tienda y si ya tienen factura
 *   POST    ?recurso=subir-factura    admin: guarda el PDF en el pedido y se lo manda al comprador
 *   GET/PUT ?recurso=cupon            admin: el cupón para la próxima compra (se genera al entregar)
 *
 * Lo demás de la cuenta (mis compras, mis cupones, activar un cupón y mis datos) va directo a la base con la
 * sesión del cliente: funciones de la base que solo devuelven lo del email confirmado de la sesión.
 */

export const config = { maxDuration: 30 };

const BUCKET = "facturas";
const PDF_MAXIMO = 3 * 1024 * 1024;
const ESTADOS_CON_FACTURA = ["pagado", "preparando", "enviado", "entregado", "reintegrado"];

const privacidadSchema = z.object({
  tipo: z.enum(["copia", "borrado", "rectificacion"]),
  detalle: z.string().trim().max(2000).optional(),
});

const subirFacturaSchema = z.object({
  order_id: z.coerce.number().int().positive(),
  // El PDF en base64: el panel lo lee del archivo elegido.
  pdf: z.string().min(100).max(Math.ceil((PDF_MAXIMO * 4) / 3) + 16),
});

const cuponSchema = z
  .object({
    activo: z.boolean(),
    tipo: z.enum(["percentage", "fixed"]),
    valor: z.coerce.number().min(0).max(10_000_000),
    minimo: z.coerce.number().min(0).max(100_000_000).default(0),
    tope: z.coerce.number().min(0).max(100_000_000).nullable().default(null),
    dias: z.coerce.number().int().min(1).max(365).default(60),
    categorias: z.array(z.coerce.number().int().positive()).max(50).default([]),
    solo_primera: z.boolean().default(true),
  })
  .refine((c) => c.tipo !== "percentage" || c.valor <= 90, { message: "El porcentaje no puede pasar de 90.", path: ["valor"] })
  .refine((c) => !c.activo || c.valor > 0, { message: "Para activarlo, poné el valor del descuento.", path: ["valor"] });

const intentos = new Map<string, number[]>();
function excedeLaTasa(clave: string, porMinuto: number): boolean {
  const ahora = Date.now();
  const recientes = (intentos.get(clave) ?? []).filter((t) => ahora - t < 60_000);
  recientes.push(ahora);
  intentos.set(clave, recientes);
  if (intentos.size > 5_000) {
    const masVieja = intentos.keys().next().value;
    if (masVieja !== undefined) intentos.delete(masVieja);
  }
  return recientes.length > porMinuto;
}

function tokenDe(req: VercelRequest): string | undefined {
  const bearer = req.headers.authorization;
  return bearer?.startsWith("Bearer ") ? bearer.slice(7) : undefined;
}

async function quienPide(req: VercelRequest): Promise<{ admin: boolean; panel: boolean; userId: string | null }> {
  const supabase = getSupabaseClient(req);
  const rol = await getRoleFromRequest(req, supabase);
  const token = tokenDe(req);
  const userId = token ? ((await supabase.auth.getUser(token)).data.user?.id ?? null) : null;
  return { admin: rol === "admin", panel: rol === "admin" || rol === "vendedor" || rol === "sales", userId };
}

function mismoToken(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const recurso = String(req.query.recurso ?? "");
  try {
    switch (recurso) {
      case "factura":
        return await bajarFactura(req, res);
      case "privacidad":
        return await privacidad(req, res);
      case "facturas":
        return await listarFacturas(req, res);
      case "subir-factura":
        return await subirFactura(req, res);
      case "cupon":
        return await cupon(req, res);
      default:
        return fail(res, "Recurso desconocido", 404);
    }
  } catch (e: unknown) {
    const mensaje = e instanceof Error ? e.message : "Error inesperado";
    console.error("[cuenta]", recurso, mensaje);
    return fail(res, "No se pudo completar. Probá de nuevo en un momento.", 500);
  }
}

async function bajarFactura(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  const ip = String(req.headers["x-forwarded-for"] ?? req.socket?.remoteAddress ?? "").split(",")[0].trim();
  if (excedeLaTasa(`factura|${ip}`, 30)) return fail(res, "Demasiados intentos seguidos. Esperá un minuto.", 429);

  const id = Number(req.query.id);
  const token = typeof req.query.t === "string" ? req.query.t : "";
  if (!Number.isInteger(id) || id <= 0 || !token) return fail(res, "El enlace de la factura está incompleto.", 400);

  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from("orders").select("order_number, token_acceso, factura_path").eq("id", id).maybeSingle();
  const pedido = data as { order_number: string; token_acceso: string | null; factura_path: string | null } | null;
  if (!pedido || !pedido.token_acceso || !mismoToken(pedido.token_acceso, token)) return fail(res, "No encontramos esa compra.", 404);
  if (!pedido.factura_path) return fail(res, "La factura de esta compra todavía no está disponible.", 404);

  const { data: firmado, error } = await supabase.storage.from(BUCKET).createSignedUrl(pedido.factura_path, 300, { download: `Factura ${pedido.order_number}.pdf` });
  if (error || !firmado?.signedUrl) throw new Error(`No se pudo firmar la factura: ${error?.message ?? "sin enlace"}`);
  res.setHeader("Cache-Control", "no-store");
  return res.redirect(302, firmado.signedUrl);
}

async function privacidad(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  const token = tokenDe(req);
  if (!token) return fail(res, "Entrá a tu cuenta para hacer el pedido.", 401);
  const { data: sesion } = await getSupabaseAdmin().auth.getUser(token);
  const usuario = sesion.user;
  if (!usuario?.email || !usuario.email_confirmed_at) return fail(res, "Entrá a tu cuenta para hacer el pedido.", 401);
  if (excedeLaTasa(`privacidad|${usuario.id}`, 3)) return fail(res, "Ya recibimos tu pedido. Esperá un minuto para mandar otro.", 429);

  const parseado = privacidadSchema.safeParse(req.body ?? {});
  if (!parseado.success) return fail(res, "Elegí qué querés pedir.");
  const { tipo, detalle } = parseado.data;
  const email = usuario.email.toLowerCase();

  const { data: creado, error } = await getSupabaseAdmin()
    .from("pedidos_de_privacidad")
    .insert({ user_id: usuario.id, email, tipo, detalle: detalle || null })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const destino = process.env.ADMIN_EMAIL?.trim() || getDefaultFromEmail();
  const QUE: Record<typeof tipo, string> = { copia: "una copia de sus datos", borrado: "el borrado de sus datos", rectificacion: "corregir sus datos" };
  try {
    await createMailerTransport().sendMail({
      from: `"Teqo" <${getDefaultFromEmail()}>`,
      to: destino,
      replyTo: email,
      subject: sanitizeHeaderText(`Pedido de datos personales #${(creado as { id: number }).id}`, "Pedido de datos personales"),
      text: `${email} pidió ${QUE[tipo]} desde Mi cuenta.\n\nDetalle: ${detalle || "sin detalle"}\n\nHay que responderle por email dentro de los plazos de la Ley 25.326. El pedido queda en la tabla pedidos_de_privacidad.`,
    });
  } catch (e: unknown) {
    console.error("[cuenta] No se pudo avisar el pedido de privacidad:", e instanceof Error ? e.message : e);
  }
  return ok(res, { id: (creado as { id: number }).id }, 201);
}

async function listarFacturas(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  const { panel } = await quienPide(req);
  if (!panel) return fail(res, "Solo para el panel", 403);
  const { data, error } = await getSupabaseAdmin()
    .from("orders")
    .select("id, order_number, status, total, comprador_nombre, comprador_email, comprador_documento, pagado_en, created_at, factura_path, factura_subida_en")
    .eq("origen", "tienda")
    .in("status", ESTADOS_CON_FACTURA)
    .order("created_at", { ascending: false })
    .limit(150);
  if (error) throw new Error(error.message);
  const filas = ((data ?? []) as Array<Record<string, unknown>>).map(({ factura_path, ...resto }) => ({ ...resto, factura: Boolean(factura_path) }));
  return ok(res, filas);
}

async function subirFactura(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  const { admin, userId } = await quienPide(req);
  if (!admin) return fail(res, "Solo para administradores", 403);

  const parseado = subirFacturaSchema.safeParse(req.body ?? {});
  if (!parseado.success) return fail(res, "Elegí un PDF de hasta 3 MB.");
  const { order_id, pdf } = parseado.data;
  const contenido = Buffer.from(pdf.replace(/^data:application\/pdf;base64,/, ""), "base64");
  if (contenido.length === 0 || contenido.length > PDF_MAXIMO) return fail(res, "El PDF tiene que pesar hasta 3 MB.");
  if (contenido.subarray(0, 5).toString("latin1") !== "%PDF-") return fail(res, "El archivo no es un PDF.");

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("orders")
    .select("id, order_number, status, origen, comprador_email, comprador_nombre, token_acceso")
    .eq("id", order_id)
    .maybeSingle();
  const pedido = data as {
    id: number;
    order_number: string;
    status: string;
    origen: string | null;
    comprador_email: string | null;
    comprador_nombre: string | null;
    token_acceso: string | null;
  } | null;
  if (!pedido || pedido.origen !== "tienda") return fail(res, "No existe esa compra de la tienda.", 404);
  if (!ESTADOS_CON_FACTURA.includes(pedido.status)) return fail(res, "La factura se sube cuando la compra está paga.", 409);

  const ruta = `${pedido.id}/factura-${pedido.order_number.replace(/[^A-Za-z0-9-]/g, "")}.pdf`;
  const { error: errorSubida } = await supabase.storage.from(BUCKET).upload(ruta, contenido, { contentType: "application/pdf", upsert: true });
  if (errorSubida) throw new Error(`No se pudo guardar el PDF: ${errorSubida.message}`);
  const ahora = new Date().toISOString();
  const { error: errorPedido } = await supabase.from("orders").update({ factura_path: ruta, factura_subida_en: ahora }).eq("id", pedido.id);
  if (errorPedido) throw new Error(errorPedido.message);
  await supabase.from("activity_logs").insert({ user_id: userId, action: "subir_factura", entity_type: "order", entity_id: String(pedido.id), metadata: { ruta } });

  let emailEnviado = false;
  if (pedido.comprador_email && pedido.token_acceso) {
    const base = sitioPublico();
    try {
      await createMailerTransport().sendMail({
        from: `"Teqo" <${getDefaultFromEmail()}>`,
        to: pedido.comprador_email,
        subject: sanitizeHeaderText(`Factura de tu compra ${pedido.order_number}`, "Tu factura"),
        html: facturaDisponibleHTML({
          numero: pedido.order_number,
          nombre: pedido.comprador_nombre ?? "",
          enlace: `${base}/compra/${pedido.id}?t=${pedido.token_acceso}`,
          enlaceFactura: `${base}/api/cuenta?recurso=factura&id=${pedido.id}&t=${pedido.token_acceso}`,
        }),
        attachments: [{ filename: `Factura ${pedido.order_number}.pdf`, content: contenido, contentType: "application/pdf" }],
      });
      emailEnviado = true;
    } catch (e: unknown) {
      console.error("[cuenta] No se pudo mandar la factura:", e instanceof Error ? e.message : e);
    }
  }
  return ok(res, { factura: true, email_enviado: emailEnviado, subida_en: ahora });
}

async function cupon(req: VercelRequest, res: VercelResponse) {
  const { admin, userId } = await quienPide(req);
  if (!admin) return fail(res, "Solo para administradores", 403);
  const supabase = getSupabaseAdmin();

  if (req.method === "PUT") {
    const parseado = cuponSchema.safeParse(req.body ?? {});
    if (!parseado.success) return fail(res, parseado.error.issues[0]?.message ?? "Revisá los datos del cupón.");
    const valor = { ...parseado.data, tope: parseado.data.tope && parseado.data.tope > 0 ? parseado.data.tope : null };
    const { error } = await supabase
      .from("tienda_configuracion")
      .upsert({ clave: "cupon_segunda_compra", valor, actualizado_en: new Date().toISOString(), actualizado_por: userId }, { onConflict: "clave" });
    if (error) throw new Error(error.message);
    await supabase.from("activity_logs").insert({ user_id: userId, action: "guardar_cupon_de_compra", entity_type: "configuracion", entity_id: "cupon_segunda_compra", metadata: valor });
  } else if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET", "PUT"]);
  }

  const [{ data: fila, error: errorFila }, { data: categorias, error: errorCategorias }, { data: emitidos }] = await Promise.all([
    supabase.from("tienda_configuracion").select("valor").eq("clave", "cupon_segunda_compra").maybeSingle(),
    supabase.from("categories").select("id, name, parent_id").order("name"),
    supabase.from("coupons").select("used_count, client_id").not("origen_order_id", "is", null).limit(5000),
  ]);
  if (errorFila) throw new Error(errorFila.message);
  if (errorCategorias) throw new Error(errorCategorias.message);
  const lista = (emitidos ?? []) as Array<{ used_count: number | null; client_id: string | null }>;
  return ok(res, {
    cupon: (fila as { valor: unknown } | null)?.valor ?? null,
    categorias: categorias ?? [],
    resumen: { emitidos: lista.length, activados: lista.filter((c) => c.client_id).length, usados: lista.filter((c) => (c.used_count ?? 0) > 0).length },
  });
}
