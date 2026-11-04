import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fail, methodNotAllowed, ok, parsePagination } from "../_shared/http.js";
import { getRoleFromRequest, ensureWriteRole } from "../_shared/roles.js";
import { createOrderSchema, updateOrderSchema, ORDER_STATUSES, type OrderStatus } from "../_shared/schemas.js";
import { getSupabaseClient, getSupabaseAdmin } from "../_shared/supabaseServer.js";
import { notifyOrderStatusChange } from "../_shared/notifications.js";
import { avisarAlComprador } from "../_shared/avisos.js";
import type { ApiRole } from "../_shared/roles.js";

/**
 * Pedidos. Los de la tienda (origen = 'tienda') siguen su propio flujo:
 *   pendiente_pago → pagado → preparando → enviado → entregado, más cancelado, reintegrado y vencido.
 * "pagado" nunca se pone desde acá: solo lo ponen el aviso firmado de Mercado Pago y la confirmación
 * manual de una transferencia (api/pagos.ts). Al enviar se descuenta el stock; al cancelar se libera.
 * Los pedidos mayoristas heredados conservan el flujo de Bartez.
 */

const ESTADOS_DE_LA_TIENDA = ["pendiente_pago", "pagado", "preparando", "enviado", "entregado", "cancelado", "reintegrado", "vencido"] as const;
type EstadoDeLaTienda = (typeof ESTADOS_DE_LA_TIENDA)[number];

const FLUJO_DE_LA_TIENDA: Record<EstadoDeLaTienda, EstadoDeLaTienda[]> = {
  pendiente_pago: ["cancelado"],
  pagado: ["preparando", "cancelado"],
  preparando: ["enviado", "cancelado"],
  enviado: ["entregado"],
  entregado: [],
  cancelado: [],
  reintegrado: [],
  vencido: ["cancelado"],
};

// Transitions each role is allowed to trigger (pedidos mayoristas heredados y pasos de la tienda)
const ALLOWED_TRANSITIONS: Record<ApiRole, OrderStatus[]> = {
  admin:     [...ORDER_STATUSES],
  vendedor:  ["confirmed", "preparing", "picked", "shipped", "delivered", "rejected", "preparando", "enviado", "entregado"],
  sales:     ["confirmed", "preparing", "picked", "shipped", "delivered", "rejected", "preparando", "enviado", "entregado"],
  cliente:   ["cancelled"],
  client:    ["cancelled"],
  anonymous: [],
};

const esDeLaTienda = (estado: string): estado is EstadoDeLaTienda => (ESTADOS_DE_LA_TIENDA as readonly string[]).includes(estado);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET")   return listOrders(req, res);
  if (req.method === "POST")  return createOrder(req, res);
  if (req.method === "PATCH") return updateOrder(req, res);
  return methodNotAllowed(res, ["GET", "POST", "PATCH"]);
}

async function listOrders(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabaseClient(req);
    const { limit, offset } = parsePagination(req);
    const clientId = req.query.client_id ? String(req.query.client_id) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;

    let query = supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (clientId) query = query.eq("client_id", clientId);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return fail(res, error.message, 500);
    return ok(res, data ?? []);
  } catch (error) {
    return fail(res, (error as Error).message, 500);
  }
}

async function createOrder(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabaseClient(req);
    if (!(await ensureWriteRole(req, res, supabase))) return;

    const parsed = createOrderSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return fail(res, "Invalid order payload", 400, parsed.error.flatten());
    }

    const body = parsed.data;
    const payload = {
      client_id: body.client_id,
      products: body.products,
      total: body.total,
      status: body.status ?? "pending",
      order_number: body.order_number ?? null,
      numero_remito: body.numero_remito ?? null,
    };

    const { data, error } = await supabase
      .from("orders")
      .insert(payload)
      .select("*")
      .single();

    if (error) return fail(res, error.message, 500);
    return ok(res, data, 201);
  } catch (error) {
    return fail(res, (error as Error).message, 500);
  }
}

export interface PedidoActual {
  id: number;
  client_id: string | null;
  status: string;
  origen: string | null;
  pagado_en: string | null;
}

