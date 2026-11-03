import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";

import { fail, methodNotAllowed, ok } from "../_shared/http.js";
import { createMailerTransport, getDefaultFromEmail, sanitizeHeaderText } from "../_shared/mailer.js";
import { arrepentimientoRecibidoHTML } from "../_shared/plantillas.js";
import { getRoleFromRequest } from "../_shared/roles.js";
import { getSupabaseAdmin, getSupabaseClient } from "../_shared/supabaseServer.js";

/**
 * Legal.
 *   POST  ?recurso=arrepentimiento   público, sin cuenta: deja el pedido y devuelve el código al instante
 *   GET   ?recurso=lista             panel: los arrepentimientos
 *   PATCH ?recurso=responder         admin: estado y nota interna
 *   GET/PATCH ?recurso=textos        admin: datos del vendedor y textos legales
 */

export const config = { maxDuration: 15 };

const arrepentimientoSchema = z.object({
  email: z.string().trim().email().max(320),
  numero: z.string().trim().max(40).optional(),
  motivo: z.string().trim().max(1000).optional(),
  nombre: z.string().trim().max(120).optional(),
});

const responderSchema = z.object({
  id: z.coerce.number().int().positive(),
  estado: z.enum(["recibido", "en_proceso", "cerrado", "rechazado"]),
  nota_interna: z.string().trim().max(2000).optional(),
});

const textoLegal = z.string().trim().max(40_000).nullable().optional();
const textosSchema = z.object({
  datos_legales: z
    .object({
      razon_social: z.string().trim().max(160).nullable().optional(),
      cuit: z.string().trim().max(20).nullable().optional(),
      domicilio: z.string().trim().max(240).nullable().optional(),
      email: z.string().trim().max(320).nullable().optional(),
      telefono: z.string().trim().max(40).nullable().optional(),
      data_fiscal_url: z.string().trim().max(500).nullable().optional(),
    })
    .optional(),
  texto_terminos: textoLegal,
  texto_privacidad: textoLegal,
  texto_garantias: textoLegal,
});

const intentos = new Map<string, number[]>();
function excedeLaTasa(clave: string, porMinuto: number): boolean {
  const ahora = Date.now();
  const recientes = (intentos.get(clave) ?? []).filter((t) => ahora - t < 60_000);
  recientes.push(ahora);
  intentos.set(clave, recientes);
  return recientes.length > porMinuto;
}

async function quienPide(req: VercelRequest): Promise<{ admin: boolean; panel: boolean; userId: string | null }> {
  const supabase = getSupabaseClient(req);
  const rol = await getRoleFromRequest(req, supabase);
  const bearer = req.headers.authorization;
  const token = bearer?.startsWith("Bearer ") ? bearer.slice(7) : undefined;
  const userId = token ? ((await supabase.auth.getUser(token)).data.user?.id ?? null) : null;
  return { admin: rol === "admin", panel: rol === "admin" || rol === "vendedor" || rol === "sales", userId };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const recurso = String(req.query.recurso ?? "");
  try {
    switch (recurso) {
      case "arrepentimiento":
        return await arrepentimiento(req, res);
      case "lista":
        return await lista(req, res);
      case "responder":
        return await responder(req, res);
      case "textos":
        return await textos(req, res);
      default:
        return fail(res, "Recurso desconocido", 404);
    }
  } catch (e: unknown) {
    const mensaje = e instanceof Error ? e.message : "Error inesperado";
    console.error("[legal]", recurso, mensaje);
    return fail(res, mensaje, 500);
  }
}

