import { supabase } from "@/lib/supabase";
import type { ClientType } from "@/lib/supabase";
import type { Invoice } from "@/lib/api/invoices";

// ── Types ──────────────────────────────────────────────────────────────────────

export type ClientEstado = "activo" | "inactivo" | "bloqueado";
export type PrecioLista  = "standard" | "mayorista" | "distribuidor" | "especial";

export interface ClientDetail {
  id: string;
  company_name: string;
  contact_name: string;
  client_type: ClientType;
  default_margin: number;
  role: string;
  phone?: string;
  credit_limit: number;
  credit_used: number;
  // campos nuevos (016)
  estado: ClientEstado;
  vendedor_id?: string;
  precio_lista: PrecioLista;
  razon_social?: string;
  cuit?: string;
  direccion?: string;
  ciudad?: string;
  provincia?: string;
  notas_internas?: string;
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

// ── Queries ────────────────────────────────────────────────────────────────────

/** Perfil completo del cliente (incluye campos de la migración 016). */
export async function fetchClientProfile(clientId: string): Promise<ClientDetail> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, company_name, contact_name, client_type, default_margin, role, phone, " +
      "credit_limit, credit_used, estado, vendedor_id, precio_lista, " +
      "razon_social, cuit, direccion, ciudad, provincia, notas_internas"
    )
    .eq("id", clientId)
    .single();
  if (error) throw new Error(error.message);
  return data as ClientDetail;
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