/** También lo usan los avisos de Zipnova (api/_tienda/envios.ts) para pasar un pedido a enviado o entregado. */
export async function cambiarEstadoDeLaTienda(
  pedido: PedidoActual,
  nuevo: EstadoDeLaTienda,
  resto: Record<string, unknown>,
  userId: string | null,
): Promise<{ error?: string; estado?: number; data?: unknown }> {
  const admin = getSupabaseAdmin();
  const actual = pedido.status as EstadoDeLaTienda;
  if (nuevo === "pagado") return { error: "Un pedido se marca pagado solo desde Pagos: por el aviso de Mercado Pago o confirmando la transferencia.", estado: 409 };
  if (nuevo === actual) return { error: `El pedido ya está "${actual}".`, estado: 409 };
  const permitidos = esDeLaTienda(actual) ? FLUJO_DE_LA_TIENDA[actual] : [];
  if (!permitidos.includes(nuevo)) return { error: `De "${actual}" no se pasa a "${nuevo}".`, estado: 409 };

  const ahora = new Date().toISOString();
  const patch: Record<string, unknown> = { ...resto, status: nuevo };

  if (nuevo === "cancelado") {
    const motivo = typeof resto.notes === "string" && resto.notes.trim() ? resto.notes.trim() : "Cancelado desde el panel.";
    if (actual === "pendiente_pago" || actual === "vencido") {
      const { data: cancelado, error } = await admin.rpc("tienda_cancelar_pedido", { p_order_id: pedido.id, p_estado: "cancelado", p_motivo: motivo });
      if (error) return { error: error.message, estado: 500 };
      if (!cancelado && actual === "pendiente_pago") return { error: "No se pudo cancelar el pedido.", estado: 409 };
      if (actual === "vencido") await admin.from("orders").update({ status: "cancelado", cancelado_en: ahora }).eq("id", pedido.id);
    } else {
      // Pagado o preparando: se libera la reserva y el dinero se devuelve desde Pagos.
      const { error } = await admin.rpc("tienda_liberar_reserva", { p_order_id: pedido.id });
      if (error) return { error: error.message, estado: 500 };
      await admin.from("orders").update({ status: "cancelado", cancelado_en: ahora, notes: motivo }).eq("id", pedido.id);
    }
    void avisarAlComprador(pedido.id, "cancelado", { motivo });
  } else {
    if (nuevo === "preparando") patch.preparando_en = ahora;
    if (nuevo === "enviado") {
      const { error } = await admin.rpc("tienda_descontar_stock", { p_order_id: pedido.id });
      if (error) return { error: error.message, estado: 500 };
      patch.enviado_en = ahora;
      patch.shipped_at = ahora;
    }
    if (nuevo === "entregado") patch.entregado_en = ahora;
    const { error } = await admin.from("orders").update(patch).eq("id", pedido.id);
    if (error) return { error: error.message, estado: 500 };
    if (nuevo === "enviado") void avisarAlComprador(pedido.id, "enviado");
    if (nuevo === "entregado") void avisarAlComprador(pedido.id, "entregado");
  }

  await admin.from("activity_logs").insert({ user_id: userId, action: "cambiar_estado_pedido", entity_type: "order", entity_id: String(pedido.id), metadata: { de: actual, a: nuevo } });
  const { data } = await admin.from("orders").select("*").eq("id", pedido.id).single();
  return { data };
}

async function updateOrder(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabaseClient(req);
    const role = await getRoleFromRequest(req, supabase);

    if (role === "anonymous") return fail(res, "Unauthorized", 401);

    const parsed = updateOrderSchema.safeParse(req.body ?? {});
    if (!parsed.success) return fail(res, "Invalid payload", 400, parsed.error.flatten());

    const { id, status, ...rest } = parsed.data;

    // Validate status transition is allowed for this role
    if (status !== undefined && !ALLOWED_TRANSITIONS[role].includes(status)) {
      return fail(res, `Role '${role}' cannot set order status to '${status}'`, 403);
    }

    const admin = getSupabaseAdmin();
    const { data: currentOrder, error: fetchError } = await admin
      .from("orders")
      .select("id, client_id, status, origen, pagado_en")
      .eq("id", id)
      .single();

    if (fetchError || !currentOrder) return fail(res, "Order not found", 404);
    const pedido = currentOrder as PedidoActual;

    // Los pedidos de la tienda siguen su flujo y solo los opera el panel.
    if (pedido.origen === "tienda") {
      if (role === "cliente" || role === "client") return fail(res, "Los pedidos de la tienda se operan desde el panel.", 403);
      if (status !== undefined) {
        if (!esDeLaTienda(status)) return fail(res, `"${status}" no es un estado de la tienda.`, 400);
        const bearer = req.headers.authorization?.slice(7) ?? "";
        const userId = (await supabase.auth.getUser(bearer)).data.user?.id ?? null;
        const resultado = await cambiarEstadoDeLaTienda(pedido, status, rest, userId);
        if (resultado.error) return fail(res, resultado.error, resultado.estado ?? 500);
        return ok(res, resultado.data);
      }
      const { data, error } = await admin.from("orders").update(rest).eq("id", id).select("*").single();
      if (error) return fail(res, error.message, 500);
      return ok(res, data);
    }

    // Clients can only cancel their own orders while still pending
    if (role === "cliente" || role === "client") {
      const { data: authData } = await supabase.auth.getUser(
        req.headers.authorization?.slice(7) ?? ""
      );
      const userId = authData.user?.id;
      if (pedido.client_id !== userId) {
        return fail(res, "Cannot modify another client's order", 403);
      }
      if (pedido.status !== "pending") {
        return fail(res, "Can only cancel orders in pending status", 403);
      }
    }

    const patch: Record<string, unknown> = { ...rest };
    if (status !== undefined) patch.status = status;

    const { data, error } = await supabase
      .from("orders")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error) return fail(res, error.message, 500);

    // Fire-and-forget notifications on status change — never blocks the response
    if (status !== undefined && status !== pedido.status && pedido.client_id) {
      void notifyOrderStatusChange(
        data as { id: number; order_number?: string; client_id: string; total?: number; shipping_provider?: string; tracking_number?: string },
        status,
        admin,
      );
    }

    return ok(res, data);
  } catch (error) {
    return fail(res, (error as Error).message, 500);
  }
}
