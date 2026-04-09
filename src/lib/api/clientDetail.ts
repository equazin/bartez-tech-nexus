import { supabase } from "@/lib/supabase";
import type { ClientType } from "@/lib/supabase";
import type { Invoice } from "@/lib/api/invoices";
import type { TaxStatus } from "@/lib/api/afip";

// ── Types ──────────────────────────────────────────────────────────────────────

export type ClientEstado = "activo" | "inactivo" | "bloqueado";
export type PrecioLista  = "standard" | "mayorista" | "distribuidor" | "especial";
export type ProfileTaxStatus = TaxStatus | "no_especificado";

export interface ClientDetail {
  id: string;
  company_name: string;
  contact_name: string;
  client_type: ClientType;
  default_margin: number;
  role: string;
  phone?: string;
  email?: string;
  credit_limit: number;
  credit_used: number;
  // campos 016
  estado: ClientEstado;
  vendedor_id?: string;
  precio_lista: PrecioLista;
  razon_social?: string;
  cuit?: string;
  tax_status?: ProfileTaxStatus;
  direccion?: string;
  ciudad?: string;
  provincia?: string;
  notas_internas?: string;
  partner_level?: "cliente" | "silver" | "gold" | "platinum";
  assigned_seller_id?: string;
  last_contact_at?: string;
  last_contact_type?: "nota" | "llamada" | "reunion" | "seguimiento" | "alerta" | "pedido" | "cotizacion" | "ticket";
  // campos 017 – crédito
  payment_terms: number;          // días netos: 15/30/45/60/90/120
  credit_approved: boolean;
  credit_approved_by?: string;
  credit_approved_at?: string;
  credit_review_date?: string;
  notas_credito?: string;
  max_order_value: number;        // 0 = sin límite
}

export interface AccountMovement {
  id: string;
  client_id: string;
  tipo: "factura" | "pago" | "nota_credito" | "ajuste";
  monto: number;
  descripcion?: string;
  reference_id?: string;
  reference_type?: string;
  fecha: string;
  created_at: string;
}

export interface ClientNote {
  id: string;
  client_id: string;
  body: string;
  tipo: "nota" | "llamada" | "reunion" | "alerta" | "seguimiento";
  created_by?: string;
  created_at: string;
}

export interface ClientOrder {
  id: string;
  order_number?: string;
  total: number;
  status: string;
  created_at: string;
  products: Array<{ name: string; quantity: number; total_price?: number }>;
}

export interface ClientQuote {
  id: number;
  total: number;
  status: string;
  currency: string;
  created_at: string;
  expires_at?: string;
  converted_to_order_id?: number;
}

export interface SupportTicket {
  id: string;
  client_id: string;
  subject: string;
  description: string;
  status: "open" | "in_analysis" | "waiting_customer" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  category: string;
  created_at: string;
  updated_at: string;
}

export interface ClientRma {
  id: number;
  client_id: string;
  order_id: string;
  rma_number: string;
  status: "draft" | "submitted" | "reviewing" | "approved" | "rejected" | "resolved";
  reason: "defective" | "wrong_item" | "damaged_in_transit" | "not_as_described" | "other";
  description?: string;
  items: Array<{
    product_id: number;
    name: string;
    sku: string;
    quantity: number;
    unit_price: number;
  }>;
  resolution_type?: "refund" | "exchange" | "credit_note" | "repair";
  resolution_notes?: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
}

// ── Queries ────────────────────────────────────────────────────────────────────

/** Perfil completo del cliente (incluye campos 016 + 017). */
export async function fetchClientProfile(clientId: string): Promise<ClientDetail> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, company_name, contact_name, client_type, default_margin, role, phone, email, " +
      "credit_limit, credit_used, estado, vendedor_id, precio_lista, partner_level, assigned_seller_id, last_contact_at, last_contact_type, " +
      "razon_social, cuit, tax_status, direccion, ciudad, provincia, notas_internas, " +
      "payment_terms, credit_approved, credit_approved_by, credit_approved_at, " +
      "credit_review_date, notas_credito, max_order_value"
    )
    .eq("id", clientId)
    .single();
  if (error) throw new Error(error.message);
  const raw = data as unknown as Record<string, unknown>;
  return {
    ...raw,
    payment_terms:   (raw.payment_terms   as number)  ?? 30,
    credit_approved: (raw.credit_approved as boolean) ?? false,
    max_order_value: (raw.max_order_value as number)  ?? 0,
  } as ClientDetail;
}