async function arrepentimiento(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  const ip = String(req.headers["x-forwarded-for"] ?? req.socket?.remoteAddress ?? "").split(",")[0].trim();
  if (excedeLaTasa(`arrepentimiento|${ip}`, 5)) return fail(res, "Demasiados intentos seguidos. Esperá un minuto.", 429);

  const parseado = arrepentimientoSchema.safeParse(req.body ?? {});
  if (!parseado.success) return fail(res, "Revisá el email: ahí te mandamos el código.");
  const datos = parseado.data;

  const { data, error } = await getSupabaseAdmin().rpc("tienda_crear_arrepentimiento", {
    p_email: datos.email,
    p_numero: datos.numero ?? null,
    p_motivo: datos.motivo ?? null,
    p_nombre: datos.nombre ?? null,
  });
  if (error) throw new Error(`No se pudo registrar el arrepentimiento: ${error.message}`);
  const creado = data as { id: number; codigo: string; pedido_id: number | null; numero: string | null };

  void (async () => {
    try {
      const transporte = createMailerTransport();
      await transporte.sendMail({
        from: `"Teqo" <${getDefaultFromEmail()}>`,
        to: datos.email,
        subject: sanitizeHeaderText(`Tu código de arrepentimiento ${creado.codigo}`, "Tu código de arrepentimiento"),
        html: arrepentimientoRecibidoHTML({ codigo: creado.codigo, nombre: datos.nombre ?? null, numero: creado.numero }),
      });
      const adminEmail = process.env.ADMIN_EMAIL?.trim();
      if (adminEmail) {
        await transporte.sendMail({
          from: `"Teqo" <${getDefaultFromEmail()}>`,
          to: adminEmail,
          subject: sanitizeHeaderText(`Arrepentimiento ${creado.codigo}${creado.numero ? ` de la compra ${creado.numero}` : ""}`, "Arrepentimiento nuevo"),
          text: `Email: ${datos.email}\nNombre: ${datos.nombre ?? ""}\nPedido: ${creado.numero ?? "sin número"}\nMotivo: ${datos.motivo ?? ""}\n\nHay 24 horas para responder desde el panel (Legal › Arrepentimientos).`,
        });
      }
    } catch (e: unknown) {
      console.error("[legal] No se pudo mandar el email del arrepentimiento:", e instanceof Error ? e.message : e);
    }
  })();

  return ok(res, { codigo: creado.codigo, numero: creado.numero }, 201);
}

async function lista(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  const { panel } = await quienPide(req);
  if (!panel) return fail(res, "Solo para el panel", 403);
  const { data, error } = await getSupabaseAdmin().from("arrepentimientos").select("*").order("creado_en", { ascending: false }).limit(300);
  if (error) throw new Error(error.message);
  return ok(res, data ?? []);
}

async function responder(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "PATCH") return methodNotAllowed(res, ["PATCH"]);
  const { admin, userId } = await quienPide(req);
  if (!admin) return fail(res, "Solo para administradores", 403);
  const parseado = responderSchema.safeParse(req.body ?? {});
  if (!parseado.success) return fail(res, "Datos incompletos.");
  const { id, estado, nota_interna } = parseado.data;
  const supabase = getSupabaseAdmin();
  const { data: actual } = await supabase.from("arrepentimientos").select("id, estado, respondido_en").eq("id", id).maybeSingle();
  if (!actual) return fail(res, "No existe ese arrepentimiento.", 404);
  const ahora = new Date().toISOString();
  const fila = actual as { respondido_en: string | null };
  const { data, error } = await supabase
    .from("arrepentimientos")
    .update({
      estado,
      nota_interna: nota_interna ?? undefined,
      respondido_en: estado !== "recibido" && !fila.respondido_en ? ahora : fila.respondido_en,
      respondido_por: estado !== "recibido" && !fila.respondido_en ? userId : undefined,
      actualizado_en: ahora,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await supabase.from("activity_logs").insert({ user_id: userId, action: "responder_arrepentimiento", entity_type: "arrepentimiento", entity_id: String(id), metadata: { estado } });
  return ok(res, data);
}

async function textos(req: VercelRequest, res: VercelResponse) {
  const { admin, userId } = await quienPide(req);
  if (!admin) return fail(res, "Solo para administradores", 403);
  const supabase = getSupabaseAdmin();
  if (req.method === "PATCH") {
    const parseado = textosSchema.safeParse(req.body ?? {});
    if (!parseado.success) return fail(res, "Revisá los textos: alguno es demasiado largo.");
    const cambios = parseado.data;
    const ahora = new Date().toISOString();
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor === undefined) continue;
      const { error } = await supabase.from("tienda_configuracion").update({ valor: valor === "" ? null : valor, actualizado_en: ahora, actualizado_por: userId }).eq("clave", clave);
      if (error) throw new Error(error.message);
    }
    await supabase.from("activity_logs").insert({ user_id: userId, action: "guardar_textos_legales", entity_type: "configuracion", entity_id: "legal", metadata: { claves: Object.keys(cambios) } });
  } else if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET", "PATCH"]);
  }
  const { data, error } = await supabase.rpc("tienda_contenido_legal");
  if (error) throw new Error(error.message);
  return ok(res, data ?? {});
}