/** Patch parcial del perfil. */
export async function updateClientProfile(
  clientId: string,
  patch: Partial<Omit<ClientDetail, "id" | "role" | "credit_used">>
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", clientId);
  if (error) throw new Error(error.message);
}

/** Órdenes del cliente ordenadas por fecha desc. */
export async function fetchClientOrders(
  clientId: string,
  limit = 50
): Promise<ClientOrder[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_number, total, status, created_at, products")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as ClientOrder[];
}

/** Cotizaciones del cliente. */
export async function fetchClientQuotes(clientId: string): Promise<ClientQuote[]> {
  const { data, error } = await supabase
    .from("quotes")
    .select("id, total, status, currency, created_at, expires_at, converted_to_order_id")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as ClientQuote[];
}

/** Facturas del cliente. */
export async function fetchClientInvoices(clientId: string): Promise<Invoice[]> {
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as Invoice[];
}

/** Movimientos de cuenta corriente. */
export async function fetchAccountMovements(
  clientId: string,
  limit = 200
): Promise<AccountMovement[]> {
  const { data, error } = await supabase
    .from("account_movements")
    .select("*")
    .eq("client_id", clientId)
    .order("fecha", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as AccountMovement[];
}

/** Notas CRM del cliente. */
export async function fetchClientNotes(clientId: string): Promise<ClientNote[]> {
  const { data, error } = await supabase
    .from("client_notes")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as ClientNote[];
}

/** Tickets de soporte del cliente. */
export async function fetchClientSupportTickets(clientId: string, limit = 50): Promise<SupportTicket[]> {
  const { data, error } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("client_id", clientId)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as SupportTicket[];
}

/** RMAs del cliente. */
export async function fetchClientRmas(clientId: string, limit = 30): Promise<ClientRma[]> {
  const { data, error } = await supabase
    .from("rma_requests")
    .select("*")
    .eq("client_id", clientId)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as ClientRma[];
}

/** Agregar nota CRM. */
export async function addClientNote(
  clientId: string,
  body: string,
  tipo: ClientNote["tipo"] = "nota"
): Promise<void> {
  const { error } = await supabase
    .from("client_notes")
    .insert({ client_id: clientId, body, tipo });
  if (error) throw new Error(error.message);
}

/** Registrar un pago (llama al RPC que también reduce credit_used). */
export async function registrarPago(
  clientId: string,
  monto: number,
  descripcion?: string
): Promise<string> {
  const { data, error } = await supabase.rpc("registrar_pago", {
    p_client_id:   clientId,
    p_monto:       monto,
    p_descripcion: descripcion ?? null,
    p_reference_id: null,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

/** Verificar si el cliente puede comprar. */
export async function puedeComprar(clientId: string): Promise<{
  puede: boolean;
  razon?: string;
  disponible?: number;
}> {
  const { data, error } = await supabase.rpc("puede_comprar", {
    p_client_id: clientId,
  });
  if (error) throw new Error(error.message);
  return data as { puede: boolean; razon?: string; disponible?: number };
}

// ── Notifications ──────────────────────────────────────────────────────────────

export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body?: string;
  read: boolean;
  entity_type?: string;
  entity_id?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export async function fetchNotifications(limit = 50): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as AppNotification[];
}

export async function markNotificationsRead(): Promise<void> {
  await supabase.rpc("mark_notifications_read");
}

export async function markOneNotificationRead(id: string): Promise<void> {
  await supabase.from("notifications").update({ read: true }).eq("id", id);
}

/** Registrar movimiento manual (factura, nota de crédito, ajuste). */
export async function registrarMovimiento(
  clientId: string,
  tipo: AccountMovement["tipo"],
  monto: number,
  descripcion?: string,
  referenceId?: string
): Promise<void> {
  const { error } = await supabase
    .from("account_movements")
    .insert({
      client_id:     clientId,
      tipo,
      monto,
      descripcion,
      reference_id:   referenceId ?? null,
      reference_type: tipo,
    });
  if (error) throw new Error(error.message);
}
